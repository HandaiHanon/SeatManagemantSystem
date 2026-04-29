import type { Seat } from "./types";

/**
 * コンサート座席推薦アルゴリズム
 *
 * 以下の観点を多角的にスコアリングし、最適な座席グループを推薦する。
 *
 * 1. 視認性スコア (rowScore)
 *    - ステージ(前方)に近すぎると見上げる姿勢で首が疲れる
 *    - 遠すぎると表情や演出の細部が見えない
 *    - 最適ゾーン: 全体の30~55%付近（やや前寄りの中央）
 *
 * 2. 中央性スコア (centerScore)
 *    - 中央列ほど視野角が均等で音のバランスも良い
 *    - 端席は視界が斜めになり没入感が下がる
 *
 * 3. 集客密度スコア (clusterScore)
 *    - 既に人がいる席の近くを優先（孤立させない）
 *    - 客同士が近いと一体感・盛り上がりが生まれる
 *    - 空いた会場でバラバラに座るのを防ぐ
 *
 * 4. ギャップペナルティ (gapPenalty)
 *    - 配置後に「1席だけ空き」が残ると後から埋めにくい
 *    - 使えない死に席の発生を防ぐ
 *
 * 5. 通路アクセスボーナス (aisleBonus)
 *    - 曲間に素早く案内するため、通路側は案内しやすい
 *    - ただし重みは控えめ（利便性 < 体験品質）
 */

// ─── スコアリング重み ───
const W_ROW = 30;       // 視認性（行位置）
const W_CENTER = 25;    // 中央性（列位置）
const W_CLUSTER = 25;   // 集客密度（隣接の埋まり具合）
const W_GAP = 15;       // ギャップ回避
const W_AISLE = 5;      // 通路アクセス

// ─── ヘルパー ───

/** 全候補（同一行内の連続N席）を列挙 */
function findAllCandidates(seats: Seat[], count: number): Seat[][] {
  const rows = [...new Set(seats.map((s) => s.row))].sort();
  const candidates: Seat[][] = [];

  for (const row of rows) {
    const rowSeats = seats
      .filter((s) => s.row === row && s.type === "normal" && s.status === "available")
      .sort((a, b) => a.col - b.col);

    // スライディングウィンドウで連続席を列挙
    let window: Seat[] = [];
    for (const seat of rowSeats) {
      if (
        window.length === 0 ||
        seat.col === window[window.length - 1].col + 1
      ) {
        window.push(seat);
      } else {
        window = [seat];
      }

      if (window.length >= count) {
        // window末尾からcount個を取る（全パターン出す）
        candidates.push(window.slice(window.length - count));
      }
    }
  }

  return candidates;
}

/** ガウス曲線: peakで最大1、distanceが離れると減衰 */
function gaussian(value: number, peak: number, sigma: number): number {
  return Math.exp(-0.5 * ((value - peak) / sigma) ** 2);
}

// ─── 個別スコア関数 ───

/**
 * 1. 視認性スコア: 行位置の最適度
 *    全行数に対する相対位置で評価。ピークは35~50%付近。
 */
function calcRowScore(group: Seat[], allSeats: Seat[]): number {
  const allRows = [...new Set(allSeats.map((s) => s.row))].sort();
  const totalRows = allRows.length;
  if (totalRows <= 1) return 1;

  const rowIndex = allRows.indexOf(group[0].row);
  const relativePos = rowIndex / (totalRows - 1); // 0(最前)~1(最後)

  // ピーク: 0.40 (前寄り中央)、σ=0.35 で広めに分布
  return gaussian(relativePos, 0.40, 0.35);
}

/**
 * 2. 中央性スコア: 列の中央からの距離
 *    グループ中心が列全体の中央に近いほど高スコア。
 */
function calcCenterScore(group: Seat[], allSeats: Seat[]): number {
  const maxCol = Math.max(...allSeats.map((s) => s.col));
  const minCol = Math.min(...allSeats.map((s) => s.col));
  const centerCol = (maxCol + minCol) / 2;
  const span = (maxCol - minCol) / 2 || 1;

  const groupCenter =
    group.reduce((sum, s) => sum + s.col, 0) / group.length;
  const deviation = Math.abs(groupCenter - centerCol) / span; // 0~1

  // 中央=1、端=0に近づくガウス
  return gaussian(deviation, 0, 0.6);
}

/**
 * 3. 集客密度スコア: 周囲に人がいるほど高い
 *    隣接8方向に「使用中」の席があるかをカウント。
 *    序盤(ほぼ空席)の場合は中央寄せを優先するため影響を下げる。
 */
function calcClusterScore(group: Seat[], allSeats: Seat[]): number {
  const occupied = new Set(
    allSeats
      .filter((s) => s.status !== "available" && s.type === "normal")
      .map((s) => `${s.row}:${s.col}`)
  );

  const totalNormal = allSeats.filter((s) => s.type === "normal").length;
  const occupiedCount = occupied.size;
  const occupancyRate = occupiedCount / totalNormal;

  // 完全に空の会場では clusterScore の影響を大幅に下げる
  if (occupiedCount === 0) return 0.5; // ニュートラル

  const allRows = [...new Set(allSeats.map((s) => s.row))].sort();

  let adjacentCount = 0;
  let totalChecked = 0;

  for (const seat of group) {
    const rowIdx = allRows.indexOf(seat.row);
    // 上下左右+斜めの8方向をチェック
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const neighborRow = allRows[rowIdx + dr];
        if (!neighborRow) continue;
        const neighborCol = seat.col + dc;
        totalChecked++;
        if (occupied.has(`${neighborRow}:${neighborCol}`)) {
          adjacentCount++;
        }
      }
    }
  }

  const rawScore = totalChecked > 0 ? adjacentCount / totalChecked : 0;

  // 埋まり具合に応じてクラスタリングの重要度を上げる
  // 序盤は影響小、中盤以降は影響大
  const importance = Math.min(1, occupancyRate * 2.5);
  return rawScore * importance + 0.5 * (1 - importance);
}

/**
 * 4. ギャップペナルティ: 配置後に1席だけの空きが生じるか
 *    グループの左右に「1席だけ空き→壁or使用中」のパターンを検出。
 */
function calcGapScore(group: Seat[], allSeats: Seat[]): number {
  const row = group[0].row;
  const rowSeats = allSeats
    .filter((s) => s.row === row && s.type === "normal")
    .sort((a, b) => a.col - b.col);

  const groupCols = new Set(group.map((s) => s.col));

  // 配置後の状態をシミュレート
  const statusAfter = (col: number): string => {
    const seat = rowSeats.find((s) => s.col === col);
    if (!seat) return "wall";
    if (groupCols.has(col)) return "occupied";
    return seat.status === "available" ? "available" : "occupied";
  };

  const minCol = Math.min(...rowSeats.map((s) => s.col));
  const maxCol = Math.max(...rowSeats.map((s) => s.col));

  let singleGaps = 0;
  for (let c = minCol; c <= maxCol; c++) {
    if (statusAfter(c) === "available") {
      const left = statusAfter(c - 1);
      const right = statusAfter(c + 1);
      // 左右どちらも壁or使用中 → 1席だけの死に席
      if (left !== "available" && right !== "available") {
        singleGaps++;
      }
    }
  }

  // ペナルティ: 死に席が多いほど低スコア
  return Math.max(0, 1 - singleGaps * 0.4);
}

/**
 * 5. 通路アクセスボーナス: 端列(通路側)に近いと案内しやすい
 */
function calcAisleScore(group: Seat[], allSeats: Seat[]): number {
  const maxCol = Math.max(...allSeats.map((s) => s.col));
  const minCol = Math.min(...allSeats.map((s) => s.col));

  const groupMin = Math.min(...group.map((s) => s.col));
  const groupMax = Math.max(...group.map((s) => s.col));

  // 端に隣接していると高スコア
  const nearLeft = groupMin <= minCol + 1 ? 1 : 0;
  const nearRight = groupMax >= maxCol - 1 ? 1 : 0;

  return (nearLeft + nearRight) > 0 ? 0.7 : 0.3;
}

// ─── メイン推薦関数 ───

export interface ScoredCandidate {
  seats: Seat[];
  score: number;
  breakdown: {
    row: number;
    center: number;
    cluster: number;
    gap: number;
    aisle: number;
  };
}

/**
 * count人分の最適な座席グループを推薦する。
 * 全候補をスコアリングし、上位を返す。
 */
export function recommendSeats(
  allSeats: Seat[],
  count: number,
  topN: number = 1
): ScoredCandidate[] {
  const candidates = findAllCandidates(allSeats, count);
  if (candidates.length === 0) return [];

  const scored: ScoredCandidate[] = candidates.map((group) => {
    const row = calcRowScore(group, allSeats);
    const center = calcCenterScore(group, allSeats);
    const cluster = calcClusterScore(group, allSeats);
    const gap = calcGapScore(group, allSeats);
    const aisle = calcAisleScore(group, allSeats);

    const score =
      row * W_ROW +
      center * W_CENTER +
      cluster * W_CLUSTER +
      gap * W_GAP +
      aisle * W_AISLE;

    return {
      seats: group,
      score,
      breakdown: { row, center, cluster, gap, aisle },
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}

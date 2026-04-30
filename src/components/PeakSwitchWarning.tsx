interface Props {
  discrepancy: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PeakSwitchWarning({ discrepancy, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5">
        <h3 className="text-lg font-bold text-red-600 mb-3">
          未入力データがあります
        </h3>
        <p className="text-sm text-gray-700 mb-2">
          消化済みキューのうち <strong className="text-red-600">{discrepancy}名分</strong> が座席マップに未反映です。
        </p>
        <p className="text-sm text-gray-500 mb-5">
          座席マップで「なぞり入力」を使い、実際の着席状況を反映してからモードを切り替えてください。
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
          >
            強制解除
          </button>
        </div>
      </div>
    </div>
  );
}

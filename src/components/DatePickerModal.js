"use client";

export default function DatePickerModal({ open, mode = "single", initialDate = "", initialFrom = "", initialTo = "", onSelect, onClose, title = "Choose Date" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="text-gray-600">✕</button>
        </div>
        {mode === "single" ? (
          <div className="space-y-3">
            <input type="date" defaultValue={initialDate} className="w-full px-3 py-3 rounded-lg border" id="singleDateInput" />
            <button
              onClick={() => {
                const el = document.getElementById("singleDateInput");
                const val = el && el.value ? el.value : "";
                if (val) onSelect({ date: val });
              }}
              className="w-full px-4 py-3 rounded-lg text-white font-semibold bg-[#EDC381]"
            >Select</button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-sm font-semibold mb-1">From</label>
                <input type="date" defaultValue={initialFrom} className="w-full px-3 py-3 rounded-lg border" id="rangeFromInput" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">To</label>
                <input type="date" defaultValue={initialTo} className="w-full px-3 py-3 rounded-lg border" id="rangeToInput" />
              </div>
            </div>
            <button
              onClick={() => {
                const f = document.getElementById("rangeFromInput");
                const t = document.getElementById("rangeToInput");
                const from = f && f.value ? f.value : "";
                const to = t && t.value ? t.value : "";
                if (from && to) onSelect({ from, to });
              }}
              className="w-full px-4 py-3 rounded-lg text-white font-semibold bg-[#EDC381]"
            >Select Range</button>
          </div>
        )}
      </div>
    </div>
  );
}



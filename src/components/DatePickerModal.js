"use client";

import { useState } from 'react';
import colors from '@/app/colors';
import { CalendarGrid } from '@/components/StyledDateInput';

function parseInitial(str) {
  if (!str) return null;
  const p = str.split('-');
  if (p.length < 3) return null;
  return { year: parseInt(p[0]), month: parseInt(p[1]) - 1, day: parseInt(p[2]) };
}

function fmtVal(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function DatePickerModal({ open, mode = "single", initialDate = "", initialFrom = "", initialTo = "", onSelect, onClose, title = "Choose Date" }) {
  const now = new Date();
  const parsedInit = parseInitial(initialDate);
  const parsedFrom = parseInitial(initialFrom);
  const parsedTo = parseInitial(initialTo);

  const [singleDate, setSingleDate] = useState(parsedInit);
  const [singleView, setSingleView] = useState({ y: parsedInit?.year || now.getFullYear(), m: parsedInit?.month ?? now.getMonth() });

  const [fromDate, setFromDate] = useState(parsedFrom);
  const [fromView, setFromView] = useState({ y: parsedFrom?.year || now.getFullYear(), m: parsedFrom?.month ?? now.getMonth() });
  const [toDate, setToDate] = useState(parsedTo);
  const [toView, setToView] = useState({ y: parsedTo?.year || now.getFullYear(), m: parsedTo?.month ?? now.getMonth() });
  const [rangeStep, setRangeStep] = useState('from');

  if (!open) return null;

  if (mode === "single") {
    return (
      <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="bg-white rounded-2xl w-full max-w-[340px] mx-4 overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-4 pt-4">
            <h3 className="text-base font-bold" style={{ color: colors.text }}>{title}</h3>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full active:bg-gray-100" style={{ color: colors.muted }}>✕</button>
          </div>
          <CalendarGrid
            selectedDate={singleDate}
            onSelectDate={(y, m, d) => {
              setSingleDate({ year: y, month: m, day: d });
              onSelect({ date: fmtVal(y, m, d) });
            }}
            viewMonth={singleView.m}
            viewYear={singleView.y}
            onChangeView={(y, m) => setSingleView({ y, m })}
          />
        </div>
      </div>
    );
  }

  const fmtLabel = (d) => d ? `${SHORT_MONTHS[d.month]} ${d.day}, ${d.year}` : '—';

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl w-full max-w-[340px] mx-4 overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 pt-4">
          <h3 className="text-base font-bold" style={{ color: colors.text }}>{title}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full active:bg-gray-100" style={{ color: colors.muted }}>✕</button>
        </div>

        {/* Range tab selector */}
        <div className="flex gap-2 px-4 pt-3">
          <button
            type="button"
            onClick={() => setRangeStep('from')}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              backgroundColor: rangeStep === 'from' ? colors.primaryGreen : colors.surface,
              color: rangeStep === 'from' ? '#fff' : colors.text,
            }}
          >
            From: {fmtLabel(fromDate)}
          </button>
          <button
            type="button"
            onClick={() => setRangeStep('to')}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              backgroundColor: rangeStep === 'to' ? colors.primaryGreen : colors.surface,
              color: rangeStep === 'to' ? '#fff' : colors.text,
            }}
          >
            To: {fmtLabel(toDate)}
          </button>
        </div>

        {rangeStep === 'from' ? (
          <CalendarGrid
            selectedDate={fromDate}
            onSelectDate={(y, m, d) => { setFromDate({ year: y, month: m, day: d }); setRangeStep('to'); }}
            viewMonth={fromView.m}
            viewYear={fromView.y}
            onChangeView={(y, m) => setFromView({ y, m })}
          />
        ) : (
          <CalendarGrid
            selectedDate={toDate}
            onSelectDate={(y, m, d) => setToDate({ year: y, month: m, day: d })}
            viewMonth={toView.m}
            viewYear={toView.y}
            onChangeView={(y, m) => setToView({ y, m })}
          />
        )}

        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={() => {
              if (fromDate && toDate) {
                onSelect({ from: fmtVal(fromDate.year, fromDate.month, fromDate.day), to: fmtVal(toDate.year, toDate.month, toDate.day) });
              }
            }}
            disabled={!fromDate || !toDate}
            className="w-full py-3 rounded-xl text-white font-semibold text-base transition-all active:scale-95 disabled:opacity-40"
            style={{ backgroundColor: colors.gold }}
          >
            Select Range
          </button>
        </div>
      </div>
    </div>
  );
}

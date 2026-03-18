'use client';

import { useState, useRef, useEffect } from 'react';
import colors from '@/app/colors';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKDAYS = ['S','M','T','W','T','F','S'];

function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDayOfWeek(y, m) { return new Date(y, m, 1).getDay(); }

function parseDate(str) {
  if (!str) return null;
  const p = str.split('T')[0].split('-');
  if (p.length < 3) return null;
  const year = parseInt(p[0]), month = parseInt(p[1]) - 1, day = parseInt(p[2]);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return { year, month, day };
}

function parseDateTime(str) {
  if (!str) return null;
  const date = parseDate(str);
  if (!date) return null;
  const timePart = str.includes('T') ? str.split('T')[1] : null;
  if (timePart) {
    const [h, m] = timePart.split(':');
    return { ...date, hour: parseInt(h) || 0, minute: parseInt(m) || 0 };
  }
  return { ...date, hour: 0, minute: 0 };
}

function fmtDateVal(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function fmtDateTimeVal(y, m, d, h, min) {
  return `${fmtDateVal(y, m, d)}T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function fmtDisplay(y, m, d) {
  return `${SHORT_MONTHS[m]} ${d}, ${y}`;
}

function fmtDisplayDT(y, m, d, h, min) {
  return `${fmtDisplay(y, m, d)}  ${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function snapMinute(m) {
  return Math.round(m / 5) * 5 % 60;
}

// ────────────────────────────────────────────
// PickerModal
// ────────────────────────────────────────────

function PickerModal({ open, onClose, children }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center transition-colors duration-200"
      style={{ backgroundColor: visible ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-[340px] mx-4 overflow-hidden shadow-2xl transition-all duration-200"
        style={{
          transform: visible ? 'scale(1)' : 'scale(0.95)',
          opacity: visible ? 1 : 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// CalendarGrid
// ────────────────────────────────────────────

export function CalendarGrid({ selectedDate, onSelectDate, viewMonth, viewYear, onChangeView }) {
  const today = new Date();
  const tY = today.getFullYear(), tM = today.getMonth(), tD = today.getDate();

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);
  const prevMonthDays = getDaysInMonth(viewYear, viewMonth === 0 ? 11 : viewMonth - 1);

  const goPrev = () => {
    const m = viewMonth === 0 ? 11 : viewMonth - 1;
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    onChangeView(y, m);
  };
  const goNext = () => {
    const m = viewMonth === 11 ? 0 : viewMonth + 1;
    const y = viewMonth === 11 ? viewYear + 1 : viewYear;
    onChangeView(y, m);
  };

  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: prevMonthDays - i, current: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, current: true });
  const rem = 42 - cells.length;
  for (let d = 1; d <= rem; d++) cells.push({ day: d, current: false });

  const isToday = (d) => tY === viewYear && tM === viewMonth && tD === d;
  const isSel = (d) => selectedDate && selectedDate.year === viewYear && selectedDate.month === viewMonth && selectedDate.day === d;

  return (
    <div className="px-4 pt-5 pb-3">
      {/* Month/Year header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={goPrev} type="button" className="w-10 h-10 rounded-full flex items-center justify-center active:bg-gray-100">
          <svg width="20" height="20" fill="none" viewBox="0 0 20 20"><path d="M12.5 15L7.5 10L12.5 5" stroke={colors.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <span className="text-base font-bold" style={{ color: colors.text }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button onClick={goNext} type="button" className="w-10 h-10 rounded-full flex items-center justify-center active:bg-gray-100">
          <svg width="20" height="20" fill="none" viewBox="0 0 20 20"><path d="M7.5 15L12.5 10L7.5 5" stroke={colors.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="h-8 flex items-center justify-center text-xs font-semibold" style={{ color: colors.muted }}>{w}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {cells.map((c, i) => {
          if (!c.current) {
            return <div key={i} className="h-11 flex items-center justify-center"><span className="text-sm" style={{ color: '#ddd' }}>{c.day}</span></div>;
          }
          const sel = isSel(c.day);
          const tod = isToday(c.day);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectDate(viewYear, viewMonth, c.day)}
              className="h-11 flex items-center justify-center rounded-full transition-all duration-100 active:scale-90"
              style={{
                backgroundColor: sel ? colors.primaryGreen : 'transparent',
                color: sel ? '#fff' : colors.text,
                boxShadow: tod && !sel ? `inset 0 0 0 2px ${colors.primaryGreen}` : 'none',
                fontWeight: sel || tod ? 600 : 400,
              }}
            >
              <span className="text-sm">{c.day}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// TimeScroller
// ────────────────────────────────────────────

function TimeScroller({ hour, minute, onChangeHour, onChangeMinute }) {
  const hourRef = useRef(null);
  const minRef = useRef(null);

  useEffect(() => {
    [hourRef, minRef].forEach(ref => {
      if (ref.current) {
        const el = ref.current.querySelector('[data-active="true"]');
        if (el) el.scrollIntoView({ block: 'center', behavior: 'auto' });
      }
    });
  }, []);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);

  const renderCol = (items, selected, onSelect, ref, label) => (
    <div className="flex-1 min-w-0">
      <div className="text-xs font-semibold text-center mb-1.5 tracking-wide uppercase" style={{ color: colors.muted }}>{label}</div>
      <div
        ref={ref}
        className="h-40 overflow-y-auto rounded-xl"
        style={{ backgroundColor: colors.surface }}
      >
        {items.map(v => {
          const active = v === selected;
          return (
            <button
              key={v}
              type="button"
              data-active={active}
              onClick={() => onSelect(v)}
              className="w-full py-2.5 text-center text-sm font-medium transition-colors duration-100"
              style={{
                backgroundColor: active ? colors.primaryGreen : 'transparent',
                color: active ? '#fff' : colors.text,
                borderRadius: active ? 8 : 0,
              }}
            >
              {String(v).padStart(2, '0')}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex gap-4 px-4 py-3">
      {renderCol(hours, hour, onChangeHour, hourRef, 'Hour')}
      {renderCol(minutes, minute, onChangeMinute, minRef, 'Min')}
    </div>
  );
}

// ────────────────────────────────────────────
// Shared input display field
// ────────────────────────────────────────────

function InputField({ displayValue, placeholder, disabled, onClick, className, style, id, name, rawValue }) {
  return (
    <div className="relative">
      {/* Hidden native input preserves id/name/value for DOM access and form submission */}
      <input type="hidden" id={id} name={name} value={rawValue || ''} readOnly />
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`w-full px-3 py-3 rounded-xl border text-base text-left transition-all duration-200 outline-none flex items-center justify-between gap-2 ${className || ''}`}
        style={{
          borderColor: colors.gray400,
          color: displayValue ? colors.text : colors.muted,
          backgroundColor: disabled ? '#f3f4f6' : '#fff',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.7 : 1,
          ...(style || {}),
        }}
      >
        <span className="truncate">{displayValue || placeholder || 'Select date'}</span>
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="flex-shrink-0">
          <rect x="3" y="4.5" width="16" height="14" rx="2.5" stroke={disabled ? '#bbb' : colors.primaryGreen} strokeWidth="1.5"/>
          <path d="M3 9H19" stroke={disabled ? '#bbb' : colors.primaryGreen} strokeWidth="1.5"/>
          <path d="M7.5 2.5V5.5" stroke={disabled ? '#bbb' : colors.primaryGreen} strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M14.5 2.5V5.5" stroke={disabled ? '#bbb' : colors.primaryGreen} strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="8" cy="13" r="1" fill={disabled ? '#bbb' : colors.primaryGreen}/>
          <circle cx="11" cy="13" r="1" fill={disabled ? '#bbb' : colors.primaryGreen}/>
          <circle cx="14" cy="13" r="1" fill={disabled ? '#bbb' : colors.primaryGreen}/>
        </svg>
      </button>
    </div>
  );
}

// ────────────────────────────────────────────
// StyledDateInput (date only, exported)
// ────────────────────────────────────────────

export function StyledDateInput({ value, defaultValue, onChange, name, id, disabled, required, className, style }) {
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState(defaultValue || '');

  const cur = value !== undefined ? value : internal;
  const parsed = parseDate(cur);

  const [vY, setVY] = useState(() => parsed?.year || new Date().getFullYear());
  const [vM, setVM] = useState(() => parsed?.month ?? new Date().getMonth());

  const handleOpen = () => {
    if (disabled) return;
    const p = parseDate(cur);
    if (p) { setVY(p.year); setVM(p.month); }
    else { setVY(new Date().getFullYear()); setVM(new Date().getMonth()); }
    setOpen(true);
  };

  const handleSelect = (y, m, d) => {
    const val = fmtDateVal(y, m, d);
    if (value === undefined) setInternal(val);
    onChange?.({ target: { value: val, name: name || '' } });
    setOpen(false);
  };

  return (
    <>
      <InputField
        displayValue={parsed ? fmtDisplay(parsed.year, parsed.month, parsed.day) : ''}
        placeholder="Select date"
        disabled={disabled}
        onClick={handleOpen}
        className={className}
        style={style}
        id={id}
        name={name}
        rawValue={cur}
      />
      <PickerModal open={open} onClose={() => setOpen(false)}>
        <CalendarGrid
          selectedDate={parsed}
          onSelectDate={handleSelect}
          viewMonth={vM}
          viewYear={vY}
          onChangeView={(y, m) => { setVY(y); setVM(m); }}
        />
        <div className="px-4 pb-4 flex gap-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex-1 py-2.5 rounded-xl font-semibold text-sm border-2 transition-all active:scale-95"
            style={{ borderColor: colors.gray400, color: colors.text }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const t = new Date();
              handleSelect(t.getFullYear(), t.getMonth(), t.getDate());
            }}
            className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95"
            style={{ backgroundColor: colors.primaryGreen, color: '#fff' }}
          >
            Today
          </button>
        </div>
      </PickerModal>
    </>
  );
}

// ────────────────────────────────────────────
// StyledDateTimeInput (date + time, exported)
// ────────────────────────────────────────────

export function StyledDateTimeInput({ value, defaultValue, onChange, name, id, disabled, required, className, style }) {
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState(defaultValue || '');

  const cur = value !== undefined ? value : internal;
  const parsed = parseDateTime(cur);

  const [vY, setVY] = useState(() => parsed?.year || new Date().getFullYear());
  const [vM, setVM] = useState(() => parsed?.month ?? new Date().getMonth());
  const [selDate, setSelDate] = useState(null);
  const [selH, setSelH] = useState(12);
  const [selMin, setSelMin] = useState(0);

  const handleOpen = () => {
    if (disabled) return;
    const p = parseDateTime(cur);
    if (p) {
      setVY(p.year); setVM(p.month);
      setSelDate({ year: p.year, month: p.month, day: p.day });
      setSelH(p.hour); setSelMin(snapMinute(p.minute));
    } else {
      const now = new Date();
      setVY(now.getFullYear()); setVM(now.getMonth());
      setSelDate(null);
      setSelH(now.getHours()); setSelMin(snapMinute(now.getMinutes()));
    }
    setOpen(true);
  };

  const handleConfirm = () => {
    if (!selDate) return;
    const val = fmtDateTimeVal(selDate.year, selDate.month, selDate.day, selH, selMin);
    if (value === undefined) setInternal(val);
    onChange?.({ target: { value: val, name: name || '' } });
    setOpen(false);
  };

  return (
    <>
      <InputField
        displayValue={parsed ? fmtDisplayDT(parsed.year, parsed.month, parsed.day, parsed.hour, parsed.minute) : ''}
        placeholder="Select date & time"
        disabled={disabled}
        onClick={handleOpen}
        className={className}
        style={style}
        id={id}
        name={name}
        rawValue={cur}
      />
      <PickerModal open={open} onClose={() => setOpen(false)}>
        <CalendarGrid
          selectedDate={selDate}
          onSelectDate={(y, m, d) => setSelDate({ year: y, month: m, day: d })}
          viewMonth={vM}
          viewYear={vY}
          onChangeView={(y, m) => { setVY(y); setVM(m); }}
        />
        <div className="border-t" style={{ borderColor: colors.gray400 + '60' }}>
          <TimeScroller hour={selH} minute={selMin} onChangeHour={setSelH} onChangeMinute={setSelMin} />
        </div>
        <div className="px-4 pb-4 flex gap-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex-1 py-3 rounded-xl font-semibold text-sm border-2 transition-all active:scale-95"
            style={{ borderColor: colors.gray400, color: colors.text }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selDate}
            className="flex-1 py-3 rounded-xl font-semibold text-sm text-white transition-all active:scale-95 disabled:opacity-40"
            style={{ backgroundColor: colors.gold }}
          >
            Confirm
          </button>
        </div>
      </PickerModal>
    </>
  );
}

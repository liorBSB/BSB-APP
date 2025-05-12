import { useState } from 'react';
import colors from '../../app/colors';

export default function CollapsibleSection({ title, children, defaultOpen = false, headerBg = `rgba(0,0,0,0.28)`, headerText = colors.gold, contentBg = `rgba(0,0,0,0.18)` }) {
  const [open, setOpen] = useState(defaultOpen);
  const childrenArray = Array.isArray(children) ? children : [children];

  return (
    <div className="mb-4">
      <div
        className="flex items-center px-4 py-2 rounded-t-lg shadow-sm select-none cursor-pointer"
        style={{ background: headerBg, color: headerText }}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="font-semibold text-base">{title}</span>
      </div>
      <div className="rounded-b-lg p-4" style={{ background: contentBg }}>
        {open ? childrenArray : childrenArray[0]}
      </div>
    </div>
  );
} 
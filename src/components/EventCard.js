import React from 'react';
import colors from '../app/colors';

export default function EventCard({ icon, title, subtitle, children }) {
  return (
    <div className="relative mb-3 bg-white rounded-lg shadow p-4 flex items-center gap-3">
      <span className="text-2xl">{icon}</span>
      <div className="flex-1">
        <div className="font-bold text-lg text-[#076332]">{title}</div>
        {subtitle && <div className="text-sm text-gray-700">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
} 
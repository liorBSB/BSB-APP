"use client";

import { useRouter } from 'next/navigation';
import colors from '../app/colors';

const icons = {
  report: (
    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z"/></svg>
  ),
  add: (
    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
  ),
  home: (
    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5L12 4l9 6.5"/><path d="M5 10v9a1 1 0 001 1h12a1 1 0 001-1v-9"/></svg>
  ),
  soldiers: (
    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="4"/><circle cx="16" cy="8" r="4"/><rect x="2" y="16" width="20" height="6" rx="3"/></svg>
  ),
  settings: (
    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33h.09a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51h.09a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.09a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
  ),
  expenses: (
    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 14h4"/></svg>
  ),
};

export default function AdminBottomNavBar({ active }) {
  const router = useRouter();

  const navItems = [
    { key: 'report', label: 'Reports', path: '/admin/report', icon: icons.report },
    { key: 'expenses', label: 'Expenses', path: '/admin/expenses', icon: icons.expenses },
    { key: 'home', label: 'Home', path: '/admin/home', icon: icons.home },
    { key: 'soldiers', label: 'Soldiers', path: '/admin/soldiers', icon: icons.soldiers },
    { key: 'settings', label: 'Settings', path: '/admin/settings', icon: icons.settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full max-w-md mx-auto bg-white rounded-t-2xl shadow-lg flex justify-between items-center px-2 py-2 z-50" style={{ right: 0, left: 0 }}>
      {navItems.map(tab => (
        <button
          key={tab.key}
          onClick={() => router.push(tab.path)}
          className="flex flex-col items-center flex-1 focus:outline-none"
        >
          <div className={`flex items-center justify-center ${tab.key === active ? 'bg-[#EDC381] text-white' : 'text-gray-700'} rounded-full ${tab.key === active ? 'w-12 h-12 -mt-8 shadow-lg' : 'w-8 h-8'} transition-all duration-200`}>
            {tab.icon}
          </div>
          <span className={`text-xs mt-1 ${tab.key === active ? 'font-bold text-[#EDC381]' : 'text-gray-700'}`}>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
} 
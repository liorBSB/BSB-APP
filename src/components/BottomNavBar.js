import { useTranslation } from 'react-i18next';
import { useRouter, usePathname } from 'next/navigation';
import i18n from '@/i18n';

const icons = {
  report: (
    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z"/></svg>
  ),
  home: (
    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5L12 4l9 6.5"/><path d="M5 10v9a1 1 0 001 1h12a1 1 0 001-1v-9"/></svg>
  ),
  settings: (
    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33h.09a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51h.09a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.09a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
  ),
};

export default function BottomNavBar({ active }) {
  const { t } = useTranslation('home');
  const router = useRouter();
  const pathname = usePathname();
  const isRTL = i18n.language === 'he';

  const tabs = [
    { key: 'report', label: t('report'), href: '/report', icon: icons.report },
    { key: 'home', label: t('home'), href: '/home', icon: icons.home },
    { key: 'settings', label: t('settings'), href: '/settings', icon: icons.settings },
  ];
  const navTabs = isRTL ? [...tabs].reverse() : tabs;

  return (
    <nav className="fixed bottom-0 left-0 w-full max-w-md mx-auto bg-white rounded-t-2xl shadow-lg flex justify-between items-center px-4 py-2 z-50" style={{ right: 0, left: 0 }}>
      {navTabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => router.push(tab.href)}
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
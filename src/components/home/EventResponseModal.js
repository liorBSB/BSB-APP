import React from 'react';
import { useTranslation } from 'react-i18next';
import colors from '@/app/colors';

const options = [
  { key: 'coming', icon: '✓', bg: colors.primaryGreen, text: '#fff' },
  { key: 'maybe', icon: '?', bg: colors.gold, text: '#fff' },
  { key: 'not_coming', icon: '✕', bg: colors.red, text: '#fff' },
];

export default function EventResponseModal({ open, onClose, onSelect }) {
  const { t } = useTranslation('home');
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="w-full sm:w-auto sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 pb-8 sm:pb-6 relative animate-slide-up"
        style={{ backgroundColor: colors.surface }}
      >
        <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-4 sm:hidden" />

        <button
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full transition-colors"
          style={{ backgroundColor: colors.gray400 + '33' }}
          onClick={onClose}
          aria-label={t('close')}
        >
          <span className="text-gray-500 text-lg leading-none">✕</span>
        </button>

        <h2
          className="text-xl font-bold mb-6 px-2"
          style={{ color: colors.primaryGreen }}
        >
          {t('respond_to_event')}
        </h2>

        <div className="flex flex-col gap-3">
          {options.map(({ key, icon, bg, text }) => (
            <button
              key={key}
              className="w-full py-3.5 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.97] shadow-sm hover:shadow-md"
              style={{ backgroundColor: bg, color: text }}
              onClick={() => onSelect(key)}
            >
              <span className="text-lg leading-none">{icon}</span>
              {t(key)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
} 
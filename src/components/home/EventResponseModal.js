import React from 'react';
import { useTranslation } from 'react-i18next';

export default function EventResponseModal({ open, onClose, onSelect }) {
  const { t } = useTranslation('home');
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-white rounded-xl shadow-lg p-6 w-11/12 max-w-xs text-center relative">
        <button
          className="absolute top-2 right-3 text-gray-400 text-2xl font-bold"
          onClick={onClose}
          aria-label={t('close')}
        >
          ×
        </button>
        <h2 className="text-lg font-semibold mb-4 text-[#076332]">{t('respond_to_event')}</h2>
        <div className="flex flex-col gap-3">
          <button
            className="w-full py-2 rounded-lg font-semibold text-white bg-[#076332]"
            onClick={() => onSelect('coming')}
          >
            {t('coming')}
          </button>
          <button
            className="w-full py-2 rounded-lg font-semibold text-[#fff] bg-[#EDC381]"
            onClick={() => onSelect('maybe')}
          >
            {t('maybe')}
          </button>
          <button
            className="w-full py-2 rounded-lg font-semibold text-[#fff] bg-[#EDC381]"
            onClick={() => onSelect('not_coming')}
          >
            {t('not_coming')}
          </button>
        </div>
      </div>
    </div>
  );
} 
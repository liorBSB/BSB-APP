"use client";
import { useTranslation } from 'react-i18next';
import BottomNavBar from '@/components/BottomNavBar';
import { useState, useEffect } from 'react';

export default function ReportPage() {
  const { t, i18n } = useTranslation('report');
  const [desc, setDesc] = useState('');
  const [photo, setPhoto] = useState(null);

  useEffect(() => {
    // On mount, set language from localStorage if available
    const savedLang = typeof window !== 'undefined' ? localStorage.getItem('lang') : null;
    if (savedLang && savedLang !== i18n.language) {
      i18n.changeLanguage(savedLang);
      document.documentElement.dir = savedLang === 'he' ? 'rtl' : 'ltr';
    }
  }, [i18n]);

  const handleLanguageSwitch = () => {
    const nextLang = i18n.language === 'en' ? 'he' : 'en';
    i18n.changeLanguage(nextLang);
    if (typeof window !== 'undefined') localStorage.setItem('lang', nextLang);
    document.documentElement.dir = nextLang === 'he' ? 'rtl' : 'ltr';
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-200/60 to-green-100/60 font-body flex flex-col items-center pt-6 pb-32 px-4">
      <button
        onClick={handleLanguageSwitch}
        className="absolute top-4 right-4 bg-surface p-2 rounded-full text-muted hover:text-text"
      >
        {i18n.language === 'en' ? 'עברית' : 'EN'}
      </button>
      <div className="w-full max-w-md">
        <div className="rounded-2xl p-6 mb-6 shadow-sm" style={{ background: 'rgba(0,0,0,0.28)' }}>
          <h2 className="text-lg font-bold mb-4 text-[#EDC381]">{t('report_a_problem')}</h2>
          <div className="mb-4">
            <label className="block text-sm mb-1 text-text">{t('describe_problem')}</label>
            <textarea className="w-full border border-muted px-3 py-2 rounded-md text-text bg-background" rows={4} value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
          <div className="mb-4">
            <label className="block text-sm mb-1 text-text">{t('add_photo')}</label>
            <input type="file" accept="image/*" onChange={e => setPhoto(e.target.files[0])} className="w-full" />
          </div>
          <button className="w-full bg-[#EDC381] hover:bg-[#d4b06a] text-white py-2 rounded-md font-semibold">{t('submit')}</button>
        </div>
      </div>
      <BottomNavBar active="report" />
    </main>
  );
} 
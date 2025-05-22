"use client";
import { useTranslation } from 'react-i18next';
import BottomNavBar from '@/components/BottomNavBar';
import { useState, useEffect } from 'react';
import colors from '../colors';

export default function ReportPage() {
  const { t, i18n } = useTranslation('report');
  const [desc, setDesc] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photos, setPhotos] = useState([]);

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
    <main className="min-h-screen bg-gradient-to-br from-blue-200/60 to-green-100/60 font-body flex flex-col items-center pt-10 pb-32 px-2 phone-sm:px-2 phone-md:px-4 phone-lg:px-6">
      <button
        onClick={handleLanguageSwitch}
        className="absolute top-4 right-4 bg-surface p-2 rounded-full text-white text-xl hover:text-text"
      >
        {i18n.language === 'en' ? 'עברית' : 'EN'}
      </button>
      <div className="w-full max-w-md">
        <div className="rounded-3xl p-10 mb-8 shadow-lg flex flex-col items-center" style={{ background: 'rgba(0,0,0,0.38)' }}>
          <h2 className="text-3xl font-extrabold mb-8 text-white text-center tracking-wide">{t('report_a_problem')}</h2>
          <div className="mb-8 w-full">
            <label className="block text-lg mb-2 text-white font-semibold">{t('describe_problem')}</label>
            <textarea className="w-full border border-white/30 px-4 py-3 rounded-xl text-black bg-white text-lg placeholder-black/50 focus:outline-none focus:border-gold transition" rows={5} value={desc} onChange={e => setDesc(e.target.value)} placeholder={t('describe_problem')} style={{ background: colors.white, color: 'black' }} />
          </div>
          <div className="mb-8 w-full flex flex-col items-center">
            <label className="block text-lg mb-2 text-white font-semibold">{t('add_photo')}</label>
            <label className="flex items-center justify-center px-4 py-2 rounded-full cursor-pointer bg-white text-black font-semibold text-base transition hover:bg-gray-100 border border-white/30 mx-auto" style={{ minWidth: 120 }}>
              <input type="file" accept="image/*" multiple onChange={e => {
                const files = Array.from(e.target.files);
                setPhotos(prev => [...prev, ...files]);
              }} className="hidden" />
              Upload File
            </label>
            <div className="mt-4 w-full flex flex-col items-center gap-2">
              {photos.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between bg-white/80 text-black rounded-lg px-3 py-2 w-full max-w-xs shadow">
                  <span className="truncate max-w-[140px]">{file.name}</span>
                  <button
                    className="ml-3 text-red-500 hover:text-red-700 text-lg"
                    onClick={() => setPhotos(photos.filter((_, i) => i !== idx))}
                    aria-label="Remove file"
                  >🗑️</button>
                </div>
              ))}
            </div>
          </div>
          <button className="w-full bg-[#EDC381] hover:bg-[#d4b06a] text-white py-4 rounded-full font-bold text-xl transition">{t('submit')}</button>
        </div>
      </div>
      <BottomNavBar active="report" />
    </main>
  );
} 
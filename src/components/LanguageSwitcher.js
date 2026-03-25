'use client';

import '@/i18n';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import colors from '@/app/colors';
import { setLangCookie } from '@/lib/langCookie';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation('components');

  useEffect(() => {
    const savedLang = typeof window !== 'undefined' ? localStorage.getItem('lang') : null;
    if (savedLang && savedLang !== i18n.language && i18n.changeLanguage) {
      try {
        i18n.changeLanguage(savedLang);
        setLangCookie(savedLang);
        document.documentElement.dir = savedLang === 'he' ? 'rtl' : 'ltr';
      } catch (error) {
        // Silently handle error
      }
    }
  }, [i18n]);

  const switchTo = (lang) => {
    if (lang === i18n.language) return;
    if (i18n.changeLanguage) {
      try {
        i18n.changeLanguage(lang);
        if (typeof window !== 'undefined') localStorage.setItem('lang', lang);
        setLangCookie(lang);
        document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
      } catch (error) {
        // Silently handle error
      }
    }
  };

  const isHebrew = i18n.language === 'he';

  return (
    <div
      className="w-full rounded-2xl p-4 flex items-center justify-between"
      style={{ backgroundColor: colors.surface, direction: 'ltr' }}
    >
      {/* Toggle pill */}
      <div
        className="flex items-center rounded-full p-1 shadow-inner"
        style={{ backgroundColor: colors.white }}
      >
        <button
          onClick={() => switchTo('he')}
          className="flex items-center justify-center w-12 h-10 rounded-full transition-all duration-200"
          style={{
            backgroundColor: isHebrew ? colors.gold : 'transparent',
            boxShadow: isHebrew ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
          }}
        >
          <span className={`text-2xl leading-none transition-all duration-200 ${isHebrew ? '' : 'grayscale opacity-40'}`}>🇮🇱</span>
        </button>
        <button
          onClick={() => switchTo('en')}
          className="flex items-center justify-center w-12 h-10 rounded-full transition-all duration-200"
          style={{
            backgroundColor: !isHebrew ? colors.gold : 'transparent',
            boxShadow: !isHebrew ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
          }}
        >
          <span className={`text-2xl leading-none transition-all duration-200 ${!isHebrew ? '' : 'grayscale opacity-40'}`}>🇺🇸</span>
        </button>
      </div>

      {/* Selected language label */}
      <span className="text-base font-semibold" style={{ color: colors.text }}>
        {isHebrew ? 'עברית' : 'English'}
      </span>
    </div>
  );
}

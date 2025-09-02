'use client';

import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';

export default function LanguageSwitcher({ className = "absolute top-4 right-4 bg-surface p-2 rounded-full text-white text-xl hover:text-text" }) {
  const { i18n } = useTranslation();

  useEffect(() => {
    // On mount, set language from localStorage if available
    const savedLang = typeof window !== 'undefined' ? localStorage.getItem('lang') : null;
    if (savedLang && savedLang !== i18n.language && i18n.changeLanguage) {
      try {
        i18n.changeLanguage(savedLang);
        document.documentElement.dir = savedLang === 'he' ? 'rtl' : 'ltr';
      } catch (error) {
        // Silently handle error to prevent app crash
      }
    }
  }, [i18n]);

  const handleLanguageSwitch = () => {
    const nextLang = i18n.language === 'en' ? 'he' : 'en';
    if (i18n.changeLanguage) {
      try {
        i18n.changeLanguage(nextLang);
        if (typeof window !== 'undefined') localStorage.setItem('lang', nextLang);
        document.documentElement.dir = nextLang === 'he' ? 'rtl' : 'ltr';
      } catch (error) {
        // Silently handle error to prevent app crash
      }
    }
  };

  return (
    <button
      onClick={handleLanguageSwitch}
      className={className}
      aria-label="Switch language"
    >
      {i18n.language === 'en' ? 'עברית' : 'EN'}
    </button>
  );
}

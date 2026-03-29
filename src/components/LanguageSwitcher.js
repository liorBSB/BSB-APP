'use client';

import '@/i18n';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import colors from '@/app/colors';
import { setLangCookie } from '@/lib/langCookie';

export default function LanguageSwitcher({ variant = 'default' }) {
  const isCorner = variant === 'corner';
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

  const btnClass = isCorner
    ? 'flex items-center justify-center w-10 h-9 rounded-full transition-all duration-200'
    : 'flex items-center justify-center w-12 h-10 rounded-full transition-all duration-200';
  const flagClass = isCorner
    ? 'text-xl leading-none transition-all duration-200'
    : 'text-2xl leading-none transition-all duration-200';

  const pill = (
    <div
      className="flex items-center rounded-full p-1 shadow-inner"
      style={{ backgroundColor: colors.white }}
    >
      <button
        type="button"
        onClick={() => switchTo('he')}
        className={btnClass}
        style={{
          backgroundColor: isHebrew ? colors.gold : 'transparent',
          boxShadow: isHebrew ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
        }}
      >
        <span className={`${flagClass} ${isHebrew ? '' : 'grayscale opacity-40'}`}>🇮🇱</span>
      </button>
      <button
        type="button"
        onClick={() => switchTo('en')}
        className={btnClass}
        style={{
          backgroundColor: !isHebrew ? colors.gold : 'transparent',
          boxShadow: !isHebrew ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
        }}
      >
        <span className={`${flagClass} ${!isHebrew ? '' : 'grayscale opacity-40'}`}>🇺🇸</span>
      </button>
    </div>
  );

  const label = (
    <span
      className={isCorner ? 'text-xs font-semibold' : 'text-base font-semibold'}
      style={{ color: colors.text }}
    >
      {isHebrew ? 'עברית' : 'English'}
    </span>
  );

  if (isCorner) {
    return (
      <div
        className="fixed z-[100] flex flex-col items-center gap-1 rounded-2xl p-3 shadow-md pointer-events-auto"
        style={{
          top: 'max(1rem, env(safe-area-inset-top, 0px))',
          right: 'max(1rem, env(safe-area-inset-right, 0px))',
          backgroundColor: colors.surface,
          direction: 'ltr',
        }}
        role="group"
        aria-label="Language"
      >
        {pill}
        {label}
      </div>
    );
  }

  return (
    <div
      className="w-full rounded-2xl p-4 flex items-center justify-between"
      style={{ backgroundColor: colors.surface, direction: 'ltr' }}
    >
      {pill}
      {label}
    </div>
  );
}

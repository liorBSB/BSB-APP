'use client';

import { useLayoutEffect, useRef } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { setLangCookie } from '@/lib/langCookie';

function applyDocumentLang(lng) {
  if (typeof document === 'undefined') return;
  const isHe = lng === 'he' || (typeof lng === 'string' && lng.startsWith('he'));
  document.documentElement.dir = isHe ? 'rtl' : 'ltr';
  document.documentElement.lang = isHe ? 'he' : 'en';
}

/**
 * Align i18n with the locale the server used (cookie) before any child runs t(), then
 * apply localStorage before the first paint (useLayoutEffect) so there is no hydration mismatch.
 */
function DocumentLangSync() {
  useLayoutEffect(() => {
    const sync = () => {
      const saved = localStorage.getItem('lang');
      if (saved === 'en' || saved === 'he') {
        setLangCookie(saved);
        if (saved !== i18n.language) {
          void i18n.changeLanguage(saved);
        }
      }
      applyDocumentLang(i18n.language);
    };

    sync();

    const onChanged = (lng) => {
      applyDocumentLang(lng);
      if (lng === 'he' || lng === 'en') setLangCookie(lng);
    };
    i18n.on('languageChanged', onChanged);
    return () => {
      i18n.off('languageChanged', onChanged);
    };
  }, []);

  return null;
}

export default function I18nProvider({ children, initialLang = 'en' }) {
  const lng = initialLang === 'he' ? 'he' : 'en';
  const appliedServerLang = useRef(false);
  if (!appliedServerLang.current) {
    appliedServerLang.current = true;
    if (i18n.language !== lng) {
      void i18n.changeLanguage(lng);
    }
  }

  return (
    <I18nextProvider i18n={i18n}>
      <DocumentLangSync />
      {children}
    </I18nextProvider>
  );
}

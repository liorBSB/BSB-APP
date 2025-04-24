import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '../public/locales/en/login.json';
import he from '../public/locales/he/login.json';

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      lng: 'en',
      fallbackLng: 'en',
      resources: {
        en: { login: en },
        he: { login: he },
      },
      ns: ['login'],
      defaultNS: 'login',
      interpolation: {
        escapeValue: false,
      },
    });
}

export default i18n;

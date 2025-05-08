import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enHome from '../public/locales/en/home.json';
import heHome from '../public/locales/he/home.json';
import enSettings from '../public/locales/en/settings.json';
import heSettings from '../public/locales/he/settings.json';
import enReport from '../public/locales/en/report.json';
import heReport from '../public/locales/he/report.json';
import enLogin from '../public/locales/en/login.json';
import heLogin from '../public/locales/he/login.json';

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      lng: 'en',
      fallbackLng: 'en',
      resources: {
        en: {
          home: enHome,
          settings: enSettings,
          report: enReport,
          login: enLogin,
        },
        he: {
          home: heHome,
          settings: heSettings,
          report: heReport,
          login: heLogin,
        },
      },
      ns: ['home', 'settings', 'report', 'login'],
      defaultNS: 'home',
      interpolation: {
        escapeValue: false,
      },
    });
}

export default i18n;

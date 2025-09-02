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
import enProfileSetup from '../public/locales/en/profilesetup.json';
import heProfileSetup from '../public/locales/he/profilesetup.json';
import enRegister from '../public/locales/en/register.json';
import heRegister from '../public/locales/he/register.json';
import enAdmin from '../public/locales/en/admin.json';
import heAdmin from '../public/locales/he/admin.json';
import enComponents from '../public/locales/en/components.json';
import heComponents from '../public/locales/he/components.json';

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
          profilesetup: enProfileSetup,
          register: enRegister,
          admin: enAdmin,
          components: enComponents,
        },
        he: {
          home: heHome,
          settings: heSettings,
          report: heReport,
          login: heLogin,
          profilesetup: heProfileSetup,
          register: heRegister,
          admin: heAdmin,
          components: heComponents,
        },
      },
      ns: ['home', 'settings', 'report', 'login', 'profilesetup', 'register', 'admin', 'components'],
      defaultNS: 'home',
      interpolation: {
        escapeValue: false,
      },
    });
}

export default i18n;

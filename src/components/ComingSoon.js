'use client';

import '@/i18n';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import colors from '@/app/colors';

export default function ComingSoon({ navBar }) {
  const { t } = useTranslation('report');
  const isRTL = i18n.language === 'he';

  return (
    <div
      className="min-h-screen flex flex-col"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{ backgroundColor: colors.background }}
    >
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ backgroundColor: `${colors.gold}22` }}
        >
          <span className="text-4xl">🚧</span>
        </div>
        <h1
          className="text-2xl font-bold mb-3"
          style={{ color: colors.text }}
        >
          {t('comingSoonTitle')}
        </h1>
        <p
          className="text-base max-w-xs"
          style={{ color: colors.muted }}
        >
          {t('comingSoonSubtitle')}
        </p>
      </div>
      {navBar}
    </div>
  );
}

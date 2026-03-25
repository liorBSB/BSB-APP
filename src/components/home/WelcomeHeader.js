'use client';

import { useTranslation } from 'react-i18next';
import { auth } from '@/lib/firebase';
import colors from '@/app/colors';

export default function WelcomeHeader({ status, userData, isRTL = false }) {
  const { t } = useTranslation('home');
  const user = auth.currentUser;

  return (
    <div
      className="w-full max-w-md rounded-2xl px-5 pt-6 pb-4 mb-6 bg-white/10 backdrop-blur-md shadow-sm"
      style={{ border: `1px solid ${colors.gold}` }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="flex justify-between items-start">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-text" dir="auto">
            {t('welcome')}, {userData?.fullName || user?.displayName || 'Soldier'}
          </h1>
          <p className="text-sm text-muted">
            {t('room')} {userData?.roomNumber || '---'} • {t(status)}
          </p>
        </div>
      </div>
    </div>
  );
}

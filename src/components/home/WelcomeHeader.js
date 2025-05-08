'use client';

import { useTranslation } from 'react-i18next';
import { auth } from '@/lib/firebase';

export default function WelcomeHeader({ status, userData }) {
  const { t } = useTranslation('home'); // ✅ this was missing
  const user = auth.currentUser;

  return (
    <div className="w-full max-w-md rounded-2xl px-5 pt-6 pb-4 mb-6 bg-white/10 backdrop-blur-md shadow-sm">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold text-text">
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

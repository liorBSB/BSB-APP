'use client';

import '@/i18n';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import AdminBottomNavBar from '@/components/AdminBottomNavBar';
import SoldierManagement from '@/components/SoldierManagement';
import HouseLoader from '@/components/HouseLoader';
import useAuthRedirect from '@/hooks/useAuthRedirect';

export default function AdminSoldiersPage() {
  const { t } = useTranslation('admin');
  const router = useRouter();
  const { isReady, userData: adminData } = useAuthRedirect({ requireRole: 'admin', fetchUserData: true, redirectIfIncomplete: true });

  if (!isReady) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-200/60 to-green-100/60 font-body flex items-center justify-center">
        <HouseLoader size={80} text={t('loading')} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-200/60 to-green-100/60 font-body flex flex-col items-center pt-6 pb-32 px-4">
      <div className="w-full max-w-6xl">

        {/* Soldier Management Component */}
        <SoldierManagement />
      </div>

      {/* Admin Bottom Navigation */}
      <AdminBottomNavBar active="soldiers" />
    </main>
  );
}

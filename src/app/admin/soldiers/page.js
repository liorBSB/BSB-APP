'use client';

import '@/i18n';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import AdminBottomNavBar from '@/components/AdminBottomNavBar';
import SoldierManagement from '@/components/SoldierManagement';
import HouseLoader from '@/components/HouseLoader';

export default function AdminSoldiersPage() {
  const { t } = useTranslation('admin');
  const router = useRouter();
  const [adminData, setAdminData] = useState(null);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);

  // Check if admin profile is complete
  const checkAdminProfileComplete = (userData) => {
    if (!userData) return false;
    return !!(userData.firstName && userData.lastName && userData.jobTitle);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/');
        return;
      }
      
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        router.push('/');
        return;
      }

      const data = userDoc.data();

      if (data.userType !== 'admin') {
        router.push('/');
        return;
      }

      setAdminData(data);

      if (!checkAdminProfileComplete(data)) {
        router.push('/admin/profile-setup');
        return;
      }
      
      setIsCheckingProfile(false);
    });
    return () => unsubscribe();
  }, [router]);

  // Show loading state while checking profile
  if (isCheckingProfile) {
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

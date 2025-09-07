'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import AdminBottomNavBar from '@/components/AdminBottomNavBar';
import SoldierManagement from '@/components/SoldierManagement';

export default function AdminSoldiersPage() {
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
      
      // Check admin profile completeness
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        setAdminData(data);
        
        // Check if admin profile is complete
        if (!checkAdminProfileComplete(data)) {
          router.push('/admin/profile-setup');
          return;
        }
      } else {
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
        <div className="text-center text-muted">Loading...</div>
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

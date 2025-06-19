'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import colors from '../colors';

export default function RedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace('/');
        return;
      }
      
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        router.replace('/register');
        return;
      }
      
      const userData = userDoc.data();
      
      // Admin
      if (userData.userType === 'admin') {
        // Check admin-specific fields
        if (!userData.firstName || !userData.lastName || !userData.jobTitle) {
          router.replace('/admin/profile-setup');
        } else {
          router.replace('/admin/home');
        }
        return;
      }
      
      // Pending approval
      if (userData.userType === 'pending_approval') {
        router.replace('/register/pending-approval');
        return;
      }
      
      // User
      if (userData.userType === 'user') {
        // Check user-specific fields
        if (!userData.fullName || !userData.roomNumber) {
          router.replace('/profile-setup');
        } else {
          router.replace('/home');
        }
        return;
      }
      
      // Fallback
      router.replace('/register');
    });
    return () => unsubscribe();
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center font-body" style={{ background: colors.white }}>
      <div className="flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primaryGreen mb-6" style={{ borderColor: colors.primaryGreen }}></div>
        <div style={{ color: colors.primaryGreen, fontWeight: 600, fontSize: 22 }}>Checking your account...</div>
      </div>
    </main>
  );
} 
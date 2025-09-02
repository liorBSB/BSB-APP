'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import colors from '../colors';

export default function RedirectPage() {
  const router = useRouter();
  const [missingUser, setMissingUser] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace('/');
        return;
      }
      
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        // Show missing user page instead of modal
        setMissingUser(true);
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

  // Show missing user page instead of modal
  if (missingUser) {
    return (
      <main className="min-h-screen flex items-center justify-center font-body px-4" style={{ background: colors.white }}>
        <div className="w-full max-w-md mx-auto">
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6" style={{ background: colors.primaryGreen }}>
              <svg width="40" height="40" fill="none" viewBox="0 0 24 24">
                <path d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: colors.primaryGreen }}>No account found</h2>
            <p className="text-gray-600 mb-8">We couldn&apos;t find your account. Would you like to create one now?</p>
          </div>
          
          <div className="space-y-4">
            <button
              onClick={() => {
                window.location.href = '/register';
              }}
              className="w-full rounded-full py-4 font-semibold text-lg"
              style={{ 
                background: colors.gold, 
                color: colors.black,
                minHeight: '56px',
                cursor: 'pointer',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              Go to Register
            </button>
            <button
              onClick={async () => {
                await signOut(auth);
                window.location.href = '/';
              }}
              className="w-full rounded-full py-4 font-semibold border-2 text-lg"
              style={{ 
                borderColor: colors.primaryGreen, 
                color: colors.primaryGreen,
                minHeight: '56px',
                cursor: 'pointer',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center font-body" style={{ background: colors.white }}>
      <div className="flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primaryGreen mb-6" style={{ borderColor: colors.primaryGreen }}></div>
        <div style={{ color: colors.primaryGreen, fontWeight: 600, fontSize: 22 }}>Checking your account...</div>
      </div>
    </main>
  );
} 
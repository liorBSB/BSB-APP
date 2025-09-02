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
        // Show modal to offer navigation to register instead of immediate redirect
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

  return (
    <main className="min-h-screen flex items-center justify-center font-body" style={{ background: colors.white }}>
      <div className="flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primaryGreen mb-6" style={{ borderColor: colors.primaryGreen }}></div>
        <div style={{ color: colors.primaryGreen, fontWeight: 600, fontSize: 22 }}>Checking your account...</div>
      </div>

      {missingUser && (
        <div 
          className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50"
          style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            minHeight: '100vh',
            touchAction: 'none'
          }}
        >
          <div 
            className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 mx-4"
            style={{
              maxWidth: 'calc(100vw - 2rem)',
              touchAction: 'auto'
            }}
          >
            <h2 className="text-xl font-bold mb-2" style={{ color: colors.primaryGreen }}>No account found</h2>
            <p className="text-sm text-gray-600 mb-6">We couldn&apos;t find your account. Would you like to create one now?</p>
            <div className="flex gap-3">
              <button
                onClick={() => router.replace('/register')}
                className="flex-1 rounded-full py-3 font-semibold touch-manipulation"
                style={{ 
                  background: colors.gold, 
                  color: colors.black,
                  minHeight: '44px',
                  touchAction: 'manipulation'
                }}
              >
                Go to Register
              </button>
              <button
                onClick={async () => { await signOut(auth); router.replace('/'); }}
                className="flex-1 rounded-full py-3 font-semibold border touch-manipulation"
                style={{ 
                  borderColor: colors.primaryGreen, 
                  color: colors.primaryGreen,
                  minHeight: '44px',
                  touchAction: 'manipulation'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
} 
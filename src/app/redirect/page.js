'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { createBaseUserDoc } from '@/lib/database';
import colors from '../colors';
import HouseLoader from '@/components/HouseLoader';

function getSafeNext(next, userType) {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null;
  if (userType === 'admin' && next.startsWith('/admin/')) return next;
  if (userType === 'user' && !next.startsWith('/admin/')) return next;
  return null;
}

async function getDocWithRetry(docRef, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    const snap = await getDoc(docRef);
    if (snap.exists() || i === retries) return snap;
    await new Promise(r => setTimeout(r, 500));
  }
}

function RedirectPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation('login');
  const [missingUser, setMissingUser] = useState(false);

  useEffect(() => {
    const next = searchParams.get('next');

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace('/');
        return;
      }
      
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDocWithRetry(userRef);
      
      if (!userDoc.exists()) {
        try {
          await createBaseUserDoc(user);
          router.replace('/register/selection');
          return;
        } catch (error) {
          console.error('Failed to create user document:', error);
          setMissingUser(true);
          return;
        }
      }
      
      const userData = userDoc.data();
      
      // Admin
      if (userData.userType === 'admin') {
        // Check admin-specific fields
        if (!userData.firstName || !userData.lastName || !userData.jobTitle) {
          router.replace('/admin/profile-setup');
        } else {
          router.replace(getSafeNext(next, 'admin') || '/admin/home');
        }
        return;
      }
      
      // Pending approval
      if (userData.userType === 'pending_approval') {
        // Check if they've completed admin profile setup
        if (!userData.firstName || !userData.lastName || !userData.jobTitle) {
          // Admin profile incomplete - continue to admin profile setup
          router.replace('/admin/profile-setup');
        } else {
          // Admin profile complete - send to pending approval page
          router.replace('/register/pending-approval');
        }
        return;
      }
      
      // User - check if profile is complete
      if (userData.userType === 'user') {
        // Check if user has completed profile setup (has name and room number)
        if (!userData.fullName || !userData.roomNumber || userData.fullName.trim() === '' || userData.roomNumber.trim() === '') {
          if (userData.roleChoice === 'live_here') {
            router.replace('/profile-setup');
          } else {
            router.replace('/register/selection');
          }
        } else {
          router.replace(getSafeNext(next, 'user') || '/home');
        }
        return;
      }
      
      // Fallback - new user or unknown type, send to selection
      router.replace('/register/selection');
    });
    return () => unsubscribe();
  }, [router, searchParams]);

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
            <h2 className="text-2xl font-bold mb-2" style={{ color: colors.primaryGreen }}>{t('no_account_found')}</h2>
            <p className="text-gray-600 mb-8">{t('no_account_message')}</p>
          </div>
          
          <div className="space-y-4">
            <button
              onClick={() => {
                router.push('/register/selection');
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
              {t('complete_registration')}
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
              {t('cancel')}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center font-body" style={{ background: colors.white }}>
      <HouseLoader size={80} text={t('checking_account')} />
    </main>
  );
}

export default function RedirectPage() {
  return (
    <Suspense fallback={null}>
      <RedirectPageInner />
    </Suspense>
  );
}
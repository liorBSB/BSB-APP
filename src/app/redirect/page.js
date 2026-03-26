'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { createBaseUserDoc } from '@/lib/database';
import { useAuth } from '@/components/AuthProvider';
import colors from '../colors';
import HouseLoader from '@/components/HouseLoader';

function getSafeNext(next, userType) {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null;
  if (userType === 'admin' && next.startsWith('/admin/')) return next;
  if (userType === 'user' && !next.startsWith('/admin/')) return next;
  return null;
}

function appendNext(base, next) {
  if (!next) return base;
  return base + (base.includes('?') ? '&' : '?') + 'next=' + encodeURIComponent(next);
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
  const { user, isLoading } = useAuth();
  const [missingUser, setMissingUser] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace('/');
      return;
    }

    const next = searchParams.get('next');

    const resolve = async () => {
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDocWithRetry(userRef);

      if (!userDoc.exists()) {
        createBaseUserDoc(user).catch((err) =>
          console.error('Failed to create user document:', err)
        );
        router.replace(appendNext('/register/selection', next));
        return;
      }

      const userData = userDoc.data();

      if (userData.userType === 'admin') {
        if (!userData.firstName || !userData.lastName || !userData.jobTitle) {
          router.replace(appendNext('/admin/profile-setup', next));
        } else {
          router.replace(getSafeNext(next, 'admin') || '/admin/home');
        }
        return;
      }

      if (userData.userType === 'pending_approval') {
        if (!userData.firstName || !userData.lastName || !userData.jobTitle) {
          router.replace(appendNext('/admin/profile-setup', next));
        } else {
          router.replace(appendNext('/register/pending-approval', next));
        }
        return;
      }

      if (userData.userType === 'user') {
        if (!userData.fullName || !userData.roomNumber || userData.fullName.trim() === '' || userData.roomNumber.trim() === '') {
          if (userData.roleChoice === 'live_here') {
            router.replace(appendNext('/profile-setup', next));
          } else {
            router.replace(appendNext('/register/selection', next));
          }
        } else {
          router.replace(getSafeNext(next, 'user') || '/home');
        }
        return;
      }

      router.replace(appendNext('/register/selection', next));
    };

    resolve();
  }, [isLoading, user, router, searchParams]);

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

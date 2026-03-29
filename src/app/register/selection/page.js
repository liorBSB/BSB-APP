'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import '@/i18n';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { auth, db } from '@/lib/firebase';
import { doc, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { Suspense } from 'react';

import useAuthRedirect from '@/hooks/useAuthRedirect';
import colors from '../../colors';
import HouseLoader from '@/components/HouseLoader';
import LanguageSwitcher from '@/components/LanguageSwitcher';

function SelectionPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next');
  const { t, i18n } = useTranslation('register');
  const isRTL = i18n.language?.startsWith('he');
  const { isReady } = useAuthRedirect();

  const appendNext = (base) => {
    if (!nextParam) return base;
    return base + (base.includes('?') ? '&' : '?') + 'next=' + encodeURIComponent(nextParam);
  };

  const handleWorkHere = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists() && snap.data().userType === 'admin') {
          router.push('/admin/home');
          return;
        }
        await updateDoc(userRef, {
          userType: 'pending_approval',
          roleChoice: 'work_here'
        });
      }
      router.push(appendNext('/admin/profile-setup'));
    } catch (error) {
      console.error('Error updating user choice:', error);
      router.push(appendNext('/admin/profile-setup'));
    }
  };

  const handleLiveHere = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists() && ['admin', 'pending_approval'].includes(snap.data().userType)) {
          router.push(appendNext('/redirect'));
          return;
        }
        await updateDoc(userRef, {
          userType: 'user',
          roleChoice: 'live_here'
        });
      }
      router.push(appendNext('/profile-setup'));
    } catch (error) {
      console.error('Error updating user choice:', error);
      router.push(appendNext('/profile-setup'));
    }
  };

  const handleCancel = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists() && ['admin', 'pending_approval', 'user'].includes(snap.data().userType)) {
          await signOut(auth);
          router.push('/');
          return;
        }
        await deleteDoc(userRef);
        await signOut(auth);
      }
      router.push('/');
    } catch (error) {
      console.error('Error during cancel:', error);
      try {
        await signOut(auth);
        router.push('/');
      } catch (signOutError) {
        console.error('Error signing out:', signOutError);
        router.push('/');
      }
    }
  };

  if (!isReady) {
    return (
      <main className="min-h-screen flex items-center justify-center font-body relative" style={{ background: colors.white }}>
        <LanguageSwitcher variant="corner" />
        <HouseLoader size={80} text={t('loading')} />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center font-body px-4 phone-lg:px-0 relative" style={{ background: colors.white }}>
      <LanguageSwitcher variant="corner" />
      <div
        className="w-full max-w-xs phone-md:max-w-sm phone-lg:max-w-md mx-auto
          bg-white rounded-[2.5rem] shadow-lg p-[2.25rem_1.25rem]
          phone-lg:p-[3.5rem_2.2rem]"
      >
        <h2
          style={{ fontWeight: 700, fontSize: '2.5rem', textAlign: 'center', marginBottom: '2.8rem' }}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {t('selection.do_you')}
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button
            onClick={handleWorkHere}
            style={{ 
              width: '100%', 
              background: colors.gold, 
              color: colors.black, 
              fontWeight: 700, 
              fontSize: '1.35rem', 
              border: 'none', 
              borderRadius: 999, 
              padding: '1rem 0', 
              cursor: 'pointer',
              marginBottom: '1rem'
            }}
          >
            {t('selection.work_here')}
          </button>
          
          <button
            onClick={handleLiveHere}
            style={{ 
              width: '100%', 
              background: colors.primaryGreen, 
              color: colors.white, 
              fontWeight: 700, 
              fontSize: '1.35rem', 
              border: 'none', 
              borderRadius: 999, 
              padding: '1rem 0', 
              cursor: 'pointer',
              marginBottom: '2rem'
            }}
          >
            {t('selection.live_here')}
          </button>

          <button
            onClick={handleCancel}
            style={{ 
              width: '100%', 
              background: 'transparent', 
              color: colors.primaryGreen, 
              fontWeight: 600, 
              fontSize: '1rem', 
              border: `2px solid ${colors.primaryGreen}`, 
              borderRadius: 999, 
              padding: '0.8rem 0', 
              cursor: 'pointer'
            }}
          >
            {t('selection.cancel')}
          </button>
        </div>
      </div>
    </main>
  );
}

export default function SelectionPage() {
  return (
    <Suspense fallback={null}>
      <SelectionPageInner />
    </Suspense>
  );
}
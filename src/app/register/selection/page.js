'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import '@/i18n';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { auth, db } from '@/lib/firebase';
import { doc, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

import useAuthRedirect from '@/hooks/useAuthRedirect';
import colors from '../../colors';
import { setLangCookie } from '@/lib/langCookie';

export default function SelectionPage() {
  const router = useRouter();
  const { t, i18n } = useTranslation('register');
  const isRTL = i18n.language?.startsWith('he');
  const isReady = useAuthRedirect();
  const [langPicked, setLangPicked] = useState(false);

  const pickLanguage = (lang) => {
    setLangPicked(true);
    if (lang !== i18n.language) {
      i18n.changeLanguage(lang);
      if (typeof window !== 'undefined') localStorage.setItem('lang', lang);
      setLangCookie(lang);
      document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    }
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
      router.push('/admin/profile-setup');
    } catch (error) {
      console.error('Error updating user choice:', error);
      router.push('/admin/profile-setup');
    }
  };

  const handleLiveHere = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists() && ['admin', 'pending_approval'].includes(snap.data().userType)) {
          router.push('/redirect');
          return;
        }
        await updateDoc(userRef, {
          userType: 'user',
          roleChoice: 'live_here'
        });
      }
      router.push('/profile-setup');
    } catch (error) {
      console.error('Error updating user choice:', error);
      router.push('/profile-setup');
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
      <main className="min-h-screen flex items-center justify-center font-body" style={{ background: colors.white }}>
        <div className="animate-spin rounded-full h-16 w-16 border-b-4" style={{ borderColor: colors.primaryGreen }}></div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center font-body px-4 phone-lg:px-0" style={{ background: colors.white }}>
      <div
        className="w-full max-w-xs phone-md:max-w-sm phone-lg:max-w-md mx-auto
          bg-white rounded-[2.5rem] shadow-lg p-[2.25rem_1.25rem]
          phone-lg:p-[3.5rem_2.2rem]"
      >
        {/* Language picker */}
        <div className="mb-10">
          <div
            className="flex items-center justify-center rounded-full p-2 mx-auto shadow-inner"
            style={{ backgroundColor: colors.surface, width: 'fit-content', direction: 'ltr' }}
          >
            <button
              onClick={() => pickLanguage('he')}
              className="flex items-center justify-center w-20 h-16 rounded-full transition-all duration-200"
              style={{
                backgroundColor: langPicked && i18n.language === 'he' ? colors.gold : 'transparent',
                boxShadow: langPicked && i18n.language === 'he' ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
              }}
            >
              <span className={`text-4xl leading-none transition-all duration-200 ${langPicked && i18n.language === 'he' ? '' : !langPicked ? 'opacity-60' : 'grayscale opacity-40'}`}>🇮🇱</span>
            </button>
            <button
              onClick={() => pickLanguage('en')}
              className="flex items-center justify-center w-20 h-16 rounded-full transition-all duration-200"
              style={{
                backgroundColor: langPicked && i18n.language === 'en' ? colors.gold : 'transparent',
                boxShadow: langPicked && i18n.language === 'en' ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
              }}
            >
              <span className={`text-4xl leading-none transition-all duration-200 ${langPicked && i18n.language === 'en' ? '' : !langPicked ? 'opacity-60' : 'grayscale opacity-40'}`}>🇺🇸</span>
            </button>
          </div>
          <p className="text-center text-base font-medium mt-3" style={{ color: colors.muted }}>
            {t('selection.choose_language')}
          </p>
          <p className="text-center text-sm mt-1" style={{ color: colors.gray400 }}>
            {t('selection.change_later')}
          </p>
        </div>

        <h2
          style={{ fontWeight: 700, fontSize: '2.5rem', textAlign: 'center', marginBottom: '2.8rem' }}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {t('selection.do_you')}
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', opacity: langPicked ? 1 : 0.4, pointerEvents: langPicked ? 'auto' : 'none', transition: 'opacity 0.3s' }}>
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
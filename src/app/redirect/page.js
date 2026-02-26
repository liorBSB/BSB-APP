'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import colors from '../colors';

export default function RedirectPage() {
  const router = useRouter();
  const { t } = useTranslation('login');
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
        try {
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: user.email,
            fullName: user.displayName || '',
            userType: 'user', // Default to user, can be changed during selection
            isAdmin: false,
            status: 'home',
            roomNumber: '',
            roomLetter: '',
            createdAt: serverTimestamp()
          });
          
          // After creating the document, redirect to selection
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
          router.replace('/admin/home');
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
          // Profile incomplete - check if they've already made a role choice
          if (userData.roleChoice === 'live_here') {
            // They chose to live here, continue to profile setup
            router.replace('/profile-setup');
          } else {
            // No choice made yet, send to selection page
            router.replace('/register/selection');
          }
        } else {
          const consentDone = userData.consents?.doc1?.accepted === true
            || userData.consentSkipped === true;
          if (!consentDone) {
            router.replace('/register/consent/1?role=soldier');
          } else {
            router.replace('/home');
          }
        }
        return;
      }
      
      // Fallback - new user or unknown type, send to selection
      router.replace('/register/selection');
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
      <div className="flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primaryGreen mb-6" style={{ borderColor: colors.primaryGreen }}></div>
        <div style={{ color: colors.primaryGreen, fontWeight: 600, fontSize: 22 }}>{t('checking_account')}</div>
      </div>
    </main>
  );
} 
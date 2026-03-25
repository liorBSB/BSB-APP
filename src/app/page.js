'use client';

import '@/i18n'; // 👈 This loads your i18n config
import i18n from '@/i18n';
import { useTranslation } from 'react-i18next';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
/* eslint-disable @next/next/no-img-element */
import { signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

import colors from './colors';

function AuthPageInner() {
  const { t } = useTranslation('login');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const next = searchParams.get('next');
        const isSafe = next && next.startsWith('/') && !next.startsWith('//');
        router.push('/redirect' + (isSafe ? '?next=' + encodeURIComponent(next) : ''));
      } else {
        setIsAuthChecked(true);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const handleGoogleAuth = async () => {
    if (isSigningIn) return; // Prevent multiple clicks
    
    setIsSigningIn(true);
    setError('');
    
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // User is now authenticated - redirect will be handled by onAuthStateChanged
      // The redirect page will handle user document creation if needed
      
    } catch (error) {
      if (error.code === 'auth/popup-closed-by-user') {
        // User closed the popup - normal, no error needed
      } else if (error.code === 'auth/cancelled-popup-request') {
        // User cancelled - normal, no error needed
      } else if (error.code === 'auth/popup-blocked') {
        setError(t('error_popup_blocked'));
      } else if (error.code === 'auth/network-request-failed') {
        setError(t('error_network'));
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        setError(t('error_account_exists'));
      } else if (error.code === 'auth/email-already-in-use') {
        setError(t('error_email_in_use'));
      } else {
        setError(t('error_auth_failed'));
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  // Show loading spinner while checking auth state
  if (isLoading || !isAuthChecked) {
    return (
      <main className="min-h-screen flex items-center justify-center font-body px-4 phone-lg:px-0" style={{ background: colors.white }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 mx-auto mb-6" style={{ borderColor: colors.primaryGreen }}></div>
          <div style={{ color: colors.primaryGreen, fontWeight: 600, fontSize: 22 }}>{t('loading')}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-200/60 to-green-100/60 font-body flex items-center justify-center px-4 phone-lg:px-0">
      <div
        className="w-full max-w-xs phone-md:max-w-sm phone-lg:max-w-md mx-auto 
          bg-transparent rounded-none shadow-none p-0
          phone-lg:bg-white phone-lg:rounded-[2.5rem] phone-lg:shadow-lg phone-lg:p-[3.5rem_2.2rem]"
      >
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <img
            src="/House_Logo.jpg"
            alt="House Logo"
            width={220}
            height={220}
            style={{ 
              margin: '0 auto 3rem', 
              display: 'block'
            }}
          />
          
          <h1 style={{ 
            fontWeight: 800, 
            fontSize: '2.2rem', 
            marginBottom: '1rem', 
            color: colors.primaryGreen,
            letterSpacing: '-0.02em'
          }}>
            {t('welcome_home')}
          </h1>
          
          <p style={{ 
            color: colors.black, 
            fontSize: '1.1rem', 
            marginBottom: '0',
            fontWeight: 500
          }}>
            {t('sign_in_subtitle')}
          </p>
        </div>

        {error && (
          <div style={{ 
            color: '#dc2626', 
            backgroundColor: '#fef2f2', 
            border: '1px solid #fecaca',
            borderRadius: '0.5rem',
            padding: '1rem', 
            marginBottom: '1.5rem',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleAuth}
          disabled={isSigningIn}
          style={{
            width: '85%',
            maxWidth: '300px',
            margin: '0 auto',
            background: isSigningIn ? '#cbd5e1' : 'white',
            color: isSigningIn ? '#64748b' : '#374151',
            fontWeight: 600,
            fontSize: '0.95rem',
            border: isSigningIn ? 'none' : `2px solid ${colors.primaryGreen}`,
            borderRadius: '12px',
            padding: '0.8rem 1.2rem',
            cursor: isSigningIn ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.6rem',
            marginBottom: '3rem',
            transition: 'all 0.2s ease',
            boxShadow: isSigningIn ? 'none' : '0 2px 8px rgba(0,0,0,0.1)',
            transform: isSigningIn ? 'none' : 'translateY(0)',
            ':hover': {
              transform: 'translateY(-1px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }
          }}
          onMouseEnter={(e) => {
            if (!isSigningIn) {
              e.target.style.transform = 'translateY(-1px)';
              e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isSigningIn) {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            }
          }}
        >
          {isSigningIn ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div>
              {t('signing_in')}
            </>
          ) : (
            <>
              <img
                src="/google-logo.png"
                alt="Google"
                width={20}
                height={20}
              />
              {t('continue_with_google')}
            </>
          )}
        </button>

        <div style={{ 
          textAlign: 'center', 
          color: colors.black, 
          fontSize: '0.8rem',
          marginTop: '2rem',
          lineHeight: '1.4'
        }}>
          <p>
            {t('terms_notice')}
          </p>
        </div>
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageInner />
    </Suspense>
  );
}
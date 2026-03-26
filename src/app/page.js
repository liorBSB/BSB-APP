'use client';

import '@/i18n';
import { useTranslation } from 'react-i18next';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
/* eslint-disable @next/next/no-img-element */
import { signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import HouseLoader from '@/components/HouseLoader';
import { useAuth } from '@/components/AuthProvider';
import {
  isStorageAvailable,
  isUnsupportedBrowser,
  mapAuthErrorCodeToKey,
} from '@/lib/authSignInFlow';

import colors from './colors';

function AuthPageInner() {
  const { t } = useTranslation('login');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading, weakPersistence } = useAuth();
  const [error, setError] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);

  const mapAuthErrorToMessage = (errorCode) => t(mapAuthErrorCodeToKey(errorCode));

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      const next = searchParams.get('next');
      const isSafe = next && next.startsWith('/') && !next.startsWith('//');
      router.replace('/redirect' + (isSafe ? '?next=' + encodeURIComponent(next) : ''));
    }
  }, [isLoading, user, router, searchParams]);

  const handleGoogleAuth = async () => {
    if (isSigningIn) return;

    setIsSigningIn(true);
    setError('');

    const hasWorkingStorage =
      typeof window !== 'undefined'
        ? isStorageAvailable(window.localStorage) || isStorageAvailable(window.sessionStorage)
        : false;

    if (isUnsupportedBrowser({
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      hasWorkingStorage,
    })) {
      setError(t('error_open_in_browser'));
      setIsSigningIn(false);
      return;
    }

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        // User closed/cancelled — not an error
      } else if (error.code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch {
          setError(t('error_popup_blocked'));
        }
      } else {
        setError(mapAuthErrorToMessage(error.code));
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  if (isLoading || user) {
    return (
      <main className="min-h-screen flex items-center justify-center font-body px-4 phone-lg:px-0" style={{ background: colors.white }}>
        <HouseLoader size={80} text={t('loading')} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-200/60 to-green-100/60 font-body flex items-center justify-center px-4 phone-lg:px-0">
      <div
        className="w-full max-w-xs phone-md:max-w-sm phone-lg:max-w-md mx-auto
          bg-white rounded-[2.5rem] shadow-lg p-[2.25rem_1.25rem]
          phone-lg:p-[3.5rem_2.2rem]"
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

        {weakPersistence && (
          <div style={{
            color: '#92400e',
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '1.5rem',
            fontSize: '0.9rem'
          }}>
            {t('error_open_in_browser')}
          </div>
        )}

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
              <HouseLoader size={20} />
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

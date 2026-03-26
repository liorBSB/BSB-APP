'use client';

import '@/i18n'; // 👈 This loads your i18n config
import i18n from '@/i18n';
import { useTranslation } from 'react-i18next';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
/* eslint-disable @next/next/no-img-element */
import {
  signInWithPopup,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import HouseLoader from '@/components/HouseLoader';
import {
  isStorageAvailable,
  mapAuthErrorCodeToKey,
} from '@/lib/authSignInFlow';

import colors from './colors';

function AuthPageInner() {
  const { t } = useTranslation('login');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isAuthBootstrapping, setIsAuthBootstrapping] = useState(true);

  const mapAuthErrorToMessage = (errorCode) => t(mapAuthErrorCodeToKey(errorCode));

  useEffect(() => {
    let active = true;

    // #region agent log
    fetch('http://127.0.0.1:7376/ingest/622e0f72-8f44-4150-84ee-ce7476cc5432',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'295cab'},body:JSON.stringify({sessionId:'295cab',runId:'run1',hypothesisId:'H1',location:'src/app/page.js:bootstrapAuth.start',message:'login bootstrap start',data:{pathname:typeof window!=='undefined'?window.location.pathname:'n/a',host:typeof window!=='undefined'?window.location.host:'n/a',hasSessionStorage:typeof window!=='undefined'?isStorageAvailable(window.sessionStorage):false,ua:typeof navigator!=='undefined'?navigator.userAgent:'n/a'},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    const bootstrapAuth = async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch {
        try {
          await setPersistence(auth, browserSessionPersistence);
        } catch {
          try {
            await setPersistence(auth, inMemoryPersistence);
          } catch {
            // Ignore persistence setup failure and continue sign-in flow.
          }
        }
      }
      if (active) setIsAuthBootstrapping(false);
    };

    bootstrapAuth();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // #region agent log
      fetch('http://127.0.0.1:7376/ingest/622e0f72-8f44-4150-84ee-ce7476cc5432',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'295cab'},body:JSON.stringify({sessionId:'295cab',runId:'run1',hypothesisId:'H3',location:'src/app/page.js:onAuthStateChanged',message:'login auth state callback',data:{hasUser:!!user,uid:user?.uid||null,pathname:typeof window!=='undefined'?window.location.pathname:'n/a'},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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

    // #region agent log
    fetch('http://127.0.0.1:7376/ingest/622e0f72-8f44-4150-84ee-ce7476cc5432',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'295cab'},body:JSON.stringify({sessionId:'295cab',runId:'run1',hypothesisId:'H1',location:'src/app/page.js:handleGoogleAuth.start',message:'google auth button pressed',data:{pathname:typeof window!=='undefined'?window.location.pathname:'n/a'},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    
    try {
      // #region agent log
      fetch('http://127.0.0.1:7376/ingest/622e0f72-8f44-4150-84ee-ce7476cc5432',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'295cab'},body:JSON.stringify({sessionId:'295cab',runId:'run1',hypothesisId:'H2',location:'src/app/page.js:handleGoogleAuth.beforePopup',message:'calling signInWithPopup',data:{provider:'google'},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      await signInWithPopup(auth, googleProvider);

      // User is now authenticated - redirect will be handled by onAuthStateChanged
      // The redirect page will handle user document creation if needed
      
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7376/ingest/622e0f72-8f44-4150-84ee-ce7476cc5432',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'295cab'},body:JSON.stringify({sessionId:'295cab',runId:'run1',hypothesisId:'H2',location:'src/app/page.js:handleGoogleAuth.catch',message:'sign in failed',data:{code:error?.code||null,name:error?.name||null,message:error?.message||null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (error.code === 'auth/popup-closed-by-user') {
        // User closed the popup - normal, no error needed
      } else if (error.code === 'auth/cancelled-popup-request') {
        // User cancelled - normal, no error needed
      } else if (error.code === 'auth/popup-blocked') {
        setError(t('error_popup_blocked'));
      } else {
        setError(mapAuthErrorToMessage(error.code));
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  // Show loading spinner while checking auth state
  if (isLoading || !isAuthChecked || isAuthBootstrapping) {
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
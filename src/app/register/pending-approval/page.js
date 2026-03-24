'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

import colors from '../../colors';
import { fullyDeleteCurrentUser } from '@/lib/accountDeletionClient';

export default function PendingApprovalPage() {
  const router = useRouter();
  const { t } = useTranslation('register');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showStartOverModal, setShowStartOverModal] = useState(false);
  const [startOverError, setStartOverError] = useState('');
  const [isStartingOver, setIsStartingOver] = useState(false);

  useEffect(() => {
    let unsubSnapshot = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace('/');
        return;
      }

      const userRef = doc(db, 'users', user.uid);
      unsubSnapshot = onSnapshot(userRef, (userDoc) => {
        try {
          if (!userDoc.exists()) {
            setError(t('pending_approval.error_no_doc'));
            setLoading(false);
            return;
          }

          const userData = userDoc.data();

          if (userData?.userType === 'admin') {
            router.push('/admin/home');
            return;
          }

          if (userData?.userType !== 'pending_approval') {
            setError(t('pending_approval.error_invalid_status'));
            setLoading(false);
            return;
          }

          setLoading(false);
        } catch (error) {
          console.error('Error checking user status:', error);
          setError(t('pending_approval.error_check_status'));
          setLoading(false);
        }
      }, (error) => {
        console.error('Error setting up user listener:', error);
        setError(t('pending_approval.error_monitor'));
        setLoading(false);
      });
    });

    return () => {
      unsubAuth();
      if (unsubSnapshot) unsubSnapshot();
    };
  }, [router]);

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleStartOver = async () => {
    setIsStartingOver(true);
    setStartOverError('');
    try {
      await fullyDeleteCurrentUser();
      router.push('/');
    } catch (err) {
      console.error('Start over error:', err);
      setStartOverError(t('start_over_failed', 'Failed to start over. Please try again.'));
    } finally {
      setIsStartingOver(false);
      setShowStartOverModal(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center font-body px-4 phone-lg:px-0" style={{ background: colors.white }}>
        <div className="text-center">
          <div className="text-muted mb-2">{t('pending_approval.processing')}</div>
          <div className="text-sm text-muted">{t('pending_approval.please_wait')}</div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center font-body px-4 phone-lg:px-0" style={{ background: colors.white }}>
        <div className="text-center max-w-md">
          <div className="text-2xl font-bold text-red-600 mb-4">{t('pending_approval.error_title')}</div>
          <div className="text-muted mb-6">{error}</div>
          <button
            onClick={() => router.push('/register/selection')}
            style={{
              background: colors.primaryGreen,
              color: colors.white,
              padding: '12px 24px',
              borderRadius: '999px',
              border: 'none',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {t('pending_approval.try_again')}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center font-body px-4 phone-lg:px-0" style={{ background: colors.white }}>
      <div
        className="w-full max-w-xs phone-md:max-w-sm phone-lg:max-w-md mx-auto 
          bg-transparent rounded-none shadow-none p-0
          phone-lg:bg-white phone-lg:rounded-[2.5rem] phone-lg:shadow-lg phone-lg:p-[3.5rem_2.2rem]"
      >
        <div className="text-center">
          {/* Success Icon */}
          <div className="mb-6">
            <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center" style={{ background: colors.primaryGreen }}>
              <svg width="40" height="40" fill="none" viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2"/>
              </svg>
            </div>
          </div>

          <h2 style={{ fontWeight: 700, fontSize: '2rem', textAlign: 'center', marginBottom: '1rem' }}>
            {t('pending_approval.request_submitted')}
          </h2>
          
          <p style={{ color: colors.muted, fontSize: '1.1rem', marginBottom: '2rem', lineHeight: '1.5' }}>
            {t('pending_approval.submitted_message')}
          </p>

          <div style={{ 
            background: '#f8f9fa', 
            padding: '1.5rem', 
            borderRadius: '1rem', 
            marginBottom: '2rem',
            border: `1px solid ${colors.primaryGreen}20`
          }}>
            <div style={{ color: colors.primaryGreen, fontWeight: 600, marginBottom: '0.5rem' }}>
              {t('pending_approval.what_next')}
            </div>
            <ul style={{ textAlign: 'left', color: colors.muted, fontSize: '0.9rem' }}>
              <li style={{ marginBottom: '0.5rem' }}>• {t('pending_approval.next_step_1')}</li>
              <li style={{ marginBottom: '0.5rem' }}>• {t('pending_approval.next_step_2')}</li>
            </ul>
          </div>

          <button
            onClick={handleSignOut}
            style={{
              background: colors.gold,
              color: colors.black,
              padding: '12px 24px',
              borderRadius: '999px',
              border: 'none',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
              width: '100%',
              marginBottom: '1rem'
            }}
          >
            {t('pending_approval.sign_out')}
          </button>

          <button
            onClick={() => {
              setStartOverError('');
              setShowStartOverModal(true);
            }}
            style={{
              background: 'transparent',
              color: colors.red,
              padding: '12px 24px',
              borderRadius: '999px',
              border: `2px solid ${colors.red}`,
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
              width: '100%'
            }}
          >
            {t('start_over', 'Start over / Delete account')}
          </button>
        </div>
      </div>

      {showStartOverModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 60,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '1.5rem',
            maxWidth: '26rem',
            width: '100%',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '1.25rem 1.5rem', background: colors.red, color: 'white' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, textAlign: 'center', margin: 0 }}>
                {t('start_over_title', 'Start over?')}
              </h3>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <p style={{ color: '#4b5563', fontSize: '0.95rem', textAlign: 'center', marginBottom: '1.25rem' }}>
                {t('start_over_description', 'This will delete your account and all app data. You will need to sign up again.')}
              </p>

              {startOverError && (
                <p style={{ color: colors.red, fontSize: '0.9rem', textAlign: 'center', marginBottom: '0.75rem' }}>
                  {startOverError}
                </p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleStartOver}
                  disabled={isStartingOver}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '0.75rem',
                    fontWeight: 700,
                    fontSize: '1rem',
                    border: 'none',
                    background: isStartingOver ? '#9ca3af' : colors.red,
                    color: 'white',
                    cursor: isStartingOver ? 'not-allowed' : 'pointer',
                    opacity: isStartingOver ? 0.7 : 1,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isStartingOver ? t('loading', 'Loading...') : t('start_over_confirm', 'Delete account')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowStartOverModal(false)}
                  disabled={isStartingOver}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '0.75rem',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    border: `2px solid ${colors.primaryGreen}`,
                    background: 'transparent',
                    color: colors.primaryGreen,
                    cursor: isStartingOver ? 'not-allowed' : 'pointer',
                    opacity: isStartingOver ? 0.7 : 1,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {t('cancel', 'Cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
} 
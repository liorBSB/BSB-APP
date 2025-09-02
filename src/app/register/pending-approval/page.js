'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../../lib/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import colors from '../../colors';

export default function PendingApprovalPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setError('No authenticated user found');
      setLoading(false);
      return;
    }

    // Set up real-time listener for user status changes
    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (userDoc) => {
      try {
        if (!userDoc.exists()) {
          setError('User document not found. Please complete your profile setup first.');
          setLoading(false);
          return;
        }

        const userData = userDoc.data();

        if (userData?.userType === 'admin') {
          // User is approved, redirect to admin home
          router.push('/admin/home');
          return;
        }

        // If user is not approved, just show the pending approval page
        // The approval request should already be created by the admin profile setup page
        if (userData?.userType !== 'pending_approval') {
          setError('Invalid user status. Please complete your profile setup first.');
          setLoading(false);
          return;
        }

        setLoading(false);
      } catch (error) {
        console.error('Error checking user status:', error);
        setError('Failed to check user status. Please try again.');
        setLoading(false);
      }
    }, (error) => {
      console.error('Error setting up user listener:', error);
      setError('Failed to monitor user status. Please try again.');
      setLoading(false);
    });

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [router]);

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center font-body px-4 phone-lg:px-0" style={{ background: colors.white }}>
        <div className="text-center">
          <div className="text-muted mb-2">Processing your request...</div>
          <div className="text-sm text-muted">Please wait</div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center font-body px-4 phone-lg:px-0" style={{ background: colors.white }}>
        <div className="text-center max-w-md">
          <div className="text-2xl font-bold text-red-600 mb-4">⚠️ Error</div>
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
            Try Again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center font-body px-4 phone-lg:px-0" style={{ background: colors.white }}>
      <LanguageSwitcher className="absolute top-4 right-4 bg-surface p-2 rounded-full text-white text-xl hover:text-text" />
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
            Request Submitted!
          </h2>
          
          <p style={{ color: colors.muted, fontSize: '1.1rem', marginBottom: '2rem', lineHeight: '1.5' }}>
            Your request to work here has been submitted successfully. 
            Please wait for your boss to approve your access.
          </p>

          <div style={{ 
            background: '#f8f9fa', 
            padding: '1.5rem', 
            borderRadius: '1rem', 
            marginBottom: '2rem',
            border: `1px solid ${colors.primaryGreen}20`
          }}>
            <div style={{ color: colors.primaryGreen, fontWeight: 600, marginBottom: '0.5rem' }}>
              What happens next?
            </div>
            <ul style={{ textAlign: 'left', color: colors.muted, fontSize: '0.9rem' }}>
              <li style={{ marginBottom: '0.5rem' }}>• Your request will be reviewed by management</li>
              <li style={{ marginBottom: '0.5rem' }}>• You can then log in and access the app</li>
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
            Sign Out
          </button>
        </div>
      </div>
    </main>
  );
} 
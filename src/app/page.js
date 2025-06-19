'use client';

import '@/i18n'; // 👈 This loads your i18n config
import i18n from '@/i18n';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { signInWithEmailAndPassword, signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import colors from './colors';

// Simple function to check user type and redirect
const getRedirectPath = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      
      // Check user type and handle accordingly
      switch (userData.userType) {
        case 'admin':
          return '/admin/home';
        case 'pending_approval':
          return '/register/pending-approval';
        case 'user':
        default:
          return '/home';
      }
    }
    
    // If user doesn't exist, send to register
    return '/register';
  } catch (error) {
    console.error('Error checking user:', error);
    return '/register';
  }
};

export default function LoginPage() {
  const { t } = useTranslation(); // 👈 i18n hook
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        router.push('/redirect');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/redirect');
    } catch (err) {
      setError(t('error'));
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      router.push('/redirect');
    } catch (error) {
      console.error('Google Sign-In Error:', error.message);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center font-body px-4 phone-lg:px-0" style={{ background: colors.white }}>
      <div
        className="w-full max-w-xs phone-md:max-w-sm phone-lg:max-w-md mx-auto 
          bg-transparent rounded-none shadow-none p-0
          phone-lg:bg-white phone-lg:rounded-[2.5rem] phone-lg:shadow-lg phone-lg:p-[3.5rem_2.2rem]"
      >
        <h1 style={{ fontWeight: 700, fontSize: '1.5rem', textAlign: 'center', marginBottom: '1rem', color: colors.primaryGreen }}>
          Welcome to the future of the house
        </h1>
        <h2 style={{ fontWeight: 700, fontSize: '2.5rem', textAlign: 'center', marginBottom: '2.8rem' }}>Log in</h2>
        <form onSubmit={handleLogin} style={{ width: '100%' }}>
          <div style={{ marginBottom: '2.2rem' }}>
            <label style={{ display: 'block', color: colors.muted, fontWeight: 600, marginBottom: 2, fontSize: 18 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', border: 'none', borderBottom: `2px solid ${colors.muted}`, outline: 'none', fontSize: '1.25rem', padding: '0.7rem 0', background: 'transparent', marginBottom: 18 }}
              placeholder="your.email@example.com"
              required
            />
            <label style={{ display: 'block', color: colors.muted, fontWeight: 600, marginBottom: 2, fontSize: 18 }}>password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', border: 'none', borderBottom: `2px solid ${colors.muted}`, outline: 'none', fontSize: '1.25rem', padding: '0.7rem 0', background: 'transparent' }}
              placeholder="your password"
              required
            />
            <div style={{ marginTop: 12, marginBottom: 0 }}>
              <a href="#" style={{ color: colors.primaryGreen, fontSize: 16, textDecoration: 'none', fontWeight: 500 }}>Forgot password?</a>
            </div>
          </div>
          {error && <div style={{ color: 'red', marginBottom: 16 }}>{error}</div>}
          <button type="submit" style={{ width: '100%', background: colors.gold, color: colors.black, fontWeight: 700, fontSize: '1.35rem', border: 'none', borderRadius: 999, padding: '0.8rem 0', marginBottom: 32, marginTop: 12, cursor: 'pointer' }}>Log in</button>
        </form>
        
        {/* Separator Line */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
          <div style={{ flex: 1, height: '1px', background: colors.muted }}></div>
          <span style={{ margin: '0 16px', color: colors.muted, fontSize: 14 }}>or</span>
          <div style={{ flex: 1, height: '1px', background: colors.muted }}></div>
        </div>
        
        <button onClick={handleGoogleSignIn} 
          className="w-full flex items-center justify-center gap-3 font-semibold text-black px-0 py-0
            bg-transparent border-2 border-primaryGreen shadow-none
            phone-lg:bg-transparent phone-lg:border-2 phone-lg:border-primaryGreen phone-lg:shadow-md phone-lg:py-4 phone-lg:px-0 phone-lg:rounded-full"
          style={{ 
            maxWidth: 340, 
            marginBottom: 32,
            fontSize: '1.25rem',
            padding: '1rem 0',
            borderRadius: 999,
            borderColor: colors.primaryGreen,
            color: colors.primaryGreen,
            fontWeight: 600
          }}
        >
          <Image src="/google-logo.png" alt="Google" width={24} height={24} /> 
          Log in with Google
        </button>
        <div style={{ textAlign: 'center', fontSize: 18, color: colors.muted, width: '100%', maxWidth: 340 }}>
          Don&apos;t have a user yet? <a href="#" style={{ color: colors.primaryGreen, fontWeight: 600, textDecoration: 'none' }} onClick={e => { e.preventDefault(); router.push('/register'); }}>Sign up</a>
        </div>
      </div>
    </main>
  );
}

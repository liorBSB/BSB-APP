'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider, db } from '../../lib/firebase';
import colors from '../colors';
import Image from 'next/image';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push('/home');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Create user document with all required fields
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        isAdmin: false,
        status: 'home',
        roomNumber: '',
        roomLetter: '',
        createdAt: new Date()
      });
      
      router.push('/register/selection');
    } catch (err) {
      setError('Registration failed: ' + err.message);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const userRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(userRef);
      if (!docSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          fullName: user.displayName,
          status: 'home',
          roomNumber: '',
          roomLetter: '',
          isAdmin: false,
          createdAt: new Date()
        });
        router.push('/register/selection');
      } else {
        router.push('/home');
      }
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
        <h2 style={{ fontWeight: 700, fontSize: '2.5rem', textAlign: 'center', marginBottom: '2.8rem' }}>Sign up</h2>
        <form onSubmit={handleRegister} style={{ width: '100%' }}>
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
          </div>
          {error && <div style={{ color: 'red', marginBottom: 16 }}>{error}</div>}
          <button type="submit" style={{ width: '100%', background: colors.gold, color: colors.black, fontWeight: 700, fontSize: '1.35rem', border: 'none', borderRadius: 999, padding: '0.8rem 0', marginBottom: 32, marginTop: 12, cursor: 'pointer' }}>Sign up</button>
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
          <img src="/google-logo.png" alt="Google" style={{ width: 24, height: 24 }} /> 
          Sign up with Google
        </button>
        <div style={{ textAlign: 'center', fontSize: 16, color: colors.muted, width: '100%', maxWidth: 340 }}>
          Already have an account? <a href="#" style={{ color: colors.primaryGreen, fontWeight: 600, textDecoration: 'none' }} onClick={e => { e.preventDefault(); router.push('/'); }}>Log in</a>
        </div>
      </div>
    </main>
  );
}

'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider, db } from '../../lib/firebase';
import colors from '../colors';
import Image from 'next/image';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      router.push('/profile-setup');
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
        });
        router.push('/profile-setup');
      } else {
        router.push('/home');
      }
    } catch (error) {
      console.error('Google Sign-In Error:', error.message);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center font-body px-0" style={{ background: 'linear-gradient(135deg, #bfdbfe99 0%, #bbf7d0 100%)' }}>
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
          <button type="submit" style={{ width: '100%', background: colors.gold, color: colors.black, fontWeight: 700, fontSize: '1.35rem', border: 'none', borderRadius: 999, padding: '0.8rem 0', marginBottom: 32, marginTop: 12, cursor: 'pointer' }}>Sign up</button>
        </form>
        <button onClick={handleGoogleSignIn} style={{ width: '100%', maxWidth: 340, background: 'transparent', color: colors.black, fontWeight: 600, border: `2px solid ${colors.primaryGreen}`, borderRadius: 999, padding: '0.8rem 0', marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
          <img src="/google-logo.png" alt="Google" style={{ width: 28, height: 28, marginRight: 10 }} /> Sign up with Google
        </button>
        <div style={{ textAlign: 'center', fontSize: 16, color: colors.muted, width: '100%', maxWidth: 340 }}>
          Already have an account? <a href="#" style={{ color: colors.primaryGreen, fontWeight: 600, textDecoration: 'none' }} onClick={e => { e.preventDefault(); router.push('/'); }}>Log in</a>
        </div>
      </div>
    </main>
  );
}

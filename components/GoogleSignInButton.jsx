'use client';

import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider, db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function GoogleSignInButton() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

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
        router.push('/profile-setup');
      } else {
        router.push('/home');
      }
    } catch (error) {
      // Handle specific Firebase auth errors gracefully
      if (error.code === 'auth/popup-closed-by-user') {
        // User closed the popup - this is normal, no need to show error
        console.log('User closed Google sign-in popup');
        return;
      } else if (error.code === 'auth/cancelled-popup-request') {
        // User cancelled the popup request - also normal
        console.log('User cancelled Google sign-in popup');
        return;
      } else {
        // Log other errors for debugging
        console.error('Google Sign-In Error:', error.message);
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
      router.push('/');
    } catch (error) {
      console.error('Sign-Out Error:', error.message);
    }
  };

  if (user) {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-sm text-gray-600 text-center">
          Signed in as: <span className="font-medium">{user.email}</span>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center justify-center gap-3 px-6 py-2 border border-gray-300 rounded-full shadow-sm hover:shadow-md transition-all bg-red-50 text-sm font-medium text-red-700 hover:bg-red-100"
        >
          Sign Out
        </button>
        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="flex items-center justify-center gap-3 px-6 py-2 border border-gray-300 rounded-full shadow-sm hover:shadow-md transition-all bg-blue-50 text-sm font-medium text-blue-700 hover:bg-blue-100"
        >
          Switch Account
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleGoogleSignIn}
      className="flex items-center gap-3 px-6 py-2 border border-gray-300 rounded-full shadow-sm hover:shadow-md transition-all bg-white text-sm font-medium text-gray-700"
    >
      <img
        src="https://developers.google.com/identity/images/g-google.png"
        alt="Google logo"
        className="w-3 h-3"
      />
      Sign in with Google
    </button>
  );
}


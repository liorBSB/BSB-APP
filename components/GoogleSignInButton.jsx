'use client';

import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider, db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

export default function GoogleSignInButton() {
  const router = useRouter();

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
      console.error('Google Sign-In Error:', error.message);
    }
  };

  return (
    <button
      type="button"
      onClick={handleGoogleSignIn}
      className="flex items-center gap-3 px-6 py-2 border border-gray-300 rounded-full shadow-sm hover:shadow-md transition-all bg-white text-sm font-medium text-gray-700"
    >
      <img
        src="https://developers.google.com/identity/images/g-logo.png"
        alt="Google logo"
        className="w-3 h-3"
      />
      Sign in with Google
    </button>
  );
}


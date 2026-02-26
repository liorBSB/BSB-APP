'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function useAuthRedirect(redirectIfIncomplete = false) {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/');
        return;
      }

      if (redirectIfIncomplete) {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          router.push('/');
          return;
        }

        const userData = docSnap.data();

        if (userData.userType === 'user') {
          const hasProfile = userData.fullName && userData.fullName.trim() !== ''
            && userData.roomNumber && userData.roomNumber.trim() !== '';

          if (!hasProfile) {
            if (userData.roleChoice === 'live_here') {
              router.push('/profile-setup');
            } else {
              router.push('/register/selection');
            }
            return;
          }
        }
      }

      setIsReady(true);
    });

    return () => unsubscribe();
  }, [router, redirectIfIncomplete]);

  return isReady;
}

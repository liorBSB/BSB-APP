'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getStableAuthUser } from '@/lib/authState';

export default function useAuthRedirect(redirectIfIncomplete = false) {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const resolvedUser = user || await getStableAuthUser(auth);

      if (!resolvedUser) {
        router.push('/?next=' + encodeURIComponent(window.location.pathname));
        return;
      }

      if (redirectIfIncomplete) {
        const docRef = doc(db, 'users', resolvedUser.uid);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          router.push('/?next=' + encodeURIComponent(window.location.pathname));
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

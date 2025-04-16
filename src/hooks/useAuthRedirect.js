'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function useAuthRedirect(redirectIfIncomplete = false) {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const user = auth.currentUser;

      if (!user) {
        router.push('/');
        return;
      }

      if (redirectIfIncomplete) {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          router.push('/profile-setup');
        }
      }
    };

    checkAuth();
  }, [router, redirectIfIncomplete]);
}

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
      console.log('Current user:', user?.uid);

      if (!user) {
        console.log('No user found, redirecting to login');
        router.push('/');
        return;
      }

      if (redirectIfIncomplete) {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        console.log('Profile exists:', docSnap.exists());
        console.log('Profile data:', docSnap.data());

        if (!docSnap.exists()) {
          console.log('User document not found, redirecting to login');
          router.push('/');
          return;
        }

        const userData = docSnap.data();
        
        // Check if user-specific fields are missing
        if (userData.userType === 'user' && (!userData.roomNumber || !userData.fullName || userData.fullName.trim() === '' || userData.roomNumber.trim() === '')) {
          console.log('User profile incomplete, redirecting to selection');
          router.push('/register/selection');
          return;
        }
      }
    };

    checkAuth();
  }, [router, redirectIfIncomplete]);
}

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

      // #region agent log
      fetch('http://127.0.0.1:7376/ingest/622e0f72-8f44-4150-84ee-ce7476cc5432',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'295cab'},body:JSON.stringify({sessionId:'295cab',runId:'run1',hypothesisId:'H4',location:'src/hooks/useAuthRedirect.js:onAuthStateChanged',message:'protected route auth guard',data:{hasUser:!!resolvedUser,uid:resolvedUser?.uid||null,redirectIfIncomplete,pathname:typeof window!=='undefined'?window.location.pathname:'n/a'},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      if (!resolvedUser) {
        // #region agent log
        fetch('http://127.0.0.1:7376/ingest/622e0f72-8f44-4150-84ee-ce7476cc5432',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'295cab'},body:JSON.stringify({sessionId:'295cab',runId:'run1',hypothesisId:'H4',location:'src/hooks/useAuthRedirect.js:redirectToLogin',message:'redirecting unauthenticated user to root',data:{pathname:typeof window!=='undefined'?window.location.pathname:'n/a'},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
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

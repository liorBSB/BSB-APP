'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';

/**
 * Unified auth guard hook. Consumes the centralized AuthProvider context.
 *
 * Options:
 *   requireRole   - 'admin' | 'user' | undefined (any authenticated)
 *   redirectIfIncomplete - redirect to profile-setup if profile is missing
 *   fetchUserData - fetch the Firestore user doc and return it
 *
 * Returns { isReady, user, userData }
 */
export default function useAuthRedirect(options = {}) {
  // Support legacy boolean signature: useAuthRedirect(true)
  const opts =
    typeof options === 'boolean'
      ? { redirectIfIncomplete: options, fetchUserData: options }
      : options;

  const {
    requireRole,
    redirectIfIncomplete = false,
    fetchUserData = false,
  } = opts;

  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [userData, setUserData] = useState(null);
  const didRun = useRef(false);

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      const next = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';
      router.replace('/?next=' + encodeURIComponent(next));
      return;
    }

    if (!fetchUserData && !redirectIfIncomplete && !requireRole) {
      setIsReady(true);
      return;
    }

    if (didRun.current) return;
    didRun.current = true;

    const check = async () => {
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        router.replace('/?next=' + encodeURIComponent(window.location.pathname));
        return;
      }

      const data = docSnap.data();

      if (requireRole && data.userType !== requireRole) {
        router.replace('/');
        return;
      }

      if (redirectIfIncomplete && data.userType === 'user') {
        const hasProfile =
          data.fullName &&
          data.fullName.trim() !== '' &&
          data.roomNumber &&
          data.roomNumber.trim() !== '';

        if (!hasProfile) {
          if (data.roleChoice === 'live_here') {
            router.replace('/profile-setup');
          } else {
            router.replace('/register/selection');
          }
          return;
        }
      }

      if (redirectIfIncomplete && data.userType === 'admin') {
        if (!data.firstName || !data.lastName || !data.jobTitle) {
          router.replace('/admin/profile-setup');
          return;
        }
      }

      setUserData(data);
      setIsReady(true);
    };

    check();
  }, [isLoading, user, router, requireRole, redirectIfIncomplete, fetchUserData]);

  return { isReady, user, userData };
}

'use client';

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import {
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  getRedirectResult,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

const AuthContext = createContext({
  user: null,
  isLoading: true,
  weakPersistence: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [weakPersistence, setWeakPersistence] = useState(false);
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    let unsubscribe = () => {};

    const init = async () => {
      let persistenceLevel = 'local';
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch {
        try {
          await setPersistence(auth, browserSessionPersistence);
          persistenceLevel = 'session';
        } catch {
          try {
            await setPersistence(auth, inMemoryPersistence);
            persistenceLevel = 'memory';
          } catch {
            persistenceLevel = 'none';
          }
        }
      }

      if (persistenceLevel === 'memory' || persistenceLevel === 'none') {
        setWeakPersistence(true);
      }

      getRedirectResult(auth).catch(() => {});

      unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        setUser(firebaseUser);
        setIsLoading(false);
      });
    };

    init();

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, weakPersistence }}>
      {children}
    </AuthContext.Provider>
  );
}

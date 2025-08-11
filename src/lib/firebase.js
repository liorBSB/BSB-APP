// src/lib/firebase.js

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth,GoogleAuthProvider  } from 'firebase/auth';
import { getFirestore, collection, addDoc, Timestamp, getDocs, writeBatch } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: "AIzaSyBKggC-pkA1U-CNNc08ByLcDeoYDrkYVwU",
    authDomain: "bsb-app-e37dc.firebaseapp.com",
    projectId: "bsb-app-e37dc",
    // IMPORTANT: Use the actual bucket name shown in Firebase Storage console
    // e.g., gs://bsb-app-e37dc.firebasestorage.app
    storageBucket: "bsb-app-e37dc.firebasestorage.app", 
    messagingSenderId: "42055438329",
    appId: "1:42055438329:web:405e792e16eb8d2eed7728"
  };

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
// Use the default bucket from firebaseConfig.storageBucket to avoid mismatches
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();



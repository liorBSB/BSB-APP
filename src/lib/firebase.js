// src/lib/firebase.js

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth,GoogleAuthProvider  } from 'firebase/auth';
import { getFirestore, collection, addDoc, Timestamp, getDocs, writeBatch } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: "AIzaSyBKggC-pkA1U-CNNc08ByLcDeoYDrkYVwU",
    authDomain: "bsb-app-e37dc.firebaseapp.com",
    projectId: "bsb-app-e37dc",
    storageBucket: "bsb-app-e37dc.appspot.com", 
    messagingSenderId: "42055438329",
    appId: "1:42055438329:web:405e792e16eb8d2eed7728"
  };

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();



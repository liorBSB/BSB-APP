// src/lib/firebase.js

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: "AIzaSyBJ-CnEzD3S_VxFqLYBdiIOBKAekPKFP9E",
    authDomain: "house-efficiency.firebaseapp.com",
    projectId: "house-efficiency",
    storageBucket: "house-efficiency.firebasestorage.app",
    messagingSenderId: "77988263985",
    appId: "1:77988263985:web:d208499280c4d70625fd10"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// src/lib/firebase.js

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: "AIzaSyDtHVwDCa48LuYRTLiRsWRCLDxEIPg3vDw",
    authDomain: "house-efficiency-app.firebaseapp.com",
    projectId: "house-efficiency-app",
    storageBucket: "house-efficiency-app.firebasestorage.app",
    messagingSenderId: "29634399630",
    appId: "1:29634399630:web:072e9ce5e029f5d3e768df"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// src/lib/firebase.js

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth,GoogleAuthProvider  } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyBKggC-pkA1U-CNNc08ByLcDeoYDrkYVwU",
    authDomain: "bsb-app-e37dc.firebaseapp.com",
    projectId: "bsb-app-e37dc",
    storageBucket: "bsb-app-e37dc.appspot.com", // <-- FIXED THIS LINE
    messagingSenderId: "42055438329",
    appId: "1:42055438329:web:405e792e16eb8d2eed7728"
  };

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// --- DEVELOPMENT/SEEDING SCRIPT ---
async function seedExampleData() {
  // Example data
  const now = new Date();
  const future1 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 1 week from now
  const future2 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 2 weeks from now
  const future3 = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000); // 3 weeks from now

  const surveys = [
    { title: 'Survey 1', body: 'How do you like our app?', dueDate: Timestamp.fromDate(future1) },
    { title: 'Survey 2', body: 'What features do you want?', dueDate: Timestamp.fromDate(future2) },
  ];
  const messages = [
    { title: 'Welcome!', body: 'Thanks for joining!', dueDate: Timestamp.fromDate(future1) },
    { title: 'Update', body: 'New features released.', dueDate: Timestamp.fromDate(future3) },
  ];
  const events = [
    { title: 'Launch Party', body: 'Join us for the launch!', dueDate: Timestamp.fromDate(future2) },
    { title: 'Webinar', body: 'Learn how to use the app.', dueDate: Timestamp.fromDate(future3) },
  ];

  for (const doc of surveys) {
    await addDoc(collection(db, 'surveys'), doc);
  }
  for (const doc of messages) {
    await addDoc(collection(db, 'messages'), doc);
  }
  for (const doc of events) {
    await addDoc(collection(db, 'events'), doc);
  }
  console.log('Seeded example data!');
}

// Uncomment to run once for seeding:
seedExampleData();

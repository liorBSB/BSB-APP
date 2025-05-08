'use client';
import useAuthRedirect from '@/hooks/useAuthRedirect';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useTranslation } from 'react-i18next';

export default function ProfileSetup() {
  const router = useRouter();
  const { t, i18n } = useTranslation('profilesetup');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [roomLetter, setRoomLetter] = useState('');
  const [error, setError] = useState('');

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  const handleSave = async (e) => {
    e.preventDefault();

    const uid = auth.currentUser?.uid;
    if (!uid) {
      setError('No authenticated user');
      return;
    }

    try {
      await setDoc(doc(db, 'users', uid), {
        fullName: `${firstName} ${lastName}`,
        firstName,
        lastName,
        roomNumber: `${roomNumber}${roomLetter}`,
        roomNumberOnly: roomNumber,
        roomLetter,
        email: auth.currentUser.email,
        status: 'home', // default status
      });

      router.push('/home');
    } catch (err) {
      setError('Failed to save profile: ' + err.message);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background">
      {/* Status Bar */}
      <div className="w-full max-w-md h-11 bg-primary flex justify-between items-center px-5 rounded-t-xl text-white">
        <div className="text-sm font-medium">9:41</div>
        <div className="flex gap-1.5">
          <div className="w-4.5 h-4.5">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="w-4.5 h-4.5">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
          </div>
          <div className="w-4.5 h-4.5">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSave}
        className="relative bg-white shadow-md rounded-b-xl p-6 w-full max-w-md"
      >
        {/* Language Toggle */}
        <div className="absolute top-4 right-6 flex gap-2">
          <button
            type="button"
            onClick={() => changeLanguage('en')}
            className={`px-3 py-1 rounded-full text-xs ${
              i18n.language === 'en'
                ? 'bg-primary text-white'
                : 'border border-primary text-primary'
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => changeLanguage('he')}
            className={`px-3 py-1 rounded-full text-xs ${
              i18n.language === 'he'
                ? 'bg-primary text-white'
                : 'border border-primary text-primary'
            }`}
          >
            HE
          </button>
        </div>

        <div className="mt-8 mb-8 text-center">
          <h1 className="text-2xl font-semibold text-primary mb-2">
            {t('completeProfile')}
          </h1>
          <p className="text-sm text-muted">
            {t('fillDetails')}
          </p>
        </div>

        <div className="bg-surface rounded-xl p-6 shadow-sm">
          <div className="mb-5">
            <label htmlFor="firstName" className="block text-sm font-medium mb-2 text-text">
              {t('firstName')}
            </label>
            <input
              id="firstName"
              type="text"
              placeholder={t('enterFirstName')}
              className="border border-gray-200 rounded-xl w-full p-3.5 focus:outline-none focus:border-primary bg-white"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>

          <div className="mb-5">
            <label htmlFor="lastName" className="block text-sm font-medium mb-2 text-text">
              {t('lastName')}
            </label>
            <input
              id="lastName"
              type="text"
              placeholder={t('enterLastName')}
              className="border border-gray-200 rounded-xl w-full p-3.5 focus:outline-none focus:border-primary bg-white"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>

          <div className="mb-5">
            <label htmlFor="roomNumber" className="block text-sm font-medium mb-2 text-text">
              {t('roomNumber')}
            </label>
            <div className="flex gap-3">
              <input
                id="roomNumber"
                type="text"
                placeholder={t('number')}
                className="border border-gray-200 rounded-xl w-full p-3.5 focus:outline-none focus:border-primary bg-white flex-3"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                required
              />
              <select
                id="roomLetter"
                className="border border-gray-200 rounded-xl p-3.5 focus:outline-none focus:border-primary bg-white flex-1"
                value={roomLetter}
                onChange={(e) => setRoomLetter(e.target.value)}
                required
              >
                <option value="">{t('letter')}</option>
                <option value="א">א</option>
                <option value="ב">ב</option>
                <option value="ג">ג</option>
              </select>
            </div>
          </div>

          {error && <p className="text-error text-sm mb-4">{error}</p>}

          <button
            type="submit"
            className="bg-primary hover:bg-opacity-90 text-white w-full py-4 rounded-xl font-semibold mt-6"
          >
            {t('continue')}
          </button>
          
          <button
            type="button"
            onClick={() => signOut(auth).then(() => router.push('/'))}
            className="mt-4 w-full py-3.5 rounded-xl border border-accent text-accent hover:bg-accent hover:bg-opacity-5 font-medium"
          >
            {t('logout')}
          </button>
        </div>
      </form>
    </main>
  );
}
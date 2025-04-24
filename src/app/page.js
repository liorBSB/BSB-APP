'use client';

import '@/i18n'; // 👈 This loads your i18n config
import i18n from '@/i18n';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import GoogleSignInButton from '../../components/GoogleSignInButton';

export default function LoginPage() {
  const { t } = useTranslation(); // 👈 i18n hook
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/home');
    } catch (err) {
      setError(t('error'));
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#F5F5F5] font-[Poppins]">
      <div className="text-4xl mb-2">🏠</div>
      <h1 className="text-lg font-semibold mb-1">{t('title')}</h1>
      <p className="text-sm mb-6 text-gray-600">{t('subtitle')}</p>

      <form
        onSubmit={handleLogin}
        className="bg-white shadow-md rounded-lg w-full max-w-sm p-6 space-y-4"
      >
        <div>
          <label className="block text-sm mb-1">{t('email')}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border px-3 py-2 rounded-md"
            placeholder="your.email@example.com"
            required
          />
        </div>

        <div>
          <label className="block text-sm mb-1">{t('password')}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border px-3 py-2 rounded-md"
            placeholder={t('password_placeholder')}
            required
          />
        </div>

        <GoogleSignInButton />

        <div className="flex justify-between items-center text-sm">
          <label className="flex items-center gap-1">
            <input type="checkbox" className="accent-[#4CAF50]" /> {t('remember')}
          </label>
          <button type="button" className="text-[#4CAF50] hover:underline">
            {t('forgot')}
          </button>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          className="w-full bg-[#4CAF50] hover:bg-green-600 text-white py-2 rounded-md font-semibold"
        >
          ➜ {t('login')}
        </button>
      </form>

      <p className="mt-4 text-sm">
        {t('no_account')}{' '}
        <button
          onClick={() => router.push('/register')}
          className="text-[#4CAF50] font-medium hover:underline"
        >
          {t('register')}
        </button>
      </p>

      <button
        onClick={() => router.push('/crew-login')}
        className="mt-4 border border-[#7A5C43] text-[#7A5C43] px-4 py-2 rounded-md text-sm hover:bg-[#7A5C43]/10"
      >
        👥 {t('crew_login')}
      </button>

      <div className="mt-6">
  <button
    onClick={() => {
      const nextLang = i18n.language === 'en' ? 'he' : 'en';
      i18n.changeLanguage(nextLang);
      document.documentElement.dir = nextLang === 'he' ? 'rtl' : 'ltr';
    }}
    className="text-sm underline text-gray-600 hover:text-black"
  >
    {i18n.language === 'en' ? 'עברית' : 'English'}
  </button>
</div>

    </main>
  );
}

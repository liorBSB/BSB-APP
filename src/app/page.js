// src/app/login/page.js
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import GoogleSignInButton from '@/components/GoogleSignInButton';


export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/home'); // or wherever your main page is
    } catch (err) {
      setError('Incorrect email or password');
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#F5F5F5] font-[Poppins]">
      <div className="text-4xl mb-2">🏠</div>
      <h1 className="text-lg font-semibold mb-1">HABAYIT SHEL BENJI</h1>
      <p className="text-sm mb-6 text-gray-600">Welcome to your home away from home!</p>

      <form
        onSubmit={handleLogin}
        className="bg-white shadow-md rounded-lg w-full max-w-sm p-6 space-y-4"
      >
        <div>
          <label className="block text-sm mb-1">Email Address</label>
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
          <label className="block text-sm mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border px-3 py-2 rounded-md"
            placeholder="Enter your password"
            required
          />
        </div>

        <GoogleSignInButton />

        <div className="flex justify-between items-center text-sm">
          <label className="flex items-center gap-1">
            <input type="checkbox" className="accent-[#4CAF50]" /> Remember me
          </label>
          <button type="button" className="text-[#4CAF50] hover:underline">
            Forgot password?
          </button>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          className="w-full bg-[#4CAF50] hover:bg-green-600 text-white py-2 rounded-md font-semibold"
        >
          ➜ Login
        </button>
      </form>

      <p className="mt-4 text-sm">
        Don’t have an account?{' '}
        <button
          onClick={() => router.push('/register')}
          className="text-[#4CAF50] font-medium hover:underline"
        >
          Register here
        </button>
      </p>

      <button
        onClick={() => router.push('/crew-login')}
        className="mt-4 border border-[#7A5C43] text-[#7A5C43] px-4 py-2 rounded-md text-sm hover:bg-[#7A5C43]/10"
      >
        👥 Crew / Admin Login
      </button>
    </main>
  );
}

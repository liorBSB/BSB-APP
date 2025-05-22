"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import colors from '../../colors';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../../lib/firebase';

export default function AdminRegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [error, setError] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    // Securely check admin code via API
    const res = await fetch("/api/check-admin-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: adminCode })
    });
    if (!res.ok) {
      setError("Invalid admin code.");
      return;
    }
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      router.push('/admin/profile-setup');
    } catch (err) {
      setError('Registration failed: ' + err.message);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center font-body px-4 phone-lg:px-0" style={{ background: colors.white }}>
      <div className="w-full max-w-xs phone-md:max-w-sm phone-lg:max-w-md mx-auto 
        bg-transparent rounded-none shadow-none p-0
        phone-lg:bg-white phone-lg:rounded-[2.5rem] phone-lg:shadow-lg phone-lg:p-[3.5rem_2.2rem]">
        <h2 style={{ fontWeight: 700, fontSize: '2.5rem', textAlign: 'center', marginBottom: '2.8rem' }}>Admin Register</h2>
        <form onSubmit={handleRegister} style={{ width: '100%' }}>
          <div style={{ marginBottom: '2.2rem' }}>
            <label style={{ display: 'block', color: colors.muted, fontWeight: 600, marginBottom: 2, fontSize: 18 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', border: 'none', borderBottom: `2px solid ${colors.muted}`, outline: 'none', fontSize: '1.25rem', padding: '0.7rem 0', background: 'transparent', marginBottom: 18 }}
              placeholder="admin@email.com"
              required
            />
            <label style={{ display: 'block', color: colors.muted, fontWeight: 600, marginBottom: 2, fontSize: 18 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', border: 'none', borderBottom: `2px solid ${colors.muted}`, outline: 'none', fontSize: '1.25rem', padding: '0.7rem 0', background: 'transparent' }}
              placeholder="your password"
              required
            />
            <label style={{ display: 'block', color: colors.muted, fontWeight: 600, marginBottom: 2, fontSize: 18 }}>Admin Code</label>
            <input
              type="text"
              value={adminCode}
              onChange={e => setAdminCode(e.target.value)}
              style={{ width: '100%', border: 'none', borderBottom: `2px solid ${colors.muted}`, outline: 'none', fontSize: '1.25rem', padding: '0.7rem 0', background: 'transparent', marginBottom: 18 }}
              placeholder="Enter admin code"
              required
            />
          </div>
          {error && <div style={{ color: 'red', marginBottom: 16 }}>{error}</div>}
          <button type="submit" style={{ width: '100%', background: colors.gold, color: colors.black, fontWeight: 700, fontSize: '1.35rem', border: 'none', borderRadius: 999, padding: '0.8rem 0', marginBottom: 32, marginTop: 12, cursor: 'pointer' }}>Register</button>
        </form>
        <button
          className="w-full flex items-center justify-center gap-2 font-semibold text-black px-0 py-0 bg-transparent border-none shadow-none phone-lg:bg-white phone-lg:border-2 phone-lg:border-primaryGreen phone-lg:shadow-md phone-lg:py-3 phone-lg:px-0 phone-lg:rounded-full"
          style={{ maxWidth: 340, marginBottom: 32 }}
          onClick={() => router.push('/admin/login')}
        >
          Back to Admin Login
        </button>
        <button
          className="w-full flex items-center justify-center gap-2 font-semibold text-black px-0 py-0 bg-transparent border-none shadow-none phone-lg:bg-white phone-lg:border-2 phone-lg:border-primaryGreen phone-lg:shadow-md phone-lg:py-3 phone-lg:px-0 phone-lg:rounded-full"
          style={{ maxWidth: 340, marginBottom: 32 }}
          onClick={() => router.push('/')}
        >
          Back to User Login
        </button>
      </div>
    </main>
  );
} 
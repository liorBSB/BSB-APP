"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import colors from '../../colors';
import { createUserWithEmailAndPassword, fetchSignInMethodsForEmail } from 'firebase/auth';
import { auth } from '../../../lib/firebase';

export default function AdminRegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    adminCode: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAlreadyRegistered, setShowAlreadyRegistered] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Check if user already exists
      const signInMethods = await fetchSignInMethodsForEmail(auth, formData.email);
      if (signInMethods.length > 0) {
        setShowAlreadyRegistered(true);
        setLoading(false);
        return;
      }

      // Check admin code
      const response = await fetch('/api/check-admin-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: formData.adminCode }),
      });

      if (!response.ok) {
        throw new Error('Invalid admin code');
      }

      // Create user
      await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      router.push('/admin/profile-setup');
    } catch (error) {
      console.error('Registration error:', error);
      // Check if it's an email-already-in-use error
      if (error.code === 'auth/email-already-in-use') {
        setShowAlreadyRegistered(true);
      } else {
        setError(error.message);
      }
    } finally {
      setLoading(false);
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
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              style={{ width: '100%', border: 'none', borderBottom: `2px solid ${colors.muted}`, outline: 'none', fontSize: '1.25rem', padding: '0.7rem 0', background: 'transparent', marginBottom: 18 }}
              placeholder="admin@email.com"
              required
            />
            <label style={{ display: 'block', color: colors.muted, fontWeight: 600, marginBottom: 2, fontSize: 18 }}>Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              style={{ width: '100%', border: 'none', borderBottom: `2px solid ${colors.muted}`, outline: 'none', fontSize: '1.25rem', padding: '0.7rem 0', background: 'transparent' }}
              placeholder="your password"
              required
            />
            <label style={{ display: 'block', color: colors.muted, fontWeight: 600, marginBottom: 2, fontSize: 18 }}>Admin Code</label>
            <input
              type="text"
              value={formData.adminCode}
              onChange={(e) => setFormData({ ...formData, adminCode: e.target.value })}
              style={{ width: '100%', border: 'none', borderBottom: `2px solid ${colors.muted}`, outline: 'none', fontSize: '1.25rem', padding: '0.7rem 0', background: 'transparent', marginBottom: 18 }}
              placeholder="Enter admin code"
              required
            />
          </div>
          {error && <div style={{ color: 'red', marginBottom: 16 }}>{error}</div>}
          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              width: '100%', 
              background: colors.gold, 
              color: colors.black, 
              fontWeight: 700, 
              fontSize: '1.35rem', 
              border: 'none', 
              borderRadius: 999, 
              padding: '0.8rem 0', 
              marginBottom: 32, 
              marginTop: 12, 
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
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

      {/* Already Registered Modal */}
      {showAlreadyRegistered && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-lg w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">Already Registered</h2>
            <p className="text-gray-600 mb-6">This email is already registered. Please log in instead.</p>
            <button
              onClick={() => router.push('/admin/login')}
              className="w-full px-4 py-2 rounded-lg text-white font-semibold"
              style={{ background: colors.gold }}
            >
              Go to Login
            </button>
          </div>
        </div>
      )}
    </main>
  );
} 
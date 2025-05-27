"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import colors from '../../colors';

export default function AdminProfileSetupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    jobTitle: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No user logged in');
      }

      // Save profile data to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        firstName: formData.firstName,
        lastName: formData.lastName,
        fullName: `${formData.firstName} ${formData.lastName}`,
        jobTitle: formData.jobTitle,
        email: user.email,
        isAdmin: true,
        createdAt: new Date(),
      });

      // Redirect to admin home
      router.push('/admin/home');
    } catch (error) {
      console.error('Profile setup error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center font-body px-4 phone-lg:px-0" style={{ background: colors.white }}>
      <div className="w-full max-w-xs phone-md:max-w-sm phone-lg:max-w-md mx-auto 
        bg-transparent rounded-none shadow-none p-0
        phone-lg:bg-white phone-lg:rounded-[2.5rem] phone-lg:shadow-lg phone-lg:p-[3.5rem_2.2rem]">
        <h2 style={{ fontWeight: 700, fontSize: '2.5rem', textAlign: 'center', marginBottom: '2.8rem' }}>Complete Your Profile</h2>
        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <div style={{ marginBottom: '2.2rem' }}>
            <label style={{ display: 'block', color: colors.muted, fontWeight: 600, marginBottom: 2, fontSize: 18 }}>First Name</label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              style={{ width: '100%', border: 'none', borderBottom: `2px solid ${colors.muted}`, outline: 'none', fontSize: '1.25rem', padding: '0.7rem 0', background: 'transparent', marginBottom: 18 }}
              placeholder="Enter your first name"
              required
            />
            <label style={{ display: 'block', color: colors.muted, fontWeight: 600, marginBottom: 2, fontSize: 18 }}>Last Name</label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              style={{ width: '100%', border: 'none', borderBottom: `2px solid ${colors.muted}`, outline: 'none', fontSize: '1.25rem', padding: '0.7rem 0', background: 'transparent', marginBottom: 18 }}
              placeholder="Enter your last name"
              required
            />
            <label style={{ display: 'block', color: colors.muted, fontWeight: 600, marginBottom: 2, fontSize: 18 }}>Job Title</label>
            <input
              type="text"
              value={formData.jobTitle}
              onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
              style={{ width: '100%', border: 'none', borderBottom: `2px solid ${colors.muted}`, outline: 'none', fontSize: '1.25rem', padding: '0.7rem 0', background: 'transparent' }}
              placeholder="Enter your job title"
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
            {loading ? 'Saving...' : 'Complete Setup'}
          </button>
        </form>
      </div>
    </main>
  );
} 
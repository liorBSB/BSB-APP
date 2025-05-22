"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import colors from '../../colors';

export default function AdminProfileSetup() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [jobTitle, setJobTitle] = useState('Manager');
  const [showTitles, setShowTitles] = useState(false);
  const [error, setError] = useState('');

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
        jobTitle,
        email: auth.currentUser.email,
        IsAdmin: true,
      }, { merge: true });
      router.push('/admin');
    } catch (err) {
      setError('Failed to save profile: ' + err.message);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center font-body px-4 phone-lg:px-0" style={{ background: colors.white }}>
      <div
        className="w-full max-w-xs phone-md:max-w-sm phone-lg:max-w-md mx-auto 
          bg-transparent rounded-none shadow-none p-0
          phone-lg:bg-white phone-lg:rounded-[2.5rem] phone-lg:shadow-lg phone-lg:p-[3.5rem_2.2rem]"
      >
        <h2 style={{ fontWeight: 700, fontSize: '2.5rem', textAlign: 'center', marginBottom: '2.8rem' }}>Admin Profile Setup</h2>
        <form onSubmit={handleSave}>
          <div style={{ marginBottom: '2.2rem' }}>
            <label style={{ display: 'block', color: colors.muted, fontWeight: 600, marginBottom: 2, fontSize: 18 }}>First Name</label>
            <input
              type="text"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              style={{ width: '100%', border: 'none', borderBottom: `2px solid ${colors.muted}`, outline: 'none', fontSize: '1.25rem', padding: '0.4rem 0', background: 'transparent', marginBottom: 18 }}
              placeholder="Enter your first name"
              required
            />
            <label style={{ display: 'block', color: colors.muted, fontWeight: 600, marginBottom: 2, fontSize: 18 }}>Last Name</label>
            <input
              type="text"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              style={{ width: '100%', border: 'none', borderBottom: `2px solid ${colors.muted}`, outline: 'none', fontSize: '1.25rem', padding: '0.4rem 0', background: 'transparent', marginBottom: 18 }}
              placeholder="Enter your last name"
              required
            />
            <label style={{ display: 'block', color: colors.muted, fontWeight: 600, marginBottom: 2, fontSize: 18 }}>Job Title</label>
            <div style={{ position: 'relative', marginBottom: 18 }}>
              <input
                type="text"
                value={jobTitle}
                readOnly
                onClick={() => setShowTitles(v => !v)}
                style={{ width: '100%', border: 'none', borderBottom: `2px solid ${colors.muted}`, outline: 'none', fontSize: '1.25rem', padding: '0.4rem 0', background: 'transparent', cursor: 'pointer' }}
                placeholder="Select job title"
                required
              />
              <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 10, background: colors.white, border: `1px solid ${colors.muted}`, borderRadius: 8, display: showTitles ? 'block' : 'none' }}>
                <div
                  style={{ padding: 12, cursor: 'pointer', fontWeight: jobTitle === 'Manager' ? 700 : 400 }}
                  onClick={() => { setJobTitle('Manager'); setShowTitles(false); }}
                >Manager</div>
                {/* Add more job titles here as needed */}
              </div>
            </div>
          </div>
          {error && <p style={{ color: colors.red, fontSize: 16, marginBottom: 16 }}>{error}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <button type="submit" style={{ width: '100%', background: colors.gold, color: colors.black, fontWeight: 700, fontSize: '1.35rem', border: 'none', borderRadius: 999, padding: '0.8rem 0', cursor: 'pointer' }}>Save</button>
            <button
              type="button"
              onClick={() => signOut(auth).then(() => router.push('/admin/login'))}
              style={{ width: '100%', background: 'transparent', color: colors.primaryGreen, fontWeight: 600, border: `2px solid ${colors.primaryGreen}`, borderRadius: 999, padding: '0.8rem 0', fontSize: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}
            >
              Log Out
            </button>
          </div>
        </form>
      </div>
    </main>
  );
} 
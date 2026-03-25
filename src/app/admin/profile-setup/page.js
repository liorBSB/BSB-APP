"use client";
import '@/i18n';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import useAuthRedirect from '@/hooks/useAuthRedirect';
import colors from '../../colors';
import { resetUserToPreSelection } from '@/lib/database';
import HouseLoader from '@/components/HouseLoader';

export default function AdminProfileSetupPage() {
  const router = useRouter();
  const { t, i18n } = useTranslation('profilesetup');
  const isRTL = i18n.language?.startsWith('he');
  const isReady = useAuthRedirect();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    jobTitle: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No user logged in');
      }

      const userRef = doc(db, 'users', user.uid);
      const existingDoc = await getDoc(userRef);
      if (existingDoc.exists() && existingDoc.data().userType === 'admin') {
        router.push('/admin/home');
        return;
      }

      const batch = writeBatch(db);

      batch.set(userRef, {
        uid: user.uid,
        firstName: formData.firstName,
        lastName: formData.lastName,
        fullName: `${formData.firstName} ${formData.lastName}`,
        jobTitle: formData.jobTitle,
        email: user.email,
        userType: 'pending_approval',
      }, { merge: true });

      batch.set(doc(db, 'approvalRequests', user.uid), {
        userId: user.uid,
        userEmail: user.email,
        userName: `${formData.firstName} ${formData.lastName}`,
        jobTitle: formData.jobTitle,
        requestType: 'work_here',
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await batch.commit();

      router.push('/register/pending-approval');
    } catch (error) {
      console.error('Profile setup error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartOver = async () => {
    setIsResetting(true);
    setResetError('');
    try {
      await resetUserToPreSelection(auth.currentUser);
      router.push('/register/selection');
    } catch (err) {
      console.error('Reset choice error:', err);
      setResetError(t('start_over_failed', 'Failed to start over. Please try again.'));
    } finally {
      setIsResetting(false);
    }
  };

  if (!isReady) {
    return (
      <main className="min-h-screen flex items-center justify-center font-body" style={{ background: colors.white }}>
        <HouseLoader size={80} text={t('loading')} />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center font-body px-4 phone-lg:px-0" style={{ background: colors.white }}>
      <div className="w-full max-w-xs phone-md:max-w-sm phone-lg:max-w-md mx-auto
        bg-white rounded-[2.5rem] shadow-lg p-[2.25rem_1.25rem]
        phone-lg:p-[3.5rem_2.2rem]">
        <h2 dir={isRTL ? 'rtl' : 'ltr'} style={{ fontWeight: 700, fontSize: '2.5rem', textAlign: 'center', marginBottom: '2.8rem' }}>{t('completeProfile')}</h2>
        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <div style={{ marginBottom: '2.2rem' }}>
            <label style={{ display: 'block', color: colors.muted, fontWeight: 600, marginBottom: 2, fontSize: 18 }}>{t('admin_first_name')}</label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              style={{ width: '100%', border: 'none', borderBottom: `2px solid ${colors.muted}`, outline: 'none', fontSize: '1.25rem', padding: '0.7rem 0', background: 'transparent', marginBottom: 18 }}
              placeholder={t('admin_enter_first_name')}
              required
            />
            <label style={{ display: 'block', color: colors.muted, fontWeight: 600, marginBottom: 2, fontSize: 18 }}>{t('admin_last_name')}</label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              style={{ width: '100%', border: 'none', borderBottom: `2px solid ${colors.muted}`, outline: 'none', fontSize: '1.25rem', padding: '0.7rem 0', background: 'transparent', marginBottom: 18 }}
              placeholder={t('admin_enter_last_name')}
              required
            />
            <label style={{ display: 'block', color: colors.muted, fontWeight: 600, marginBottom: 2, fontSize: 18 }}>{t('admin_job_title')}</label>
            <input
              type="text"
              value={formData.jobTitle}
              onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
              style={{ width: '100%', border: 'none', borderBottom: `2px solid ${colors.muted}`, outline: 'none', fontSize: '1.25rem', padding: '0.7rem 0', background: 'transparent' }}
              placeholder={t('admin_enter_job_title')}
              required
            />
          </div>
          {error && <div style={{ color: 'red', marginBottom: 16 }}>{error}</div>}
          {resetError && <div style={{ color: 'red', marginBottom: 16 }}>{resetError}</div>}
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
            {loading ? t('admin_saving') : t('admin_complete_setup')}
          </button>

          <button
            type="button"
            onClick={handleStartOver}
            disabled={isResetting || loading}
            style={{ 
              width: '100%', 
              background: 'transparent', 
              color: colors.red, 
              fontWeight: 700, 
              fontSize: '1.1rem', 
              border: `2px solid ${colors.red}`, 
              borderRadius: 999, 
              padding: '0.8rem 0', 
              cursor: isResetting || loading ? 'not-allowed' : 'pointer',
              opacity: isResetting || loading ? 0.7 : 1
            }}
          >
            {isResetting ? t('loading', 'Loading...') : t('go_back', 'Go back')}
          </button>
        </form>
      </div>
    </main>
  );
} 
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import '@/i18n';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import HouseLoader from '@/components/HouseLoader';
import colors from '../../colors';
import AdminBottomNavBar from '@/components/AdminBottomNavBar';
import EditFieldModal from '@/components/EditFieldModal';
import DeleteAccountModal from '@/components/DeleteAccountModal';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { cleanupExpiredPhotos } from '@/lib/storageCleanup';

export default function AdminSettingsPage() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [fields, setFields] = useState({
    name: '',
    title: '',
    email: '',
  });
  const [editField, setEditField] = useState(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupConfirm, setCleanupConfirm] = useState(false);
  const [cleanupProgress, setCleanupProgress] = useState(null);
  const [cleanupResult, setCleanupResult] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/');
        return;
      }
      const userRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(userRef);
      if (!docSnap.exists() || docSnap.data().userType !== 'admin') {
        router.push('/');
        return;
      }
      const data = docSnap.data();
      setFields({
        name: data.fullName || '',
        title: data.jobTitle || '',
        email: data.email || '',
      });
      setIsCheckingAuth(false);
    });
    return () => unsubscribe();
  }, [router]);

  const handleSaveField = async (field, value) => {
    setSaving(true);
    setSuccess('');
    setError('');
    try {
      const user = auth.currentUser;
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        let updateObj = {};
        if (field === 'name') updateObj.fullName = value;
        if (field === 'title') updateObj.jobTitle = value;
        if (field === 'email') updateObj.email = value;
        await updateDoc(userRef, updateObj);
        setFields(prev => ({ ...prev, [field]: value }));
        setSuccess('Saved successfully!');
      }
    } catch (e) {
      setError('Error saving. Please try again.');
    }
    setSaving(false);
    setEditField(null);
  };

  const runCleanup = async () => {
    setCleanupConfirm(false);
    setCleanupRunning(true);
    setCleanupProgress(null);
    setCleanupResult(null);
    try {
      const result = await cleanupExpiredPhotos((progress) => {
        setCleanupProgress(progress);
      });
      setCleanupResult(result);
    } catch (err) {
      console.error('Cleanup failed:', err);
      setError('Cleanup failed. Check console for details.');
    } finally {
      setCleanupRunning(false);
    }
  };

  const fieldLabels = {
    name: 'Full Name',
    title: 'Job Title',
    email: 'Email',
  };

  if (isCheckingAuth) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-200/60 to-green-100/60 font-body flex items-center justify-center">
        <HouseLoader />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-200/60 to-green-100/60 font-body flex flex-col items-center pt-6 pb-32 px-4">
      <div className="w-full max-w-md">
        <div className="w-full max-w-md rounded-2xl px-5 pt-6 pb-4 mb-6 bg-white/10 backdrop-blur-md shadow-sm">
          <h1 className="text-2xl font-bold text-text">Admin Settings</h1>
          <p className="text-sm text-muted">Manage your admin profile</p>
        </div>

        <div className="w-full max-w-md rounded-2xl p-4 mb-6" style={{ background: colors.sectionBg }}>
          {saving ? (
            <div className="text-center text-white py-4">Saving...</div>
          ) : (
            <>
              {Object.keys(fields).map((field) => (
                <div key={field} className="flex items-center justify-between w-full bg-transparent rounded-xl shadow-none p-5 mb-6 border-b border-white/20">
                  <div>
                    <div className="font-semibold text-white text-lg mb-1">{fieldLabels[field]}</div>
                    <div className="text-base text-white/80 mt-1">{fields[field]}</div>
                  </div>
                  <button
                    className="ml-4 p-3 rounded-full hover:bg-[#EDC381]/20"
                    onClick={() => setEditField(field)}
                    aria-label="Edit"
                  >
                    <svg width="28" height="28" fill="none" stroke="#EDC381" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19.5 3 21l1.5-4L16.5 3.5z"/></svg>
                  </button>
                </div>
              ))}
              {success && <div className="text-green-300 text-lg mb-2">{success}</div>}
              {error && <div className="text-red-300 text-lg mb-2">{error}</div>}
            </>
          )}
        </div>

        {/* Storage Maintenance */}
        <div className="w-full max-w-md rounded-2xl p-4 mb-6" style={{ background: colors.sectionBg }}>
          <h2 className="text-lg font-bold text-white mb-3">Storage Maintenance</h2>
          <p className="text-sm text-white/70 mb-4">
            Remove old photos past their retention period: problem reports (1 year), receipts/refunds (3 years), profile photos (5 years).
          </p>

          {cleanupRunning && cleanupProgress && (
            <div className="mb-4 p-3 rounded-xl bg-white/10">
              <p className="text-sm text-white/90">
                Processing <span className="font-semibold">{cleanupProgress.collection}</span>: {cleanupProgress.deleted}/{cleanupProgress.total}
              </p>
            </div>
          )}

          {cleanupResult && !cleanupRunning && (
            <div className="mb-4 p-3 rounded-xl bg-green-500/20">
              <p className="text-sm font-semibold text-green-200 mb-1">Cleanup complete</p>
              <ul className="text-xs text-green-200/80 space-y-0.5">
                {Object.entries(cleanupResult).map(([col, count]) => (
                  <li key={col}>{col}: {count} photo{count !== 1 ? 's' : ''} removed</li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={() => setCleanupConfirm(true)}
            disabled={cleanupRunning}
            className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-60"
            style={{ background: colors.gold }}
          >
            {cleanupRunning ? 'Cleaning up...' : 'Clean Up Old Photos'}
          </button>
        </div>

        {/* Cleanup confirmation modal */}
        {cleanupConfirm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-5">
              <h3 className="text-lg font-bold text-gray-800 mb-3">Confirm Cleanup</h3>
              <p className="text-sm text-gray-600 mb-2">
                This will permanently delete old photos from storage:
              </p>
              <ul className="text-sm text-gray-600 mb-4 space-y-1 list-disc list-inside">
                <li>Problem report photos older than <strong>1 year</strong></li>
                <li>Receipt & refund photos older than <strong>3 years</strong></li>
                <li>Profile photos not updated in <strong>5 years</strong></li>
              </ul>
              <p className="text-xs text-gray-500 mb-4">
                The Firestore documents will remain; only the photo files will be removed.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setCleanupConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl font-semibold border-2 transition-all"
                  style={{ borderColor: colors.gray400, color: colors.text }}
                >
                  Cancel
                </button>
                <button
                  onClick={runCleanup}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-white transition-all"
                  style={{ background: colors.red }}
                >
                  Delete Old Photos
                </button>
              </div>
            </div>
          </div>
        )}

        <LanguageSwitcher />

        <button
          onClick={() => { auth.signOut(); router.push('/'); }}
          style={{ width: '100%', background: 'transparent', color: colors.primaryGreen, fontWeight: 700, border: `2.5px solid ${colors.primaryGreen}`, borderRadius: 999, padding: '1.2rem 0', fontSize: 22, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginTop: 18 }}
        >
          Log Out
        </button>
        
        {/* Delete Account Button */}
        <button
          onClick={() => setShowDeleteModal(true)}
          style={{ 
            width: '100%', 
            background: 'transparent', 
            color: '#dc2626', 
            fontWeight: 700, 
            border: '2.5px solid #dc2626', 
            borderRadius: 999, 
            padding: '1.2rem 0', 
            fontSize: 22, 
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)', 
            marginTop: 12 
          }}
        >
          Delete Account
        </button>
      </div>
      <EditFieldModal
        open={!!editField}
        onClose={() => setEditField(null)}
        onSave={(val) => handleSaveField(editField, val)}
        label={editField ? fieldLabels[editField] : ''}
        value={editField ? fields[editField] : ''}
      />
      
      {/* Delete Account Modal */}
      <DeleteAccountModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onDelete={() => setShowDeleteModal(false)}
      />
      
      <AdminBottomNavBar active="settings" />
    </main>
  );
} 
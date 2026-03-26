"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import '@/i18n';
import { useTranslation } from 'react-i18next';
import { auth, db } from '@/lib/firebase';
import useAuthRedirect from '@/hooks/useAuthRedirect';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import HouseLoader from '@/components/HouseLoader';
import colors from '../../colors';
import AdminBottomNavBar from '@/components/AdminBottomNavBar';
import EditFieldModal from '@/components/EditFieldModal';
import DeleteAccountModal from '@/components/DeleteAccountModal';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { cleanupExpiredPhotos } from '@/lib/storageCleanup';

export default function AdminSettingsPage() {
  const { t } = useTranslation('admin');
  const router = useRouter();
  const { isReady, userData: hookAdminData } = useAuthRedirect({ requireRole: 'admin', fetchUserData: true });
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

  const fieldLabels = {
    name: t('full_name'),
    title: t('job_title'),
    email: t('email_label'),
  };

  useEffect(() => {
    if (!isReady || !hookAdminData) return;
    setFields({
      name: hookAdminData.fullName || '',
      title: hookAdminData.jobTitle || '',
      email: hookAdminData.email || '',
    });
  }, [isReady, hookAdminData]);

  const handleSaveField = async (field, value) => {
    setSaving(true);
    setSuccess('');
    setError('');
    try {
      const user = auth.currentUser;
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        let updateObj = {};
        if (field === 'name') {
          const trimmedValue = value.trim();
          const nameParts = trimmedValue.split(/\s+/).filter(Boolean);
          updateObj.fullName = trimmedValue;
          if (nameParts.length > 0) {
            updateObj.firstName = nameParts[0];
            updateObj.lastName = nameParts.slice(1).join(' ');
          }
        }
        if (field === 'title') updateObj.jobTitle = value;
        if (field === 'email') updateObj.email = value;
        await updateDoc(userRef, updateObj);
        setFields(prev => ({ ...prev, [field]: value }));
        setSuccess(t('admin_saved_success'));
      }
    } catch (e) {
      setError(t('admin_save_error'));
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
      setError(t('admin_cleanup_failed'));
    } finally {
      setCleanupRunning(false);
    }
  };

  if (!isReady) {
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
          <h1 className="text-2xl font-bold text-text">{t('admin_settings_title')}</h1>
          <p className="text-sm text-muted">{t('admin_settings_subtitle')}</p>
        </div>

        <div className="w-full max-w-md rounded-2xl p-4 mb-6" style={{ background: colors.sectionBg }}>
          {saving ? (
            <div className="text-center text-white py-4">{t('admin_profile_saving')}</div>
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
                    aria-label={t('admin_edit_aria')}
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

        <div className="w-full max-w-md rounded-2xl p-4 mb-6" style={{ background: colors.sectionBg }}>
          <h2 className="text-lg font-bold text-white mb-3">{t('admin_storage_title')}</h2>
          <p className="text-sm text-white/70 mb-4">
            {t('admin_storage_desc')}
          </p>

          {cleanupRunning && cleanupProgress && (
            <div className="mb-4 p-3 rounded-xl bg-white/10">
              <p className="text-sm text-white/90">
                {t('admin_cleanup_progress', {
                  collection: cleanupProgress.collection,
                  deleted: cleanupProgress.deleted,
                  total: cleanupProgress.total,
                })}
              </p>
            </div>
          )}

          {cleanupResult && !cleanupRunning && (
            <div className="mb-4 p-3 rounded-xl bg-green-500/20">
              <p className="text-sm font-semibold text-green-200 mb-1">{t('admin_cleanup_complete')}</p>
              <ul className="text-xs text-green-200/80 space-y-0.5">
                {Object.entries(cleanupResult).map(([col, count]) => (
                  <li key={col}>{t('admin_cleanup_row', { collection: col, count })}</li>
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
            {cleanupRunning ? t('admin_cleanup_running') : t('admin_cleanup_button')}
          </button>
        </div>

        {cleanupConfirm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-5">
              <h3 className="text-lg font-bold text-gray-800 mb-3">{t('admin_confirm_cleanup_title')}</h3>
              <p className="text-sm text-gray-600 mb-2">
                {t('admin_confirm_cleanup_intro')}
              </p>
              <ul className="text-sm text-gray-600 mb-4 space-y-1 list-disc list-inside">
                <li>{t('admin_confirm_cleanup_li1')}</li>
                <li>{t('admin_confirm_cleanup_li2')}</li>
                <li>{t('admin_confirm_cleanup_li3')}</li>
              </ul>
              <p className="text-xs text-gray-500 mb-4">
                {t('admin_confirm_cleanup_footer')}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setCleanupConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl font-semibold border-2 transition-all"
                  style={{ borderColor: colors.gray400, color: colors.text }}
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={runCleanup}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-white transition-all"
                  style={{ background: colors.red }}
                >
                  {t('admin_delete_old_photos')}
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
          {t('admin_logout')}
        </button>
        
        <button
          onClick={() => setShowDeleteModal(true)}
          style={{ 
            width: '100%', 
            background: 'transparent', 
            color: colors.red, 
            fontWeight: 700, 
            border: `2.5px solid ${colors.red}`, 
            borderRadius: 999, 
            padding: '1.2rem 0', 
            fontSize: 22, 
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)', 
            marginTop: 12 
          }}
        >
          {t('admin_delete_account')}
        </button>
      </div>
      <EditFieldModal
        open={!!editField}
        onClose={() => setEditField(null)}
        onSave={(val) => handleSaveField(editField, val)}
        label={editField ? fieldLabels[editField] : ''}
        value={editField ? fields[editField] : ''}
      />
      
      <DeleteAccountModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onDelete={() => setShowDeleteModal(false)}
      />
      
      <AdminBottomNavBar active="settings" />
    </main>
  );
}

'use client';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import BottomNavBar from '@/components/BottomNavBar';
import EditFieldModal from '@/components/EditFieldModal';
import colors from '../colors';

export default function SettingsPage() {
  const { t, i18n } = useTranslation('settings');
  const router = useRouter();
  const [fields, setFields] = useState({
    name: '',
    room: '',
    bank: '',
    email: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [editField, setEditField] = useState(null); // 'name', 'room', 'bank', 'email'

  useEffect(() => {
    // On mount, set language from localStorage if available
    const savedLang = typeof window !== 'undefined' ? localStorage.getItem('lang') : null;
    if (savedLang && savedLang !== i18n.language) {
      i18n.changeLanguage(savedLang);
      document.documentElement.dir = savedLang === 'he' ? 'rtl' : 'ltr';
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          setFields({
            name: data.fullName || '',
            room: data.roomNumber || '',
            bank: data.bankDetails || '',
            email: data.email || '',
          });
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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
        if (field === 'room') updateObj.roomNumber = value;
        if (field === 'bank') updateObj.bankDetails = value;
        if (field === 'email') updateObj.email = value;
        await updateDoc(userRef, updateObj);
        setFields(prev => ({ ...prev, [field]: value }));
        setSuccess(t('saved_successfully'));
      }
    } catch (e) {
      setError(t('save_error'));
    }
    setSaving(false);
    setEditField(null);
  };

  const fieldLabels = {
    name: t('name'),
    room: t('room'),
    bank: t('bank_details'),
    email: t('email'),
  };

  const handleLanguageSwitch = () => {
    const nextLang = i18n.language === 'en' ? 'he' : 'en';
    i18n.changeLanguage(nextLang);
    if (typeof window !== 'undefined') localStorage.setItem('lang', nextLang);
    document.documentElement.dir = nextLang === 'he' ? 'rtl' : 'ltr';
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-200/60 to-green-100/60 font-body flex flex-col items-center pt-10 pb-32 px-2 phone-sm:px-2 phone-md:px-4 phone-lg:px-6">
      <button
        onClick={handleLanguageSwitch}
        className="absolute top-4 right-4 bg-surface p-2 rounded-full text-white text-xl hover:text-text"
      >
        {i18n.language === 'en' ? 'עברית' : 'EN'}
      </button>
      <div className="w-full max-w-md">
        <div className="rounded-3xl p-10 mb-8 shadow-lg flex flex-col items-center" style={{ background: 'rgba(0,0,0,0.38)' }}>
          <h2 className="text-3xl font-extrabold mb-8 text-white text-center tracking-wide">{t('settings')}</h2>
          {loading ? (
            <div className="text-center text-white text-xl py-8">{t('loading')}</div>
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
                    aria-label={t('edit')}
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
        <button
          onClick={() => { auth.signOut(); router.push('/'); }}
          style={{ width: '100%', background: 'transparent', color: colors.primaryGreen, fontWeight: 700, border: `2.5px solid ${colors.primaryGreen}`, borderRadius: 999, padding: '1.2rem 0', fontSize: 22, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginTop: 18 }}
        >
          Log Out
        </button>
      </div>
      <EditFieldModal
        open={!!editField}
        onClose={() => setEditField(null)}
        onSave={(val) => handleSaveField(editField, val)}
        label={editField ? fieldLabels[editField] : ''}
        value={editField ? fields[editField] : ''}
      />
      <BottomNavBar active="settings" />
    </main>
  );
} 
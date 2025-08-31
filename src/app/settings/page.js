'use client';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import BottomNavBar from '@/components/BottomNavBar';
import EditFieldModal from '@/components/EditFieldModal';
import QuestionnaireEditor from '@/components/QuestionnaireEditor';
import PhotoUpload from '@/components/PhotoUpload';
import colors from '../colors';

export default function SettingsPage() {
  const { t, i18n } = useTranslation('settings');
  const router = useRouter();
  const [fields, setFields] = useState({
    name: '',
    room: '',
    email: '',
    phone: '',
    unit: '',
    profilePhotoUrl: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [editField, setEditField] = useState(null); // 'name', 'room', 'bank', 'email'
  const [questionnaireEditorOpen, setQuestionnaireEditorOpen] = useState(false);
  const [showPersonalId, setShowPersonalId] = useState(false);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);

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
            email: data.email || '',
            phone: data.phoneNumber || '',
            unit: data.unit || '',
            profilePhotoUrl: data.profilePhotoUrl || '',
          });
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [i18n]);

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
    email: t('email'),
  };

  const handleLanguageSwitch = () => {
    const nextLang = i18n.language === 'en' ? 'he' : 'en';
    i18n.changeLanguage(nextLang);
    if (typeof window !== 'undefined') localStorage.setItem('lang', nextLang);
    document.documentElement.dir = nextLang === 'he' ? 'rtl' : 'ltr';
  };

  const handleProfileUpdate = (updatedAnswers) => {
    // Update local fields with the new answers if they match our basic fields
    if (updatedAnswers.fullName !== undefined) setFields(prev => ({ ...prev, name: updatedAnswers.fullName }));
    if (updatedAnswers.roomNumber !== undefined) setFields(prev => ({ ...prev, room: updatedAnswers.roomNumber }));
    if (updatedAnswers.email !== undefined) setFields(prev => ({ ...prev, email: updatedAnswers.email }));
  };

  const updateUserPhoto = async (photoUrl) => {
    try {
      const user = auth.currentUser;
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { profilePhotoUrl: photoUrl });
        setFields(prev => ({ ...prev, profilePhotoUrl: photoUrl }));
        setSuccess('Profile photo updated successfully!');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      console.error('Error updating profile photo:', error);
      setError('Failed to update profile photo');
      setTimeout(() => setError(''), 3000);
    }
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
              
              {/* Edit Profile Button */}
              <div className="w-full mt-6">
                <button
                  onClick={() => setQuestionnaireEditorOpen(true)}
                  className="w-full py-4 px-6 bg-transparent text-white font-bold text-lg border-2 border-white rounded-xl hover:bg-white/10 transition-colors"
                >
                  Edit Full Profile
                </button>
              </div>
              
              {/* Personal ID Button */}
              <div className="w-full mt-4">
                <button
                  onClick={() => setShowPersonalId(true)}
                  className="w-full py-4 px-6 bg-transparent text-white font-bold text-lg border-2 border-white rounded-xl hover:bg-white/10 transition-colors"
                >
                  🆔 Personal ID
                </button>
              </div>
              
              {/* Go Back Button */}
              <div className="w-full mt-4">
                <button
                  onClick={() => router.back()}
                  className="w-full py-4 px-6 bg-transparent text-white font-bold text-lg border-2 border-white rounded-xl hover:bg-white/10 transition-colors"
                >
                  ← Go Back
                </button>
              </div>
              

              
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
      <QuestionnaireEditor
        isOpen={questionnaireEditorOpen}
        onClose={() => setQuestionnaireEditorOpen(false)}
        userData={fields}
        onUpdate={handleProfileUpdate}
      />

      {/* Personal ID Modal */}
      {showPersonalId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            {/* Header */}
            <div className="p-6" style={{ background: colors.primaryGreen, color: colors.white }}>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">
                  🆔 Personal ID
                </h3>
                <button
                  onClick={() => setShowPersonalId(false)}
                  className="text-white hover:text-gray-200 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Photo Section */}
              <div className="text-center mb-6">
                {fields.profilePhotoUrl ? (
                  <div className="w-32 h-32 rounded-full mx-auto mb-4 overflow-hidden border-4 border-gray-200">
                    <img 
                      src={fields.profilePhotoUrl} 
                      alt="Profile Photo" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-32 h-32 rounded-full mx-auto mb-4 bg-gray-200 flex items-center justify-center">
                    <span className="text-4xl text-gray-400">📷</span>
                  </div>
                )}
                
                {!fields.profilePhotoUrl && (
                  <button
                    onClick={() => setShowPhotoUpload(true)}
                    className="px-4 py-2 rounded-lg font-semibold text-white"
                    style={{ background: colors.gold }}
                  >
                    Add Photo
                  </button>
                )}
              </div>

              {/* ID Information */}
              <div className="space-y-3 text-center">
                <div className="text-2xl font-bold text-gray-800">
                  {fields.name}
                </div>
                
                <div className="space-y-2 text-sm text-gray-600">
                  <div><span className="font-medium">Unit:</span> {fields.unit || 'Not specified'}</div>
                  <div><span className="font-medium">Phone:</span> {fields.phone || 'Not specified'}</div>
                  <div><span className="font-medium">Room:</span> {fields.room}</div>
                  <div><span className="font-medium">Email:</span> {fields.email}</div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 pt-4 border-t">
                <div className="flex justify-center">
                  <button
                    onClick={() => setShowPersonalId(false)}
                    className="px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105"
                    style={{ 
                      background: colors.primaryGreen, 
                      color: colors.white,
                      boxShadow: '0 4px 12px rgba(7, 99, 50, 0.3)'
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo Upload Modal */}
      {showPhotoUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-gray-800 mb-2">Add Profile Photo</h3>
              <p className="text-gray-600">Take a photo or upload from your device</p>
            </div>
            
            <PhotoUpload
              onPhotoUploaded={(photoUrl, photoPath) => {
                updateUserPhoto(photoUrl);
                setShowPhotoUpload(false);
              }}
              onPhotoRemoved={() => setShowPhotoUpload(false)}
              currentPhotoUrl={fields.profilePhotoUrl || null}
              uploadPath={`user-profiles/${auth.currentUser?.uid}`}
            />
            
            <div className="mt-6 text-center">
              <button
                onClick={() => setShowPhotoUpload(false)}
                className="px-6 py-2 rounded-lg font-semibold text-white"
                style={{ background: colors.gold }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNavBar active="settings" />
    </main>
  );
} 
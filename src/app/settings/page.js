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
import LanguageSwitcher from '@/components/LanguageSwitcher';
import colors from '../colors';

export default function SettingsPage() {
  const { t, i18n } = useTranslation('settings');
  const router = useRouter();
  const [fields, setFields] = useState({
    name: '',
    room: '',
    email: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [editField, setEditField] = useState(null); // 'name', 'room', 'email'
  const [questionnaireEditorOpen, setQuestionnaireEditorOpen] = useState(false);
  const [showPersonalId, setShowPersonalId] = useState(false);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [hasDeclinedPhoto, setHasDeclinedPhoto] = useState(false);
  const [personalIdData, setPersonalIdData] = useState({
    personalNumber: '',
    phone: '',
    profilePhotoUrl: '',
  });

  useEffect(() => {
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



  const handleProfileUpdate = (updatedAnswers) => {
    // Update local fields with the new answers if they match our basic fields
    if (updatedAnswers.fullName !== undefined) setFields(prev => ({ ...prev, name: updatedAnswers.fullName }));
    if (updatedAnswers.roomNumber !== undefined) setFields(prev => ({ ...prev, room: updatedAnswers.roomNumber }));
    if (updatedAnswers.email !== undefined) setFields(prev => ({ ...prev, email: updatedAnswers.email }));
  };

  const updateUserPhoto = async (photoUrl) => {
    try {
      // Don't save the photo URL to the database
      // Just update the local state for display purposes
      setSuccess('Profile photo updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error updating profile photo:', error);
      setError('Failed to update profile photo');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleClosePersonalId = () => {
    if (!personalIdData.profilePhotoUrl) {
      setHasDeclinedPhoto(true);
      return; // Don't close if no photo
    }
    setShowPersonalId(false);
    setHasDeclinedPhoto(false);
  };

  const handleOpenPersonalId = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          setPersonalIdData({
            personalNumber: data.personalNumber || '',
            phone: data.phoneNumber || '',
            profilePhotoUrl: data.profilePhotoUrl || '',
          });
        }
      }
      setShowPersonalId(true);
    } catch (error) {
      console.error('Error fetching personal ID data:', error);
      setShowPersonalId(true);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-200/60 to-green-100/60 font-body flex flex-col items-center pt-10 pb-32 px-2 phone-sm:px-2 phone-md:px-4 phone-lg:px-6">
      <LanguageSwitcher />
      <div className="w-full max-w-md">
        {/* Personal ID Button - Above Settings */}
        <div className="rounded-3xl p-8 mb-6 shadow-lg flex flex-col items-center" style={{ background: 'rgba(0,0,0,0.38)' }}>
          <button
            onClick={handleOpenPersonalId}
            className="w-full py-5 px-6 bg-transparent font-bold text-xl border-2 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-center gap-3"
            style={{ borderColor: colors.gold, color: colors.gold }}
          >
{t('personal_id')}
          </button>
        </div>

        {/* Settings Section */}
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
{t('edit_full_profile')}
                </button>
              </div>
              
              {/* Go Back Button */}
              <div className="w-full mt-4">
                <button
                  onClick={() => router.back()}
                  className="w-full py-4 px-6 bg-transparent text-white font-bold text-lg border-2 border-white rounded-xl hover:bg-white/10 transition-colors"
                >
{t('go_back')}
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
{t('logout')}
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
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl" style={{ border: `4px solid ${colors.gold}`, maxHeight: '90vh' }}>
            {/* ID Card Content - Scrollable */}
            <div className="p-6 relative overflow-y-auto" style={{ maxHeight: 'calc(90vh - 2rem)' }}>
              {/* Close Button */}
              <button
                onClick={handleClosePersonalId}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl transition-colors z-10"
              >
                ×
              </button>
              
              {/* Header */}
              <div className="text-center mb-6 pt-2">
                <h3 className="text-2xl font-bold text-gray-800 mb-3">{t('habayit_shel_benji_card')}</h3>
              </div>
              
              {/* Logo */}
              <div className="text-center mb-6">
                <img 
                  src="/House_Logo.jpg" 
                  alt="House Logo" 
                  className="h-16 mx-auto"
                  onError={(e) => {
                    console.log('Logo failed to load:', e.target.src);
                    e.target.style.display = 'none';
                  }}
                />
              </div>
              
              {/* Photo */}
              <div className="text-center mb-6">
                {personalIdData.profilePhotoUrl ? (
                  <div className="w-32 h-32 rounded-xl overflow-hidden shadow-xl mx-auto" style={{ border: `3px solid ${colors.gold}` }}>
                    <img 
                      src={personalIdData.profilePhotoUrl} 
                      alt="Profile Photo" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-32 h-32 rounded-xl flex items-center justify-center shadow-xl mx-auto" style={{ border: `3px solid ${colors.gold}`, background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)' }}>
                    <span className="text-4xl text-gray-400">📷</span>
                  </div>
                )}
                
                {!personalIdData.profilePhotoUrl && (
                  <div className="mt-3 text-center">
                    <p className="text-gray-600 text-sm mb-2 font-medium">{t('photo_required')}</p>
                    <button
                      onClick={() => setShowPhotoUpload(true)}
                      className="px-4 py-2 rounded-lg font-semibold text-white text-sm transition-all hover:scale-105"
                      style={{ background: colors.gold, boxShadow: '0 4px 12px rgba(237, 195, 129, 0.3)' }}
                    >
{t('add_photo')}
                    </button>
                    {hasDeclinedPhoto && (
                      <p className="text-red-500 text-sm mt-2 font-medium">{t('please_add_photo')}</p>
                    )}
                  </div>
                )}
              </div>
              
              {/* All Fields - Stacked Vertically */}
              <div className="space-y-4 mb-6">
                <div className="text-center pb-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">{t('full_name')}</div>
                  <div className="text-lg font-semibold text-gray-800">{fields.name || t('not_specified')}</div>
                </div>
                
                <div className="text-center pb-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">{t('room_number')}</div>
                  <div className="text-lg font-semibold text-gray-800">{fields.room || t('not_specified')}</div>
                </div>
                
                <div className="text-center pb-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">{t('personal_army_id')}</div>
                  <div className="text-lg font-semibold text-gray-800">{personalIdData.personalNumber || t('not_specified')}</div>
                </div>
                
                <div className="text-center pb-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">{t('phone_number')}</div>
                  <div className="text-lg font-semibold text-gray-800">{personalIdData.phone || t('not_specified')}</div>
                </div>
                
                <div className="text-center pb-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">{t('email')}</div>
                  <div className="text-lg font-semibold text-gray-800">{fields.email || t('not_specified')}</div>
                </div>
              </div>

              {/* Actions */}
              <div className="text-center">
                <button
                  onClick={handleClosePersonalId}
                  className="px-8 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105"
                  style={{ 
                    background: colors.sectionBg, 
                    color: colors.white,
                    boxShadow: '0 6px 20px rgba(0,0,0,0.15)'
                  }}
                >
{t('close')}
                </button>
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
              <h3 className="text-xl font-bold text-gray-800 mb-2">{t('add_profile_photo')}</h3>
              <p className="text-gray-600">{t('take_photo_or_upload')}</p>
            </div>
            
            <PhotoUpload
              onPhotoUploaded={(photoUrl, photoPath) => {
                updateUserPhoto(photoUrl);
                setFields(prev => ({ ...prev, profilePhotoUrl: photoUrl }));
                setShowPhotoUpload(false);
                setShowPersonalId(false);
                setHasDeclinedPhoto(false);
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
{t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNavBar active="settings" />
    </main>
  );
} 
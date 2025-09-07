'use client';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import BottomNavBar from '@/components/BottomNavBar';
import EditFieldModal from '@/components/EditFieldModal';
import PhotoUpload from '@/components/PhotoUpload';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import DeleteAccountModal from '@/components/DeleteAccountModal';
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
  const [showPersonalId, setShowPersonalId] = useState(false);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [hasDeclinedPhoto, setHasDeclinedPhoto] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditAllModal, setShowEditAllModal] = useState(false);
  const [editAllForm, setEditAllForm] = useState({});
  const [showGenderDropdown, setShowGenderDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showFamilyDropdown, setShowFamilyDropdown] = useState(false);
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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showGenderDropdown || showStatusDropdown || showFamilyDropdown) {
        const target = event.target;
        const isDropdownButton = target.closest('[data-dropdown-trigger]');
        const isDropdownContent = target.closest('[data-dropdown-content]');
        
        if (!isDropdownButton && !isDropdownContent) {
          setShowGenderDropdown(false);
          setShowStatusDropdown(false);
          setShowFamilyDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showGenderDropdown, showStatusDropdown, showFamilyDropdown]);

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
            phone: data.phoneNumber || data.phone || '',
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

  const handleOpenEditAll = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          
          // Helper function to format dates for input fields
          const formatDateForInput = (dateValue) => {
            if (!dateValue) return '';
            if (typeof dateValue === 'string') {
              // If it's already a string, try to parse it
              const parsed = new Date(dateValue);
              return isNaN(parsed.getTime()) ? '' : parsed.toISOString().split('T')[0];
            }
            if (dateValue && dateValue.toDate) {
              // Firestore Timestamp
              return dateValue.toDate().toISOString().split('T')[0];
            }
            if (dateValue && dateValue.seconds) {
              // Firestore Timestamp object
              return new Date(dateValue.seconds * 1000).toISOString().split('T')[0];
            }
            if (dateValue instanceof Date) {
              return dateValue.toISOString().split('T')[0];
            }
            return '';
          };

          // Helper function to format numbers
          const formatNumber = (value) => {
            if (value === null || value === undefined || value === '') return '';
            return value.toString();
          };

          setEditAllForm({
            // Basic info
            fullName: data.fullName || '',
            email: data.email || '',
            phoneNumber: data.phoneNumber || data.phone || '',
            roomNumber: data.roomNumber || '',
            age: formatNumber(data.age),
            
            // Personal info
            gender: data.gender || '',
            dateOfBirth: formatDateForInput(data.dateOfBirth),
            
            // Family info
            familyInIsrael: Boolean(data.familyInIsrael),
            fatherName: data.fatherName || '',
            fatherPhone: data.fatherPhone || '',
            motherName: data.motherName || '',
            motherPhone: data.motherPhone || '',
            parentsAddress: data.parentsAddress || '',
            parentsEmail: data.parentsEmail || '',
            
            // Emergency contact
            emergencyContactName: data.emergencyContactName || '',
            emergencyContactPhone: data.emergencyContactPhone || '',
            emergencyContactAddress: data.emergencyContactAddress || '',
            emergencyContactEmail: data.emergencyContactEmail || '',
            
            // Military info
            personalNumber: data.personalNumber || '',
            enlistmentDate: formatDateForInput(data.enlistmentDate),
            releaseDate: formatDateForInput(data.releaseDate),
            unit: data.unit || '',
            battalion: data.battalion || '',
            mashakitTash: data.mashakitTash || '',
            mashakitPhone: data.mashakitPhone || '',
            officerName: data.officerName || '',
            officerPhone: data.officerPhone || '',
            
            
            // Check-in and status info
            checkInDate: formatDateForInput(data.checkInDate || data.createdAt),
            status: data.status || 'home',
            userType: data.userType || 'user',
          });
        }
      }
      setShowEditAllModal(true);
    } catch (error) {
      console.error('Error loading user data:', error);
      setShowEditAllModal(true);
    }
  };

  const handleEditAllFormChange = (field, value) => {
    setEditAllForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveEditAll = async () => {
    setSaving(true);
    setSuccess('');
    setError('');
    try {
      const user = auth.currentUser;
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        
        // Helper function to convert date strings to proper format
        const formatDateForSave = (dateString) => {
          if (!dateString || dateString.trim() === '') return null;
          const date = new Date(dateString);
          return isNaN(date.getTime()) ? null : date.toISOString();
        };

        // Helper function to convert numbers
        const formatNumberForSave = (value) => {
          if (!value || value.toString().trim() === '') return null;
          const num = Number(value);
          return isNaN(num) ? null : num;
        };

        await updateDoc(userRef, {
          // Basic info
          fullName: editAllForm.fullName || null,
          email: editAllForm.email || null,
          phoneNumber: editAllForm.phoneNumber || null,
          roomNumber: editAllForm.roomNumber || null,
          age: formatNumberForSave(editAllForm.age),
          
          // Personal info
          gender: editAllForm.gender || null,
          dateOfBirth: formatDateForSave(editAllForm.dateOfBirth),
          
          // Family info
          familyInIsrael: Boolean(editAllForm.familyInIsrael),
          fatherName: editAllForm.fatherName || null,
          fatherPhone: editAllForm.fatherPhone || null,
          motherName: editAllForm.motherName || null,
          motherPhone: editAllForm.motherPhone || null,
          parentsAddress: editAllForm.parentsAddress || null,
          parentsEmail: editAllForm.parentsEmail || null,
          
          // Emergency contact
          emergencyContactName: editAllForm.emergencyContactName || null,
          emergencyContactPhone: editAllForm.emergencyContactPhone || null,
          emergencyContactAddress: editAllForm.emergencyContactAddress || null,
          emergencyContactEmail: editAllForm.emergencyContactEmail || null,
          
          // Military info
          personalNumber: editAllForm.personalNumber || null,
          enlistmentDate: formatDateForSave(editAllForm.enlistmentDate),
          releaseDate: formatDateForSave(editAllForm.releaseDate),
          unit: editAllForm.unit || null,
          battalion: editAllForm.battalion || null,
          mashakitTash: editAllForm.mashakitTash || null,
          mashakitPhone: editAllForm.mashakitPhone || null,
          officerName: editAllForm.officerName || null,
          officerPhone: editAllForm.officerPhone || null,
          
          
          // Check-in and status info
          checkInDate: formatDateForSave(editAllForm.checkInDate),
          status: editAllForm.status || 'home',
          userType: editAllForm.userType || 'user',
        });
        
        // Update local state
        setFields(prev => ({
          ...prev,
          name: editAllForm.fullName,
          room: editAllForm.roomNumber,
          email: editAllForm.email,
        }));
        
        setPersonalIdData(prev => ({
          ...prev,
          personalNumber: editAllForm.personalNumber,
          phone: editAllForm.phoneNumber,
        }));
        
        setSuccess(t('saved_successfully'));
        setShowEditAllModal(false);
      }
    } catch (e) {
      setError(t('save_error'));
    }
    setSaving(false);
  };

  const handleCancelEditAll = () => {
    setShowEditAllModal(false);
    setEditAllForm({});
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
              
              
              {/* Edit All Fields Button */}
              <div className="w-full mt-4">
                <button
                  onClick={handleOpenEditAll}
                  className="w-full py-4 px-6 font-bold text-lg rounded-xl transition-all duration-200 hover:scale-105"
                  style={{ 
                    background: colors.gold, 
                    color: colors.black,
                    boxShadow: '0 6px 20px rgba(237, 195, 129, 0.4)',
                    border: `3px solid ${colors.gold}`
                  }}
                >
                  ✏️ Edit All Fields
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
{t('delete_account')}
        </button>
      </div>
      <EditFieldModal
        open={!!editField}
        onClose={() => setEditField(null)}
        onSave={(val) => handleSaveField(editField, val)}
        label={editField ? fieldLabels[editField] : ''}
        value={editField ? fields[editField] : ''}
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
                    <button
                      onClick={() => setShowPhotoUpload(true)}
                      className="px-4 py-2 rounded-lg font-semibold text-white text-sm transition-all hover:scale-105"
                      style={{ background: colors.gold, boxShadow: '0 4px 12px rgba(237, 195, 129, 0.3)' }}
                    >
{t('add_photo')}
                    </button>
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

      {/* Delete Account Modal */}
      <DeleteAccountModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onDelete={() => setShowDeleteModal(false)}
      />

      {/* Edit All Fields Modal */}
      {showEditAllModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="p-6" style={{ background: colors.primaryGreen, color: colors.white }}>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">
                  Edit All Fields
                </h3>
                <button
                  onClick={handleCancelEditAll}
                  className="text-white hover:text-gray-200 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Form Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="space-y-8">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-800 border-b pb-2">Basic Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={editAllForm.fullName || ''}
                        onChange={(e) => handleEditAllFormChange('fullName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={editAllForm.email || ''}
                        onChange={(e) => handleEditAllFormChange('email', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                      <input
                        type="tel"
                        value={editAllForm.phoneNumber || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                      <div className="relative">
                        <button
                          type="button"
                          data-dropdown-trigger
                          onClick={() => setShowGenderDropdown(!showGenderDropdown)}
                          className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm bg-white text-left flex items-center justify-between"
                        >
                          <span className={editAllForm.gender ? 'text-gray-900' : 'text-gray-500'}>
                            {editAllForm.gender === 'male' ? 'Male' : editAllForm.gender === 'female' ? 'Female' : 'Select Gender'}
                          </span>
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        
                        {showGenderDropdown && (
                          <div data-dropdown-content className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                            <button
                              type="button"
                              onClick={() => {
                                handleEditAllFormChange('gender', 'male');
                                setShowGenderDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center justify-between"
                            >
                              <span>Male</span>
                              {editAllForm.gender === 'male' && (
                                <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleEditAllFormChange('gender', 'female');
                                setShowGenderDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center justify-between"
                            >
                              <span>Female</span>
                              {editAllForm.gender === 'female' && (
                                <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                      <input
                        type="date"
                        value={editAllForm.dateOfBirth || ''}
                        onChange={(e) => handleEditAllFormChange('dateOfBirth', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                      <input
                        type="number"
                        value={editAllForm.age || ''}
                        onChange={(e) => handleEditAllFormChange('age', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <input
                        type="text"
                        value={editAllForm.status === 'home' ? 'Home' : 
                               editAllForm.status === 'away' ? 'Away' : 
                               editAllForm.status === 'in base' ? 'In Base' : 
                               editAllForm.status === 'abroad' ? 'Abroad' : 
                               editAllForm.status === 'left' ? 'Left' : 'Home'}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                      />
                      <p className="text-xs text-gray-500 mt-1">Status can only be changed on the main home page</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Check-in Date</label>
                      <input
                        type="date"
                        value={editAllForm.checkInDate || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                {/* Room Information */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-800 border-b pb-2">Room Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Room Number</label>
                      <input
                        type="text"
                        value={editAllForm.roomNumber || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>


                {/* Military Information */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-800 border-b pb-2">Military Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Personal Number</label>
                      <input
                        type="text"
                        value={editAllForm.personalNumber || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Enlistment Date</label>
                      <input
                        type="date"
                        value={editAllForm.enlistmentDate || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Release Date</label>
                      <input
                        type="date"
                        value={editAllForm.releaseDate || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                      <input
                        type="text"
                        value={editAllForm.unit || ''}
                        onChange={(e) => handleEditAllFormChange('unit', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Battalion</label>
                      <input
                        type="text"
                        value={editAllForm.battalion || ''}
                        onChange={(e) => handleEditAllFormChange('battalion', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mashakit Tash</label>
                      <input
                        type="text"
                        value={editAllForm.mashakitTash || ''}
                        onChange={(e) => handleEditAllFormChange('mashakitTash', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mashakit Phone</label>
                      <input
                        type="tel"
                        value={editAllForm.mashakitPhone || ''}
                        onChange={(e) => handleEditAllFormChange('mashakitPhone', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Officer Name</label>
                      <input
                        type="text"
                        value={editAllForm.officerName || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Officer Phone</label>
                      <input
                        type="tel"
                        value={editAllForm.officerPhone || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                {/* Family Information */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-800 border-b pb-2">Family Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Family in Israel</label>
                      <input
                        type="text"
                        value={editAllForm.familyInIsrael ? 'Yes' : 'No'}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Father Name</label>
                      <input
                        type="text"
                        value={editAllForm.fatherName || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Father Phone</label>
                      <input
                        type="tel"
                        value={editAllForm.fatherPhone || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mother Name</label>
                      <input
                        type="text"
                        value={editAllForm.motherName || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mother Phone</label>
                      <input
                        type="tel"
                        value={editAllForm.motherPhone || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Parents Address</label>
                      <input
                        type="text"
                        value={editAllForm.parentsAddress || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Parents Email</label>
                      <input
                        type="email"
                        value={editAllForm.parentsEmail || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-800 border-b pb-2">Emergency Contact</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Name</label>
                      <input
                        type="text"
                        value={editAllForm.emergencyContactName || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Phone</label>
                      <input
                        type="tel"
                        value={editAllForm.emergencyContactPhone || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Address</label>
                      <input
                        type="text"
                        value={editAllForm.emergencyContactAddress || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Email</label>
                      <input
                        type="email"
                        value={editAllForm.emergencyContactEmail || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>


              </div>

              {/* Actions */}
              <div className="mt-8 pt-6 border-t">
                <div className="flex justify-end gap-3">
                  <button
                    onClick={handleCancelEditAll}
                    className="px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105"
                    style={{ 
                      background: 'transparent', 
                      color: colors.primaryGreen,
                      border: `2px solid ${colors.primaryGreen}`,
                      boxShadow: '0 4px 12px rgba(7, 99, 50, 0.1)'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEditAll}
                    disabled={saving}
                    className="px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ 
                      background: colors.primaryGreen, 
                      color: colors.white,
                      boxShadow: '0 4px 12px rgba(7, 99, 50, 0.3)'
                    }}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <BottomNavBar active="settings" />
    </main>
  );
} 
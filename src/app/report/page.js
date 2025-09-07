"use client";
import { useTranslation } from 'react-i18next';
import BottomNavBar from '@/components/BottomNavBar';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import PhotoUpload from '@/components/PhotoUpload';
import { useState, useEffect, useRef } from 'react';
import colors from '../colors';
import { auth, db, storage } from '@/lib/firebase';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

export default function ReportPage() {
  const { t, i18n } = useTranslation('report');
  const [desc, setDesc] = useState('');
  const [isInMyRoom, setIsInMyRoom] = useState(null); // null, true (in my room), false (not in my room)
  const [selectedHouse, setSelectedHouse] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submittedReport, setSubmittedReport] = useState(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundSaving, setRefundSaving] = useState(false);
  const [refundError, setRefundError] = useState('');
  const [refundSuccess, setRefundSuccess] = useState('');
  const [refundForm, setRefundForm] = useState({ title: '', amount: '', category: 'transportation', method: 'bit', expenseDate: '' });
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState('');
  const [uploadedPhotoPath, setUploadedPhotoPath] = useState('');
  const [refundPhotoUrl, setRefundPhotoUrl] = useState('');
  const [refundPhotoPath, setRefundPhotoPath] = useState('');
  const categoryDropdownRef = useRef(null);

  const categoryOptions = [
    { value: 'air_conditioning', label: 'Air Conditioning' },
    { value: 'shower_toilet', label: 'Shower and Toilet' },
    { value: 'walls_floor', label: 'Walls and Floor' },
    { value: 'furniture', label: 'Furniture' },
    { value: 'other', label: 'Other' }
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
        setCategoryDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handlePhotoUploaded = (photoUrl, photoPath) => {
    setUploadedPhotoUrl(photoUrl);
    setUploadedPhotoPath(photoPath);
  };

  const handlePhotoRemoved = () => {
    setUploadedPhotoUrl('');
    setUploadedPhotoPath('');
  };

  const handleRefundPhotoUploaded = (photoUrl, photoPath) => {
    setRefundPhotoUrl(photoUrl);
    setRefundPhotoPath(photoPath);
  };

  const handleRefundPhotoRemoved = () => {
    setRefundPhotoUrl('');
    setRefundPhotoPath('');
  };

  const validateRefund = () => {
    if (!refundForm.title.trim()) return 'Please enter what for';
    if (!refundForm.amount || isNaN(Number(refundForm.amount))) return 'Please enter a valid amount';
    if (!refundForm.category) return 'Please choose an expense category';
    if (!refundForm.method) return 'Please choose a repayment method';
    if (!refundForm.expenseDate) return 'Please choose the expense date';
    return '';
  };

  const handleReportSubmit = async () => {
    setSubmitError(''); setSubmitSuccess('');
    
    // Validate form
    if (!desc.trim()) {
      setSubmitError('Please describe the problem');
      return;
    }
    if (isInMyRoom === null) {
      setSubmitError('Please select if the problem is in your room or not');
      return;
    }
    if (!selectedCategory) {
      setSubmitError('Please select a problem category');
      return;
    }
    if (isInMyRoom === false) {
      if (!selectedHouse) {
        setSubmitError('Please select a house');
        return;
      }
      if (!selectedFloor) {
        setSubmitError('Please select a floor');
        return;
      }
    }
    
    try {
      setSubmitting(true);
      const user = auth.currentUser;
      if (!user) {
        setSubmitError('You must be logged in');
        return;
      }
      
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const userData = userSnap.exists() ? userSnap.data() : {};
      
      const payload = {
        ownerUid: user.uid,
        ownerName: userData.fullName || '',
        ownerRoomNumber: userData.roomNumber || '',
        description: desc.trim(),
        category: selectedCategory,
        isInMyRoom: isInMyRoom,
        house: isInMyRoom ? userData.house || '' : selectedHouse,
        floor: isInMyRoom ? userData.floor || '' : selectedFloor,
        photoUrl: uploadedPhotoUrl || '',
        photoPath: uploadedPhotoPath || '',
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        softDeleted: false,
      };
      
      await addDoc(collection(db, 'problemReports'), payload);
      
      // Store submitted report details for success modal
      setSubmittedReport({
        description: desc,
        category: selectedCategory,
        isInMyRoom: isInMyRoom,
        house: isInMyRoom ? null : selectedHouse,
        floor: isInMyRoom ? null : selectedFloor,
        roomNumber: isInMyRoom ? userData.roomNumber : null,
        photoUrl: uploadedPhotoUrl,
        submittedAt: new Date()
      });
      
      // Show success modal
      setShowSuccessModal(true);
      
      // Reset form
      setDesc('');
      setIsInMyRoom(null);
      setSelectedCategory('');
      setSelectedHouse('');
      setSelectedFloor('');
      setUploadedPhotoUrl('');
      setUploadedPhotoPath('');
      
    } catch (e) {
      setSubmitError('Failed to submit problem report');
      console.error('Error submitting report:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefundSave = async () => {
    setRefundError(''); setRefundSuccess('');
    const v = validateRefund(); if (v) { setRefundError(v); return; }
    try {
      setRefundSaving(true);
      const user = auth.currentUser; if (!user) { setRefundError('You must be logged in'); setRefundSaving(false); return; }
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const userData = userSnap.exists() ? userSnap.data() : {};
      const payload = {
        ownerUid: user.uid,
        ownerName: userData.fullName || '',
        ownerRoomNumber: userData.roomNumber || '',
        title: refundForm.title.trim(),
        amount: Number(refundForm.amount),
        category: refundForm.category,
        repaymentMethod: refundForm.method,
        expenseDate: new Date(refundForm.expenseDate),
        status: 'waiting',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        softDeleted: false,
        receiptPhotoUrl: refundPhotoUrl || '',
        photoPath: refundPhotoPath || '',
      };
      
      await addDoc(collection(db, 'refundRequests'), payload);
      setRefundSuccess(t('request_submitted'));
      setRefundForm({ title: '', amount: '', category: 'transportation', method: 'bit', expenseDate: '' });
      setRefundPhotoUrl('');
      setRefundPhotoPath('');
    } catch (e) { setRefundError('Failed to submit request'); }
    finally { setRefundSaving(false); }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-200/60 to-green-100/60 font-body flex flex-col items-center pt-10 pb-32 px-2 phone-sm:px-2 phone-md:px-4 phone-lg:px-6">
      <LanguageSwitcher />
      <div className="w-full max-w-md">
        <div className="rounded-3xl p-10 mb-8 shadow-lg flex flex-col items-center" style={{ background: 'rgba(0,0,0,0.38)' }}>
          <h2 className="text-3xl font-extrabold mb-8 text-white text-center tracking-wide">{t('report_a_problem')}</h2>
          
          {/* Error and Success Messages */}
          {submitError && <div className="mb-4 w-full text-red-200 text-sm bg-red-500/20 rounded px-3 py-2">{submitError}</div>}
          {submitSuccess && <div className="mb-4 w-full text-green-200 text-sm bg-green-500/20 rounded px-3 py-2">{submitSuccess}</div>}
          
          {/* Room Location Selector */}
          <div className="mb-6 w-full">
            <label className="block text-lg mb-2 text-white font-semibold">Where is the problem located?</label>
            <div className="flex gap-2">
              <button
                onClick={() => setIsInMyRoom(isInMyRoom === true ? null : true)}
                className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105 ${
                  isInMyRoom === true 
                    ? 'text-white' 
                    : 'text-white'
                }`}
                style={{ 
                  background: isInMyRoom === true ? colors.primaryGreen : 'rgba(255, 255, 255, 0.1)',
                  border: isInMyRoom === true ? 'none' : `2px solid rgba(255, 255, 255, 0.3)`,
                  color: isInMyRoom === true ? colors.white : colors.white,
                  boxShadow: isInMyRoom === true ? '0 4px 12px rgba(7, 99, 50, 0.3)' : 'none'
                }}
              >
                In my room
              </button>
              <button
                onClick={() => setIsInMyRoom(isInMyRoom === false ? null : false)}
                className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105 ${
                  isInMyRoom === false 
                    ? 'text-white' 
                    : 'text-white'
                }`}
                style={{ 
                  background: isInMyRoom === false ? colors.primaryGreen : 'rgba(255, 255, 255, 0.1)',
                  border: isInMyRoom === false ? 'none' : `2px solid rgba(255, 255, 255, 0.3)`,
                  color: isInMyRoom === false ? colors.white : colors.white,
                  boxShadow: isInMyRoom === false ? '0 4px 12px rgba(7, 99, 50, 0.3)' : 'none'
                }}
              >
                Not in my room
              </button>
            </div>
          </div>

          {/* House Selector - Only show if not in my room */}
          {isInMyRoom === false && (
            <div className="mb-6 w-full">
              <label className="block text-lg mb-2 text-white font-semibold">{t('select_house')}</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedHouse(selectedHouse === 'new_house' ? '' : 'new_house')}
                  className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105 ${
                    selectedHouse === 'new_house' 
                      ? 'text-white' 
                      : 'text-white'
                  }`}
                  style={{ 
                    background: selectedHouse === 'new_house' ? colors.primaryGreen : 'rgba(255, 255, 255, 0.1)',
                    border: selectedHouse === 'new_house' ? 'none' : `2px solid rgba(255, 255, 255, 0.3)`,
                    color: selectedHouse === 'new_house' ? colors.white : colors.white,
                    boxShadow: selectedHouse === 'new_house' ? '0 4px 12px rgba(7, 99, 50, 0.3)' : 'none'
                  }}
                >
                  {t('houses.new_house')}
                </button>
                <button
                  onClick={() => setSelectedHouse(selectedHouse === 'original_house' ? '' : 'original_house')}
                  className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105 ${
                    selectedHouse === 'original_house' 
                      ? 'text-white' 
                      : 'text-white'
                  }`}
                  style={{ 
                    background: selectedHouse === 'original_house' ? colors.primaryGreen : 'rgba(255, 255, 255, 0.1)',
                    border: selectedHouse === 'original_house' ? 'none' : `2px solid rgba(255, 255, 255, 0.3)`,
                    color: selectedHouse === 'original_house' ? colors.white : colors.white,
                    boxShadow: selectedHouse === 'original_house' ? '0 4px 12px rgba(7, 99, 50, 0.3)' : 'none'
                  }}
                >
                  {t('houses.original_house')}
                </button>
              </div>
            </div>
          )}

          {/* Floor Selector - Only show if not in my room */}
          {isInMyRoom === false && (
            <div className="mb-6 w-full">
              <label className="block text-lg mb-2 text-white font-semibold">{t('select_floor')}</label>
              <div className="grid grid-cols-3 gap-2">
                {['-1', '0', '1', '2', '3'].map((floor) => (
                  <button
                    key={floor}
                    onClick={() => setSelectedFloor(selectedFloor === floor ? '' : floor)}
                    className={`px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105 ${
                      selectedFloor === floor 
                        ? 'text-white' 
                        : 'text-white'
                    }`}
                    style={{ 
                      background: selectedFloor === floor ? colors.primaryGreen : 'rgba(255, 255, 255, 0.1)',
                      border: selectedFloor === floor ? 'none' : `2px solid rgba(255, 255, 255, 0.3)`,
                      color: selectedFloor === floor ? colors.white : colors.white,
                      boxShadow: selectedFloor === floor ? '0 4px 12px rgba(7, 99, 50, 0.3)' : 'none'
                    }}
                  >
                    {t(`floors.${floor}`)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Problem Category Selector */}
          <div className="mb-6 w-full relative" ref={categoryDropdownRef}>
            <label className="block text-lg mb-2 text-white font-semibold">Problem Category</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                className="w-full px-4 py-3 rounded-xl text-lg border border-white/30 bg-white text-black focus:outline-none focus:border-gold transition text-left flex items-center justify-between"
              >
                <span className={selectedCategory ? 'text-black' : 'text-gray-500'}>
                  {selectedCategory ? categoryOptions.find(opt => opt.value === selectedCategory)?.label : 'Select a category...'}
                </span>
                <svg 
                  className={`w-5 h-5 transition-transform ${categoryDropdownOpen ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {categoryDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white rounded-xl shadow-lg border border-gray-200 max-h-60 overflow-auto">
                  {categoryOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(option.value);
                        setCategoryDropdownOpen(false);
                      }}
                      className={`w-full px-4 py-3 text-left text-lg hover:bg-gray-50 transition-colors first:rounded-t-xl last:rounded-b-xl ${
                        selectedCategory === option.value ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Problem Description */}
          <div className="mb-6 w-full">
            <label className="block text-lg mb-2 text-white font-semibold">{t('describe_problem')}</label>
            <textarea className="w-full border border-white/30 px-4 py-3 rounded-xl text-black bg-white text-lg placeholder-black/50 focus:outline-none focus:border-gold transition" rows={5} value={desc} onChange={e => setDesc(e.target.value)} placeholder={t('describe_problem')} style={{ background: colors.white, color: 'black' }} />
          </div>
          
          {/* Photo Upload Section */}
          <div className="w-full mb-6">
            <PhotoUpload
              onPhotoUploaded={handlePhotoUploaded}
              onPhotoRemoved={handlePhotoRemoved}
              currentPhotoUrl={uploadedPhotoUrl}
              uploadPath="reports"
              maxSize={10 * 1024 * 1024}
              acceptedTypes={['image/*']}
            />
          </div>
          
          {/* Submit Button */}
          <button 
            onClick={handleReportSubmit} 
            disabled={submitting} 
            className="w-full bg-[#EDC381] hover:bg-[#d4b06a] text-white py-4 rounded-full font-bold text-xl transition disabled:opacity-60"
          >
            {submitting ? 'Submitting...' : t('submit')}
          </button>
        </div>
      </div>
      
      {/* Request Refund Section */}
      <div className="w-full max-w-md mb-6">
        <button onClick={()=>setRefundOpen(true)} className="w-full rounded-full px-6 py-4 font-bold text-white text-lg shadow" style={{ background: colors.gold }}>Request refund</button>
      </div>
      <BottomNavBar active="report" />

      {refundOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 p-5">
            <div className="flex items-center justify-between mb-3"><h3 className="text-lg font-bold">{t('request_refund')}</h3><button onClick={()=>setRefundOpen(false)} className="text-gray-600">✕</button></div>
            {refundError && <div className="mb-3 text-red-600 text-sm bg-red-50 rounded px-3 py-2">{refundError}</div>}
            {refundSuccess && <div className="mb-3 text-green-700 text-sm bg-green-50 rounded px-3 py-2">{refundSuccess}</div>}
            <div className="grid grid-cols-1 gap-3">
              <input className="w-full px-4 py-3 rounded-xl border" placeholder={t('what_for')} value={refundForm.title} onChange={(e)=>setRefundForm(f=>({...f,title:e.target.value}))} />
              <input className="w-full px-4 py-3 rounded-xl border" placeholder={t('amount')} value={refundForm.amount} inputMode="decimal" onChange={(e)=>setRefundForm(f=>({...f,amount:e.target.value}))} />
              <select className="w-full px-4 py-3 rounded-xl border" value={refundForm.category} onChange={(e)=>setRefundForm(f=>({...f,category:e.target.value}))}>
                <option value="transportation">{t('categories.transportation')}</option>
                <option value="food">{t('categories.food')}</option>
                <option value="shopping">{t('categories.shopping')}</option>
                <option value="utilities">{t('categories.utilities')}</option>
                <option value="medical">{t('categories.medical')}</option>
                <option value="entertainment">{t('categories.entertainment')}</option>
                <option value="other">{t('categories.other')}</option>
              </select>
              <select className="w-full px-4 py-3 rounded-xl border" value={refundForm.method} onChange={(e)=>setRefundForm(f=>({...f,method:e.target.value}))}>
                <option value="bit">{t('methods.bit')}</option>
                <option value="cash">{t('methods.cash')}</option>
              </select>
              <input type="date" className="w-full px-4 py-3 rounded-xl border" value={refundForm.expenseDate} onChange={(e)=>setRefundForm(f=>({...f,expenseDate:e.target.value}))} />
              
              {/* Photo Upload for Receipt */}
              <div className="w-full">
                <PhotoUpload
                  onPhotoUploaded={handleRefundPhotoUploaded}
                  onPhotoRemoved={handleRefundPhotoRemoved}
                  currentPhotoUrl={refundPhotoUrl}
                  uploadPath="refunds"
                  maxSize={10 * 1024 * 1024}
                  acceptedTypes={['image/*']}
                />
              </div>
              
              <button onClick={handleRefundSave} disabled={refundSaving} className="w-full px-4 py-3 rounded-xl text-white font-semibold disabled:opacity-70 text-lg" style={{ background: colors.gold }}>
                {refundSaving ? t('submitting') : t('submit_request')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && submittedReport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b flex-shrink-0" style={{ backgroundColor: colors.gold + '20' }}>
              <h3 className="text-lg font-bold" style={{ color: colors.primaryGreen }}>Report Submitted Successfully!</h3>
              <button 
                onClick={() => setShowSuccessModal(false)} 
                className="text-2xl transition-colors hover:opacity-70"
                style={{ color: colors.primaryGreen }}
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: colors.green + '20' }}>
                  <svg className="w-8 h-8" style={{ color: colors.green }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="text-xl font-semibold mb-2" style={{ color: colors.primaryGreen }}>Thank You!</h4>
                <p className="text-gray-600">We've received your problem report and will look into it soon.</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <h5 className="font-semibold text-gray-800 mb-3">Report Details:</h5>
                
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium text-gray-600">Description:</span>
                    <p className="text-gray-800">{submittedReport.description}</p>
                  </div>
                  
                  <div>
                    <span className="text-sm font-medium text-gray-600">Category:</span>
                    <p className="text-gray-800 capitalize">{submittedReport.category?.replace('_', ' ') || 'Not specified'}</p>
                  </div>
                  
                  <div>
                    <span className="text-sm font-medium text-gray-600">Location:</span>
                    <p className="text-gray-800">
                      {submittedReport.isInMyRoom 
                        ? `Room ${submittedReport.roomNumber || 'N/A'}` 
                        : `${submittedReport.house === 'new_house' ? 'New House' : 'Original House'} - Floor ${submittedReport.floor}`
                      }
                    </p>
                  </div>
                  
                  <div>
                    <span className="text-sm font-medium text-gray-600">Submitted:</span>
                    <p className="text-gray-800">{submittedReport.submittedAt.toLocaleString()}</p>
                  </div>
                  
                  {submittedReport.photoUrl && (
                    <div>
                      <span className="text-sm font-medium text-gray-600">Photo:</span>
                      <div className="mt-2">
                        <img 
                          src={submittedReport.photoUrl} 
                          alt="Submitted photo" 
                          className="w-full h-32 object-cover rounded-lg"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t" style={{ backgroundColor: colors.surface }}>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full px-4 py-2 rounded-lg font-semibold transition-all duration-200 hover:shadow-md"
                style={{ 
                  backgroundColor: colors.primaryGreen,
                  color: 'white'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
} 
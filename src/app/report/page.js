"use client";
import { useTranslation } from 'react-i18next';
import BottomNavBar from '@/components/BottomNavBar';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import PhotoUpload from '@/components/PhotoUpload';
import { useState, useEffect, useRef } from 'react';
import colors from '../colors';
import { StyledDateInput } from '@/components/StyledDateInput';
import { auth, db, storage } from '@/lib/firebase';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { authedFetch } from '@/lib/authFetch';
import HouseLoader from '@/components/HouseLoader';

const SHOW_PROBLEM_REPORT = false;

function ReportPageContent() {
  const { t, i18n } = useTranslation('report');

  // --- User data (for feedback email) ---
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) setUserData(snap.data());
      }
    });
    return () => unsubscribe();
  }, []);

  // --- Website feedback state ---
  const [feedbackSubject, setFeedbackSubject] = useState('');
  const [feedbackBody, setFeedbackBody] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackConfirmOpen, setFeedbackConfirmOpen] = useState(false);
  const [feedbackScreenshots, setFeedbackScreenshots] = useState([]);
  const [screenshotUploading, setScreenshotUploading] = useState(false);
  const feedbackFileRef = useRef(null);

  const handleScreenshotFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const user = auth.currentUser;
    if (!user) return;

    setScreenshotUploading(true);
    const newScreenshots = [];

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) continue;
      try {
        const path = `feedback/${user.uid}/${Date.now()}_${file.name}`;
        const sRef = storageRef(storage, path);
        const snap = await uploadBytesResumable(sRef, file);
        const url = await getDownloadURL(snap.ref);
        newScreenshots.push({ url, path, name: file.name });
      } catch (err) {
        console.error('Screenshot upload failed:', err);
      }
    }

    setFeedbackScreenshots(prev => [...prev, ...newScreenshots]);
    setScreenshotUploading(false);
    if (feedbackFileRef.current) feedbackFileRef.current.value = '';
  };

  const removeScreenshot = (idx) => {
    setFeedbackScreenshots(prev => prev.filter((_, i) => i !== idx));
  };

  const handleFeedbackReview = () => {
    setFeedbackError('');
    if (!feedbackSubject.trim()) { setFeedbackError(t('feedback_subject_required')); return; }
    if (!feedbackBody.trim()) { setFeedbackError(t('feedback_body_required')); return; }
    setFeedbackConfirmOpen(true);
  };

  const handleFeedbackConfirm = async () => {
    setFeedbackError('');

    try {
      setFeedbackSending(true);
      const res = await authedFetch('/api/send-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: feedbackSubject.trim(),
          body: feedbackBody.trim(),
          senderName: userData?.fullName || '',
          roomNumber: userData?.roomNumber || '',
          phone: userData?.phone || '',
          screenshots: feedbackScreenshots.map(s => s.url),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to send');
      }

      setFeedbackConfirmOpen(false);
      setFeedbackSuccess(true);
      setFeedbackSubject('');
      setFeedbackBody('');
      setFeedbackScreenshots([]);
    } catch (e) {
      setFeedbackConfirmOpen(false);
      setFeedbackError(t('feedback_error'));
    } finally {
      setFeedbackSending(false);
    }
  };

  // --- Problem report state (hidden for now) ---
  const [desc, setDesc] = useState('');
  const [isInMyRoom, setIsInMyRoom] = useState(null);
  const [selectedHouse, setSelectedHouse] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submittedReport, setSubmittedReport] = useState(null);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState('');
  const [uploadedPhotoPath, setUploadedPhotoPath] = useState('');
  const categoryDropdownRef = useRef(null);

  const categoryOptions = [
    { value: 'air_conditioning', label: 'Air Conditioning' },
    { value: 'shower_toilet', label: 'Shower and Toilet' },
    { value: 'walls_floor', label: 'Walls and Floor' },
    { value: 'furniture', label: 'Furniture' },
    { value: 'other', label: 'Other' }
  ];

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

  const handleReportSubmit = async () => {
    setSubmitError(''); setSubmitSuccess('');
    
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
      const uData = userSnap.exists() ? userSnap.data() : {};
      
      const payload = {
        ownerUid: user.uid,
        ownerName: uData.fullName || '',
        ownerRoomNumber: uData.roomNumber || '',
        description: desc.trim(),
        category: selectedCategory,
        isInMyRoom: isInMyRoom,
        house: isInMyRoom ? uData.house || '' : selectedHouse,
        floor: isInMyRoom ? uData.floor || '' : selectedFloor,
        photoUrl: uploadedPhotoUrl || '',
        photoPath: uploadedPhotoPath || '',
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        softDeleted: false,
      };
      
      await addDoc(collection(db, 'problemReports'), payload);
      
      setSubmittedReport({
        description: desc,
        category: selectedCategory,
        isInMyRoom: isInMyRoom,
        house: isInMyRoom ? null : selectedHouse,
        floor: isInMyRoom ? null : selectedFloor,
        roomNumber: isInMyRoom ? uData.roomNumber : null,
        photoUrl: uploadedPhotoUrl,
        submittedAt: new Date()
      });
      
      setShowSuccessModal(true);
      
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

  // --- Refund state ---
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundSaving, setRefundSaving] = useState(false);
  const [refundError, setRefundError] = useState('');
  const [refundSuccess, setRefundSuccess] = useState('');
  const [refundForm, setRefundForm] = useState({ title: '', amount: '', category: 'transportation', method: 'bit', expenseDate: '' });
  const [refundPhotoUrl, setRefundPhotoUrl] = useState('');
  const [refundPhotoPath, setRefundPhotoPath] = useState('');
  const [refundConfirmOpen, setRefundConfirmOpen] = useState(false);
  const [categoryDropOpen, setCategoryDropOpen] = useState(false);
  const [methodDropOpen, setMethodDropOpen] = useState(false);
  const categoryRef = useRef(null);
  const methodRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target)) setCategoryDropOpen(false);
      if (methodRef.current && !methodRef.current.contains(e.target)) setMethodDropOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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

  const handleRefundReview = () => {
    setRefundError(''); setRefundSuccess('');
    const v = validateRefund();
    if (v) { setRefundError(v); return; }
    setCategoryDropOpen(false);
    setMethodDropOpen(false);
    setRefundConfirmOpen(true);
  };

  const handleRefundConfirm = async () => {
    setRefundError('');
    try {
      setRefundSaving(true);
      const user = auth.currentUser;
      if (!user) { setRefundError('You must be logged in'); setRefundSaving(false); setRefundConfirmOpen(false); return; }
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const uData = userSnap.exists() ? userSnap.data() : {};
      const payload = {
        ownerUid: user.uid,
        ownerName: uData.fullName || '',
        ownerRoomNumber: uData.roomNumber || '',
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

      const docRef = await addDoc(collection(db, 'refundRequests'), payload);
      console.log('Refund request saved, doc ID:', docRef.id);
      setRefundConfirmOpen(false);
      setRefundSuccess(t('request_submitted'));
      setRefundForm({ title: '', amount: '', category: 'transportation', method: 'bit', expenseDate: '' });
      setRefundPhotoUrl('');
      setRefundPhotoPath('');
    } catch (e) {
      console.error('Refund request failed:', e);
      setRefundConfirmOpen(false);
      setRefundError('Failed to submit request');
    } finally {
      setRefundSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-200/60 to-green-100/60 font-body flex flex-col items-center pt-10 pb-32 px-2 phone-sm:px-2 phone-md:px-4 phone-lg:px-6">
      <LanguageSwitcher />
      <div className="w-full max-w-md">

        {/* ========== PROBLEM REPORT (hidden) ========== */}
        {SHOW_PROBLEM_REPORT && (
          <div className="rounded-3xl p-10 mb-8 shadow-lg flex flex-col items-center" style={{ background: 'rgba(0,0,0,0.38)' }}>
            <h2 className="text-3xl font-extrabold mb-8 text-white text-center tracking-wide">{t('report_a_problem')}</h2>
            
            {submitError && <div className="mb-4 w-full text-red-200 text-sm bg-red-500/20 rounded px-3 py-2">{submitError}</div>}
            {submitSuccess && <div className="mb-4 w-full text-green-200 text-sm bg-green-500/20 rounded px-3 py-2">{submitSuccess}</div>}
            
            <div className="mb-6 w-full">
              <label className="block text-lg mb-2 text-white font-semibold">Where is the problem located?</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsInMyRoom(isInMyRoom === true ? null : true)}
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105 text-white"
                  style={{ 
                    background: isInMyRoom === true ? colors.primaryGreen : 'rgba(255, 255, 255, 0.1)',
                    border: isInMyRoom === true ? 'none' : '2px solid rgba(255, 255, 255, 0.3)',
                    color: colors.white,
                    boxShadow: isInMyRoom === true ? '0 4px 12px rgba(7, 99, 50, 0.3)' : 'none'
                  }}
                >
                  In my room
                </button>
                <button
                  onClick={() => setIsInMyRoom(isInMyRoom === false ? null : false)}
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105 text-white"
                  style={{ 
                    background: isInMyRoom === false ? colors.primaryGreen : 'rgba(255, 255, 255, 0.1)',
                    border: isInMyRoom === false ? 'none' : '2px solid rgba(255, 255, 255, 0.3)',
                    color: colors.white,
                    boxShadow: isInMyRoom === false ? '0 4px 12px rgba(7, 99, 50, 0.3)' : 'none'
                  }}
                >
                  Not in my room
                </button>
              </div>
            </div>

            {isInMyRoom === false && (
              <div className="mb-6 w-full">
                <label className="block text-lg mb-2 text-white font-semibold">{t('select_house')}</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedHouse(selectedHouse === 'new_house' ? '' : 'new_house')}
                    className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105 text-white"
                    style={{ 
                      background: selectedHouse === 'new_house' ? colors.primaryGreen : 'rgba(255, 255, 255, 0.1)',
                      border: selectedHouse === 'new_house' ? 'none' : '2px solid rgba(255, 255, 255, 0.3)',
                      color: colors.white,
                      boxShadow: selectedHouse === 'new_house' ? '0 4px 12px rgba(7, 99, 50, 0.3)' : 'none'
                    }}
                  >
                    {t('houses.new_house')}
                  </button>
                  <button
                    onClick={() => setSelectedHouse(selectedHouse === 'original_house' ? '' : 'original_house')}
                    className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105 text-white"
                    style={{ 
                      background: selectedHouse === 'original_house' ? colors.primaryGreen : 'rgba(255, 255, 255, 0.1)',
                      border: selectedHouse === 'original_house' ? 'none' : '2px solid rgba(255, 255, 255, 0.3)',
                      color: colors.white,
                      boxShadow: selectedHouse === 'original_house' ? '0 4px 12px rgba(7, 99, 50, 0.3)' : 'none'
                    }}
                  >
                    {t('houses.original_house')}
                  </button>
                </div>
              </div>
            )}

            {isInMyRoom === false && (
              <div className="mb-6 w-full">
                <label className="block text-lg mb-2 text-white font-semibold">{t('select_floor')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {['-1', '0', '1', '2', '3'].map((floor) => (
                    <button
                      key={floor}
                      onClick={() => setSelectedFloor(selectedFloor === floor ? '' : floor)}
                      className="px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105 text-white"
                      style={{ 
                        background: selectedFloor === floor ? colors.primaryGreen : 'rgba(255, 255, 255, 0.1)',
                        border: selectedFloor === floor ? 'none' : '2px solid rgba(255, 255, 255, 0.3)',
                        color: colors.white,
                        boxShadow: selectedFloor === floor ? '0 4px 12px rgba(7, 99, 50, 0.3)' : 'none'
                      }}
                    >
                      {t(`floors.${floor}`)}
                    </button>
                  ))}
                </div>
              </div>
            )}

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

            <div className="mb-6 w-full">
              <label className="block text-lg mb-2 text-white font-semibold">{t('describe_problem')}</label>
              <textarea className="w-full border border-white/30 px-4 py-3 rounded-xl text-black bg-white text-lg placeholder-black/50 focus:outline-none focus:border-gold transition" rows={5} value={desc} onChange={e => setDesc(e.target.value)} placeholder={t('describe_problem')} style={{ background: colors.white, color: 'black' }} />
            </div>
            
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
            
            <button 
              onClick={handleReportSubmit} 
              disabled={submitting} 
              className="w-full bg-[#EDC381] hover:bg-[#d4b06a] text-white py-4 rounded-full font-bold text-xl transition disabled:opacity-60"
            >
              {submitting ? 'Submitting...' : t('submit')}
            </button>
          </div>
        )}

        {/* ========== WEBSITE FEEDBACK FORM ========== */}
        <div className="rounded-3xl p-8 mb-8 shadow-lg flex flex-col items-center" style={{ background: 'rgba(0,0,0,0.38)' }}>
          <h2 className="text-2xl font-extrabold mb-6 text-white text-center tracking-wide">{t('report_website_problem')}</h2>

          {feedbackError && <div className="mb-4 w-full text-red-200 text-sm bg-red-500/20 rounded px-3 py-2">{feedbackError}</div>}
          {feedbackSuccess && (
            <div className="mb-4 w-full text-green-200 text-sm bg-green-500/20 rounded px-3 py-2 flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t('feedback_sent')}
            </div>
          )}

          <div className="mb-4 w-full">
            <label className="block text-base mb-2 text-white font-semibold">{t('email_subject')}</label>
            <input
              className="w-full border border-white/30 px-4 py-3 rounded-xl text-lg focus:outline-none transition"
              style={{ background: colors.white, color: 'black' }}
              placeholder={t('email_subject_placeholder')}
              value={feedbackSubject}
              onChange={e => setFeedbackSubject(e.target.value)}
            />
          </div>

          <div className="mb-4 w-full">
            <label className="block text-base mb-2 text-white font-semibold">{t('email_body')}</label>
            <textarea
              className="w-full border border-white/30 px-4 py-3 rounded-xl text-lg placeholder-black/50 focus:outline-none transition"
              style={{ background: colors.white, color: 'black' }}
              rows={5}
              placeholder={t('email_body_placeholder')}
              value={feedbackBody}
              onChange={e => setFeedbackBody(e.target.value)}
            />
          </div>

          <div className="mb-6 w-full">
            <label className="block text-base mb-2 text-white font-semibold">{t('attach_screenshots')}</label>
            <input
              ref={feedbackFileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleScreenshotFiles}
              className="hidden"
            />
            {screenshotUploading ? (
              <div className="flex justify-center py-3">
                <HouseLoader size={56} text={t('uploading_screenshots')} />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => feedbackFileRef.current?.click()}
                className="w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 text-white flex items-center justify-center gap-2"
                style={{ background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.3)' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{t('add_screenshots')}</span>
              </button>
            )}
            {feedbackScreenshots.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {feedbackScreenshots.map((s, idx) => (
                  <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-white/30">
                    <img src={s.url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeScreenshot(idx)}
                      className="absolute top-0 right-0 bg-black/60 text-white w-5 h-5 flex items-center justify-center text-xs rounded-bl-lg"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleFeedbackReview}
            className="w-full text-white py-4 rounded-full font-bold text-xl transition hover:opacity-90"
            style={{ background: colors.gold }}
          >
            {t('send_feedback')}
          </button>
        </div>

        {/* ========== REFUND REQUEST BUTTON ========== */}
        <div className="w-full mb-6">
          <button onClick={() => setRefundOpen(true)} className="w-full rounded-full px-6 py-4 font-bold text-white text-lg shadow" style={{ background: colors.gold }}>{t('request_refund')}</button>
        </div>
      </div>

      <BottomNavBar active="report" />

      {/* Refund modal */}
      {refundOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center overflow-y-auto py-8">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 p-5 my-auto">
            <div className="flex items-center justify-between mb-3"><h3 className="text-lg font-bold">{t('request_refund')}</h3><button onClick={() => setRefundOpen(false)} className="text-gray-600">✕</button></div>
            {refundError && <div className="mb-3 text-red-600 text-sm bg-red-50 rounded px-3 py-2">{refundError}</div>}
            {refundSuccess && <div className="mb-3 text-green-700 text-sm bg-green-50 rounded px-3 py-2">{refundSuccess}</div>}
            <div className="grid grid-cols-1 gap-3">
              <input className="w-full px-4 py-3 rounded-xl border" placeholder={t('what_for')} value={refundForm.title} onChange={(e) => setRefundForm(f => ({ ...f, title: e.target.value }))} />
              <input className="w-full px-4 py-3 rounded-xl border" placeholder={t('amount')} value={refundForm.amount} inputMode="decimal" onChange={(e) => setRefundForm(f => ({ ...f, amount: e.target.value }))} />
              <div className="relative" ref={categoryRef}>
                <button
                  type="button"
                  onClick={() => { setCategoryDropOpen(v => !v); setMethodDropOpen(false); }}
                  className="w-full px-4 py-3 rounded-xl border text-left flex items-center justify-between"
                >
                  <span>{t(`categories.${refundForm.category}`)}</span>
                  <svg className={`w-5 h-5 text-gray-400 transition-transform ${categoryDropOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {categoryDropOpen && (
                  <div className="absolute z-[80] w-full mt-1 bg-white rounded-xl shadow-lg border max-h-60 overflow-auto">
                    {['transportation','food','shopping','utilities','medical','entertainment','other'].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => { setRefundForm(f => ({ ...f, category: val })); setCategoryDropOpen(false); }}
                        className={`w-full px-4 py-3 text-left transition-colors first:rounded-t-xl last:rounded-b-xl ${refundForm.category === val ? 'bg-green-50 font-semibold' : 'hover:bg-gray-50'}`}
                      >
                        {t(`categories.${val}`)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative" ref={methodRef}>
                <button
                  type="button"
                  onClick={() => { setMethodDropOpen(v => !v); setCategoryDropOpen(false); }}
                  className="w-full px-4 py-3 rounded-xl border text-left flex items-center justify-between"
                >
                  <span>{t(`methods.${refundForm.method}`)}</span>
                  <svg className={`w-5 h-5 text-gray-400 transition-transform ${methodDropOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {methodDropOpen && (
                  <div className="absolute z-[80] w-full mt-1 bg-white rounded-xl shadow-lg border">
                    {['bit','cash'].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => { setRefundForm(f => ({ ...f, method: val })); setMethodDropOpen(false); }}
                        className={`w-full px-4 py-3 text-left transition-colors first:rounded-t-xl last:rounded-b-xl ${refundForm.method === val ? 'bg-green-50 font-semibold' : 'hover:bg-gray-50'}`}
                      >
                        {t(`methods.${val}`)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <StyledDateInput value={refundForm.expenseDate} onChange={(e) => setRefundForm(f => ({ ...f, expenseDate: e.target.value }))} />
              
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
              
              <button onClick={handleRefundReview} className="w-full px-4 py-3 rounded-xl text-white font-semibold text-lg" style={{ background: colors.gold }}>
                {t('submit_request')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund confirmation modal */}
      {refundConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="px-5 pt-5 pb-3">
              <h3 className="text-lg font-bold text-center mb-4">{t('confirm_refund_title')}</h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">{t('what_for')}</span>
                  <span className="font-medium text-right max-w-[60%] truncate">{refundForm.title}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">{t('amount')}</span>
                  <span className="font-semibold">{Number(refundForm.amount).toLocaleString('he-IL', { style: 'currency', currency: 'ILS' })}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">{t('expense_category')}</span>
                  <span className="font-medium">{t(`categories.${refundForm.category}`)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">{t('repayment_method')}</span>
                  <span className="font-medium">{t(`methods.${refundForm.method}`)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">{t('expense_date')}</span>
                  <span className="font-medium">{refundForm.expenseDate ? new Date(refundForm.expenseDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : ''}</span>
                </div>
                {refundPhotoUrl && (
                  <div className="pt-1">
                    <span className="text-gray-500 text-xs block mb-1.5">{t('receipt_attached')}</span>
                    <img src={refundPhotoUrl} alt="" className="w-full h-28 object-cover rounded-lg" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5 pt-3">
              <button
                type="button"
                onClick={() => setRefundConfirmOpen(false)}
                className="flex-1 py-3 rounded-xl font-semibold text-sm border-2 transition-all active:scale-95"
                style={{ borderColor: colors.gray400, color: colors.text }}
              >
                {t('go_back')}
              </button>
              <button
                type="button"
                onClick={handleRefundConfirm}
                disabled={refundSaving}
                className="flex-1 py-3 rounded-xl font-semibold text-sm text-white transition-all active:scale-95 disabled:opacity-60"
                style={{ backgroundColor: colors.primaryGreen }}
              >
                {refundSaving ? t('submitting') : t('confirm_submit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback confirmation modal */}
      {feedbackConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="px-5 pt-5 pb-3">
              <h3 className="text-lg font-bold text-center mb-4">{t('confirm_feedback_title')}</h3>
              <div className="space-y-2.5 text-sm">
                <div className="py-2 border-b border-gray-100">
                  <span className="text-gray-500">{t('email_subject')}</span>
                  <p className="font-medium mt-0.5">{feedbackSubject}</p>
                </div>
                <div className="py-2 border-b border-gray-100">
                  <span className="text-gray-500">{t('email_body')}</span>
                  <p className="font-medium mt-0.5 whitespace-pre-wrap max-h-32 overflow-y-auto">{feedbackBody}</p>
                </div>
                {feedbackScreenshots.length > 0 && (
                  <div className="pt-1">
                    <span className="text-gray-500 text-xs block mb-1.5">{t('screenshots_count', { count: feedbackScreenshots.length })}</span>
                    <div className="flex flex-wrap gap-2">
                      {feedbackScreenshots.map((s, idx) => (
                        <img key={idx} src={s.url} alt="" className="w-14 h-14 object-cover rounded-lg" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5 pt-3">
              <button
                type="button"
                onClick={() => setFeedbackConfirmOpen(false)}
                className="flex-1 py-3 rounded-xl font-semibold text-sm border-2 transition-all active:scale-95"
                style={{ borderColor: colors.gray400, color: colors.text }}
              >
                {t('go_back')}
              </button>
              <button
                type="button"
                onClick={handleFeedbackConfirm}
                disabled={feedbackSending}
                className="flex-1 py-3 rounded-xl font-semibold text-sm text-white transition-all active:scale-95 disabled:opacity-60"
                style={{ backgroundColor: colors.primaryGreen }}
              >
                {feedbackSending ? t('submitting') : t('confirm_send')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Problem report success modal (hidden when SHOW_PROBLEM_REPORT is false) */}
      {SHOW_PROBLEM_REPORT && showSuccessModal && submittedReport && (
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
                <p className="text-gray-600">We&apos;ve received your problem report and will look into it soon.</p>
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

export default ReportPageContent;

"use client";
import { useTranslation } from 'react-i18next';
import BottomNavBar from '@/components/BottomNavBar';
import { useState, useEffect, useRef } from 'react';
import colors from '../colors';
import { auth, db, storage } from '@/lib/firebase';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

export default function ReportPage() {
  const { t, i18n } = useTranslation('report');
  const [desc, setDesc] = useState('');
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundSaving, setRefundSaving] = useState(false);
  const [refundError, setRefundError] = useState('');
  const [refundSuccess, setRefundSuccess] = useState('');
  const [refundForm, setRefundForm] = useState({ title: '', amount: '', category: 'transportation', method: 'bit', expenseDate: '' });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    const savedLang = typeof window !== 'undefined' ? localStorage.getItem('lang') : null;
    if (savedLang && savedLang !== i18n.language) {
      i18n.changeLanguage(savedLang);
      document.documentElement.dir = savedLang === 'he' ? 'rtl' : 'ltr';
    }
  }, [i18n]);

  const handleLanguageSwitch = () => {
    const nextLang = i18n.language === 'en' ? 'he' : 'en';
    i18n.changeLanguage(nextLang);
    if (typeof window !== 'undefined') localStorage.setItem('lang', nextLang);
    document.documentElement.dir = nextLang === 'he' ? 'rtl' : 'ltr';
  };

  const triggerFilePicker = () => {
    setUploadError('');
    setUploadSuccess('');
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileSelected = async (event) => {
    try {
      setUploadError('');
      setUploadSuccess('');
      const file = event.target.files?.[0];
      if (!file) return;
      const user = auth.currentUser;
      if (!user) { setUploadError('You must be logged in'); return; }
      if (!file.type.startsWith('image/')) { setUploadError('Please select an image file'); return; }
      if (file.size > 10 * 1024 * 1024) { setUploadError('File too large (max 10MB)'); return; }

      setUploading(true);
      setUploadProgress(0);
      const path = `reports/${user.uid}/${Date.now()}_${file.name}`;
      const ref = storageRef(storage, path);
      // Debug info to validate bucket and path in case of stuck uploads
      try { console.log('Upload to bucket:', storage.app?.options?.storageBucket, 'ref.bucket:', ref.bucket, 'path:', path); } catch(_) {}
      const task = uploadBytesResumable(ref, file, { contentType: file.type });

      await new Promise((resolve, reject) => {
        task.on('state_changed', (snap) => {
          if (snap.totalBytes > 0) {
            setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
          }
        }, reject, resolve);
      });

      const downloadURL = await getDownloadURL(task.snapshot.ref);

      // Save minimal metadata for later linking
      await addDoc(collection(db, 'reportUploads'), {
        ownerUid: user.uid,
        storagePath: path,
        downloadURL,
        createdAt: serverTimestamp(),
      });

      setUploadSuccess('Photo uploaded');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e) {
      setUploadError(`Failed to upload photo: ${e?.message || ''}`.trim());
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const validateRefund = () => {
    if (!refundForm.title.trim()) return 'Please enter what for';
    if (!refundForm.amount || isNaN(Number(refundForm.amount))) return 'Please enter a valid amount';
    if (!refundForm.category) return 'Please choose an expense category';
    if (!refundForm.method) return 'Please choose a repayment method';
    if (!refundForm.expenseDate) return 'Please choose the expense date';
    return '';
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
      };
      await addDoc(collection(db, 'refundRequests'), payload);
      setRefundSuccess(t('request_submitted'));
      setRefundForm({ title: '', amount: '', category: 'transportation', method: 'bit', expenseDate: '' });
    } catch (e) { setRefundError('Failed to submit request'); }
    finally { setRefundSaving(false); }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-200/60 to-green-100/60 font-body flex flex-col items-center pt-10 pb-32 px-2 phone-sm:px-2 phone-md:px-4 phone-lg:px-6">
      <div className="w-full max-w-md mb-6">
        <button onClick={()=>setRefundOpen(true)} className="w-full rounded-full px-6 py-4 font-bold text-white text-lg shadow" style={{ background: colors.gold }}>Request refund</button>
      </div>
      <button onClick={handleLanguageSwitch} className="absolute top-4 right-4 bg-surface p-2 rounded-full text-white text-xl hover:text-text">{i18n.language === 'en' ? 'עברית' : 'EN'}</button>
      <div className="w-full max-w-md">
        <div className="rounded-3xl p-10 mb-8 shadow-lg flex flex-col items-center" style={{ background: 'rgba(0,0,0,0.38)' }}>
          <h2 className="text-3xl font-extrabold mb-8 text-white text-center tracking-wide">{t('report_a_problem')}</h2>
          <div className="mb-8 w-full">
            <label className="block text-lg mb-2 text-white font-semibold">{t('describe_problem')}</label>
            <textarea className="w-full border border-white/30 px-4 py-3 rounded-xl text-black bg-white text-lg placeholder-black/50 focus:outline-none focus:border-gold transition" rows={5} value={desc} onChange={e => setDesc(e.target.value)} placeholder={t('describe_problem')} style={{ background: colors.white, color: 'black' }} />
          </div>
          {/* Upload photo section */}
          <div className="w-full mb-4">
            {uploadError && <div className="mb-3 text-red-200 text-sm bg-red-500/20 rounded px-3 py-2">{uploadError}</div>}
            {uploadSuccess && <div className="mb-3 text-green-200 text-sm bg-green-500/20 rounded px-3 py-2">{uploadSuccess}</div>}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />
            <button onClick={triggerFilePicker} disabled={uploading} className="w-full bg-white/15 hover:bg-white/25 text-white py-3 rounded-xl font-semibold text-lg disabled:opacity-60">
              {uploading ? `Uploading… ${uploadProgress}%` : 'Upload photo'}
            </button>
          </div>
          <button className="w-full bg-[#EDC381] hover:bg-[#d4b06a] text-white py-4 rounded-full font-bold text-xl transition">{t('submit')}</button>
        </div>
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
              <button onClick={handleRefundSave} disabled={refundSaving} className="w-full px-4 py-3 rounded-xl text-white font-semibold disabled:opacity-70 text-lg" style={{ background: colors.gold }}>
                {refundSaving ? t('submitting') : t('submit_request')}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
} 
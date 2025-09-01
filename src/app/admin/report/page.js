"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, orderBy, addDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '@/lib/firebase';
import colors from '../../colors';
import AdminBottomNavBar from '@/components/AdminBottomNavBar';

export default function AdminReportPage() {
  const router = useRouter();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
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
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const reportsQuery = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
      const reportsSnapshot = await getDocs(reportsQuery);
      const reportsData = reportsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReports(reportsData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching reports:', error);
      setLoading(false);
    }
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
    setRefundError(''); 
    setRefundSuccess('');
    const v = validateRefund(); 
    if (v) { 
      setRefundError(v); 
      return; 
    }
    try {
      setRefundSaving(true);
      const user = auth.currentUser; 
      if (!user) { 
        setRefundError('You must be logged in'); 
        setRefundSaving(false); 
        return; 
      }
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
      setRefundSuccess('Request submitted successfully');
      setRefundForm({ title: '', amount: '', category: 'transportation', method: 'bit', expenseDate: '' });
    } catch (e) { 
      setRefundError('Failed to submit request'); 
    } finally { 
      setRefundSaving(false); 
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-200/60 to-green-100/60 font-body flex flex-col items-center pt-6 pb-32 px-4">
      <div className="w-full max-w-md">
        <div className="w-full max-w-md rounded-2xl px-5 pt-6 pb-4 mb-6 bg-white/10 backdrop-blur-md shadow-sm">
          <h1 className="text-2xl font-bold text-text">Reports</h1>
          <p className="text-sm text-muted">View all submitted reports</p>
        </div>

        {/* Report Creation Form */}
        <div className="w-full max-w-md rounded-2xl p-6 mb-6" style={{ background: colors.sectionBg }}>
          <h2 className="text-2xl font-bold text-white mb-4 text-center">Report a Problem</h2>
          <div className="mb-4">
            <label className="block text-lg mb-2 text-white font-semibold">Describe the problem</label>
            <textarea 
              className="w-full border border-white/30 px-4 py-3 rounded-xl text-black bg-white text-lg placeholder-black/50 focus:outline-none focus:border-gold transition" 
              rows={5} 
              value={desc} 
              onChange={e => setDesc(e.target.value)} 
              placeholder="Describe the problem..." 
              style={{ background: colors.white, color: 'black' }} 
            />
          </div>
          
          {/* Upload photo section */}
          <div className="w-full mb-4">
            {uploadError && <div className="mb-3 text-red-200 text-sm bg-red-500/20 rounded px-3 py-2">{uploadError}</div>}
            {uploadSuccess && <div className="mb-3 text-green-200 text-sm bg-green-500/20 rounded px-3 py-2">{uploadSuccess}</div>}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />
            <button 
              onClick={triggerFilePicker} 
              disabled={uploading} 
              className="w-full bg-white/15 hover:bg-white/25 text-white py-3 rounded-xl font-semibold text-lg disabled:opacity-60"
            >
              {uploading ? `Uploading… ${uploadProgress}%` : 'Upload photo'}
            </button>
          </div>
          
          <button className="w-full bg-[#EDC381] hover:bg-[#d4b06a] text-white py-4 rounded-full font-bold text-xl transition">
            Submit Report
          </button>
        </div>

        {/* Request Refund Section */}
        <div className="w-full max-w-md rounded-2xl p-4 mb-6" style={{ background: colors.sectionBg }}>
          <button 
            onClick={() => setRefundOpen(true)} 
            className="w-full rounded-full px-6 py-4 font-bold text-white text-lg shadow" 
            style={{ background: colors.gold }}
          >
            Request Refund
          </button>
        </div>

        {/* View Reports Section */}
        <div className="w-full max-w-md rounded-2xl p-4 mb-6" style={{ background: colors.sectionBg }}>
          <h3 className="text-lg font-semibold text-white mb-4">All Reports</h3>
          {loading ? (
            <div className="text-center text-white py-4">Loading...</div>
          ) : reports.length === 0 ? (
            <div className="text-center text-white py-4">No reports found</div>
          ) : (
            reports.map(report => (
              <div key={report.id} className="bg-white/10 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{report.title}</h3>
                    <p className="text-sm text-white/80">{report.description}</p>
                  </div>
                  <span className="text-xs text-white/60">
                    {report.createdAt?.toDate().toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-white/80">
                  <span>Room: {report.roomNumber}</span>
                  <span>•</span>
                  <span>Status: {report.status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      <AdminBottomNavBar active="report" />

      {/* Refund Request Modal */}
      {refundOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold">Request Refund</h3>
              <button onClick={() => setRefundOpen(false)} className="text-gray-600">✕</button>
            </div>
            {refundError && <div className="mb-3 text-red-600 text-sm bg-red-50 rounded px-3 py-2">{refundError}</div>}
            {refundSuccess && <div className="mb-3 text-green-700 text-sm bg-green-50 rounded px-3 py-2">{refundSuccess}</div>}
            <div className="grid grid-cols-1 gap-3">
              <input 
                className="w-full px-4 py-3 rounded-xl border" 
                placeholder="What for" 
                value={refundForm.title} 
                onChange={(e) => setRefundForm(f => ({...f, title: e.target.value}))} 
              />
              <input 
                className="w-full px-4 py-3 rounded-xl border" 
                placeholder="Amount" 
                value={refundForm.amount} 
                inputMode="decimal" 
                onChange={(e) => setRefundForm(f => ({...f, amount: e.target.value}))} 
              />
              <select 
                className="w-full px-4 py-3 rounded-xl border" 
                value={refundForm.category} 
                onChange={(e) => setRefundForm(f => ({...f, category: e.target.value}))}
              >
                <option value="transportation">Transportation</option>
                <option value="food">Food</option>
                <option value="shopping">Shopping</option>
                <option value="utilities">Utilities</option>
                <option value="medical">Medical</option>
                <option value="entertainment">Entertainment</option>
                <option value="other">Other</option>
              </select>
              <select 
                className="w-full px-4 py-3 rounded-xl border" 
                value={refundForm.method} 
                onChange={(e) => setRefundForm(f => ({...f, method: e.target.value}))}
              >
                <option value="bit">Bit</option>
                <option value="cash">Cash</option>
              </select>
              <input 
                type="date" 
                className="w-full px-4 py-3 rounded-xl border" 
                value={refundForm.expenseDate} 
                onChange={(e) => setRefundForm(f => ({...f, expenseDate: e.target.value}))} 
              />
              <button 
                onClick={handleRefundSave} 
                disabled={refundSaving} 
                className="w-full px-4 py-3 rounded-xl text-white font-semibold disabled:opacity-70 text-lg" 
                style={{ background: colors.gold }}
              >
                {refundSaving ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
} 
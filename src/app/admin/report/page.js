"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, query, orderBy, addDoc, doc, getDoc, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '@/lib/firebase';
import colors from '../../colors';
import AdminBottomNavBar from '@/components/AdminBottomNavBar';
import PhotoUpload from '@/components/PhotoUpload';

export default function AdminReportPage() {
  const router = useRouter();
  const { t, i18n } = useTranslation('report');
  const [reports, setReports] = useState([]);
  const [problemReports, setProblemReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [problemsLoading, setProblemsLoading] = useState(true);
  
  // Report a Problem Form State
  const [desc, setDesc] = useState('');
  const [selectedHouse, setSelectedHouse] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState('');
  const [uploadedPhotoPath, setUploadedPhotoPath] = useState('');
  
  // Refund Form State
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
  
  // Modal states
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState('');
  const [formerProblemsOpen, setFormerProblemsOpen] = useState(false);
  const [fixedReports, setFixedReports] = useState([]);

  useEffect(() => {
    fetchReports();
    fetchProblemReports();
    fetchFixedReports();
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

  const fetchProblemReports = async () => {
    try {
      const problemReportsQuery = query(collection(db, 'problemReports'), orderBy('createdAt', 'desc'));
      const problemReportsSnapshot = await getDocs(problemReportsQuery);
      const problemReportsData = problemReportsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(report => report.status !== 'fixed');
      setProblemReports(problemReportsData);
      setProblemsLoading(false);
    } catch (error) {
      console.error('Error fetching problem reports:', error);
      setProblemsLoading(false);
    }
  };

  const fetchFixedReports = async () => {
    try {
      const fixedReportsQuery = query(collection(db, 'problemReports'), orderBy('createdAt', 'desc'));
      const fixedReportsSnapshot = await getDocs(fixedReportsQuery);
      const fixedReportsData = fixedReportsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(report => report.status === 'fixed');
      setFixedReports(fixedReportsData);
    } catch (error) {
      console.error('Error fetching fixed reports:', error);
    }
  };

  const markAsFixed = async (reportId) => {
    try {
      const reportRef = doc(db, 'problemReports', reportId);
      await updateDoc(reportRef, {
        status: 'fixed',
        updatedAt: serverTimestamp()
      });
      
      // Refresh the reports
      fetchProblemReports();
      fetchFixedReports();
    } catch (error) {
      console.error('Error marking report as fixed:', error);
    }
  };

  const openPhotoModal = (photoUrl) => {
    setSelectedPhoto(photoUrl);
    setPhotoModalOpen(true);
  };

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
    
    // Validate form
    if (!desc.trim()) {
      setSubmitError('Please describe the problem');
      return;
    }
    if (!selectedHouse) {
      setSubmitError('Please select a house');
      return;
    }
    if (!selectedFloor) {
      setSubmitError('Please select a floor');
      return;
    }
    
    try {
      setSubmitting(true);
      const user = auth.currentUser;
      if (!user) {
        setSubmitError('You must be logged in to submit a report');
        return;
      }
      
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const userData = userSnap.exists() ? userSnap.data() : {};
      
      const payload = {
        ownerUid: user.uid,
        ownerName: userData.fullName || '',
        ownerRoomNumber: userData.roomNumber || '',
        description: desc.trim(),
        house: selectedHouse,
        floor: selectedFloor,
        photoUrl: uploadedPhotoUrl || '',
        photoPath: uploadedPhotoPath || '',
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        softDeleted: false,
      };
      
      await addDoc(collection(db, 'problemReports'), payload);
      setSubmitSuccess('Problem report submitted successfully');
      
      // Reset form
      setDesc('');
      setSelectedHouse('');
      setSelectedFloor('');
      setUploadedPhotoUrl('');
      setUploadedPhotoPath('');
      
      // Refresh the problem reports list
      fetchProblemReports();
      
    } catch (e) {
      setSubmitError('Failed to submit problem report. Please try again');
      console.error('Error submitting report:', e);
    } finally {
      setSubmitting(false);
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
          <p className="text-sm text-muted">View and manage all submitted reports</p>
        </div>

        {/* Report a Problem Form - Same as Soldiers */}
        <div className="rounded-3xl p-10 mb-8 shadow-lg flex flex-col items-center" style={{ background: 'rgba(0,0,0,0.38)' }}>
          <h2 className="text-3xl font-extrabold mb-8 text-white text-center tracking-wide">Report a Problem</h2>
          
          {/* Error and Success Messages */}
          {submitError && <div className="mb-4 w-full text-red-200 text-sm bg-red-500/20 rounded px-3 py-2">{submitError}</div>}
          {submitSuccess && <div className="mb-4 w-full text-green-200 text-sm bg-green-500/20 rounded px-3 py-2">{submitSuccess}</div>}
          
          {/* House Selector */}
          <div className="mb-6 w-full">
            <label className="block text-lg mb-2 text-white font-semibold">Select House</label>
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
                New House
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
                Original House
              </button>
            </div>
          </div>

          {/* Floor Selector */}
          <div className="mb-6 w-full">
            <label className="block text-lg mb-2 text-white font-semibold">Select Floor</label>
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
                  {floor === '-1' ? 'Floor -1' : 
                   floor === '0' ? 'Ground Floor' : 
                   `Floor ${floor}`}
                </button>
              ))}
            </div>
          </div>

          {/* Problem Description */}
          <div className="mb-6 w-full">
            <label className="block text-lg mb-2 text-white font-semibold">Problem Description</label>
            <textarea className="w-full border border-white/30 px-4 py-3 rounded-xl text-black bg-white text-lg placeholder-black/50 focus:outline-none focus:border-gold transition" rows={5} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Please describe the problem in detail..." style={{ background: colors.white, color: 'black' }} />
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
            {submitting ? 'Submitting...' : 'Submit Report'}
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
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white">All Reports</h3>
            <button
              onClick={() => setFormerProblemsOpen(true)}
              className="bg-white/15 hover:bg-white/25 text-white px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-105"
            >
              View Fixed
            </button>
          </div>
          {problemsLoading ? (
            <div className="text-center text-white py-4">Loading reports...</div>
          ) : problemReports.length === 0 ? (
            <div className="text-center text-white py-4">No reports available</div>
          ) : (
            problemReports.map(report => (
              <div key={report.id} className="bg-white/10 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm text-white/80 mb-2">
                      <span>House: {report.house === 'new_house' ? 'New House' : 'Original House'}</span>
                      <span>•</span>
                      <span>Floor: {report.floor === '-1' ? 'Floor -1' : report.floor === '0' ? 'Ground Floor' : `Floor ${report.floor}`}</span>
                    </div>
                    <p className="text-sm text-white/80 mb-2">{report.description}</p>
                    <div className="flex items-center gap-2 text-xs text-white/60">
                      <span>By: {report.ownerName}</span>
                      <span>•</span>
                      <span>Room: {report.ownerRoomNumber}</span>
                      <span>•</span>
                      <span>Status: {report.status}</span>
                    </div>
                  </div>
                  <span className="text-xs text-white/60 ml-2">
                    {report.createdAt?.toDate().toLocaleDateString()}
                  </span>
                </div>
                {report.photoUrl && (
                  <div className="mt-3">
                    <img 
                      src={report.photoUrl} 
                      alt="Problem report photo" 
                      className="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => openPhotoModal(report.photoUrl)}
                    />
                  </div>
                )}
                <div className="mt-3">
                  <button
                    onClick={() => markAsFixed(report.id)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-semibold text-sm transition-colors"
                  >
                    Mark as Fixed
                  </button>
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

      {/* Photo Modal */}
      {photoModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-bold">Problem Report Photo</h3>
              <button 
                onClick={() => setPhotoModalOpen(false)} 
                className="text-gray-600 hover:text-gray-800 text-2xl"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <img 
                src={selectedPhoto} 
                alt="Problem report photo" 
                className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Former Problems Modal */}
      {formerProblemsOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-bold">Fixed Problems</h3>
              <button 
                onClick={() => setFormerProblemsOpen(false)} 
                className="text-gray-600 hover:text-gray-800 text-2xl"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {fixedReports.length === 0 ? (
                <div className="text-center text-gray-500 py-8">No fixed problems yet</div>
              ) : (
                fixedReports.map(report => (
                  <div key={report.id} className="bg-gray-50 rounded-lg p-4 mb-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                          <span>House: {report.house === 'new_house' ? 'New House' : 'Original House'}</span>
                          <span>•</span>
                          <span>Floor: {report.floor === '-1' ? 'Floor -1' : report.floor === '0' ? 'Ground Floor' : `Floor ${report.floor}`}</span>
                        </div>
                        <p className="text-sm text-gray-800 mb-2">{report.description}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>By: {report.ownerName}</span>
                          <span>•</span>
                          <span>Room: {report.ownerRoomNumber}</span>
                          <span>•</span>
                          <span className="text-green-600 font-semibold">FIXED</span>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 ml-2">
                        {report.createdAt?.toDate().toLocaleDateString()}
                      </span>
                    </div>
                    {report.photoUrl && (
                      <div className="mt-3">
                        <img 
                          src={report.photoUrl} 
                          alt="Problem report photo" 
                          className="w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => openPhotoModal(report.photoUrl)}
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
} 
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, query, orderBy, addDoc, doc, getDoc, serverTimestamp, updateDoc, where, deleteDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import colors from '../../colors';
import { StyledDateInput } from '@/components/StyledDateInput';
import AdminBottomNavBar from '@/components/AdminBottomNavBar';
import ComingSoon from '@/components/ComingSoon';
import PhotoUpload from '@/components/PhotoUpload';
import { authedFetch } from '@/lib/authFetch';
import HouseLoader from '@/components/HouseLoader';

const SHOW_PROBLEM_REPORT = false;

// --- FEATURE GATE: To re-enable reports, replace the bottom wrapper with `export default AdminReportPageContent;` ---
function AdminReportPageContent() {
  const router = useRouter();
  const { t, i18n } = useTranslation('report');
  const [reports, setReports] = useState([]);
  const [problemReports, setProblemReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [problemsLoading, setProblemsLoading] = useState(true);
  const [adminData, setAdminData] = useState(null);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  
  // Report a Problem Form State
  const [desc, setDesc] = useState('');
  const [isInMyRoom, setIsInMyRoom] = useState(false); // false (not in my room) for admins by default
  const [selectedHouse, setSelectedHouse] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submittedReport, setSubmittedReport] = useState(null);
  const adminReportPhotoRef = useRef(null);
  const [filteredFixedProblems, setFilteredFixedProblems] = useState([]);
  const [fixedProblemsFilters, setFixedProblemsFilters] = useState({
    category: 'all',
    search: '',
    dateRange: 'all'
  });
  const [fixedProblemsCategoryDropdownOpen, setFixedProblemsCategoryDropdownOpen] = useState(false);
  const [fixedProblemsDateRangeDropdownOpen, setFixedProblemsDateRangeDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef(null);
  const fixedProblemsCategoryDropdownRef = useRef(null);
  const fixedProblemsDateRangeDropdownRef = useRef(null);

  // Check if admin profile is complete
  const checkAdminProfileComplete = (userData) => {
    if (!userData) return false;
    return !!(userData.firstName && userData.lastName && userData.jobTitle);
  };

  // Admin authentication check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/');
        return;
      }
      
      // Check admin profile completeness
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        router.push('/');
        return;
      }
      
      const userData = userSnap.data();
      
      // Check if user is admin
      if (userData.userType !== 'admin') {
        router.push('/');
        return;
      }
      
      // Check if admin profile is complete
      if (!checkAdminProfileComplete(userData)) {
        router.push('/admin/profile-setup');
        return;
      }
      
      setAdminData(userData);
      setIsCheckingProfile(false);
    });

    return () => unsubscribe();
  }, [router]);

  // --- Website feedback state ---
  const [feedbackSubject, setFeedbackSubject] = useState('');
  const [feedbackBody, setFeedbackBody] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackConfirmOpen, setFeedbackConfirmOpen] = useState(false);
  const [feedbackScreenshots, setFeedbackScreenshots] = useState([]);
  const feedbackFileRef = useRef(null);

  const handleScreenshotFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const staged = files
      .filter((f) => f.size <= 10 * 1024 * 1024 && f.type.startsWith('image/'))
      .map((file) => ({ file, previewUrl: URL.createObjectURL(file), name: file.name }));

    setFeedbackScreenshots((prev) => [...prev, ...staged]);
    if (feedbackFileRef.current) feedbackFileRef.current.value = '';
  };

  const removeScreenshot = (idx) => {
    setFeedbackScreenshots((prev) => {
      const removed = prev[idx];
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
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
      const user = auth.currentUser;
      if (!user) { setFeedbackError('You must be logged in'); setFeedbackSending(false); return; }

      const uploadedUrls = [];
      for (const s of feedbackScreenshots) {
        const { compressImage } = await import('@/components/PhotoUpload');
        const compressed = await compressImage(s.file);
        const path = `feedback/${user.uid}/${Date.now()}_${s.name}`;
        const sRef = storageRef(storage, path);
        const snap = await uploadBytesResumable(sRef, compressed, { contentType: compressed.type || 'image/jpeg' });
        const url = await getDownloadURL(snap.ref);
        uploadedUrls.push(url);
      }

      const res = await authedFetch('/api/send-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: feedbackSubject.trim(),
          body: feedbackBody.trim(),
          senderName: adminData?.fullName || adminData?.firstName + ' ' + adminData?.lastName || '',
          roomNumber: 'Staff',
          phone: adminData?.phone || '',
          screenshots: uploadedUrls,
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
      feedbackScreenshots.forEach((s) => { if (s.previewUrl) URL.revokeObjectURL(s.previewUrl); });
      setFeedbackScreenshots([]);
    } catch (e) {
      setFeedbackConfirmOpen(false);
      setFeedbackError(t('feedback_error'));
    } finally {
      setFeedbackSending(false);
    }
  };

  const categoryOptions = [
    { value: 'air_conditioning', label: 'Air Conditioning' },
    { value: 'shower_toilet', label: 'Shower and Toilet' },
    { value: 'walls_floor', label: 'Walls and Floor' },
    { value: 'furniture', label: 'Furniture' },
    { value: 'other', label: 'Other' }
  ];

  const houseOptions = [
    { value: 'all', label: 'All Houses' },
    { value: 'new_house', label: 'New House' },
    { value: 'original_house', label: 'Original House' }
  ];

  const floorOptions = [
    { value: 'all', label: 'All Floors' },
    { value: '-1', label: 'Floor -1' },
    { value: '0', label: 'Ground Floor' },
    { value: '1', label: 'Floor 1' },
    { value: '2', label: 'Floor 2' },
    { value: '3', label: 'Floor 3' }
  ];

  const dateRangeOptions = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' }
  ];

  const sortOptions = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'category', label: 'Category' },
    { value: 'house', label: 'House' },
    { value: 'floor', label: 'Floor' }
  ];

  // Refs for dropdowns
  const houseDropdownRef = useRef(null);
  const floorDropdownRef = useRef(null);
  const categoryDropdownFilterRef = useRef(null);
  const dateRangeDropdownRef = useRef(null);
  const sortDropdownRef = useRef(null);
  
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
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [showAllReports, setShowAllReports] = useState(false);
  const [showFixedProblems, setShowFixedProblems] = useState(false);
  const [fixedProblems, setFixedProblems] = useState([]);
  const [fixedProblemsLoading, setFixedProblemsLoading] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    status: 'all', // all, pending
    category: 'all', // all, air_conditioning, shower_toilet, walls_floor, furniture, other
    search: '',
    dateRange: 'all', // all, today, week, month
    sortBy: 'newest' // newest, oldest
  });
  const [showFilters, setShowFilters] = useState(false);
  const [filteredReports, setFilteredReports] = useState([]);
  
  // Filter dropdown states
  const [houseDropdownOpen, setHouseDropdownOpen] = useState(false);
  const [floorDropdownOpen, setFloorDropdownOpen] = useState(false);
  const [categoryDropdownOpenFilter, setCategoryDropdownOpenFilter] = useState(false);
  const [dateRangeDropdownOpen, setDateRangeDropdownOpen] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);

  // Fetch functions
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
        .filter(report => report.status !== 'fixed'); // Only get pending reports
      setProblemReports(problemReportsData);
      setProblemsLoading(false);
    } catch (error) {
      console.error('Error fetching problem reports:', error);
      setProblemsLoading(false);
    }
  };

  // Apply filters to reports
  const applyFilters = useCallback(() => {
    let filtered = [...problemReports];

    // Filter by status (only pending reports now)
    if (filters.status !== 'all') {
      filtered = filtered.filter(report => report.status === filters.status);
    }

    // Filter by category
    if (filters.category !== 'all') {
      filtered = filtered.filter(report => report.category === filters.category);
    }

    // Filter by search term
    if (filters.search.trim()) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(report => 
        report.description?.toLowerCase().includes(searchTerm) ||
        report.ownerName?.toLowerCase().includes(searchTerm) ||
        report.ownerRoomNumber?.toLowerCase().includes(searchTerm)
      );
    }

    // Filter by date range
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filtered = filtered.filter(report => {
        if (!report.createdAt) return false;
        const reportDate = report.createdAt.toDate();
        
        switch (filters.dateRange) {
          case 'today':
            return reportDate >= today;
          case 'week':
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            return reportDate >= weekAgo;
          case 'month':
            const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
            return reportDate >= monthAgo;
          default:
            return true;
        }
      });
    }

    // Sort reports
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'newest':
          return (b.createdAt?.toDate() || new Date(0)) - (a.createdAt?.toDate() || new Date(0));
        case 'oldest':
          return (a.createdAt?.toDate() || new Date(0)) - (b.createdAt?.toDate() || new Date(0));
        default:
          return (b.createdAt?.toDate() || new Date(0)) - (a.createdAt?.toDate() || new Date(0));
      }
    });

    setFilteredReports(filtered);
  }, [problemReports, filters]);

  // Apply filters to fixed problems
  const applyFixedProblemsFilters = useCallback(() => {
    let filtered = [...fixedProblems];

    // Filter by category
    if (fixedProblemsFilters.category !== 'all') {
      filtered = filtered.filter(problem => problem.category === fixedProblemsFilters.category);
    }

    // Filter by search term
    if (fixedProblemsFilters.search.trim()) {
      const searchTerm = fixedProblemsFilters.search.toLowerCase();
      filtered = filtered.filter(problem => 
        problem.description?.toLowerCase().includes(searchTerm) ||
        problem.ownerName?.toLowerCase().includes(searchTerm) ||
        problem.ownerRoomNumber?.toLowerCase().includes(searchTerm)
      );
    }

    // Filter by date range
    if (fixedProblemsFilters.dateRange !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filtered = filtered.filter(problem => {
        if (!problem.fixedAt) return false;
        const fixedDate = problem.fixedAt.toDate();
        
        switch (fixedProblemsFilters.dateRange) {
          case 'today':
            return fixedDate >= today;
          case 'week':
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            return fixedDate >= weekAgo;
          case 'month':
            const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
            return fixedDate >= monthAgo;
          default:
            return true;
        }
      });
    }

    // Sort by fixed date (newest first)
    filtered.sort((a, b) => {
      return (b.fixedAt?.toDate() || new Date(0)) - (a.fixedAt?.toDate() || new Date(0));
    });

    setFilteredFixedProblems(filtered);
  }, [fixedProblems, fixedProblemsFilters]);

  useEffect(() => {
    if (!isCheckingProfile && adminData) {
      fetchReports();
      fetchProblemReports();
    }
  }, [isCheckingProfile, adminData]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
        setCategoryDropdownOpen(false);
      }
      if (houseDropdownRef.current && !houseDropdownRef.current.contains(event.target)) {
        setHouseDropdownOpen(false);
      }
      if (floorDropdownRef.current && !floorDropdownRef.current.contains(event.target)) {
        setFloorDropdownOpen(false);
      }
      if (categoryDropdownFilterRef.current && !categoryDropdownFilterRef.current.contains(event.target)) {
        setCategoryDropdownOpenFilter(false);
      }
      if (dateRangeDropdownRef.current && !dateRangeDropdownRef.current.contains(event.target)) {
        setDateRangeDropdownOpen(false);
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target)) {
        setSortDropdownOpen(false);
      }
      if (fixedProblemsCategoryDropdownRef.current && !fixedProblemsCategoryDropdownRef.current.contains(event.target)) {
        setFixedProblemsCategoryDropdownOpen(false);
      }
      if (fixedProblemsDateRangeDropdownRef.current && !fixedProblemsDateRangeDropdownRef.current.contains(event.target)) {
        setFixedProblemsDateRangeDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter and sort reports whenever problemReports or filters change
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Filter fixed problems whenever fixedProblems or fixedProblemsFilters change
  useEffect(() => {
    applyFixedProblemsFilters();
  }, [applyFixedProblemsFilters]);

  // Show loading while checking admin profile
  if (isCheckingProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Verifying admin access...</p>
        </div>
      </div>
    );
  }


  const fetchFixedProblems = async () => {
    try {
      setFixedProblemsLoading(true);
      const fixedProblemsQuery = query(collection(db, 'fixedProblems'), orderBy('fixedAt', 'desc'));
      const fixedProblemsSnapshot = await getDocs(fixedProblemsQuery);
      const fixedProblemsData = fixedProblemsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }));
      setFixedProblems(fixedProblemsData);
      setFixedProblemsLoading(false);
    } catch (error) {
      console.error('Error fetching fixed problems:', error);
      setFixedProblemsLoading(false);
    }
  };


  const markAsFixed = async (reportId) => {
    try {
      // Get the report data first
      const reportRef = doc(db, 'problemReports', reportId);
      const reportSnap = await getDoc(reportRef);
      
      if (!reportSnap.exists()) {
        console.error('Report not found');
        return;
      }
      
      const reportData = reportSnap.data();
      
      // Add to fixedProblems collection with additional metadata
      await addDoc(collection(db, 'fixedProblems'), {
        ...reportData,
        fixedAt: serverTimestamp(),
        originalId: reportId,
        status: 'fixed'
      });
      
      // Delete from problemReports collection
      await deleteDoc(reportRef);
      
      // Refresh the reports
      fetchProblemReports();
    } catch (error) {
      console.error('Error marking report as fixed:', error);
    }
  };

  // Filter management functions
  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      status: 'all',
      category: 'all',
      search: '',
      dateRange: 'all',
      sortBy: 'newest'
    });
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.status !== 'all') count++;
    if (filters.category !== 'all') count++;
    if (filters.search.trim()) count++;
    if (filters.dateRange !== 'all') count++;
    return count;
  };

  const getActiveFixedProblemsFiltersCount = () => {
    let count = 0;
    if (fixedProblemsFilters.category !== 'all') count++;
    if (fixedProblemsFilters.dateRange !== 'all') count++;
    if (fixedProblemsFilters.search.trim()) count++;
    return count;
  };

  const clearFixedProblemsFilters = () => {
    setFixedProblemsFilters({
      category: 'all',
      search: '',
      dateRange: 'all'
    });
  };

  const openPhotoModal = (item) => {
    const photos = item.photos?.length > 0
      ? item.photos
      : (item.photoUrl ? [{ url: item.photoUrl }] : []);
    if (photos.length === 0) return;
    setSelectedPhoto({ photos, index: 0 });
    setPhotoModalOpen(true);
  };

  const handleReportSubmit = async () => {
    setSubmitError(''); setSubmitSuccess('');
    
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
    if (!selectedCategory) {
      setSubmitError('Please select a problem category');
      return;
    }
    
    try {
      setSubmitting(true);
      const user = auth.currentUser;
      if (!user) {
        setSubmitError('You must be logged in to submit a report');
        return;
      }

      let photoResults;
      try {
        photoResults = await adminReportPhotoRef.current?.upload() || [];
      } catch {
        setSubmitError('Photo upload failed');
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
        isInMyRoom: false,
        house: selectedHouse,
        floor: selectedFloor,
        photos: photoResults.map(p => ({ url: p.url, path: p.path })),
        photoUrl: photoResults[0]?.url || '',
        photoPath: photoResults[0]?.path || '',
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        softDeleted: false,
      };
      
      await addDoc(collection(db, 'problemReports'), payload);
      
      setSubmittedReport({
        description: desc,
        category: selectedCategory,
        isInMyRoom: false,
        house: selectedHouse,
        floor: selectedFloor,
        photos: photoResults,
        submittedAt: new Date()
      });
      
      setShowSuccessModal(true);
      adminReportPhotoRef.current?.clear();
      
      setDesc('');
      setIsInMyRoom(false);
      setSelectedCategory('');
      setSelectedHouse('');
      setSelectedFloor('');
      
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
            {feedbackScreenshots.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {feedbackScreenshots.map((s, idx) => (
                  <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-white/30">
                    <img src={s.previewUrl} alt="" className="w-full h-full object-cover" />
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

        {/* ========== PROBLEM REPORT FORM (hidden) ========== */}
        {SHOW_PROBLEM_REPORT && (<div className="rounded-3xl p-10 mb-8 shadow-lg flex flex-col items-center" style={{ background: 'rgba(0,0,0,0.38)' }}>
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
            <label className="block text-lg mb-2 text-white font-semibold">Problem Description</label>
            <textarea className="w-full border border-white/30 px-4 py-3 rounded-xl text-black bg-white text-lg placeholder-black/50 focus:outline-none focus:border-gold transition" rows={5} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Please describe the problem in detail..." style={{ background: colors.white, color: 'black' }} />
          </div>
          
          {/* Photo Upload Section */}
          <div className="w-full mb-6">
            <PhotoUpload
              ref={adminReportPhotoRef}
              uploadPath="reports"
              maxPhotos={5}
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
        </div>)}

        {/* Request Refund Section */}
        {SHOW_PROBLEM_REPORT && (<div className="w-full max-w-md rounded-2xl p-4 mb-6" style={{ background: colors.sectionBg }}>
          <button 
            onClick={() => setRefundOpen(true)} 
            className="w-full rounded-full px-6 py-4 font-bold text-white text-lg shadow" 
            style={{ background: colors.gold }}
          >
            Request Refund
          </button>
        </div>)}

        {/* Recent Reports Section */}
        {SHOW_PROBLEM_REPORT && (
        <div className="w-full max-w-md rounded-2xl p-4 mb-6" style={{ background: colors.sectionBg }}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white">Recent Reports</h3>
            <button
              onClick={() => setShowAllReports(true)}
              className="bg-white/15 hover:bg-white/25 text-white px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-105"
            >
              Show All Reports
            </button>
          </div>
          {problemsLoading ? (
            <div className="text-center text-white py-4">Loading reports...</div>
          ) : problemReports.length === 0 ? (
            <div className="text-center text-white py-4">No reports available</div>
          ) : (
            problemReports.slice(0, 3).map(report => (
              <div key={report.id} className="bg-white/10 rounded-xl p-4 mb-4 backdrop-blur-sm">
                {/* Category Badge */}
                <div className="mb-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold"
                    style={{ 
                      backgroundColor: colors.primaryGreen + '30',
                      color: colors.white
                    }}
                  >
                    {report.category?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Other'}
                  </span>
                </div>

                {/* Location */}
                <div className="mb-3">
                  <div className="flex items-center gap-2 text-sm text-white/90">
                    <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="font-medium">
                      {report.isInMyRoom 
                        ? `Room ${report.ownerRoomNumber || 'N/A'}` 
                        : `${report.house === 'new_house' ? 'New House' : 'Original House'} - Floor ${report.floor}`
                      }
                    </span>
                  </div>
                </div>

                {/* Reporter and Date */}
                <div className="mb-3">
                  <div className="flex items-center gap-2 text-sm text-white/80">
                    <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>Reported by <span className="font-medium text-white">{report.ownerName}</span></span>
                    <span className="text-white/60">•</span>
                    <span>{report.createdAt?.toDate().toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Description */}
                <div className="mb-3">
                  <p className="text-white/90 leading-relaxed text-sm">{report.description}</p>
                </div>

                {/* Photos */}
                {(report.photos?.length > 0 || report.photoUrl) && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {(report.photos?.length > 0 ? report.photos : [{ url: report.photoUrl }]).map((p, idx) => (
                      <img
                        key={idx}
                        src={p.url}
                        alt="Problem report photo"
                        className={`${report.photos?.length > 1 ? 'w-24 h-24' : 'w-full h-32'} object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity border border-white/20`}
                        onClick={() => openPhotoModal(report)}
                      />
                    ))}
                  </div>
                )}

                {/* Mark as Fixed Button */}
                <div>
                  <button
                    onClick={() => markAsFixed(report.id)}
                    className="w-full text-white py-2 px-4 rounded-lg font-semibold text-sm transition-all duration-200 hover:shadow-md hover:scale-105"
                    style={{ backgroundColor: colors.green }}
                  >
                    Mark as Fixed
                  </button>
                </div>
              </div>
            ))
          )}
        </div>)}
      </div>
      
      <AdminBottomNavBar active="report" />

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
                        <img key={idx} src={s.previewUrl} alt="" className="w-14 h-14 object-cover rounded-lg" />
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

      {/* Refund Request Modal */}
      {SHOW_PROBLEM_REPORT && refundOpen && (
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
              <StyledDateInput
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
      {photoModalOpen && selectedPhoto?.photos && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-bold">
                Problem Report Photo
                {selectedPhoto.photos.length > 1 && ` (${selectedPhoto.index + 1}/${selectedPhoto.photos.length})`}
              </h3>
              <button 
                onClick={() => setPhotoModalOpen(false)} 
                className="text-gray-600 hover:text-gray-800 text-2xl"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center relative">
              {selectedPhoto.photos.length > 1 && selectedPhoto.index > 0 && (
                <button
                  onClick={() => setSelectedPhoto(prev => ({ ...prev, index: prev.index - 1 }))}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 text-white flex items-center justify-center text-xl hover:bg-black/50 z-10"
                >
                  ‹
                </button>
              )}
              <img 
                src={selectedPhoto.photos[selectedPhoto.index]?.url} 
                alt="Problem report photo" 
                className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
              />
              {selectedPhoto.photos.length > 1 && selectedPhoto.index < selectedPhoto.photos.length - 1 && (
                <button
                  onClick={() => setSelectedPhoto(prev => ({ ...prev, index: prev.index + 1 }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 text-white flex items-center justify-center text-xl hover:bg-black/50 z-10"
                >
                  ›
                </button>
              )}
            </div>
            {selectedPhoto.photos.length > 1 && (
              <div className="flex justify-center gap-1.5 pb-3">
                {selectedPhoto.photos.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedPhoto(prev => ({ ...prev, index: idx }))}
                    className="w-2 h-2 rounded-full transition-colors"
                    style={{ backgroundColor: idx === selectedPhoto.index ? colors.primaryGreen : colors.gray400 }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Show All Reports Modal */}
      {SHOW_PROBLEM_REPORT && showAllReports && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b flex-shrink-0" style={{ backgroundColor: colors.gold + '20' }}>
              <h3 className="text-lg font-bold" style={{ color: colors.primaryGreen }}>All Reports</h3>
              <button 
                onClick={() => setShowAllReports(false)} 
                className="text-2xl transition-colors hover:opacity-70"
                style={{ color: colors.primaryGreen }}
              >
                ✕
              </button>
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Filter Section */}
              <div className="p-4 border-b space-y-4" style={{ backgroundColor: colors.surface }}>
                {/* Sort Toggle */}
                <div className="flex items-center gap-3">
                  <label className="text-sm font-semibold" style={{ color: colors.primaryGreen }}>Sort by:</label>
                  <div className="flex rounded-lg p-1" style={{ backgroundColor: colors.gold + '20' }}>
                    <button
                      type="button"
                      onClick={() => updateFilter('sortBy', 'newest')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                        filters.sortBy === 'newest' 
                          ? 'text-white shadow-md' 
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                      style={{
                        backgroundColor: filters.sortBy === 'newest' ? colors.primaryGreen : 'transparent'
                      }}
                    >
                      Newest
                    </button>
                    <button
                      type="button"
                      onClick={() => updateFilter('sortBy', 'oldest')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                        filters.sortBy === 'oldest' 
                          ? 'text-white shadow-md' 
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                      style={{
                        backgroundColor: filters.sortBy === 'oldest' ? colors.primaryGreen : 'transparent'
                      }}
                    >
                      Oldest
                    </button>
                  </div>
                </div>

                {/* Category Filter */}
                <div className="relative" ref={categoryDropdownFilterRef}>
                  <label className="block text-sm font-semibold mb-2" style={{ color: colors.primaryGreen }}>Category</label>
                  <button
                    type="button"
                    onClick={() => setCategoryDropdownOpenFilter(!categoryDropdownOpenFilter)}
                    className="w-full px-3 py-2 rounded-lg border text-left flex items-center justify-between focus:outline-none transition-all duration-200"
                    style={{ 
                      backgroundColor: 'transparent',
                      borderColor: colors.gold,
                      color: filters.category !== 'all' ? colors.text : colors.muted
                    }}
                  >
                    <span>
                      {categoryOptions.find(opt => opt.value === filters.category)?.label || 'All Categories'}
                    </span>
                    <svg className={`w-4 h-4 transition-transform ${categoryDropdownOpenFilter ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: colors.primaryGreen }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {categoryDropdownOpenFilter && (
                    <div className="absolute z-10 w-full mt-1 rounded-lg shadow-lg border" style={{ backgroundColor: 'white', borderColor: colors.gold }}>
                      {categoryOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            updateFilter('category', option.value);
                            setCategoryDropdownOpenFilter(false);
                          }}
                          className={`w-full px-3 py-2 text-left text-sm first:rounded-t-lg last:rounded-b-lg transition-colors ${
                            filters.category === option.value ? 'text-white' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                          style={{
                            backgroundColor: filters.category === option.value ? colors.primaryGreen : 'transparent'
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Date Range */}
                <div className="relative" ref={dateRangeDropdownRef}>
                  <label className="block text-sm font-semibold mb-2" style={{ color: colors.primaryGreen }}>Date Range</label>
                  <button
                    type="button"
                    onClick={() => setDateRangeDropdownOpen(!dateRangeDropdownOpen)}
                    className="w-full px-3 py-2 rounded-lg border text-left flex items-center justify-between focus:outline-none transition-all duration-200"
                    style={{ 
                      backgroundColor: 'transparent',
                      borderColor: colors.gold,
                      color: filters.dateRange !== 'all' ? colors.text : colors.muted
                    }}
                  >
                    <span>
                      {dateRangeOptions.find(opt => opt.value === filters.dateRange)?.label || 'All Time'}
                    </span>
                    <svg className={`w-4 h-4 transition-transform ${dateRangeDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: colors.primaryGreen }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {dateRangeDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 rounded-lg shadow-lg border" style={{ backgroundColor: 'white', borderColor: colors.gold }}>
                      {dateRangeOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            updateFilter('dateRange', option.value);
                            setDateRangeDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 text-left text-sm first:rounded-t-lg last:rounded-b-lg transition-colors ${
                            filters.dateRange === option.value ? 'text-white' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                          style={{
                            backgroundColor: filters.dateRange === option.value ? colors.primaryGreen : 'transparent'
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Search */}
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: colors.primaryGreen }}>Search</label>
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => updateFilter('search', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border focus:outline-none transition-all duration-200"
                    style={{ 
                      backgroundColor: 'transparent',
                      borderColor: colors.gold,
                      color: colors.text
                    }}
                    placeholder="Search by description, name, room..."
                  />
                </div>

                {/* Clear Filters */}
                {getActiveFiltersCount() > 0 && (
                  <button
                    onClick={clearFilters}
                    className="w-full px-4 py-3 rounded-xl font-medium transition-all duration-200 hover:scale-105 hover:shadow-lg flex items-center justify-center gap-2"
                    style={{ 
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      border: `2px solid ${colors.red}`,
                      color: colors.red
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Clear {getActiveFiltersCount()} Filter{getActiveFiltersCount() !== 1 ? 's' : ''}
                  </button>
                )}
              </div>


              {/* Reports List */}
              <div className="p-4">
              <div className="text-sm text-gray-600 mb-4">
                Showing {filteredReports.length} of {problemReports.length} reports
              </div>
              
              {problemsLoading ? (
                <div className="text-center text-gray-500 py-8">Loading reports...</div>
              ) : filteredReports.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  {problemReports.length === 0 ? 'No reports available' : 'No reports match your filters'}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredReports.map(report => (
                    <div key={report.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                      {/* Category Badge */}
                      <div className="mb-3">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold"
                          style={{ 
                            backgroundColor: colors.primaryGreen + '20',
                            color: colors.primaryGreen
                          }}
                        >
                          {report.category?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Other'}
                        </span>
                      </div>

                      {/* Location */}
                      <div className="mb-3">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="font-medium">
                            {report.isInMyRoom 
                              ? `Room ${report.ownerRoomNumber || 'N/A'}` 
                              : `${report.house === 'new_house' ? 'New House' : 'Original House'} - Floor ${report.floor}`
                            }
                          </span>
                        </div>
                      </div>

                      {/* Reporter and Date */}
                      <div className="mb-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span>Reported by <span className="font-medium text-gray-800">{report.ownerName}</span></span>
                          <span className="text-gray-400">•</span>
                          <span>{report.createdAt?.toDate().toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Description */}
                      <div className="mb-4">
                        <p className="text-gray-800 leading-relaxed">{report.description}</p>
                      </div>

                      {/* Photos */}
                      {(report.photos?.length > 0 || report.photoUrl) && (
                        <div className="mb-4 flex flex-wrap gap-2">
                          {(report.photos?.length > 0 ? report.photos : [{ url: report.photoUrl }]).map((p, idx) => (
                            <img
                              key={idx}
                              src={p.url}
                              alt="Problem report photo"
                              className={`${report.photos?.length > 1 ? 'w-28 h-28' : 'w-full h-40'} object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity border border-gray-200`}
                              onClick={() => openPhotoModal(report)}
                            />
                          ))}
                        </div>
                      )}

                      {/* Mark as Fixed Button */}
                      <div>
                        <button
                          onClick={() => markAsFixed(report.id)}
                          className="w-full text-white py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 hover:shadow-md hover:scale-105"
                          style={{ backgroundColor: colors.green }}
                        >
                          Mark as Fixed
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </div>

              {/* Bottom Actions */}
              <div className="flex gap-3 p-4 border-t" style={{ backgroundColor: colors.surface }}>
                <button
                  onClick={() => {
                    setShowFixedProblems(true);
                    fetchFixedProblems();
                  }}
                  className="flex-1 px-4 py-2 rounded-lg font-semibold transition-all duration-200 hover:shadow-md border-2"
                  style={{ 
                    backgroundColor: 'transparent',
                    borderColor: colors.gold,
                    color: colors.gold
                  }}
                >
                  Show Fixed Problems
                </button>
                <button
                  onClick={() => setShowAllReports(false)}
                  className="flex-1 px-4 py-2 rounded-lg font-semibold transition-all duration-200 hover:shadow-md border-2"
                  style={{ 
                    backgroundColor: 'transparent',
                    borderColor: colors.primaryGreen,
                    color: colors.primaryGreen
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Problems Modal */}
      {SHOW_PROBLEM_REPORT && showFixedProblems && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b flex-shrink-0" style={{ backgroundColor: colors.primaryGreen + '10' }}>
              <h3 className="text-lg font-bold" style={{ color: colors.primaryGreen }}>Fixed Problems</h3>
              <button 
                onClick={() => setShowFixedProblems(false)} 
                className="text-2xl transition-colors hover:opacity-70"
                style={{ color: colors.primaryGreen }}
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {/* Filters Section */}
              <div className="p-4 border-b" style={{ backgroundColor: colors.primaryGreen + '05' }}>
                {/* Category Filter */}
                <div className="mb-4 w-full relative" ref={fixedProblemsCategoryDropdownRef}>
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>Category</label>
                  <div className="relative">
                    <button
                      onClick={() => setFixedProblemsCategoryDropdownOpen(!fixedProblemsCategoryDropdownOpen)}
                      className="w-full px-4 py-2 text-left rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{ 
                        backgroundColor: 'white',
                        color: colors.text
                      }}
                    >
                      {fixedProblemsFilters.category === 'all' 
                        ? 'All Categories' 
                        : categoryOptions.find(opt => opt.value === fixedProblemsFilters.category)?.label || 'All Categories'
                      }
                    </button>
                    {fixedProblemsCategoryDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white rounded-xl shadow-lg border border-gray-200 max-h-60 overflow-auto">
                        {categoryOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => {
                              setFixedProblemsFilters(prev => ({ ...prev, category: option.value }));
                              setFixedProblemsCategoryDropdownOpen(false);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors"
                            style={{ color: colors.text }}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Date Range Filter */}
                <div className="mb-4 w-full relative" ref={fixedProblemsDateRangeDropdownRef}>
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>Date Range</label>
                  <div className="relative">
                    <button
                      onClick={() => setFixedProblemsDateRangeDropdownOpen(!fixedProblemsDateRangeDropdownOpen)}
                      className="w-full px-4 py-2 text-left rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{ 
                        backgroundColor: 'white',
                        color: colors.text
                      }}
                    >
                      {dateRangeOptions.find(opt => opt.value === fixedProblemsFilters.dateRange)?.label || 'All Time'}
                    </button>
                    {fixedProblemsDateRangeDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white rounded-xl shadow-lg border border-gray-200 max-h-60 overflow-auto">
                        {dateRangeOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => {
                              setFixedProblemsFilters(prev => ({ ...prev, dateRange: option.value }));
                              setFixedProblemsDateRangeDropdownOpen(false);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors"
                            style={{ color: colors.text }}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Search Filter */}
                <div className="mb-4 w-full">
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>Search</label>
                  <input
                    type="text"
                    value={fixedProblemsFilters.search}
                    onChange={(e) => setFixedProblemsFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ 
                      backgroundColor: 'white',
                      color: colors.text
                    }}
                    placeholder="Search by description, name, room..."
                  />
                </div>

                {/* Clear Filters */}
                {getActiveFixedProblemsFiltersCount() > 0 && (
                  <button
                    onClick={clearFixedProblemsFilters}
                    className="w-full px-4 py-3 rounded-xl font-medium transition-all duration-200 hover:scale-105 hover:shadow-lg flex items-center justify-center gap-2"
                    style={{ 
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      border: `2px solid ${colors.red}`,
                      color: colors.red
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Clear {getActiveFixedProblemsFiltersCount()} Filter{getActiveFixedProblemsFiltersCount() !== 1 ? 's' : ''}
                  </button>
                )}
              </div>

              {/* Fixed Problems List */}
              <div className="p-4">
                {fixedProblemsLoading ? (
                  <div className="text-center text-gray-500 py-8">Loading fixed problems...</div>
                ) : filteredFixedProblems.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    {fixedProblems.length === 0 ? 'No fixed problems yet' : 'No fixed problems match your filters'}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-sm text-gray-600 mb-4">
                      Showing {filteredFixedProblems.length} of {fixedProblems.length} fixed problems
                    </div>
                    {filteredFixedProblems.map(problem => (
                      <div key={problem.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow mb-4">
                        {/* Category Badge */}
                        <div className="mb-3">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold"
                            style={{ 
                              backgroundColor: colors.primaryGreen + '20',
                              color: colors.primaryGreen
                            }}
                          >
                            {problem.category?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Other'}
                          </span>
                          <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                            FIXED
                          </span>
                        </div>

                        {/* Location */}
                        <div className="mb-3">
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="font-medium">
                              {problem.isInMyRoom 
                                ? `Room ${problem.ownerRoomNumber || 'N/A'}` 
                                : `${problem.house === 'new_house' ? 'New House' : 'Original House'} - Floor ${problem.floor}`
                              }
                            </span>
                          </div>
                        </div>

                        {/* Reporter and Date */}
                        <div className="mb-3">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span>Reported by <span className="font-medium text-gray-800">{problem.ownerName}</span></span>
                            <span className="text-gray-400">•</span>
                            <span>Fixed: {problem.fixedAt?.toDate().toLocaleDateString()}</span>
                          </div>
                        </div>

                        {/* Description */}
                        <div className="mb-3">
                          <p className="text-gray-800 leading-relaxed">{problem.description}</p>
                        </div>

                        {/* Photos */}
                        {(problem.photos?.length > 0 || problem.photoUrl) && (
                          <div className="mb-3 flex flex-wrap gap-2">
                            {(problem.photos?.length > 0 ? problem.photos : [{ url: problem.photoUrl }]).map((p, idx) => (
                              <img
                                key={idx}
                                src={p.url}
                                alt="Fixed problem photo"
                                className={`${problem.photos?.length > 1 ? 'w-28 h-28' : 'w-full h-40'} object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity border border-gray-200`}
                                onClick={() => openPhotoModal(problem)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
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
                <p className="text-gray-600">The problem report has been submitted and will be reviewed.</p>
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
                      {`${submittedReport.house === 'new_house' ? 'New House' : 'Original House'} - Floor ${submittedReport.floor}`}
                    </p>
                  </div>
                  
                  <div>
                    <span className="text-sm font-medium text-gray-600">Submitted:</span>
                    <p className="text-gray-800">{submittedReport.submittedAt.toLocaleString()}</p>
                  </div>
                  
                  {submittedReport.photos?.length > 0 && (
                    <div>
                      <span className="text-sm font-medium text-gray-600">Photo:</span>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {submittedReport.photos.map((p, idx) => (
                          <img key={idx} src={p.url} alt="Submitted photo" className="w-full h-32 object-cover rounded-lg" />
                        ))}
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

      {/* Photo Modal (Fixed problems tab) */}
      {photoModalOpen && selectedPhoto?.photos && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-800">
                Problem Report Photo
                {selectedPhoto.photos.length > 1 && ` (${selectedPhoto.index + 1}/${selectedPhoto.photos.length})`}
              </h3>
              <button 
                onClick={() => setPhotoModalOpen(false)} 
                className="text-2xl text-gray-500 hover:text-gray-700 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center relative">
              {selectedPhoto.photos.length > 1 && selectedPhoto.index > 0 && (
                <button
                  onClick={() => setSelectedPhoto(prev => ({ ...prev, index: prev.index - 1 }))}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 text-white flex items-center justify-center text-xl hover:bg-black/50 z-10"
                >
                  ‹
                </button>
              )}
              <img 
                src={selectedPhoto.photos[selectedPhoto.index]?.url} 
                alt="Problem report photo" 
                className="w-full h-full object-contain rounded-lg"
              />
              {selectedPhoto.photos.length > 1 && selectedPhoto.index < selectedPhoto.photos.length - 1 && (
                <button
                  onClick={() => setSelectedPhoto(prev => ({ ...prev, index: prev.index + 1 }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 text-white flex items-center justify-center text-xl hover:bg-black/50 z-10"
                >
                  ›
                </button>
              )}
            </div>
            {selectedPhoto.photos.length > 1 && (
              <div className="flex justify-center gap-1.5 pb-3">
                {selectedPhoto.photos.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedPhoto(prev => ({ ...prev, index: idx }))}
                    className="w-2 h-2 rounded-full transition-colors"
                    style={{ backgroundColor: idx === selectedPhoto.index ? colors.primaryGreen : colors.gray400 }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </main>
  );
}

export default AdminReportPageContent;
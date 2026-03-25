"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { deleteDoc } from "firebase/firestore";
import AdminBottomNavBar from "@/components/AdminBottomNavBar";
import DatePickerModal from "@/components/DatePickerModal";
import PhotoUpload from "@/components/PhotoUpload";
import { deleteStorageFile } from "@/lib/storageCleanup";
import { StyledDateInput, StyledDateTimeInput } from "@/components/StyledDateInput";
import colors from "@/app/colors";
import '@/i18n';
import i18n from '@/i18n';
import { useTranslation } from 'react-i18next';
import { generateExpensesPDF, generateRefundsPDF } from '@/lib/pdfGenerator';
import HouseLoader from '@/components/HouseLoader';

// Function to get user name by UID
const getUserName = async (uid) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const userData = userSnap.data();
      return `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || i18n.t('unknown_user', { ns: 'expenses' });
    }
    return i18n.t('unknown_user', { ns: 'expenses' });
  } catch (error) {
    console.error('Error getting user name:', error);
    return i18n.t('unknown_user', { ns: 'expenses' });
  }
};

const CATEGORIES = ["Food","Equipment","Maintenance","Transport","Utilities","Other"];
const REIMBURSEMENT_METHODS = ["Credit Card","Bank Transfer","Cash","Other"];
const REIMBURSEMENT_SLUG = {
  "Credit Card": "credit_card",
  "Bank Transfer": "bank_transfer",
  "Cash": "cash",
  "Other": "other",
};

export default function AdminExpensesPage() {
  const { t } = useTranslation('expenses');
  const router = useRouter();
  const isRTL = i18n.language === 'he';

  const labelCategory = (c) => (c ? t(`categories.${c}`) : '');
  const labelMethod = (m) => {
    const slug = REIMBURSEMENT_SLUG[m];
    return slug ? t(`reimbursement_methods.${slug}`) : (m || t('card.na'));
  };
  const refundStatusLabel = (s) => t(`refunds.status_labels.${s}`, { defaultValue: s || '' });
  const [userDoc, setUserDoc] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const [form, setForm] = useState({
    title: "",
    amount: "",
    category: "Food",
    categoryOther: "",
    reimbursementMethod: "Credit Card",
    notes: "",
    linkedSoldierUid: "",
    expenseDate: new Date().toISOString().slice(0,10),
  });
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const expensePhotoRef = useRef(null);
  const refundReceiptPhotoRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfProgressText, setPdfProgressText] = useState('');

  // List state
  const [items, setItems] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [filters, setFilters] = useState({ from: "", to: "", category: "" });
  const [expandedId, setExpandedId] = useState(null);
  
  // Refund requests state
  const [refundRequests, setRefundRequests] = useState([]);
  const [refundLoading, setRefundLoading] = useState(true);
  const [refundExpandedId, setRefundExpandedId] = useState(null);
  
  // Refund modals state
  const [allRefundsOpen, setAllRefundsOpen] = useState(false);
  const [pastRefundsOpen, setPastRefundsOpen] = useState(false);
  const [refundSortOrder, setRefundSortOrder] = useState('latest'); // 'latest' or 'earliest'
  const [refundSearchTerm, setRefundSearchTerm] = useState('');
  
  // Approve modal state
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approvingRefundId, setApprovingRefundId] = useState(null);
  const [approvingRefundData, setApprovingRefundData] = useState(null);
  const [editRefundStatus, setEditRefundStatus] = useState('approved');
  const [refundActionLoading, setRefundActionLoading] = useState(false);

  // Export modal state
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportDateRange, setExportDateRange] = useState('pastMonth');
  const [exportCustomFrom, setExportCustomFrom] = useState('');
  const [exportCustomTo, setExportCustomTo] = useState('');

  // Report modal state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportFilterModalOpen, setReportFilterModalOpen] = useState(false);
  const [showTimeRangeOptions, setShowTimeRangeOptions] = useState(false);
  const [showCategoryOptions, setShowCategoryOptions] = useState(false);
  const [showPaymentMethodOptions, setShowPaymentMethodOptions] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [reportItems, setReportItems] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportFilters, setReportFilters] = useState({
    dateRange: "",
    category: "",
    paymentMethod: "",
    titleQuery: "",
    customFrom: "",
    customTo: ""
  });

  // Edit/Delete state
  const [editingExpense, setEditingExpense] = useState(null);
  const [editFromReport, setEditFromReport] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);

  // Photo viewer state
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  // Preview search state (separate from sort filters)
  const [previewSearch, setPreviewSearch] = useState('');

  // Save confirmation popup state
  const [savedExpenseSummary, setSavedExpenseSummary] = useState(null);
  const isAnyOverlayOpen =
    datePickerOpen ||
    reportOpen ||
    Boolean(editingExpense) ||
    deleteConfirmOpen ||
    photoViewerOpen ||
    exportModalOpen ||
    savedExpenseSummary ||
    allRefundsOpen ||
    pastRefundsOpen ||
    approveModalOpen ||
    reportFilterModalOpen;

  // Prevent background scrolling when modals are open
  useEffect(() => {
    if (isAnyOverlayOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup function to restore scrolling when component unmounts
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isAnyOverlayOpen]);

  // Force-close native selects before opening overlays (mobile/WebKit quirk)
  useEffect(() => {
    if (!isAnyOverlayOpen) return;
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
  }, [isAnyOverlayOpen]);


  // Access control: only admins
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          router.push("/");
          return;
        }
        const uRef = doc(db, "users", user.uid);
        const uSnap = await getDoc(uRef);

        if (!uSnap.exists()) {
          router.push("/home");
          return;
        }

        const userData = uSnap.data();

        if (userData?.userType !== "admin") {
          router.push("/home");
          return;
        }

        setUserDoc({ id: uSnap.id, ...userData });
        setIsCheckingAuth(false);
      } catch (error) {
        console.error('Error checking user access:', error);
        router.push("/");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const validate = () => {
    if (!form.title.trim()) return t('validation.title_required');
    if (!form.amount || isNaN(Number(form.amount))) return t('validation.amount_required');
    if (!form.category) return t('validation.category_required');
    if (form.category === "Other" && !form.categoryOther.trim()) return t('validation.category_other_required');
    if (!form.reimbursementMethod) return t('validation.reimbursement_required');
    if (!form.expenseDate) return t('validation.date_required');
    return "";
  };

  const showSuccess = (msg) => { setSuccess(msg); try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {} };
  const showError = (msg) => { setError(msg); try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {} };

  const resetForm = () => setForm({
    title: "", amount: "", category: "Food", categoryOther: "",
    reimbursementMethod: "Credit Card", notes: "", linkedSoldierUid: "",
    expenseDate: new Date().toISOString().slice(0, 10),
  });

  const handleCloseEditModal = () => {
    const wasFromReport = editFromReport;
    const viewState = editingExpense?.viewState;
    setEditingExpense(null);
    resetForm();
    if (wasFromReport) {
      setEditFromReport(false);
      setReportOpen(true);
      if (viewState) {
        setShowSearchResults(true);
      }
    }
  };

  const handleCloseReportModal = () => {
    setReportOpen(false);
    setReportFilterModalOpen(false);
    setShowTimeRangeOptions(false);
    setShowCategoryOptions(false);
    setShowPaymentMethodOptions(false);
    setShowSearchResults(false);
    setReportItems([]);
    setReportFilters({
      dateRange: '',
      category: '',
      paymentMethod: '',
      titleQuery: '',
      customFrom: '',
      customTo: ''
    });
  };

  const handleEditExpense = (expense) => {
    const wasInSearchResults = showSearchResults;
    
    setEditFromReport(reportOpen);
    setEditingExpense(expense);
    setForm({
      title: expense.title || "",
      amount: expense.amount?.toString() || "",
      category: expense.category || "Food",
      categoryOther: expense.categoryOther || "",
      reimbursementMethod: expense.reimbursementMethod || "Credit Card",
      notes: expense.notes || "",
      linkedSoldierUid: expense.linkedSoldierUid || "",
      expenseDate: expense.expenseDate?.toDate?.()?.toISOString().slice(0,10) || new Date().toISOString().slice(0,10),
    });
    setReportOpen(false);
    
    expense.viewState = wasInSearchResults;
  };

  const handleDeleteExpense = (expense) => {
    // Remember the current view state before deleting
    expense.viewState = showSearchResults;
    
    setExpenseToDelete(expense);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteExpense = async () => {
    if (!expenseToDelete) return;
    
    try {
      await deleteDoc(doc(db, "expenses", expenseToDelete.id));
      const photosToDelete = (expenseToDelete.photos || []).map(p => p.path).filter(Boolean);
      if (!photosToDelete.length && expenseToDelete.photoPath) photosToDelete.push(expenseToDelete.photoPath);
      for (const path of photosToDelete) {
        deleteStorageFile(path).catch(console.error);
      }
      setSuccess(t('success.expense_deleted'));
      setDeleteConfirmOpen(false);
      setExpenseToDelete(null);
      
      // Refresh the data
      await fetchList();
      if (reportOpen) {
        await fetchReportData();
      }
      
      // Restore the view state that was active before deleting
      if (expenseToDelete && expenseToDelete.viewState) {
        setShowSearchResults(true);
      } else {
        setShowSearchResults(false);
      }
      
    } catch (error) {
      console.error("Error deleting expense:", error);
      setError(t('errors.delete_failed'));
    }
  };

  const handleUpdateExpense = async () => {
    const validationError = validate();
    if (validationError) {
      showError(validationError);
      return;
    }

    if (!editingExpense) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const oldPhotoPaths = (editingExpense.photos || []).map(p => p.path).filter(Boolean);
      if (!oldPhotoPaths.length && editingExpense.photoPath) oldPhotoPaths.push(editingExpense.photoPath);

      let photoResults;
      try {
        photoResults = await expensePhotoRef.current?.upload() || [];
      } catch {
        showError(t('errors.photo_upload'));
        setSaving(false);
        return;
      }

      const newPhotoPaths = new Set(photoResults.map(p => p.path));

      const payload = {
        title: form.title.trim(),
        amount: Number(form.amount),
        currency: "ILS",
        category: form.category,
        categoryOther: form.category === "Other" ? form.categoryOther.trim() : "",
        reimbursementMethod: form.reimbursementMethod,
        notes: form.notes.trim(),
        linkedSoldierUid: form.linkedSoldierUid || null,
        expenseDate: new Date(form.expenseDate),
        photos: photoResults.map(p => ({ url: p.url, path: p.path })),
        photoUrl: photoResults[0]?.url || '',
        photoPath: photoResults[0]?.path || '',
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, "expenses", editingExpense.id), payload);

      for (const oldPath of oldPhotoPaths) {
        if (!newPhotoPaths.has(oldPath)) {
          deleteStorageFile(oldPath).catch(console.error);
        }
      }
      
      showSuccess(t('success.expense_updated'));
      setEditingExpense(null);
      resetForm();
      
      // Refresh the data and return to modal
      await fetchList();
      if (reportOpen) {
        await fetchReportData();
      }
      
      // Reopen the modal if it was closed
      if (!reportOpen) {
        setReportOpen(true);
        // Restore the view state that was active before editing
        if (editingExpense && editingExpense.viewState) {
          setShowSearchResults(true);
        } else {
          setShowSearchResults(false);
        }
      }
      
    } catch (error) {
      console.error("Error updating expense:", error);
      showError(t('errors.update_failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setError(""); 
    setSuccess("");
    const v = validate(); 
    if (v) { 
      showError(v); 
      return; 
    }
    
    try {
      setSaving(true);
      const user = auth.currentUser; 
      if (!user) { 
        showError(t('errors.sign_in_again')); 
        return; 
      }

      let photoResults;
      try {
        photoResults = await expensePhotoRef.current?.upload() || [];
      } catch {
        showError(t('errors.photo_upload'));
        setSaving(false);
        return;
      }
      
      const payload = {
        ownerUid: user.uid,
        title: form.title.trim(),
        amount: Number(form.amount),
        currency: "ILS",
        category: form.category,
        categoryOther: form.category === "Other" ? form.categoryOther.trim() : "",
        reimbursementMethod: form.reimbursementMethod,
        notes: form.notes.trim(),
        linkedSoldierUid: form.linkedSoldierUid || null,
        expenseDate: new Date(form.expenseDate),
        photos: photoResults.map(p => ({ url: p.url, path: p.path })),
        photoUrl: photoResults[0]?.url || null,
        photoPath: photoResults[0]?.path || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        softDeleted: false,
      };
      
      const docRef = await addDoc(collection(db, "expenses"), payload);
      
      setSavedExpenseSummary({
        id: docRef.id,
        title: payload.title,
        amount: payload.amount,
        category: payload.category,
        categoryOther: payload.categoryOther,
        reimbursementMethod: payload.reimbursementMethod,
        notes: payload.notes,
        expenseDate: payload.expenseDate,
        photos: payload.photos,
      });
      
      resetForm();
      expensePhotoRef.current?.clear();
      
      // Refresh the expenses list
      await fetchList();
      
    } catch (e) {
      console.error("Error saving expense:", e);
      if (e.code === 'permission-denied') {
        showError(t('errors.permission_denied'));
      } else if (e.code === 'unavailable') {
        showError(t('errors.service_unavailable'));
      } else {
        showError(e?.message || t('errors.save_failed'));
      }
    } finally { 
      setSaving(false); 
    }
  };

  const fetchList = useCallback(async () => {
    try {
      setLoadingList(true);
      let constraints = [];
      if (filters.category) constraints.push(where("category", "==", filters.category));
      if (filters.from) constraints.push(where("expenseDate", ">=", new Date(filters.from)));
      if (filters.to) constraints.push(where("expenseDate", "<=", new Date(filters.to)));
      const q = query(collection(db, "expenses"), ...constraints, orderBy("expenseDate", "desc"), limit(100));
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setItems(data);
    } finally { setLoadingList(false); }
  }, [filters.category, filters.from, filters.to]);

  const fetchRefundRequests = async () => {
    try {
      setRefundLoading(true);
      const q = query(collection(db, "refundRequests"), orderBy("createdAt", "desc"), limit(100));
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRefundRequests(data);
    } finally { setRefundLoading(false); }
  };

  const handleApproveRefund = async (requestId) => {
    const request = refundRequests.find(r => r.id === requestId);
    if (request) {
      setApprovingRefundId(requestId);
      setApprovingRefundData(request);
      setEditRefundStatus(request.status === 'denied' ? 'denied' : 'approved');
      setApproveModalOpen(true);
    }
  };

  const confirmApproveRefund = async (receiptPhotoUrl, receiptResults) => {
    if (refundActionLoading) return;
    setRefundActionLoading(true);
    try {
      await updateDoc(doc(db, "refundRequests", approvingRefundId), {
        status: 'approved',
        approvedAt: serverTimestamp(),
        approvedBy: auth.currentUser.uid,
        receiptPhotoUrl: receiptPhotoUrl,
        photos: receiptResults?.map(p => ({ url: p.url, path: p.path })) || [],
      });
      await fetchRefundRequests(); // Refresh the list
      setApproveModalOpen(false);
      setApprovingRefundId(null);
      setApprovingRefundData(null);
    } catch (error) {
      console.error('Error approving refund:', error);
    } finally {
      setRefundActionLoading(false);
    }
  };

  const handleStatusChange = async (newStatus, receiptPhotoUrl, receiptResults) => {
    if (refundActionLoading) return;
    setRefundActionLoading(true);
    try {
      const updateData = {
        status: newStatus,
        receiptPhotoUrl: receiptPhotoUrl || approvingRefundData.receiptPhotoUrl || '',
        photos: receiptResults?.map(p => ({ url: p.url, path: p.path })) || approvingRefundData.photos || [],
      };

      if (newStatus === 'approved') {
        updateData.approvedAt = serverTimestamp();
        updateData.approvedBy = auth.currentUser.uid;
        // Clear denied fields if they exist
        updateData.deniedAt = null;
        updateData.deniedBy = null;
      } else if (newStatus === 'denied') {
        updateData.deniedAt = serverTimestamp();
        updateData.deniedBy = auth.currentUser.uid;
        // Clear approved fields if they exist
        updateData.approvedAt = null;
        updateData.approvedBy = null;
      }

      await updateDoc(doc(db, "refundRequests", approvingRefundId), updateData);
      await fetchRefundRequests(); // Refresh the list
      setApproveModalOpen(false);
      setApprovingRefundId(null);
      setApprovingRefundData(null);
    } catch (error) {
      console.error('Error changing refund status:', error);
    } finally {
      setRefundActionLoading(false);
    }
  };

  const handleDenyRefund = async (requestId) => {
    try {
      await updateDoc(doc(db, "refundRequests", requestId), {
        status: 'denied',
        deniedAt: serverTimestamp(),
        deniedBy: auth.currentUser.uid
      });
      await fetchRefundRequests(); // Refresh the list
    } catch (error) {
      console.error('Error denying refund:', error);
    }
  };

  useEffect(() => { fetchList(); }, [fetchList]);
  useEffect(() => { fetchRefundRequests(); }, []);

  const amountFormatted = (amt) => new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS" }).format(amt || 0);

  const openPhotoViewer = (expense) => {
    const photos = expense.photos?.length > 0
      ? expense.photos
      : (expense.photoUrl ? [{ url: expense.photoUrl }] : []);
    if (photos.length === 0) return;
    setSelectedPhoto({ photos, title: expense.title, index: 0 });
    setPhotoViewerOpen(true);
  };

  const generateDateRange = (range) => {
    const now = new Date();
    const start = new Date();
    
    switch (range) {
      case "lastDay":
        start.setDate(now.getDate() - 1);
        break;
      case "lastWeek":
        start.setDate(now.getDate() - 7);
        break;
      case "lastMonth":
        start.setMonth(now.getMonth() - 1);
        break;
      case "last3Months":
        start.setMonth(now.getMonth() - 3);
        break;
      case "lastYear":
        start.setFullYear(now.getFullYear() - 1);
        break;
      case "all":
        return { from: null, to: null };
      default:
        return { from: null, to: null };
    }
    
    return { from: start, to: now };
  };

  const fetchReportData = async () => {
    if (reportFilters.dateRange === "custom" && (!reportFilters.customFrom || !reportFilters.customTo)) {
      setError(t('errors.custom_dates_required'));
      return;
    }

    setError("");
    setReportFilterModalOpen(false);
    setReportLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "expenses"));
      
      // Convert to array and add user names
      let expenses = await Promise.all(querySnapshot.docs.map(async doc => {
        const data = doc.data();
        const expense = {
        id: doc.id,
          ...data
        };
        
        // Get user name if ownerUid exists
        if (data.ownerUid) {
          expense.createdByName = await getUserName(data.ownerUid);
        } else {
          expense.createdByName = i18n.t('unknown_user', { ns: 'expenses' });
        }
        
        return expense;
      }));
      
      // Apply category filtering in JavaScript
      if (reportFilters.category) {
        expenses = expenses.filter(expense => expense.category === reportFilters.category);
      }
      
      if (reportFilters.paymentMethod) {
        expenses = expenses.filter(expense => expense.reimbursementMethod === reportFilters.paymentMethod);
      }

      if (reportFilters.titleQuery.trim()) {
        const titleQuery = reportFilters.titleQuery.trim().toLowerCase();
        expenses = expenses.filter((expense) => (expense.title || '').toLowerCase().includes(titleQuery));
      }
      
      // Apply date filtering in JavaScript
      if (reportFilters.dateRange) {
        const now = new Date();
        let startDate;
        
        switch (reportFilters.dateRange) {
          case "lastDay":
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case "lastWeek":
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case "lastMonth":
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case "last3Months":
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
          case "lastYear":
            startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
          case "custom":
            if (reportFilters.customFrom && reportFilters.customTo) {
              startDate = new Date(reportFilters.customFrom + "T00:00:00");
              const endDate = new Date(reportFilters.customTo + "T23:59:59");
              expenses = expenses.filter(expense => {
                const expenseDate = expense.expenseDate?.toDate?.() || new Date(expense.expenseDate);
                return expenseDate >= startDate && expenseDate <= endDate;
              });
            }
            break;
        }
        
        if (startDate && reportFilters.dateRange !== "custom") {
          expenses = expenses.filter(expense => {
            const expenseDate = expense.expenseDate?.toDate?.() || new Date(expense.expenseDate);
            return expenseDate >= startDate;
          });
        }
      }
      
      // Sort by date (newest first)
      expenses.sort((a, b) => {
        const dateA = a.expenseDate?.toDate?.() || new Date(a.expenseDate);
        const dateB = b.expenseDate?.toDate?.() || new Date(b.expenseDate);
        return dateB - dateA;
      });
      
      setReportItems(expenses);
      setShowSearchResults(true);
    } catch (error) {
      console.error("Error fetching report data:", error);
      setError(t('errors.search_failed'));
    } finally {
      setReportLoading(false);
    }
  };

  const getTotalAmount = (items) => {
    return items.reduce((sum, item) => sum + (item.amount || 0), 0);
  };

  const getCategoryBreakdown = (items) => {
    const breakdown = {};
    items.forEach(item => {
      const category = item.category || 'Other';
      breakdown[category] = (breakdown[category] || 0) + (item.amount || 0);
    });
    return breakdown;
  };

  const getPaymentMethodBreakdown = (items) => {
    const breakdown = {};
    items.forEach(item => {
      const method = item.reimbursementMethod || 'Other';
      breakdown[method] = (breakdown[method] || 0) + (item.amount || 0);
    });
    return breakdown;
  };

  const exportToPDF = async () => {
    if (reportItems.length === 0) return;
    if (isGeneratingPDF) return;

    setIsGeneratingPDF(true);
    setPdfProgressText(t('pdf_generating'));

    try {
      await generateExpensesPDF(reportItems, {
        dateRange: reportFilters.dateRange === 'custom' ? 'custom' : reportFilters.dateRange,
        customFrom: reportFilters.customFrom,
        customTo: reportFilters.customTo,
        onProgress: (current, total) => {
          setPdfProgressText(t('pdf_loading_image', { current, total }));
        },
      });
      setSuccess(t('pdf_success'));
    } catch (err) {
      setError(t('pdf_error'));
      console.error('PDF generation error:', err);
    } finally {
      setIsGeneratingPDF(false);
      setPdfProgressText('');
    }
  };

  const exportToExcel = () => {
    if (reportItems.length === 0) return;
    
    // Create CSV content (Excel can open CSV files)
    const headers = ['title', 'category', 'amount', 'date', 'notes', 'payment method', 'created by', 'photo'];
    const csvContent = [
      headers.join(','),
      ...reportItems.map(expense => [
        `"${(expense.title || '').replace(/"/g, '""')}"`,
        `"${(expense.category || '').replace(/"/g, '""')}"`,
        expense.amount || 0,
        `"${expense.expenseDate?.toDate?.()?.toLocaleDateString?.() || ''}"`,
        `"${(expense.notes || '').replace(/"/g, '""')}"`,
        `"${(expense.reimbursementMethod || '').replace(/"/g, '""')}"`,
        `"${(expense.createdByName || '').replace(/"/g, '""')}"`,
        `"${expense.photos?.map(p => p.url).join('; ') || expense.photoUrl || ''}"`
      ].join(','))
    ].join('\n');

    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `expenses_report_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const CATEGORY_ICONS = {
    Food: '🍽️', Equipment: '🔧', Maintenance: '🏠',
    Transport: '🚗', Utilities: '💡', Other: '📦',
  };

  const renderExpenseCard = (expense) => (
    <div key={expense.id} className="bg-white rounded-xl shadow-sm border overflow-hidden transition-colors duration-200" style={{ borderColor: colors.gray400 }}>
      <div className="flex" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        {/* Photo / Category icon side */}
        <div
          className="flex-shrink-0 flex items-center justify-center cursor-pointer relative"
          style={{ width: 90, minHeight: 90, background: (expense.photos?.length > 0 || expense.photoUrl) ? 'transparent' : colors.background }}
          onClick={() => openPhotoViewer(expense)}
        >
          {(expense.photos?.length > 0 || expense.photoUrl) ? (
            <>
              <img src={expense.photos?.[0]?.url || expense.photoUrl} alt={t('card.receipt_alt')} className="w-full h-full object-cover" style={{ minHeight: 90 }} />
              {expense.photos?.length > 1 && (
                <span className="absolute bottom-1 right-1 text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                  +{expense.photos.length - 1}
                </span>
              )}
            </>
          ) : (
            <span className="text-3xl">{CATEGORY_ICONS[expense.category] || '📦'}</span>
          )}
        </div>

        {/* Info side */}
        <div className="flex-1 p-3 flex flex-col gap-1 min-w-0" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          <div className="flex items-start justify-between gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <h5 className="text-base font-bold truncate" style={{ color: colors.text }}>{expense.title}</h5>
            <span className="text-lg font-extrabold flex-shrink-0" style={{ color: colors.primaryGreen }}>{amountFormatted(expense.amount)}</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: colors.primaryGreen }}>{labelCategory(expense.category)}</span>
            <span className="text-xs font-medium" style={{ color: colors.muted }}>💳 {labelMethod(expense.reimbursementMethod)}</span>
          </div>

          <p className="text-xs font-medium" style={{ color: colors.muted }}>
            📅 {expense.expenseDate?.toDate?.()?.toLocaleDateString?.() || t('refunds.no_date')}
          </p>

          {/* Actions row */}
          <div className="flex items-center gap-2 mt-1" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <button
              onClick={() => handleEditExpense(expense)}
              className="px-3 py-1.5 border-2 font-bold text-xs rounded-lg transition-colors duration-200 active:scale-95 touch-manipulation"
              style={{ borderColor: colors.primaryGreen, color: colors.primaryGreen }}
            >
              {t('card.edit')}
            </button>
            <button
              onClick={() => handleDeleteExpense(expense)}
              className="px-3 py-1.5 border-2 font-bold text-xs rounded-lg transition-colors duration-200 active:scale-95 touch-manipulation"
              style={{ borderColor: colors.red, color: colors.red }}
            >
              {t('card.delete')}
            </button>
          </div>
        </div>
      </div>

      {expense.notes && (
        <div className="px-3 pb-3">
          <p className="text-xs p-2 rounded" style={{ color: colors.muted, background: colors.surface, textAlign: isRTL ? 'right' : 'left' }}>{expense.notes}</p>
        </div>
      )}
    </div>
  );

  if (isCheckingAuth) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-200/60 to-green-100/60 font-body flex items-center justify-center">
        <HouseLoader />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-200/60 to-green-100/60 font-body flex flex-col items-center pt-6 pb-32 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 rounded-2xl p-6 shadow-xl" style={{ background: "rgba(0,0,0,0.22)" }}>
          <h2 className="text-white font-extrabold text-2xl mb-4">{t('form.add_expense')}</h2>
          {error && <div className="mb-3 text-red-600 text-sm bg-white rounded px-3 py-2">{error}</div>}
          {success && <div className="mb-3 text-green-700 text-sm bg-white rounded px-3 py-2">{success}</div>}
          <div className="grid grid-cols-1 gap-4">
            <input 
              className="w-full px-4 py-3 rounded-xl border text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200" 
              placeholder={t('form.title_placeholder')} 
              value={form.title} 
              onChange={(e)=>setForm(f=>({...f,title:e.target.value}))}
              autoComplete="off"
              spellCheck="false"
            />
            <input 
              className="w-full px-4 py-3 rounded-xl border text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200" 
              placeholder={t('form.amount_placeholder')} 
              type="text"
              inputMode="decimal" 
              value={form.amount} 
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                  setForm(f => ({ ...f, amount: val }));
                }
              }}
              autoComplete="off"
            />
            {!isAnyOverlayOpen && (
              <div className="grid grid-cols-2 gap-3">
                <select 
                  className="w-full px-4 py-3 rounded-xl border text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200" 
                  value={form.category} 
                  onChange={(e)=>setForm(f=>({...f,category:e.target.value}))}
                >
                  {CATEGORIES.map(c=> <option key={c} value={c}>{labelCategory(c)}</option>)}
                </select>
                {form.category === "Other" && (
                  <input 
                    className="w-full px-4 py-3 rounded-xl border text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200" 
                    placeholder={t('form.other_category_placeholder')} 
                    value={form.categoryOther} 
                    onChange={(e)=>setForm(f=>({...f,categoryOther:e.target.value}))}
                    autoComplete="off"
                  />
                )}
              </div>
            )}
            {!isAnyOverlayOpen && (
              <select 
                className="w-full px-4 py-3 rounded-xl border text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200" 
                value={form.reimbursementMethod} 
                onChange={(e)=>setForm(f=>({...f,reimbursementMethod:e.target.value}))}
              >
                {REIMBURSEMENT_METHODS.map(m=> <option key={m} value={m}>{labelMethod(m)}</option>)}
              </select>
            )}
            <div>
              <div className="flex gap-2 items-center">
                <button 
                  onClick={()=>setForm(f=>({...f,expenseDate:new Date().toISOString().slice(0,10)}))} 
                  className="px-4 py-2 rounded-full text-sm font-semibold text-white transition-all duration-200 active:scale-95 touch-manipulation" 
                  style={{ background: colors.gold }}
                >
                  {t('form.today')}
                </button>
                <button 
                  onClick={()=>setDatePickerOpen(true)} 
                  className="px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-200 active:scale-95 touch-manipulation" 
                  style={{ borderColor: colors.primaryGreen, color: colors.primaryGreen }}
                >
                  {t('form.other_date')}
                </button>
              </div>
              {form.expenseDate && (
                <div className="mt-2 text-white text-sm">{t('form.selected')}: {new Date(form.expenseDate).toLocaleDateString()}</div>
              )}
            </div>
            <textarea 
              className="w-full px-4 py-3 rounded-xl border text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 resize-none" 
              placeholder={t('form.notes_placeholder')}
              value={form.notes} 
              onChange={(e)=>setForm(f=>({...f,notes:e.target.value.replace(/[a-zA-Z]/g,'')}))}
              rows={3}
              autoComplete="off"
              dir="rtl"
            />
            
            {/* Photo Upload Section */}
            <div className="bg-white/10 rounded-xl p-4">
              <h3 className="text-white font-semibold mb-3 text-center">{t('form.receipt_photo')}</h3>
              <PhotoUpload
                ref={expensePhotoRef}
                key="new-expense"
                uploadPath="expenses"
                maxPhotos={5}
              />
            </div>
            
            <button 
          onClick={handleSave} 
          disabled={saving} 
          className="w-full px-4 py-3 rounded-xl text-white font-semibold disabled:opacity-70 text-lg transition-all duration-200 active:scale-95 touch-manipulation" 
          style={{ background: colors.gold }}
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <HouseLoader size={20} />
              {t('form.saving')}
            </span>
          ) : (
            t('form.save_expense')
          )}
        </button>
        
        {/* View Expenses Button */}
        <button 
          onClick={()=>{ setReportOpen(true); setShowSearchResults(false); }} 
          className="w-full mt-3 px-4 py-3 rounded-xl text-white font-semibold text-lg transition-all duration-200 active:scale-95 touch-manipulation" 
          style={{ background: colors.primaryGreen }}
        >
          {t('form.view_expenses')}
        </button>
          </div>
        </div>



        {/* Refund Requests Section */}
        <div className="mb-3 rounded-2xl p-5 shadow-xl" style={{ background: "rgba(0,0,0,0.22)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-white font-extrabold text-xl">{t('refunds.title')}</h3>
              {refundRequests.filter(r => r.status === 'waiting').length > 3 && (
                <button 
                  onClick={() => setAllRefundsOpen(true)}
                  className="px-3 py-1 rounded-full border text-sm text-white border-white/30 hover:bg-white/10"
                >
                  {t('refunds.see_all', { count: refundRequests.filter(r => r.status === 'waiting').length })}
                </button>
              )}
            </div>
            <button onClick={fetchRefundRequests} className="px-3 py-1 rounded-full border text-sm text-white border-white/30 hover:bg-white/10">{t('refunds.refresh')}</button>
          </div>
          
          {refundLoading ? (
            <div className="text-center py-4 text-white/70 text-lg">{t('refunds.loading')}</div>
          ) : refundRequests.filter(r => r.status === 'waiting').length === 0 ? (
            <div className="text-center py-4 text-white/70 text-lg">{t('refunds.none_pending')}</div>
          ) : (
            <div className="space-y-3">
              {/* Show only waiting requests (max 3) */}
              {refundRequests
                .filter(request => request.status === 'waiting')
                .slice(0, 3)
                .map(request => (
                  <div key={request.id} className="bg-blue-50 rounded-xl shadow-md p-6">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h5 className="font-bold text-xl mb-2" style={{ color: colors.primaryGreen }}>{request.title}</h5>
                          <p className="text-gray-700 text-lg font-semibold mb-1">{t('refunds.amount', { amount: request.amount })}</p>
                          <p className="text-gray-600 text-base font-medium mb-1">{t('refunds.method', { method: request.repaymentMethod })}</p>
                          <p className="text-gray-600 text-base font-medium mb-1">{t('refunds.from_room', { name: request.ownerName, roomLabel: t('refunds.room_label', { number: request.ownerRoomNumber }) })}</p>
                          <p className="text-gray-500 text-base">{t('refunds.date', { date: request.expenseDate?.toDate?.()?.toLocaleDateString?.() || t('refunds.no_date') })}</p>
                        </div>
                        <span className="px-3 py-1 rounded-full text-sm font-bold flex-shrink-0" style={{ background: colors.gold, color: 'white' }}>
                          {t('refunds.status_waiting')}
                        </span>
                      </div>
                      
                      <div className="flex gap-3 mt-1">
                        <button
                          onClick={() => handleApproveRefund(request.id)}
                          className="flex-1 px-4 py-3 rounded-xl font-bold text-base transition-all active:scale-95"
                          style={{ 
                            background: colors.primaryGreen,
                            color: 'white'
                          }}
                        >
                          {t('refunds.approve')}
                        </button>
                        <button
                          onClick={() => handleDenyRefund(request.id)}
                          className="flex-1 px-4 py-3 rounded-xl font-bold text-base transition-all active:scale-95"
                          style={{ 
                            background: colors.red,
                            color: 'white'
                          }}
                        >
                          {t('refunds.deny')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
          
          {/* Show Past button - Always visible */}
          <div className="pt-4">
            <button 
              onClick={() => setPastRefundsOpen(true)}
              className="w-full px-6 py-3 rounded-full text-white font-bold text-lg"
              style={{ background: colors.gold }}
            >
              {t('refunds.show_past')}
            </button>
          </div>
        </div>
      </div>

      {/* Comprehensive Report Modal */}
      {reportOpen && (
        <div className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
          <div className="rounded-2xl w-full h-full sm:h-auto sm:max-h-[90vh] mx-0 sm:mx-4 p-3 sm:p-5 flex flex-col overflow-hidden" style={{ background: colors.surface }}>
            <div className="overflow-y-auto flex-1">
              <div className="flex items-center justify-between mb-4 border-b pb-3" style={{ borderColor: colors.gray400 }}>
                <h3 className="text-xl sm:text-2xl font-bold" style={{ color: colors.text }}>{t('report.view_title')}</h3>
                <button onClick={handleCloseReportModal} className="text-xl sm:text-2xl font-bold transition-colors duration-200" style={{ color: colors.muted }} onMouseEnter={(e) => e.target.style.color = colors.text} onMouseLeave={(e) => e.target.style.color = colors.muted }>✕</button>
              </div>
            
            {/* Recent Expenses Preview */}
            {!showSearchResults && (() => {
              const sortedByCreation = [...items].sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
                const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
                return dateB - dateA;
              });
              const filteredPreview = previewSearch.trim()
                ? sortedByCreation.filter((e) => (e.title || '').toLowerCase().includes(previewSearch.trim().toLowerCase()))
                : sortedByCreation;
              return (
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg flex-1 overflow-hidden flex flex-col" style={{ background: colors.background }}>
                <div className="flex justify-center mb-4 flex-shrink-0">
                  <button 
                    onClick={() => setReportFilterModalOpen(true)}
                    className="w-full px-8 py-4 border-2 font-bold text-lg sm:text-xl rounded-xl transition-colors duration-200"
                    style={{ 
                      borderColor: colors.gold, 
                      color: 'black',
                      background: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = colors.gold;
                      e.target.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'transparent';
                      e.target.style.color = 'black';
                    }}
                  >
                    {t('report.sort_reports')}
                  </button>
                </div>

                <h4 className="text-base sm:text-lg font-semibold mb-3 flex-shrink-0" style={{ color: colors.text }}>{t('report.recent')}</h4>
                
                <div className="mb-3 flex-shrink-0">
                  <input
                    type="text"
                    value={previewSearch}
                    onChange={(e) => setPreviewSearch(e.target.value)}
                    placeholder={t('report.search_placeholder')}
                    className="w-full px-4 py-3 rounded-xl border text-base focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                  />
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto min-h-0">
                  {loadingList ? (
                    <div className="text-center py-4" style={{ color: colors.muted }}>{t('report.loading_list')}</div>
                  ) : filteredPreview.length === 0 ? (
                    <div className="text-center py-4" style={{ color: colors.muted }}>{t('report.none_found')}</div>
                  ) : (
                    <>
                      {filteredPreview.slice(0, expandedId === 'recent' ? filteredPreview.length : 3).map(expense => renderExpenseCard(expense))}
                      
                      {/* Show More/Less Button */}
                      {filteredPreview.length > 3 && (
                        <div className="text-center pt-2 flex-shrink-0">
                          <button 
                            onClick={() => setExpandedId(expandedId === 'recent' ? null : 'recent')}
                            className="px-4 py-2 border-2 font-bold text-sm rounded-lg transition-colors duration-200"
                            style={{ 
                              borderColor: colors.primaryGreen, 
                              color: colors.primaryGreen 
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.background = colors.primaryGreen;
                              e.target.style.color = 'white';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.background = 'transparent';
                              e.target.style.color = colors.primaryGreen;
                            }}
                          >
                            {expandedId === 'recent' ? t('report.show_less') : t('report.show_more', { count: filteredPreview.length - 3 })}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              );
            })()}
            
            {/* Search Results Dashboard */}
            {showSearchResults && reportItems.length > 0 && (
              <div className="flex-1 overflow-y-auto min-h-0">
                {/* Back to search button */}
                <button
                  onClick={() => {
                    setShowSearchResults(false);
                    setReportFilters({
                      dateRange: '',
                      category: '',
                      paymentMethod: '',
                      titleQuery: '',
                      customFrom: '',
                      customTo: ''
                    });
                  }}
                  className="mb-3 w-10 h-10 flex items-center justify-center rounded-full border-2 transition-colors duration-200 active:scale-95 touch-manipulation"
                  style={{ borderColor: colors.primaryGreen, color: colors.primaryGreen }}
                  title={t('report.back_title')}
                >
                  <span className="text-xl font-bold" style={{ transform: isRTL ? 'scaleX(-1)' : 'none', display: 'inline-block' }}>←</span>
                </button>

                {/* Summary Stats - Fixed */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 flex-shrink-0">
                  <div className="p-4 rounded-lg text-center" style={{ background: colors.background }}>
                    <div className="text-2xl font-bold" style={{ color: colors.primaryGreen }}>{reportItems.length}</div>
                    <div className="text-sm" style={{ color: colors.muted }}>{t('report.total_count')}</div>
                  </div>
                  <div className="p-4 rounded-lg text-center" style={{ background: colors.background }}>
                    <div className="text-2xl font-bold" style={{ color: colors.gold }}>{amountFormatted(getTotalAmount(reportItems))}</div>
                    <div className="text-sm" style={{ color: colors.muted }}>{t('report.total_amount')}</div>
                  </div>
                  <div className="p-4 rounded-lg text-center" style={{ background: colors.background }}>
                    <div className="text-2xl font-bold" style={{ color: colors.primaryGreen }}>{Object.keys(getPaymentMethodBreakdown(reportItems)).length}</div>
                    <div className="text-sm" style={{ color: colors.muted }}>{t('report.payment_methods_count')}</div>
                  </div>
                </div>
                
                {/* Export Buttons - Fixed */}
                <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 mb-6 flex-shrink-0">
                  <button 
                    onClick={exportToPDF}
                    className="px-4 sm:px-6 py-3 border-2 font-bold text-base sm:text-lg rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ 
                      borderColor: isGeneratingPDF ? colors.gold : colors.primaryGreen, 
                      color: isGeneratingPDF ? colors.gold : colors.primaryGreen 
                    }}
                    disabled={isGeneratingPDF}
                    onMouseEnter={(e) => {
                      e.target.style.background = colors.primaryGreen;
                      e.target.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'transparent';
                      e.target.style.color = colors.primaryGreen;
                    }}
                  >
                    {isGeneratingPDF ? (
                      <span className="flex items-center justify-center gap-2">
                        <HouseLoader size={20} />
                        {t('report.generating_pdf')}
                      </span>
                    ) : (
                      `📄 ${t('report.export_pdf')}`
                    )}
                  </button>
                  <button 
                    onClick={exportToExcel}
                    className="px-4 sm:px-6 py-3 border-2 font-bold text-base sm:text-lg rounded-lg transition-colors duration-200"
                    style={{ borderColor: colors.gold, color: colors.gold }}
                    onMouseEnter={(e) => {
                      e.target.style.background = colors.gold;
                      e.target.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'transparent';
                      e.target.style.color = colors.gold;
                    }}
                  >
                    📊 {t('report.export_excel')}
                  </button>
                </div>
                
                {/* Category Breakdown */}
                <div className="mb-6">
                  <h4 className="text-lg font-semibold mb-3" style={{ color: colors.text }}>{t('report.category_breakdown')}</h4>
                  <div className="space-y-2">
                    {Object.entries(getCategoryBreakdown(reportItems))
                      .sort(([,a], [,b]) => b - a)
                      .map(([category, amount]) => (
                        <div key={category} className="flex justify-between items-center p-3 rounded-lg" style={{ background: colors.background }}>
                          <span className="font-medium" style={{ color: colors.text }}>{labelCategory(category)}</span>
                          <span className="font-bold" style={{ color: colors.text }}>{amountFormatted(amount)}</span>
                        </div>
                      ))}
                  </div>
                </div>
                
                {/* Payment Method Breakdown */}
                <div className="mb-6">
                  <h4 className="text-lg font-semibold mb-3" style={{ color: colors.text }}>{t('report.payment_breakdown')}</h4>
                  <div className="space-y-2">
                    {Object.entries(getPaymentMethodBreakdown(reportItems))
                      .sort(([,a], [,b]) => b - a)
                      .map(([method, amount]) => (
                        <div key={method} className="flex justify-between items-center p-3 rounded-lg" style={{ background: colors.background }}>
                          <span className="font-medium" style={{ color: colors.text }}>{labelMethod(method)}</span>
                          <span className="font-bold" style={{ color: colors.text }}>{amountFormatted(amount)}</span>
                        </div>
                      ))}
                  </div>
                </div>
                
                {/* Detailed List */}
                <div>
                  <h4 className="text-lg font-semibold mb-3" style={{ color: colors.text }}>{t('report.details')}</h4>
                  <div className="space-y-3">
                    {reportItems.map(expense => renderExpenseCard(expense))}
                  </div>
                </div>
              </div>
            )}
            
            {/* No Results Message */}
            {showSearchResults && reportItems.length === 0 && !reportLoading && (
              <div className="text-center py-8" style={{ color: colors.muted }}>
                {!reportFilters.dateRange && !reportFilters.category 
                  ? t('report.no_results_empty')
                  : t('report.no_results_filters')
                }
              </div>
            )}
            
            
            </div>
          </div>
        </div>
      )}

      {/* Search Filters Popup */}
      {reportOpen && reportFilterModalOpen && (
        <div className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-lg rounded-2xl p-4 sm:p-5 max-h-[90vh] overflow-y-auto" style={{ background: colors.surface }}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg sm:text-xl font-bold" style={{ color: colors.text }}>{t('report.filters_title')}</h4>
              <button
                onClick={() => {
                  setReportFilterModalOpen(false);
                  setShowTimeRangeOptions(false);
                  setShowCategoryOptions(false);
                  setShowPaymentMethodOptions(false);
                }}
                className="text-xl font-bold"
                style={{ color: colors.muted }}
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: colors.text }}>
                  {t('report.time_range')}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowTimeRangeOptions((prev) => !prev);
                    setShowCategoryOptions(false);
                    setShowPaymentMethodOptions(false);
                  }}
                  className="w-full px-3 py-3 rounded-xl border text-base font-semibold flex items-center justify-between"
                  style={{
                    borderColor: showTimeRangeOptions ? colors.primaryGreen : colors.gray400,
                    color: colors.text,
                    background: reportFilters.dateRange ? '#e5e7eb' : colors.white
                  }}
                >
                  <span>
                    {reportFilters.dateRange === 'lastDay' && t('report.last_day')}
                    {reportFilters.dateRange === 'lastWeek' && t('report.last_week')}
                    {reportFilters.dateRange === 'lastMonth' && t('report.last_month')}
                    {reportFilters.dateRange === 'last3Months' && t('report.last_3_months')}
                    {reportFilters.dateRange === 'lastYear' && t('report.last_year')}
                    {reportFilters.dateRange === 'custom' && t('report.custom_range')}
                    {!reportFilters.dateRange && t('report.select_time_range')}
                  </span>
                  <span className="text-lg">{showTimeRangeOptions ? '▲' : '▼'}</span>
                </button>

                {showTimeRangeOptions && (
                  <div className="mt-2 grid grid-cols-2 gap-2 p-2 rounded-xl border" style={{ borderColor: colors.gray400, background: colors.background }}>
                    {[
                      { value: 'lastDay', label: t('report.last_day') },
                      { value: 'lastWeek', label: t('report.last_week') },
                      { value: 'lastMonth', label: t('report.last_month') },
                      { value: 'last3Months', label: t('report.last_3_months') },
                      { value: 'lastYear', label: t('report.last_year') },
                      { value: 'custom', label: t('report.custom_range') },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          const isDeselect = reportFilters.dateRange === option.value;
                          setReportFilters((prev) => ({
                            ...prev,
                            dateRange: isDeselect ? '' : option.value,
                            ...((isDeselect || option.value !== 'custom') ? { customFrom: '', customTo: '' } : {})
                          }));
                          if (isDeselect || option.value !== 'custom') {
                            setShowTimeRangeOptions(false);
                          }
                        }}
                        className="px-3 py-2 rounded-lg border-2 text-sm font-semibold transition-colors duration-200"
                        style={{
                          borderColor: colors.primaryGreen,
                          background: reportFilters.dateRange === option.value ? colors.primaryGreen : 'transparent',
                          color: reportFilters.dateRange === option.value ? 'white' : colors.primaryGreen
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {reportFilters.dateRange === 'custom' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>{t('report.from')}</label>
                    <StyledDateInput
                      value={reportFilters.customFrom}
                      onChange={(e) => setReportFilters(prev => ({ ...prev, customFrom: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>{t('report.to')}</label>
                    <StyledDateInput
                      value={reportFilters.customTo}
                      onChange={(e) => setReportFilters(prev => ({ ...prev, customTo: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: colors.text }}>
                  {t('report.category_optional')}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryOptions((prev) => !prev);
                    setShowTimeRangeOptions(false);
                    setShowPaymentMethodOptions(false);
                  }}
                  className="w-full px-3 py-3 rounded-xl border text-base font-semibold flex items-center justify-between"
                  style={{
                    borderColor: showCategoryOptions ? colors.primaryGreen : colors.gray400,
                    color: colors.text,
                    background: reportFilters.category ? '#e5e7eb' : colors.white
                  }}
                >
                  <span>{reportFilters.category ? labelCategory(reportFilters.category) : t('report.select_category')}</span>
                  <span className="text-lg">{showCategoryOptions ? '▲' : '▼'}</span>
                </button>
                {showCategoryOptions && (
                  <div className="mt-2 grid grid-cols-2 gap-2 p-2 rounded-xl border" style={{ borderColor: colors.gray400, background: colors.background }}>
                    {CATEGORIES.map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => {
                          const isDeselect = reportFilters.category === category;
                          setReportFilters((prev) => ({ ...prev, category: isDeselect ? '' : category }));
                          setShowCategoryOptions(false);
                        }}
                        className="px-3 py-2 rounded-lg border-2 text-sm font-semibold transition-colors duration-200"
                        style={{
                          borderColor: colors.primaryGreen,
                          background: reportFilters.category === category ? colors.primaryGreen : 'transparent',
                          color: reportFilters.category === category ? 'white' : colors.primaryGreen
                        }}
                      >
                        {labelCategory(category)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: colors.text }}>
                  {t('report.payment_optional')}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentMethodOptions((prev) => !prev);
                    setShowTimeRangeOptions(false);
                    setShowCategoryOptions(false);
                  }}
                  className="w-full px-3 py-3 rounded-xl border text-base font-semibold flex items-center justify-between"
                  style={{
                    borderColor: showPaymentMethodOptions ? colors.primaryGreen : colors.gray400,
                    color: colors.text,
                    background: reportFilters.paymentMethod ? '#e5e7eb' : colors.white
                  }}
                >
                  <span>{reportFilters.paymentMethod ? labelMethod(reportFilters.paymentMethod) : t('report.select_payment_method')}</span>
                  <span className="text-lg">{showPaymentMethodOptions ? '▲' : '▼'}</span>
                </button>
                {showPaymentMethodOptions && (
                  <div className="mt-2 grid grid-cols-2 gap-2 p-2 rounded-xl border" style={{ borderColor: colors.gray400, background: colors.background }}>
                    {REIMBURSEMENT_METHODS.map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => {
                          const isDeselect = reportFilters.paymentMethod === method;
                          setReportFilters((prev) => ({ ...prev, paymentMethod: isDeselect ? '' : method }));
                          setShowPaymentMethodOptions(false);
                        }}
                        className="px-3 py-2 rounded-lg border-2 text-sm font-semibold transition-colors duration-200"
                        style={{
                          borderColor: colors.primaryGreen,
                          background: reportFilters.paymentMethod === method ? colors.primaryGreen : 'transparent',
                          color: reportFilters.paymentMethod === method ? 'white' : colors.primaryGreen
                        }}
                      >
                        {labelMethod(method)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: colors.text }}>
                  {t('report.title_optional')}
                </label>
                <input
                  type="text"
                  value={reportFilters.titleQuery}
                  onChange={(e) => setReportFilters((prev) => ({ ...prev, titleQuery: e.target.value }))}
                  placeholder={t('report.title_query_placeholder')}
                  className="w-full px-3 py-3 rounded-xl border text-base"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  onClick={() => {
                    setReportFilters({
                      dateRange: '',
                      category: '',
                      paymentMethod: '',
                      titleQuery: '',
                      customFrom: '',
                      customTo: ''
                    });
                    setShowTimeRangeOptions(false);
                    setShowCategoryOptions(false);
                    setShowPaymentMethodOptions(false);
                  }}
                  className="w-full py-3 rounded-xl border-2 font-semibold"
                  style={{ borderColor: colors.gold, color: colors.gold }}
                >
                  {t('report.clear')}
                </button>
                <button
                  onClick={fetchReportData}
                  disabled={reportLoading}
                  className="w-full py-3 rounded-xl font-semibold text-white disabled:opacity-60"
                  style={{ background: colors.primaryGreen }}
                >
                  {reportLoading ? t('report.searching') : t('report.search_btn')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo Viewer Modal */}
      {photoViewerOpen && selectedPhoto && (
        <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl w-full h-full sm:h-auto sm:max-w-4xl sm:max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-3 sm:p-4 border-b">
              <h3 className="text-lg sm:text-xl font-bold text-gray-800">
                {t('photo_viewer.title', { title: selectedPhoto.title })}
                {selectedPhoto.photos.length > 1 && t('photo_viewer.counter', { current: selectedPhoto.index + 1, total: selectedPhoto.photos.length })}
              </h3>
              <button 
                onClick={() => setPhotoViewerOpen(false)}
                className="text-gray-600 hover:text-gray-800 text-xl sm:text-2xl font-bold"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto p-2 sm:p-4 flex items-center justify-center relative">
              {selectedPhoto.photos.length > 1 && selectedPhoto.index > 0 && (
                <button
                  onClick={() => setSelectedPhoto(prev => ({ ...prev, index: prev.index - 1 }))}
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 text-white flex items-center justify-center text-xl hover:bg-black/50 z-10"
                >
                  ‹
                </button>
              )}
              <img
                src={selectedPhoto.photos[selectedPhoto.index]?.url}
                alt={t('photo_viewer.receipt_alt')}
                className="w-full h-auto max-h-full object-contain"
              />
              {selectedPhoto.photos.length > 1 && selectedPhoto.index < selectedPhoto.photos.length - 1 && (
                <button
                  onClick={() => setSelectedPhoto(prev => ({ ...prev, index: prev.index + 1 }))}
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 text-white flex items-center justify-center text-xl hover:bg-black/50 z-10"
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

      {/* Save Confirmation Popup */}
      {savedExpenseSummary && (
        <div className="fixed inset-0 z-[59] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm mx-2 overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="p-4 text-center" style={{ background: colors.primaryGreen }}>
              <div className="text-3xl mb-1">✅</div>
              <h3 className="text-xl font-bold text-white">{t('saved_dialog.title')}</h3>
            </div>

            {/* Summary content */}
            <div className="p-5 space-y-3">
              {savedExpenseSummary.photos?.length > 0 && (
                <div className="flex justify-center gap-2 flex-wrap">
                  {savedExpenseSummary.photos.map((p, idx) => (
                    <img key={idx} src={p.url} alt={t('card.receipt_alt')} className="w-20 h-20 object-cover rounded-lg border" style={{ borderColor: colors.gray400 }} />
                  ))}
                </div>
              )}

              <div className="text-center">
                <h4 className="text-lg font-bold" style={{ color: colors.text }}>{savedExpenseSummary.title}</h4>
                <p className="text-2xl font-extrabold mt-1" style={{ color: colors.primaryGreen }}>{amountFormatted(savedExpenseSummary.amount)}</p>
              </div>

              <div className="space-y-2 text-sm" style={{ color: colors.muted }}>
                <div className="flex justify-between items-center">
                  <span>{t('saved_dialog.category')}</span>
                  <span className="font-semibold px-2 py-0.5 rounded-full text-white text-xs" style={{ background: colors.primaryGreen }}>
                    {savedExpenseSummary.category === 'Other' ? savedExpenseSummary.categoryOther : labelCategory(savedExpenseSummary.category)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{t('saved_dialog.payment')}</span>
                  <span className="font-medium" style={{ color: colors.text }}>💳 {labelMethod(savedExpenseSummary.reimbursementMethod)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('saved_dialog.date')}</span>
                  <span className="font-medium" style={{ color: colors.text }}>📅 {savedExpenseSummary.expenseDate?.toLocaleDateString?.() || new Date(savedExpenseSummary.expenseDate).toLocaleDateString()}</span>
                </div>
                {savedExpenseSummary.notes && (
                  <div className="p-2 rounded text-xs" style={{ background: colors.surface, color: colors.muted }}>{savedExpenseSummary.notes}</div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 pt-0 flex flex-col gap-2">
              <button
                onClick={() => setSavedExpenseSummary(null)}
                className="w-full py-3 rounded-xl text-white font-bold text-base active:scale-95 touch-manipulation transition-transform"
                style={{ background: colors.primaryGreen }}
              >
                {t('saved_dialog.done')}
              </button>
              <button
                onClick={() => {
                  const expenseId = savedExpenseSummary.id;
                  setSavedExpenseSummary(null);
                  const expenseToEdit = items.find(e => e.id === expenseId);
                  if (expenseToEdit) {
                    handleEditExpense(expenseToEdit);
                  }
                }}
                className="w-full py-3 rounded-xl font-bold text-base border-2 active:scale-95 touch-manipulation transition-transform"
                style={{ borderColor: colors.gold, color: colors.gold }}
              >
                {t('saved_dialog.edit')}
              </button>
            </div>
          </div>
        </div>
      )}

      <DatePickerModal open={datePickerOpen} mode="single" title={t('date_picker_title')} onClose={()=>setDatePickerOpen(false)} onSelect={({date})=>{ setForm(f=>({...f,expenseDate:date})); setDatePickerOpen(false); }} />

      {/* Edit Expense Modal */}
      {editingExpense && (
        <div className="fixed inset-0 z-[57] bg-black/50 flex items-center justify-center p-2 sm:p-4">
          <div className="rounded-2xl w-full h-full sm:h-auto sm:max-w-2xl mx-0 sm:mx-4 flex flex-col" style={{ background: colors.surface, maxHeight: '90vh' }}>
            {/* Header - Fixed */}
            <div className="flex items-center justify-between p-3 sm:p-5 pb-4 border-b" style={{ borderColor: colors.gray400 }}>
              <h3 className="text-xl sm:text-2xl font-bold" style={{ color: colors.text }}>{t('edit_modal.title')}</h3>
              <button onClick={handleCloseEditModal} className="text-xl sm:text-2xl font-bold transition-colors duration-200" style={{ color: colors.muted }} onMouseEnter={(e) => e.target.style.color = colors.text} onMouseLeave={(e) => e.target.style.color = colors.muted }>✕</button>
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-5 pt-0">
              <div className="grid grid-cols-1 gap-3 sm:gap-4">
                <input className="w-full px-3 sm:px-4 py-3 rounded-xl border text-base sm:text-lg" placeholder={t('form.title_placeholder')} value={form.title} onChange={(e)=>setForm(f=>({...f,title:e.target.value}))} />
                <input className="w-full px-3 sm:px-4 py-3 rounded-xl border text-base sm:text-lg" placeholder={t('form.amount_placeholder')} type="text" inputMode="decimal" value={form.amount} onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) { setForm(f => ({ ...f, amount: val })); } }} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select className="w-full px-3 sm:px-4 py-3 rounded-xl border text-base sm:text-lg" value={form.category} onChange={(e)=>setForm(f=>({...f,category:e.target.value}))}>
                    {CATEGORIES.map(c=> <option key={c} value={c}>{labelCategory(c)}</option>)}
                  </select>
                  {form.category === "Other" && (
                    <input className="w-full px-3 sm:px-4 py-3 rounded-xl border text-base sm:text-lg" placeholder={t('form.other_category_placeholder')} value={form.categoryOther} onChange={(e)=>setForm(f=>({...f,categoryOther:e.target.value}))} />
                  )}
                </div>
                <select className="w-full px-3 sm:px-4 py-3 rounded-xl border text-base sm:text-lg" value={form.reimbursementMethod} onChange={(e)=>setForm(f=>({...f,reimbursementMethod:e.target.value}))}>
                  {REIMBURSEMENT_METHODS.map(m=> <option key={m} value={m}>{labelMethod(m)}</option>)}
                </select>
                <div>
                  <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                    <button onClick={()=>setForm(f=>({...f,expenseDate:new Date().toISOString().slice(0,10)}))} className="w-full sm:w-auto px-4 py-2 rounded-full text-sm font-semibold text-white" style={{ background: colors.gold }}>{t('form.today')}</button>
                    <button onClick={()=>setDatePickerOpen(true)} className="w-full sm:w-auto px-4 py-2 rounded-full text-sm font-semibold border" style={{ borderColor: colors.primaryGreen, color: colors.primaryGreen }}>{t('form.other_date')}</button>
                  </div>
                  {form.expenseDate && (
                    <div className="mt-2 text-sm" style={{ color: colors.text }}>{t('form.selected')}: {new Date(form.expenseDate).toLocaleDateString()}</div>
                  )}
                </div>
                <textarea className="w-full px-3 sm:px-4 py-3 rounded-xl border text-base sm:text-lg" placeholder={t('form.notes_placeholder')} value={form.notes} onChange={(e)=>setForm(f=>({...f,notes:e.target.value.replace(/[a-zA-Z]/g,'')}))} dir="rtl" />
                
                {/* Photo Upload Section */}
                <div className="rounded-xl p-3 sm:p-4" style={{ background: colors.background }}>
                  <h3 className="font-semibold mb-3 text-center" style={{ color: colors.text }}>{t('form.receipt_photo')}</h3>
                  <PhotoUpload
                    ref={expensePhotoRef}
                    key={`edit-${editingExpense?.id}`}
                    currentPhotos={editingExpense?.photos || (editingExpense?.photoUrl ? [{url: editingExpense.photoUrl, path: editingExpense.photoPath || ''}] : [])}
                    uploadPath="expenses"
                    maxPhotos={5}
                  />
                </div>
              </div>
            </div>
            
            {/* Footer - Fixed */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 p-3 sm:p-5 pt-4 border-t" style={{ borderColor: colors.gray400 }}>
              <button onClick={handleUpdateExpense} disabled={saving} className="w-full sm:w-auto px-4 sm:px-6 py-3 rounded-lg font-semibold text-white" style={{ background: colors.primaryGreen }}>
                {saving ? t('edit_modal.updating') : t('edit_modal.update')}
              </button>
              <button onClick={handleCloseEditModal} className="w-full sm:w-auto px-4 sm:px-6 py-3 rounded-lg font-semibold text-white" style={{ background: colors.red }}>
                {t('edit_modal.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && expenseToDelete && (
        <div className="fixed inset-0 z-[58] bg-black/50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl w-full max-w-md mx-2 sm:mx-0 p-4 sm:p-6 text-center">
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4">{t('delete_modal.title')}</h3>
            <p className="text-sm sm:text-base text-gray-700 mb-3 sm:mb-4">{t('delete_modal.message')}</p>
            <p className="text-red-600 font-semibold mb-4 text-sm sm:text-base">{t('delete_modal.warning')}</p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <button onClick={confirmDeleteExpense} className="w-full sm:w-auto px-4 sm:px-6 py-3 rounded-lg font-semibold text-white" style={{ background: colors.red }}>
                {t('delete_modal.delete')}
              </button>
              <button onClick={() => setDeleteConfirmOpen(false)} className="w-full sm:w-auto px-4 sm:px-6 py-3 rounded-lg font-semibold text-white" style={{ background: colors.primaryGreen }}>
                {t('delete_modal.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* See All Refunds Modal */}
      {allRefundsOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl w-full h-full sm:h-auto sm:max-w-4xl mx-0 sm:mx-4 p-3 sm:p-5 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 border-b pb-3">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-800">{t('refunds.all_title')}</h3>
              <button onClick={() => setAllRefundsOpen(false)} className="text-gray-600 text-2xl">✕</button>
            </div>
            
            {/* Sort controls */}
            <div className="flex items-center gap-3 mb-4">
              <label className="text-sm font-medium text-gray-700">{t('refunds.sort_by')}</label>
              <select 
                value={refundSortOrder} 
                onChange={(e) => setRefundSortOrder(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                <option value="latest">{t('refunds.latest_first')}</option>
                <option value="earliest">{t('refunds.earliest_first')}</option>
              </select>
            </div>
            
            {/* Refunds list */}
            <div className="flex-1 overflow-y-auto space-y-3">
              {refundRequests
                .sort((a, b) => {
                  const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
                  const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
                  return refundSortOrder === 'latest' ? dateB - dateA : dateA - dateB;
                })
                .map(request => (
                  <div key={request.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h5 className="font-bold text-lg mb-2" style={{ color: colors.primaryGreen }}>{request.title}</h5>
                          <p className="text-gray-700 text-base font-semibold mb-1">{t('refunds.amount', { amount: request.amount })}</p>
                          <p className="text-gray-600 text-sm font-medium mb-1">{t('refunds.method', { method: request.repaymentMethod })}</p>
                          <p className="text-gray-600 text-sm font-medium mb-1">{t('refunds.from_room', { name: request.ownerName, roomLabel: t('refunds.room_label', { number: request.ownerRoomNumber }) })}</p>
                          <p className="text-gray-500 text-sm">{t('refunds.date', { date: request.expenseDate?.toDate?.()?.toLocaleDateString?.() || t('refunds.no_date') })}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${
                          request.status === 'waiting' ? 'bg-yellow-100 text-yellow-800' : 
                          request.status === 'approved' ? 'bg-green-100 text-green-800' : 
                          'bg-red-100 text-red-800'
                        }`}>
                          {refundStatusLabel(request.status)}
                        </span>
                      </div>
                      {request.status === 'waiting' && (
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleApproveRefund(request.id)}
                            className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold text-white"
                            style={{ background: colors.primaryGreen }}
                          >
                            ✅ {t('refunds.approve_btn')}
                          </button>
                          <button
                            onClick={() => handleDenyRefund(request.id)}
                            className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold text-white"
                            style={{ background: colors.red }}
                          >
                            ❌ {t('refunds.deny_btn')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
            
            <div className="flex justify-end pt-4 border-t">
              <button 
                onClick={() => setAllRefundsOpen(false)}
                className="px-6 py-2 rounded-lg font-semibold text-white"
                style={{ background: colors.gold }}
              >
                {t('refunds.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Past Refunds Modal */}
      {pastRefundsOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl w-full h-full sm:h-auto sm:max-w-4xl mx-0 sm:mx-4 p-3 sm:p-5 max-h-[90vh] flex flex-col">
            <div className="overflow-y-auto flex-1">
              <div className="flex items-center justify-between mb-4 border-b pb-3">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-800">{t('refunds.past_title')}</h3>
                <button onClick={() => setPastRefundsOpen(false)} className="text-gray-600 text-2xl">✕</button>
              </div>
              
              {/* Statistics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {refundRequests.filter(r => r.status === 'approved').length}
                  </div>
                  <div className="text-sm text-gray-600">{t('refunds.stat_approved')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {refundRequests.filter(r => r.status === 'denied').length}
                  </div>
                  <div className="text-sm text-gray-600">{t('refunds.stat_denied')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {refundRequests.filter(r => r.status === 'waiting').length}
                  </div>
                  <div className="text-sm text-gray-600">{t('refunds.stat_pending')}</div>
                </div>
              </div>
              
              {/* Export Button */}
              <div className="mb-4">
                <button 
                  onClick={() => {
                    // Set default custom dates when opening modal
                    const now = new Date();
                    const pastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                    setExportCustomFrom(pastMonth.toISOString().slice(0, 10));
                    setExportCustomTo(now.toISOString().slice(0, 10));
                    setExportModalOpen(true);
                  }}
                  className="w-full px-4 py-2 rounded-lg font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: isGeneratingPDF ? colors.gold : colors.primaryGreen }}
                  disabled={isGeneratingPDF}
                >
                  {isGeneratingPDF ? (
                    <span className="flex items-center justify-center gap-2">
                      <HouseLoader size={20} />
                      {t('refunds.generating_pdf_short')}
                    </span>
                  ) : (
                    `📊 ${t('refunds.export_pdf')}`
                  )}
                </button>
              </div>
              
              {/* Search */}
              <div className="mb-4">
                <div
                  className="rounded-xl border-2 p-1 shadow-sm"
                  style={{ borderColor: colors.primaryGreen, background: `${colors.primaryGreen}12` }}
                >
                  <input
                    type="text"
                    placeholder={t('refunds.search_placeholder')}
                    value={refundSearchTerm}
                    onChange={(e) => setRefundSearchTerm(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg text-lg border-0 outline-none"
                    style={{ background: colors.white, color: colors.text }}
                  />
                </div>
              </div>
              
              {/* Past refunds list */}
              <div className="space-y-4">
                {refundRequests
                  .filter(request => {
                    if (request.status === 'waiting') return false;
                    if (refundSearchTerm === '') return true;
                    const term = refundSearchTerm.toLowerCase();
                    return (request.ownerName || '').toLowerCase().includes(term) ||
                           (request.title || '').toLowerCase().includes(term);
                  })
                  .sort((a, b) => {
                    const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
                    const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
                    return dateB - dateA;
                  })
                  .map(request => (
                    <div key={request.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <h5 className="font-extrabold text-2xl mb-3" style={{ color: colors.primaryGreen }}>{request.title}</h5>
                            <p className="text-gray-700 text-xl font-semibold mb-2">{t('refunds.amount', { amount: request.amount })}</p>
                            <p className="text-gray-600 text-lg font-medium mb-1">{t('refunds.method', { method: request.repaymentMethod })}</p>
                            <p className="text-gray-600 text-lg font-medium mb-1">{t('refunds.from_room', { name: request.ownerName, roomLabel: t('refunds.room_label', { number: request.ownerRoomNumber }) })}</p>
                            <p className="text-gray-500 text-lg mb-1">{t('refunds.date', { date: request.expenseDate?.toDate?.()?.toLocaleDateString?.() || t('refunds.no_date') })}</p>
                            {request.status === 'approved' && request.receiptPhotoUrl && (
                              <button
                                onClick={() => {
                                  setSelectedPhoto({ photos: [{ url: request.receiptPhotoUrl }], title: t('refunds.receipt_for', { title: request.title }), index: 0 });
                                  setPhotoViewerOpen(true);
                                }}
                                className="text-lg font-semibold underline mt-2"
                                style={{ color: colors.primaryGreen }}
                              >
                                📷 {t('refunds.show_receipt')}
                              </button>
                            )}
                          </div>
                          <span className={`px-3 py-1.5 rounded-full text-sm font-bold flex-shrink-0 ${
                            request.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {refundStatusLabel(request.status)}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setApprovingRefundId(request.id);
                            setApprovingRefundData(request);
                            setEditRefundStatus(request.status === 'denied' ? 'denied' : 'approved');
                            setApproveModalOpen(true);
                          }}
                          className="w-full px-4 py-3 rounded-xl text-lg font-bold border-2 transition-colors"
                          style={{ 
                            borderColor: colors.gold, 
                            color: colors.gold,
                            background: 'transparent'
                          }}
                        >
                          ✏️ {t('refunds.edit')}
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
              
              <div className="flex justify-end pt-4 border-t mt-6">
                <button 
                  onClick={() => setPastRefundsOpen(false)}
                  className="px-6 py-2 rounded-lg font-semibold text-white"
                  style={{ background: colors.gold }}
                >
                  {t('refunds.close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approve Refund Modal */}
      {approveModalOpen && approvingRefundData && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl w-full h-full sm:h-auto sm:max-w-md mx-0 sm:mx-4 p-4 sm:p-6 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-5 border-b pb-4 border-gray-200">
              <h3 className="text-2xl font-bold text-gray-800">{t('refunds.edit_modal_title')}</h3>
              <button onClick={() => {
                setApproveModalOpen(false);
              }} className="text-gray-600 hover:text-gray-800 text-2xl transition-colors">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-5">
              <div className="bg-gray-50 rounded-xl p-5">
                <h4 className="font-bold text-2xl mb-3" style={{ color: colors.primaryGreen }}>{approvingRefundData.title}</h4>
                <p className="text-gray-700 text-xl font-semibold mb-2">{t('refunds.amount', { amount: approvingRefundData.amount })}</p>
                <p className="text-gray-600 text-lg font-medium mb-2">{t('refunds.from_room', { name: approvingRefundData.ownerName, roomLabel: t('refunds.room_label', { number: approvingRefundData.ownerRoomNumber }) })}</p>
                <p className="text-gray-500 text-lg">{t('refunds.date', { date: approvingRefundData.expenseDate?.toDate?.()?.toLocaleDateString?.() || t('refunds.no_date') })}</p>
              </div>

              {/* Status Toggle */}
              <div>
                <label className="block text-lg font-bold mb-3 text-gray-800">{t('refunds.status_label')}</label>
                <div className="flex rounded-xl overflow-hidden border-2 border-gray-200">
                  <button
                    onClick={() => setEditRefundStatus('approved')}
                    className="flex-1 py-3 text-lg font-bold transition-colors"
                    disabled={refundActionLoading}
                    style={{
                      background: editRefundStatus === 'approved' ? colors.primaryGreen : 'transparent',
                      color: editRefundStatus === 'approved' ? 'white' : colors.primaryGreen
                    }}
                  >
                    {t('refunds.status_toggle_approved')}
                  </button>
                  <button
                    onClick={() => setEditRefundStatus('denied')}
                    className="flex-1 py-3 text-lg font-bold transition-colors"
                    disabled={refundActionLoading}
                    style={{
                      background: editRefundStatus === 'denied' ? colors.red : 'transparent',
                      color: editRefundStatus === 'denied' ? 'white' : colors.red
                    }}
                  >
                    {t('refunds.status_toggle_denied')}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-lg font-bold mb-3 text-gray-800">{t('refunds.receipt_photo_label')}</label>
                
                <PhotoUpload
                  ref={refundReceiptPhotoRef}
                  key={`refund-${approvingRefundId}`}
                  currentPhotos={approvingRefundData?.photos || (approvingRefundData?.receiptPhotoUrl ? [{url: approvingRefundData.receiptPhotoUrl, path: approvingRefundData.photoPath || ''}] : [])}
                  uploadPath={`refunds/${approvingRefundData.ownerUid || 'admin'}`}
                  maxPhotos={5}
                />
              </div>
            </div>
            
            <div className="flex gap-3 pt-5 border-t border-gray-200 mt-4">
              <button
                onClick={async () => {
                  if (refundActionLoading) return;
                  let receiptResults;
                  try {
                    receiptResults = await refundReceiptPhotoRef.current?.upload() || [];
                  } catch {
                    return;
                  }
                  const receiptUrl = receiptResults[0]?.url || '';
                  if (approvingRefundData.status === 'waiting') {
                    if (editRefundStatus === 'approved') {
                      confirmApproveRefund(receiptUrl, receiptResults);
                    } else {
                      handleStatusChange('denied', '', []);
                    }
                  } else {
                    handleStatusChange(editRefundStatus, receiptUrl, receiptResults);
                  }
                }}
                className="flex-1 px-6 py-4 rounded-xl font-bold text-white text-xl"
                style={{ background: colors.primaryGreen }}
                disabled={refundActionLoading}
              >
                {t('refunds.save_changes')}
              </button>
              <button
                onClick={() => {
                  if (refundActionLoading) return;
                  setApproveModalOpen(false);
                }}
                className="flex-1 px-6 py-4 rounded-xl font-bold text-xl border-2"
                style={{ borderColor: colors.gray400, color: colors.muted }}
                disabled={refundActionLoading}
              >
                {t('refunds.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export PDF Modal */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 p-5">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-gray-800 mb-2">{t('refunds.export_modal_title')}</h3>
              <p className="text-gray-600">{t('refunds.export_modal_subtitle')}</p>
            </div>
            
            <div className="space-y-4 mb-6">
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="dateRange"
                  value="pastDay"
                  checked={exportDateRange === 'pastDay'}
                  onChange={(e) => setExportDateRange(e.target.value)}
                  className="text-blue-600"
                />
                <span className="text-gray-700 font-medium">{t('refunds.past_day')}</span>
              </label>
              
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="dateRange"
                  value="pastWeek"
                  checked={exportDateRange === 'pastWeek'}
                  onChange={(e) => setExportDateRange(e.target.value)}
                  className="text-blue-600"
                />
                <span className="text-gray-700 font-medium">{t('refunds.past_week')}</span>
              </label>
              
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="dateRange"
                  value="pastMonth"
                  checked={exportDateRange === 'pastMonth'}
                  onChange={(e) => setExportDateRange(e.target.value)}
                  className="text-blue-600"
                />
                <span className="text-gray-700 font-medium">{t('refunds.past_month')}</span>
              </label>
              
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="dateRange"
                  value="custom"
                  checked={exportDateRange === 'custom'}
                  onChange={(e) => setExportDateRange(e.target.value)}
                  className="text-blue-600"
                />
                <span className="text-gray-700 font-medium">{t('refunds.custom_dates')}</span>
              </label>
            </div>
            
            {/* Custom Date Inputs */}
            {exportDateRange === 'custom' && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('refunds.from_date')}</label>
                  <StyledDateTimeInput
                    value={exportCustomFrom || ''}
                    onChange={(e) => setExportCustomFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('refunds.to_date')}</label>
                  <StyledDateTimeInput
                    value={exportCustomTo || ''}
                    onChange={(e) => setExportCustomTo(e.target.value)}
                  />
                </div>
              </div>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={() => setExportModalOpen(false)}
                className="flex-1 px-4 py-3 rounded-lg font-semibold text-white"
                style={{ background: colors.gold }}
              >
                {t('refunds.cancel')}
              </button>
              <button
                onClick={async () => {
                  if (isGeneratingPDF) return;

                  setIsGeneratingPDF(true);
                  setPdfProgressText(t('pdf_generating'));

                  try {
                    let filteredRequests = [...refundRequests];
                    const now = new Date();

                    if (exportDateRange !== 'custom') {
                      let startDate = new Date();
                      switch (exportDateRange) {
                        case 'pastDay':   startDate.setDate(now.getDate() - 1); break;
                        case 'pastWeek':  startDate.setDate(now.getDate() - 7); break;
                        case 'pastMonth': startDate.setMonth(now.getMonth() - 1); break;
                      }
                      filteredRequests = refundRequests.filter(r => {
                        const d = r.expenseDate?.toDate?.() || r.createdAt?.toDate?.() || new Date();
                        return d >= startDate && d <= now;
                      });
                    } else if (exportCustomFrom && exportCustomTo) {
                      const from = new Date(exportCustomFrom);
                      const to = new Date(exportCustomTo);
                      filteredRequests = refundRequests.filter(r => {
                        const d = r.expenseDate?.toDate?.() || r.createdAt?.toDate?.() || new Date();
                        return d >= from && d <= to;
                      });
                    }

                    await generateRefundsPDF(filteredRequests, {
                      dateRange: exportDateRange,
                      customFrom: exportCustomFrom,
                      customTo: exportCustomTo,
                      onProgress: (current, total) => {
                        setPdfProgressText(t('pdf_loading_image', { current, total }));
                      },
                    });
                    setSuccess(t('pdf_success'));
                    setExportModalOpen(false);
                  } catch (err) {
                    setError(t('pdf_error'));
                    console.error('PDF generation error:', err);
                  } finally {
                    setIsGeneratingPDF(false);
                    setPdfProgressText('');
                  }
                }}
                className="flex-1 px-4 py-3 rounded-lg font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: isGeneratingPDF ? colors.gold : colors.primaryGreen }}
                disabled={isGeneratingPDF}
              >
                {isGeneratingPDF ? (
                  <span className="flex items-center justify-center gap-2">
                    <HouseLoader size={20} />
                    {t('refunds.generating_pdf_short')}
                  </span>
                ) : (
                  t('refunds.export_pdf_btn')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {isGeneratingPDF && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 shadow-xl flex flex-col items-center gap-2 min-w-[220px]">
            <HouseLoader size={70} text={pdfProgressText || t('pdf_generating')} />
          </div>
        </div>
      )}

      <AdminBottomNavBar active="expenses" />
    </main>
  );
}
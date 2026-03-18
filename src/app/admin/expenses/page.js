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
import { deleteDoc } from "firebase/firestore";
import AdminBottomNavBar from "@/components/AdminBottomNavBar";
import DatePickerModal from "@/components/DatePickerModal";
import PhotoUpload from "@/components/PhotoUpload";
import { StyledDateInput, StyledDateTimeInput } from "@/components/StyledDateInput";
import colors from "@/app/colors";
import '@/i18n';
import i18n from '@/i18n';
import { generateExpensesPDF, generateRefundsPDF } from '@/lib/pdfGenerator';
import HouseLoader from '@/components/HouseLoader';

// Function to get user name by UID
const getUserName = async (uid) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const userData = userSnap.data();
      return `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Unknown User';
    }
    return 'Unknown User';
  } catch (error) {
    console.error('Error getting user name:', error);
    return 'Unknown User';
  }
};


const CATEGORIES = ["Food","Equipment","Maintenance","Transport","Utilities","Other"];
const REIMBURSEMENT_METHODS = ["Credit Card","Bank Transfer","Cash","Other"];

export default function AdminExpensesPage() {
  const router = useRouter();
  const isRTL = i18n.language === 'he';
  const [userDoc, setUserDoc] = useState(null);

  const [form, setForm] = useState({
    title: "",
    amount: "",
    category: "Food",
    categoryOther: "",
    reimbursementMethod: "Credit Card",
    notes: "",
    linkedSoldierUid: "",
    expenseDate: new Date().toISOString().slice(0,10),
    photoUrl: "",
    photoPath: "",
  });
  const [datePickerOpen, setDatePickerOpen] = useState(false);
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
  const [receiptPhoto, setReceiptPhoto] = useState(null);

  // Export modal state
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportDateRange, setExportDateRange] = useState('pastMonth');
  const [exportCustomFrom, setExportCustomFrom] = useState('');
  const [exportCustomTo, setExportCustomTo] = useState('');

  // Report modal state
  const [reportOpen, setReportOpen] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [reportItems, setReportItems] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportFilters, setReportFilters] = useState({
    dateRange: "all",
    category: "",
    paymentMethod: "",
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

  // Save confirmation popup state
  const [savedExpenseSummary, setSavedExpenseSummary] = useState(null);

  // Prevent background scrolling when modals are open
  useEffect(() => {
    if (reportOpen || editingExpense || deleteConfirmOpen || photoViewerOpen || exportModalOpen || savedExpenseSummary) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup function to restore scrolling when component unmounts
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [reportOpen, editingExpense, deleteConfirmOpen, photoViewerOpen, exportModalOpen, savedExpenseSummary]);


  // Access control: only admins
  useEffect(() => {
    const check = async () => {
      try {
        const user = auth.currentUser;
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
        
      } catch (error) {
        console.error('Error checking user access:', error);
        router.push("/");
      }
    };
    check();
  }, [router]);

  const validate = () => {
    if (!form.title.trim()) return "Title is required";
    if (!form.amount || isNaN(Number(form.amount))) return "Valid amount is required";
    if (!form.category) return "Category is required";
    if (form.category === "Other" && !form.categoryOther.trim()) return "Please specify the other category";
    if (!form.reimbursementMethod) return "Reimbursement method is required";
    if (!form.expenseDate) return "Expense date is required";
    return "";
  };

  const showSuccess = (msg) => { setSuccess(msg); try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {} };
  const showError = (msg) => { setError(msg); try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {} };

  const resetForm = () => setForm({
    title: "", amount: "", category: "Food", categoryOther: "",
    reimbursementMethod: "Credit Card", notes: "", linkedSoldierUid: "",
    expenseDate: new Date().toISOString().slice(0, 10),
    photoUrl: "", photoPath: "",
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

  const handlePhotoUploaded = (photoUrl, photoPath) => {
    setForm(prev => ({
      ...prev,
      photoUrl,
      photoPath
    }));
  };

  const handlePhotoRemoved = () => {
    setForm(prev => ({
      ...prev,
      photoUrl: "",
      photoPath: ""
    }));
  };

  const handleCloseReportModal = () => {
    setReportOpen(false);
    setShowSearchResults(false);
    setReportItems([]);
    setReportFilters({
      dateRange: 'all',
      category: '',
      paymentMethod: '',
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
      photoUrl: expense.photoUrl || "",
      photoPath: expense.photoPath || "",
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
      setSuccess("Expense deleted successfully");
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
      setError("Failed to delete expense");
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
        photoUrl: form.photoUrl,
        photoPath: form.photoPath,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, "expenses", editingExpense.id), payload);
      
      showSuccess("Expense updated successfully");
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
      showError("Failed to update expense");
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
        showError("Please sign in again"); 
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
        photoUrl: form.photoUrl || null,
        photoPath: form.photoPath || null,
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
        photoUrl: payload.photoUrl,
      });
      
      resetForm();
      
      // Refresh the expenses list
      await fetchList();
      
    } catch (e) {
      console.error("Error saving expense:", e);
      if (e.code === 'permission-denied') {
        showError("Permission denied. Please check your access rights.");
      } else if (e.code === 'unavailable') {
        showError("Service temporarily unavailable. Please try again.");
      } else {
        showError(e?.message || "Failed to save expense. Please try again.");
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
      // Initialize receipt photo if one exists
      if (request.receiptPhotoUrl) {
        setReceiptPhoto({ url: request.receiptPhotoUrl, path: request.photoPath || '' });
      } else {
        setReceiptPhoto(null);
      }
      setApproveModalOpen(true);
    }
  };

  const confirmApproveRefund = async (receiptPhotoUrl) => {
    try {
      await updateDoc(doc(db, "refundRequests", approvingRefundId), {
        status: 'approved',
        approvedAt: serverTimestamp(),
        approvedBy: auth.currentUser.uid,
        receiptPhotoUrl: receiptPhotoUrl
      });
      await fetchRefundRequests(); // Refresh the list
      setApproveModalOpen(false);
      setApprovingRefundId(null);
      setApprovingRefundData(null);
      setReceiptPhoto(null);
    } catch (error) {
      console.error('Error approving refund:', error);
    }
  };

  const handleStatusChange = async (newStatus, receiptPhotoUrl) => {
    try {
      const updateData = {
        status: newStatus,
        receiptPhotoUrl: receiptPhotoUrl || approvingRefundData.receiptPhotoUrl || ''
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
      setReceiptPhoto(null);
    } catch (error) {
      console.error('Error changing refund status:', error);
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

  const openPhotoViewer = (photoUrl, expenseTitle) => {
    setSelectedPhoto({ url: photoUrl, title: expenseTitle });
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
          expense.createdByName = 'Unknown User';
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
      
      // Apply date filtering in JavaScript
      if (reportFilters.dateRange !== "all") {
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
      setError("Failed to search expenses. Please try again.");
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
    setPdfProgressText(i18n.t('pdf_generating', { ns: 'admin' }));

    try {
      await generateExpensesPDF(reportItems, {
        dateRange: reportFilters.dateRange === 'custom' ? 'custom' : reportFilters.dateRange,
        customFrom: reportFilters.customFrom,
        customTo: reportFilters.customTo,
        onProgress: (current, total) => {
          setPdfProgressText(`Loading image ${current}/${total}...`);
        },
      });
      setSuccess(i18n.t('pdf_success', { ns: 'admin' }));
    } catch (err) {
      setError(i18n.t('pdf_error', { ns: 'admin' }));
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
        `"${expense.photoUrl || ''}"`
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
          className="flex-shrink-0 flex items-center justify-center cursor-pointer"
          style={{ width: 90, minHeight: 90, background: expense.photoUrl ? 'transparent' : colors.background }}
          onClick={() => {
            if (expense.photoUrl) {
              setSelectedPhoto({ url: expense.photoUrl, title: expense.title });
              setPhotoViewerOpen(true);
            }
          }}
        >
          {expense.photoUrl ? (
            <img src={expense.photoUrl} alt="Receipt" className="w-full h-full object-cover" style={{ minHeight: 90 }} />
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
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: colors.primaryGreen }}>{expense.category}</span>
            <span className="text-xs font-medium" style={{ color: colors.muted }}>💳 {expense.reimbursementMethod || 'N/A'}</span>
          </div>

          <p className="text-xs font-medium" style={{ color: colors.muted }}>
            📅 {expense.expenseDate?.toDate?.()?.toLocaleDateString?.() || 'No date'}
          </p>

          {/* Actions row */}
          <div className="flex items-center gap-2 mt-1" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <button
              onClick={() => handleEditExpense(expense)}
              className="px-3 py-1.5 border-2 font-bold text-xs rounded-lg transition-colors duration-200 active:scale-95 touch-manipulation"
              style={{ borderColor: colors.primaryGreen, color: colors.primaryGreen }}
            >
              Edit
            </button>
            <button
              onClick={() => handleDeleteExpense(expense)}
              className="px-3 py-1.5 border-2 font-bold text-xs rounded-lg transition-colors duration-200 active:scale-95 touch-manipulation"
              style={{ borderColor: colors.red, color: colors.red }}
            >
              Delete
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

  return (
    <main dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-br from-blue-200/60 to-green-100/60 font-body flex flex-col items-center pt-6 pb-32 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 rounded-2xl p-6 shadow-xl" style={{ background: "rgba(0,0,0,0.22)" }}>
          <h2 className="text-white font-extrabold text-2xl mb-4">Add Expense</h2>
          {error && <div className="mb-3 text-red-600 text-sm bg-white rounded px-3 py-2">{error}</div>}
          {success && <div className="mb-3 text-green-700 text-sm bg-white rounded px-3 py-2">{success}</div>}
          <div className="grid grid-cols-1 gap-4">
            <input 
              className="w-full px-4 py-3 rounded-xl border text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200" 
              placeholder="Title" 
              value={form.title} 
              onChange={(e)=>setForm(f=>({...f,title:e.target.value}))}
              autoComplete="off"
              spellCheck="false"
            />
            <input 
              className="w-full px-4 py-3 rounded-xl border text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200" 
              placeholder="Amount (₪)" 
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
            <div className="grid grid-cols-2 gap-3">
              <select 
                className="w-full px-4 py-3 rounded-xl border text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200" 
                value={form.category} 
                onChange={(e)=>setForm(f=>({...f,category:e.target.value}))}
              >
                {CATEGORIES.map(c=> <option key={c} value={c}>{c}</option>)}
              </select>
              {form.category === "Other" && (
                <input 
                  className="w-full px-4 py-3 rounded-xl border text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200" 
                  placeholder="Other category" 
                  value={form.categoryOther} 
                  onChange={(e)=>setForm(f=>({...f,categoryOther:e.target.value}))}
                  autoComplete="off"
                />
              )}
            </div>
            <select 
              className="w-full px-4 py-3 rounded-xl border text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200" 
              value={form.reimbursementMethod} 
              onChange={(e)=>setForm(f=>({...f,reimbursementMethod:e.target.value}))}
            >
              {REIMBURSEMENT_METHODS.map(m=> <option key={m} value={m}>{m}</option>)}
            </select>
            <div>
              <div className="flex gap-2 items-center">
                <button 
                  onClick={()=>setForm(f=>({...f,expenseDate:new Date().toISOString().slice(0,10)}))} 
                  className="px-4 py-2 rounded-full text-sm font-semibold text-white transition-all duration-200 active:scale-95 touch-manipulation" 
                  style={{ background: colors.gold }}
                >
                  Today
                </button>
                <button 
                  onClick={()=>setDatePickerOpen(true)} 
                  className="px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-200 active:scale-95 touch-manipulation" 
                  style={{ borderColor: colors.primaryGreen, color: colors.primaryGreen }}
                >
                  Other date
                </button>
              </div>
              {form.expenseDate && (
                <div className="mt-2 text-white text-sm">Selected: {new Date(form.expenseDate).toLocaleDateString()}</div>
              )}
            </div>
            <textarea 
              className="w-full px-4 py-3 rounded-xl border text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 resize-none" 
              placeholder={i18n.t('notes_hebrew_only', { ns: 'admin' })}
              value={form.notes} 
              onChange={(e)=>setForm(f=>({...f,notes:e.target.value.replace(/[a-zA-Z]/g,'')}))}
              rows={3}
              autoComplete="off"
              dir="rtl"
            />
            
            {/* Photo Upload Section */}
            <div className="bg-white/10 rounded-xl p-4">
              <h3 className="text-white font-semibold mb-3 text-center">Receipt Photo</h3>
              <PhotoUpload
                key={`photo-${form.photoUrl}-${Date.now()}`}
                onPhotoUploaded={handlePhotoUploaded}
                onPhotoRemoved={handlePhotoRemoved}
                currentPhotoUrl={form.photoUrl}
                uploadPath="expenses"
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
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Saving...
            </span>
          ) : (
            "Save Expense"
          )}
        </button>
        
        {/* View Expenses Button */}
        <button 
          onClick={()=>{ setReportOpen(true); setShowSearchResults(false); }} 
          className="w-full mt-3 px-4 py-3 rounded-xl text-white font-semibold text-lg transition-all duration-200 active:scale-95 touch-manipulation" 
          style={{ background: colors.primaryGreen }}
        >
          View Expenses
        </button>
          </div>
        </div>



        {/* Refund Requests Section */}
        <div className="mb-3 rounded-2xl p-5 shadow-xl" style={{ background: "rgba(0,0,0,0.22)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-white font-extrabold text-xl">Refund Requests</h3>
              {refundRequests.filter(r => r.status === 'waiting').length > 3 && (
                <button 
                  onClick={() => setAllRefundsOpen(true)}
                  className="px-3 py-1 rounded-full border text-sm text-white border-white/30 hover:bg-white/10"
                >
                  See All ({refundRequests.filter(r => r.status === 'waiting').length})
                </button>
              )}
            </div>
            <button onClick={fetchRefundRequests} className="px-3 py-1 rounded-full border text-sm text-white border-white/30 hover:bg-white/10">Refresh</button>
          </div>
          
          {refundLoading ? (
            <div className="text-center py-4 text-white/70 text-lg">Loading refund requests...</div>
          ) : refundRequests.filter(r => r.status === 'waiting').length === 0 ? (
            <div className="text-center py-4 text-white/70 text-lg">No pending refund requests</div>
          ) : (
            <div className="space-y-3">
              {/* Show only waiting requests (max 3) */}
              {refundRequests
                .filter(request => request.status === 'waiting')
                .slice(0, 3)
                .map(request => (
                  <div key={request.id} className="bg-white/10 rounded-lg p-4 border border-white/20">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h5 className="text-white font-bold text-xl mb-2">{request.title}</h5>
                          <p className="text-white/90 text-lg font-semibold mb-1">Amount: ₪{request.amount}</p>
                          <p className="text-white/80 text-base font-medium mb-1">Method: {request.repaymentMethod}</p>
                          <p className="text-white/80 text-base font-medium mb-1">From: {request.ownerName} (Room {request.ownerRoomNumber})</p>
                          <p className="text-white/70 text-base">Date: {request.expenseDate?.toDate?.()?.toLocaleDateString?.() || 'No date'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 rounded-full text-sm font-bold bg-yellow-500 text-white">
                            Waiting
                          </span>
                        </div>
                      </div>
                      
                      {/* Action buttons for waiting requests */}
                      <div className="flex gap-3 mt-3">
                        <button
                          onClick={() => handleApproveRefund(request.id)}
                          className="flex-1 px-4 py-3 rounded-lg font-bold text-lg border-2"
                          style={{ 
                            borderColor: colors.primaryGreen, 
                            color: colors.primaryGreen,
                            background: 'transparent'
                          }}
                        >
                          ✅ Approve
                        </button>
                        <button
                          onClick={() => handleDenyRefund(request.id)}
                          className="flex-1 px-4 py-3 rounded-lg font-bold text-lg border-2"
                          style={{ 
                            borderColor: colors.red, 
                            color: colors.red,
                            background: 'transparent'
                          }}
                        >
                          ❌ Deny
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
              Show Past Requests
            </button>
          </div>
        </div>
      </div>

      {/* Comprehensive Report Modal */}
      {reportOpen && (
        <div className="fixed inset-0 z-[55] bg-black/50 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
          <div className="rounded-2xl w-full h-full sm:h-auto sm:max-h-[90vh] mx-0 sm:mx-4 p-3 sm:p-5 flex flex-col overflow-hidden" style={{ background: colors.surface }}>
            <div className="overflow-y-auto flex-1">
              <div className="flex items-center justify-between mb-4 border-b pb-3" style={{ borderColor: colors.gray400 }}>
                <h3 className="text-xl sm:text-2xl font-bold" style={{ color: colors.text }}>View Expenses</h3>
                <button onClick={handleCloseReportModal} className="text-xl sm:text-2xl font-bold transition-colors duration-200" style={{ color: colors.muted }} onMouseEnter={(e) => e.target.style.color = colors.text} onMouseLeave={(e) => e.target.style.color = colors.muted }>✕</button>
              </div>
            
            {/* Filters and Search Button - Only show when NOT displaying search results */}
            {!showSearchResults && (
              <>
                {/* New Collapsible Filter System */}
                <div className="space-y-4 mb-6 p-4 rounded-lg" style={{ background: colors.background }}>
                  <h4 className="text-lg font-semibold mb-4" style={{ color: colors.text }}>Filter Expenses</h4>
                  
                  {/* Date Filter */}
                  <div className="space-y-3">
                    <button 
                      onClick={() => setExpandedId(expandedId === 'date' ? null : 'date')}
                      className="w-full px-3 py-2 rounded-lg font-semibold text-base transition-all duration-200 active:scale-95 touch-manipulation flex items-center justify-between border-2"
                      style={{ 
                        borderColor: expandedId === 'date' ? colors.primaryGreen : colors.gold,
                        color: expandedId === 'date' ? colors.primaryGreen : 'black',
                        background: 'transparent'
                      }}
                    >
                      <span>Date Filter</span>
                      <span className="text-lg">{expandedId === 'date' ? '▼' : '▶'}</span>
                    </button>
                    
                    {expandedId === 'date' && (
                      <div className="space-y-3 p-3 rounded-lg border" style={{ borderColor: colors.gray400, background: colors.surface }}>
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            onClick={() => {
                              setReportFilters(prev => ({ ...prev, dateRange: 'lastDay' }));
                            }}
                            className={`px-3 py-2 rounded-lg font-semibold text-sm transition-all duration-200 active:scale-95 touch-manipulation border-2 ${
                              reportFilters.dateRange === 'lastDay' 
                                ? 'text-white' 
                                : ''
                            }`}
                            style={{ 
                              background: reportFilters.dateRange === 'lastDay' ? colors.primaryGreen : 'transparent',
                              borderColor: colors.primaryGreen,
                              color: reportFilters.dateRange === 'lastDay' ? 'white' : colors.primaryGreen
                            }}
                          >
                            Day
                          </button>
                          <button 
                            onClick={() => {
                              setReportFilters(prev => ({ ...prev, dateRange: 'lastWeek' }));
                            }}
                            className={`px-3 py-2 rounded-lg font-semibold text-sm transition-all duration-200 active:scale-95 touch-manipulation border-2 ${
                              reportFilters.dateRange === 'lastWeek' 
                                ? 'text-white' 
                                : ''
                            }`}
                            style={{ 
                              background: reportFilters.dateRange === 'lastWeek' ? colors.primaryGreen : 'transparent',
                              borderColor: colors.primaryGreen,
                              color: reportFilters.dateRange === 'lastWeek' ? 'white' : colors.primaryGreen
                            }}
                          >
                            Week
                          </button>
                          <button 
                            onClick={() => {
                              setReportFilters(prev => ({ ...prev, dateRange: 'lastMonth' }));
                            }}
                            className={`px-3 py-2 rounded-lg font-semibold text-sm transition-all duration-200 active:scale-95 touch-manipulation border-2 ${
                              reportFilters.dateRange === 'lastMonth' 
                                ? 'text-white' 
                                : 'white'
                            }`}
                            style={{ 
                              background: reportFilters.dateRange === 'lastMonth' ? colors.primaryGreen : 'transparent',
                              borderColor: colors.primaryGreen,
                              color: reportFilters.dateRange === 'lastMonth' ? 'white' : colors.primaryGreen
                            }}
                          >
                            Month
                          </button>
                          <button 
                            onClick={() => {
                              setReportFilters(prev => ({ ...prev, dateRange: 'custom' }));
                            }}
                            className={`px-3 py-2 rounded-lg font-semibold text-sm transition-all duration-200 active:scale-95 touch-manipulation border-2 ${
                              reportFilters.dateRange === 'custom' 
                                ? 'text-white' 
                                : ''
                            }`}
                            style={{ 
                              background: reportFilters.dateRange === 'custom' ? colors.primaryGreen : 'transparent',
                              borderColor: colors.primaryGreen,
                              color: reportFilters.dateRange === 'custom' ? 'white' : colors.primaryGreen
                            }}
                          >
                            Select Date
                          </button>
                        </div>
                        
                        {/* Custom Date Range Inputs */}
                        {reportFilters.dateRange === 'custom' && (
                          <div className="grid grid-cols-2 gap-3 pt-3 border-t" style={{ borderColor: colors.gray400 }}>
                            <div>
                              <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>From</label>
                              <StyledDateInput
                                value={reportFilters.customFrom}
                                onChange={(e) => setReportFilters(prev => ({ ...prev, customFrom: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>To</label>
                              <StyledDateInput
                                value={reportFilters.customTo}
                                onChange={(e) => setReportFilters(prev => ({ ...prev, customTo: e.target.value }))}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Category Filter */}
                  <div className="space-y-3">
                    <button 
                      onClick={() => setExpandedId(expandedId === 'category' ? null : 'category')}
                      className="w-full px-3 py-2 rounded-lg font-semibold text-base transition-all duration-200 active:scale-95 touch-manipulation flex items-center justify-between border-2"
                      style={{ 
                        borderColor: expandedId === 'category' ? colors.primaryGreen : colors.gold,
                        color: expandedId === 'category' ? colors.primaryGreen : 'black',
                        background: 'transparent'
                      }}
                    >
                      <span>Category Filter</span>
                      <span className="text-lg">{expandedId === 'category' ? '▼' : '▶'}</span>
                    </button>
                    
                    {expandedId === 'category' && (
                      <div className="grid grid-cols-2 gap-2 p-3 rounded-lg border" style={{ borderColor: colors.gray400, background: colors.surface }}>
                        <button 
                          onClick={() => {
                            setReportFilters(prev => ({ ...prev, category: '' }));
                          }}
                          className={`px-3 py-2 rounded-lg font-semibold text-sm transition-all duration-200 active:scale-95 touch-manipulation border-2 ${
                            reportFilters.category === '' 
                              ? 'text-white' 
                              : ''
                          }`}
                          style={{ 
                            background: reportFilters.category === '' ? colors.primaryGreen : 'transparent',
                            borderColor: colors.primaryGreen,
                            color: reportFilters.category === '' ? 'white' : colors.primaryGreen
                          }}
                        >
                          All Categories
                        </button>
                        {CATEGORIES.map(category => (
                          <button 
                            key={category}
                            onClick={() => {
                              setReportFilters(prev => ({ ...prev, category }));
                            }}
                            className={`px-3 py-2 rounded-lg font-semibold text-sm transition-all duration-200 active:scale-95 touch-manipulation border-2 ${
                              reportFilters.category === category 
                                ? 'text-white' 
                                : ''
                            }`}
                            style={{ 
                              background: reportFilters.category === category ? colors.primaryGreen : 'transparent',
                              borderColor: colors.primaryGreen,
                              color: reportFilters.category === category ? 'white' : colors.primaryGreen
                            }}
                          >
                            {category}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Payment Method Filter */}
                  <div className="space-y-3">
                    <button 
                      onClick={() => setExpandedId(expandedId === 'payment' ? null : 'payment')}
                      className="w-full px-3 py-2 rounded-lg font-semibold text-base transition-all duration-200 active:scale-95 touch-manipulation flex items-center justify-between border-2"
                      style={{ 
                        borderColor: expandedId === 'payment' ? colors.primaryGreen : colors.gold,
                        color: expandedId === 'payment' ? colors.primaryGreen : 'black',
                        background: 'transparent'
                      }}
                    >
                      <span>Payment Method Filter</span>
                      <span className="text-lg">{expandedId === 'payment' ? '▼' : '▶'}</span>
                    </button>
                    
                    {expandedId === 'payment' && (
                      <div className="grid grid-cols-2 gap-2 p-3 rounded-lg border" style={{ borderColor: colors.gray400, background: colors.surface }}>
                        <button 
                          onClick={() => {
                            setReportFilters(prev => ({ ...prev, paymentMethod: '' }));
                          }}
                          className={`px-3 py-2 rounded-lg font-semibold text-sm transition-all duration-200 active:scale-95 touch-manipulation border-2 ${
                            reportFilters.paymentMethod === '' 
                              ? 'text-white' 
                              : ''
                          }`}
                                                      style={{ 
                              background: reportFilters.paymentMethod === '' ? colors.primaryGreen : 'transparent',
                              borderColor: colors.primaryGreen,
                              color: reportFilters.paymentMethod === '' ? 'white' : colors.primaryGreen
                            }}
                        >
                          All Methods
                        </button>
                        {REIMBURSEMENT_METHODS.map(method => (
                          <button 
                            key={method}
                            onClick={() => {
                              setReportFilters(prev => ({ ...prev, paymentMethod: method }));
                            }}
                            className={`px-3 py-2 rounded-lg font-semibold text-sm transition-all duration-200 active:scale-95 touch-manipulation border-2 ${
                              reportFilters.paymentMethod === method 
                                ? 'text-white' 
                                : ''
                            }`}
                            style={{ 
                              background: reportFilters.paymentMethod === method ? colors.primaryGreen : 'transparent',
                              borderColor: colors.primaryGreen,
                              color: reportFilters.paymentMethod === method ? 'white' : colors.primaryGreen
                            }}
                          >
                            {method}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Active Filters Display */}
                  {(reportFilters.dateRange !== 'all' || reportFilters.category || reportFilters.paymentMethod) && (
                    <div className="p-3 rounded-lg border" style={{ borderColor: colors.gray400, background: colors.surface }}>
                      <h5 className="text-sm font-semibold mb-2" style={{ color: colors.text }}>Active Filters:</h5>
                      <div className="flex flex-wrap gap-2">
                        {reportFilters.dateRange !== 'all' && (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ background: colors.primaryGreen }}>
                            Date: {reportFilters.dateRange === 'custom' ? 'Custom Range' : 
                                   reportFilters.dateRange === 'lastDay' ? 'Last Day' :
                                   reportFilters.dateRange === 'lastWeek' ? 'Last Week' :
                                   reportFilters.dateRange === 'lastMonth' ? 'Last Month' : 'Custom'}
                          </span>
                        )}
                        {reportFilters.category && (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ background: colors.gold }}>
                            Category: {reportFilters.category}
                          </span>
                        )}
                        {reportFilters.paymentMethod && (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ background: colors.primaryGreen }}>
                            Payment: {reportFilters.paymentMethod}
                          </span>
                        )}
                        <button 
                          onClick={() => setReportFilters({
                            dateRange: 'all',
                            category: '',
                            paymentMethod: '',
                            customFrom: '',
                            customTo: ''
                          })}
                          className="px-2 py-1 rounded-full text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Search Button */}
                <div className="flex justify-center mb-6 sm:mb-4 flex-shrink-0">
                  <button 
                    onClick={fetchReportData}
                    disabled={reportLoading}
                    className="w-full sm:w-auto px-6 py-3 border-2 font-bold text-base sm:text-lg rounded-lg transition-colors duration-200"
                    style={{ 
                      borderColor: colors.gold, 
                      color: 'black',
                      background: 'transparent',
                      opacity: reportLoading ? 0.5 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!reportLoading) {
                        e.target.style.background = colors.gold;
                        e.target.style.color = 'white';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!reportLoading) {
                        e.target.style.background = 'transparent';
                        e.target.style.color = 'black';
                      }
                    }}
                  >
                    Search Expenses
                  </button>
                </div>
              </>
            )}
            
            {/* Recent Expenses Preview */}
            {!showSearchResults && (
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg flex-1 overflow-hidden flex flex-col" style={{ background: colors.background }}>
                <h4 className="text-base sm:text-lg font-semibold mb-3 flex-shrink-0" style={{ color: colors.text }}>Recent Expenses</h4>
                
                <div className="space-y-3 flex-1 overflow-y-auto min-h-0">
                  {loadingList ? (
                    <div className="text-center py-4" style={{ color: colors.muted }}>Loading expenses...</div>
                  ) : items.length === 0 ? (
                    <div className="text-center py-4" style={{ color: colors.muted }}>No expenses found</div>
                  ) : (
                    <>
                      {items.slice(0, expandedId === 'recent' ? items.length : 3).map(expense => renderExpenseCard(expense))}
                      
                      {/* Show More/Less Button */}
                      {items.length > 3 && (
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
                            {expandedId === 'recent' ? 'Show Less' : `Show ${items.length - 3} More`}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
            
            {/* Search Results Dashboard */}
            {showSearchResults && reportItems.length > 0 && (
              <div className="flex-1 overflow-y-auto min-h-0">
                {/* Back to search button */}
                <button
                  onClick={() => {
                    setShowSearchResults(false);
                    setReportFilters({
                      dateRange: 'all',
                      category: '',
                      paymentMethod: '',
                      customFrom: '',
                      customTo: ''
                    });
                  }}
                  className="mb-3 w-10 h-10 flex items-center justify-center rounded-full border-2 transition-colors duration-200 active:scale-95 touch-manipulation"
                  style={{ borderColor: colors.primaryGreen, color: colors.primaryGreen }}
                  title="Back to search"
                >
                  <span className="text-xl font-bold" style={{ transform: isRTL ? 'scaleX(-1)' : 'none', display: 'inline-block' }}>←</span>
                </button>

                {/* Summary Stats - Fixed */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 flex-shrink-0">
                  <div className="p-4 rounded-lg text-center" style={{ background: colors.background }}>
                    <div className="text-2xl font-bold" style={{ color: colors.primaryGreen }}>{reportItems.length}</div>
                    <div className="text-sm" style={{ color: colors.muted }}>Total Expenses</div>
                  </div>
                  <div className="p-4 rounded-lg text-center" style={{ background: colors.background }}>
                    <div className="text-2xl font-bold" style={{ color: colors.gold }}>{amountFormatted(getTotalAmount(reportItems))}</div>
                    <div className="text-sm" style={{ color: colors.muted }}>Total Amount</div>
                  </div>
                  <div className="p-4 rounded-lg text-center" style={{ background: colors.background }}>
                    <div className="text-2xl font-bold" style={{ color: colors.primaryGreen }}>{Object.keys(getPaymentMethodBreakdown(reportItems)).length}</div>
                    <div className="text-sm" style={{ color: colors.muted }}>Payment Methods</div>
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
                    {isGeneratingPDF ? '⏳ Generating PDF...' : '📄 Export to PDF'}
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
                    📊 Export to Excel
                  </button>
                </div>
                
                {/* Category Breakdown */}
                <div className="mb-6">
                  <h4 className="text-lg font-semibold mb-3" style={{ color: colors.text }}>Category Breakdown</h4>
                  <div className="space-y-2">
                    {Object.entries(getCategoryBreakdown(reportItems))
                      .sort(([,a], [,b]) => b - a)
                      .map(([category, amount]) => (
                        <div key={category} className="flex justify-between items-center p-3 rounded-lg" style={{ background: colors.background }}>
                          <span className="font-medium" style={{ color: colors.text }}>{category}</span>
                          <span className="font-bold" style={{ color: colors.text }}>{amountFormatted(amount)}</span>
                        </div>
                      ))}
                  </div>
                </div>
                
                {/* Payment Method Breakdown */}
                <div className="mb-6">
                  <h4 className="text-lg font-semibold mb-3" style={{ color: colors.text }}>Payment Method Breakdown</h4>
                  <div className="space-y-2">
                    {Object.entries(getPaymentMethodBreakdown(reportItems))
                      .sort(([,a], [,b]) => b - a)
                      .map(([method, amount]) => (
                        <div key={method} className="flex justify-between items-center p-3 rounded-lg" style={{ background: colors.background }}>
                          <span className="font-medium" style={{ color: colors.text }}>{method}</span>
                          <span className="font-bold" style={{ color: colors.text }}>{amountFormatted(amount)}</span>
                        </div>
                      ))}
                  </div>
                </div>
                
                {/* Detailed List */}
                <div>
                  <h4 className="text-lg font-semibold mb-3" style={{ color: colors.text }}>Expense Details</h4>
                  <div className="space-y-3">
                    {reportItems.map(expense => renderExpenseCard(expense))}
                  </div>
                </div>
              </div>
            )}
            
            {/* No Results Message */}
            {showSearchResults && reportItems.length === 0 && !reportLoading && (
              <div className="text-center py-8" style={{ color: colors.muted }}>
                {reportFilters.dateRange === "all" && !reportFilters.category 
                  ? "No expenses found. Try adding some expenses first."
                  : "No expenses match your current filters. Try adjusting the criteria."
                }
              </div>
            )}
            
            
            </div>
          </div>
        </div>
      )}

      {/* Photo Viewer Modal */}
      {photoViewerOpen && selectedPhoto && (
        <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl w-full h-full sm:h-auto sm:max-w-4xl sm:max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-3 sm:p-4 border-b">
              <h3 className="text-lg sm:text-xl font-bold text-gray-800">Receipt: {selectedPhoto.title}</h3>
              <button 
                onClick={() => setPhotoViewerOpen(false)}
                className="text-gray-600 hover:text-gray-800 text-xl sm:text-2xl font-bold"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto p-2 sm:p-4">
              <img
                src={selectedPhoto.url}
                alt="Receipt"
                className="w-full h-auto max-h-full object-contain"
              />
            </div>
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
              <h3 className="text-xl font-bold text-white">Expense Saved</h3>
            </div>

            {/* Summary content */}
            <div className="p-5 space-y-3">
              {savedExpenseSummary.photoUrl && (
                <div className="flex justify-center">
                  <img src={savedExpenseSummary.photoUrl} alt="Receipt" className="w-20 h-20 object-cover rounded-lg border" style={{ borderColor: colors.gray400 }} />
                </div>
              )}

              <div className="text-center">
                <h4 className="text-lg font-bold" style={{ color: colors.text }}>{savedExpenseSummary.title}</h4>
                <p className="text-2xl font-extrabold mt-1" style={{ color: colors.primaryGreen }}>{amountFormatted(savedExpenseSummary.amount)}</p>
              </div>

              <div className="space-y-2 text-sm" style={{ color: colors.muted }}>
                <div className="flex justify-between items-center">
                  <span>Category</span>
                  <span className="font-semibold px-2 py-0.5 rounded-full text-white text-xs" style={{ background: colors.primaryGreen }}>
                    {savedExpenseSummary.category === 'Other' ? savedExpenseSummary.categoryOther : savedExpenseSummary.category}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Payment</span>
                  <span className="font-medium" style={{ color: colors.text }}>💳 {savedExpenseSummary.reimbursementMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date</span>
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
                Approve
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
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      <DatePickerModal open={datePickerOpen} mode="single" title="Choose expense date" onClose={()=>setDatePickerOpen(false)} onSelect={({date})=>{ setForm(f=>({...f,expenseDate:date})); setDatePickerOpen(false); }} />

      {/* Edit Expense Modal */}
      {editingExpense && (
        <div className="fixed inset-0 z-[57] bg-black/50 flex items-center justify-center p-2 sm:p-4">
          <div className="rounded-2xl w-full h-full sm:h-auto sm:max-w-2xl mx-0 sm:mx-4 flex flex-col" style={{ background: colors.surface, maxHeight: '90vh' }}>
            {/* Header - Fixed */}
            <div className="flex items-center justify-between p-3 sm:p-5 pb-4 border-b" style={{ borderColor: colors.gray400 }}>
              <h3 className="text-xl sm:text-2xl font-bold" style={{ color: colors.text }}>Edit Expense</h3>
              <button onClick={handleCloseEditModal} className="text-xl sm:text-2xl font-bold transition-colors duration-200" style={{ color: colors.muted }} onMouseEnter={(e) => e.target.style.color = colors.text} onMouseLeave={(e) => e.target.style.color = colors.muted }>✕</button>
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-5 pt-0">
              <div className="grid grid-cols-1 gap-3 sm:gap-4">
                <input className="w-full px-3 sm:px-4 py-3 rounded-xl border text-base sm:text-lg" placeholder="Title" value={form.title} onChange={(e)=>setForm(f=>({...f,title:e.target.value}))} />
                <input className="w-full px-3 sm:px-4 py-3 rounded-xl border text-base sm:text-lg" placeholder="Amount (₪)" type="text" inputMode="decimal" value={form.amount} onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) { setForm(f => ({ ...f, amount: val })); } }} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select className="w-full px-3 sm:px-4 py-3 rounded-xl border text-base sm:text-lg" value={form.category} onChange={(e)=>setForm(f=>({...f,category:e.target.value}))}>
                    {CATEGORIES.map(c=> <option key={c} value={c}>{c}</option>)}
                  </select>
                  {form.category === "Other" && (
                    <input className="w-full px-3 sm:px-4 py-3 rounded-xl border text-base sm:text-lg" placeholder="Other category" value={form.categoryOther} onChange={(e)=>setForm(f=>({...f,categoryOther:e.target.value}))} />
                  )}
                </div>
                <select className="w-full px-3 sm:px-4 py-3 rounded-xl border text-base sm:text-lg" value={form.reimbursementMethod} onChange={(e)=>setForm(f=>({...f,reimbursementMethod:e.target.value}))}>
                  {REIMBURSEMENT_METHODS.map(m=> <option key={m} value={m}>{m}</option>)}
                </select>
                <div>
                  <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                    <button onClick={()=>setForm(f=>({...f,expenseDate:new Date().toISOString().slice(0,10)}))} className="w-full sm:w-auto px-4 py-2 rounded-full text-sm font-semibold text-white" style={{ background: colors.gold }}>Today</button>
                    <button onClick={()=>setDatePickerOpen(true)} className="w-full sm:w-auto px-4 py-2 rounded-full text-sm font-semibold border" style={{ borderColor: colors.primaryGreen, color: colors.primaryGreen }}>Other date</button>
                  </div>
                  {form.expenseDate && (
                    <div className="mt-2 text-sm" style={{ color: colors.text }}>Selected: {new Date(form.expenseDate).toLocaleDateString()}</div>
                  )}
                </div>
                <textarea className="w-full px-3 sm:px-4 py-3 rounded-xl border text-base sm:text-lg" placeholder={i18n.t('notes_hebrew_only', { ns: 'admin' })} value={form.notes} onChange={(e)=>setForm(f=>({...f,notes:e.target.value.replace(/[a-zA-Z]/g,'')}))} dir="rtl" />
                
                {/* Photo Upload Section */}
                <div className="rounded-xl p-3 sm:p-4" style={{ background: colors.background }}>
                  <h3 className="font-semibold mb-3 text-center" style={{ color: colors.text }}>Receipt Photo</h3>
                  <PhotoUpload
                    key={`photo-${form.photoUrl}-${Date.now()}`}
                    onPhotoUploaded={handlePhotoUploaded}
                    onPhotoRemoved={handlePhotoRemoved}
                    currentPhotoUrl={form.photoUrl}
                    uploadPath="expenses"
                  />
                </div>
              </div>
            </div>
            
            {/* Footer - Fixed */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 p-3 sm:p-5 pt-4 border-t" style={{ borderColor: colors.gray400 }}>
              <button onClick={handleUpdateExpense} disabled={saving} className="w-full sm:w-auto px-4 sm:px-6 py-3 rounded-lg font-semibold text-white" style={{ background: colors.primaryGreen }}>
                {saving ? 'Updating...' : 'Update Expense'}
              </button>
              <button onClick={handleCloseEditModal} className="w-full sm:w-auto px-4 sm:px-6 py-3 rounded-lg font-semibold text-white" style={{ background: colors.red }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && expenseToDelete && (
        <div className="fixed inset-0 z-[58] bg-black/50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl w-full max-w-md mx-2 sm:mx-0 p-4 sm:p-6 text-center">
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4">Confirm Deletion</h3>
            <p className="text-sm sm:text-base text-gray-700 mb-3 sm:mb-4">Are you sure you want to delete this expense?</p>
            <p className="text-red-600 font-semibold mb-4 text-sm sm:text-base">This action cannot be undone.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <button onClick={confirmDeleteExpense} className="w-full sm:w-auto px-4 sm:px-6 py-3 rounded-lg font-semibold text-white" style={{ background: colors.red }}>
                Delete
              </button>
              <button onClick={() => setDeleteConfirmOpen(false)} className="w-full sm:w-auto px-4 sm:px-6 py-3 rounded-lg font-semibold text-white" style={{ background: colors.primaryGreen }}>
                Cancel
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
              <h3 className="text-xl sm:text-2xl font-bold text-gray-800">All Refund Requests</h3>
              <button onClick={() => setAllRefundsOpen(false)} className="text-gray-600 text-2xl">✕</button>
            </div>
            
            {/* Sort controls */}
            <div className="flex items-center gap-3 mb-4">
              <label className="text-sm font-medium text-gray-700">Sort by:</label>
              <select 
                value={refundSortOrder} 
                onChange={(e) => setRefundSortOrder(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                <option value="latest">Latest First</option>
                <option value="earliest">Earliest First</option>
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
                  <div key={request.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                             <div className="flex-1">
                         <h5 className="font-bold text-xl text-gray-800 mb-2">{request.title}</h5>
                         <p className="text-gray-700 text-lg font-semibold mb-1">Amount: ₪{request.amount}</p>
                         <p className="text-gray-600 text-base font-medium mb-1">Method: {request.repaymentMethod}</p>
                         <p className="text-gray-600 text-base font-medium mb-1">From: {request.ownerName} (Room {request.ownerRoomNumber})</p>
                         <p className="text-gray-500 text-base">Date: {request.expenseDate?.toDate?.()?.toLocaleDateString?.() || 'No date'}</p>
                       </div>
                      <div className="flex flex-col gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold text-center ${
                          request.status === 'waiting' ? 'bg-yellow-100 text-yellow-800' : 
                          request.status === 'approved' ? 'bg-green-100 text-green-800' : 
                          'bg-red-100 text-red-800'
                        }`}>
                          {request.status}
                        </span>
                        
                        {/* Action buttons for waiting requests */}
                        {request.status === 'waiting' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApproveRefund(request.id)}
                              className="px-3 py-1 rounded text-xs font-semibold border-2"
                              style={{ 
                                borderColor: colors.primaryGreen, 
                                color: colors.primaryGreen,
                                background: 'transparent'
                              }}
                            >
                              ✅ Approve
                            </button>
                            <button
                              onClick={() => handleDenyRefund(request.id)}
                              className="px-3 py-1 rounded text-xs font-semibold border-2"
                              style={{ 
                                borderColor: colors.red, 
                                color: colors.red,
                                background: 'transparent'
                              }}
                            >
                              ❌ Deny
                            </button>
                          </div>
                        )}
                      </div>
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
                Close
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
                <h3 className="text-xl sm:text-2xl font-bold text-gray-800">Past Refund Requests</h3>
                <button onClick={() => setPastRefundsOpen(false)} className="text-gray-600 text-2xl">✕</button>
              </div>
              
              {/* Statistics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {refundRequests.filter(r => r.status === 'approved').length}
                  </div>
                  <div className="text-sm text-gray-600">Approved</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {refundRequests.filter(r => r.status === 'denied').length}
                  </div>
                  <div className="text-sm text-gray-600">Denied</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {refundRequests.filter(r => r.status === 'waiting').length}
                  </div>
                  <div className="text-sm text-gray-600">Pending</div>
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
                  {isGeneratingPDF ? '⏳ Generating PDF...' : '📊 Export as PDF'}
                </button>
              </div>
              
              {/* Search */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={refundSearchTerm}
                  onChange={(e) => setRefundSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              
              {/* Past refunds list */}
              <div className="space-y-3">
                {refundRequests
                  .filter(request => 
                    request.status !== 'waiting' && 
                    (refundSearchTerm === '' || 
                     request.ownerName?.toLowerCase().includes(refundSearchTerm.toLowerCase()))
                  )
                  .sort((a, b) => {
                    const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
                    const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
                    return dateB - dateA; // Latest first
                  })
                  .map(request => (
                    <div key={request.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                               <div className="flex-1">
                           <h5 className="font-bold text-xl text-gray-800 mb-2">{request.title}</h5>
                           <p className="text-gray-700 text-lg font-semibold mb-1">Amount: ₪{request.amount}</p>
                           <p className="text-gray-600 text-base font-medium mb-1">Method: {request.repaymentMethod}</p>
                           <p className="text-gray-600 text-base font-medium mb-1">From: {request.ownerName} (Room {request.ownerRoomNumber})</p>
                           <p className="text-gray-500 text-base mb-1">Date: {request.expenseDate?.toDate?.()?.toLocaleDateString?.() || 'No date'}</p>
                           {request.status === 'approved' && request.receiptPhotoUrl && (
                             <button
                               onClick={() => {
                                 setSelectedPhoto({ url: request.receiptPhotoUrl, title: `Receipt for ${request.title}` });
                                 setPhotoViewerOpen(true);
                               }}
                               className="text-blue-600 hover:text-blue-800 text-base font-medium underline"
                             >
                               📷 Show Receipt
                             </button>
                           )}
                         </div>
                        <div className="flex flex-col gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold text-center ${
                            request.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {request.status}
                          </span>
                          
                          {/* Edit button for past requests */}
                          <button
                            onClick={() => {
                              setApprovingRefundId(request.id);
                              setApprovingRefundData(request);
                              // Initialize receipt photo if one exists
                              if (request.receiptPhotoUrl) {
                                setReceiptPhoto({ url: request.receiptPhotoUrl, path: request.photoPath || '' });
                              } else {
                                setReceiptPhoto(null);
                              }
                              setApproveModalOpen(true);
                            }}
                            className="px-3 py-1 rounded text-xs font-semibold border-2"
                            style={{ 
                              borderColor: colors.gold, 
                              color: colors.gold,
                              background: 'transparent'
                            }}
                          >
                            ✏️ Edit
                          </button>
                        </div>
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
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approve Refund Modal */}
      {approveModalOpen && approvingRefundData && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl w-full h-full sm:h-auto sm:max-w-md mx-0 sm:mx-4 p-3 sm:p-5 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 border-b pb-3 border-gray-200">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-800">
                {approvingRefundData.status === 'waiting' ? 'Approve Refund Request' : 'Edit Refund Request'}
              </h3>
              <button onClick={() => {
                setApproveModalOpen(false);
                setReceiptPhoto(null);
              }} className="text-gray-600 hover:text-gray-800 text-2xl transition-colors">✕</button>
            </div>
            
            <div className="flex-1 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-lg mb-2 text-gray-800">{approvingRefundData.title}</h4>
                <p className="text-gray-700 text-base mb-1">Amount: ₪{approvingRefundData.amount}</p>
                <p className="text-gray-600 text-base mb-1">From: {approvingRefundData.ownerName} (Room {approvingRefundData.ownerRoomNumber})</p>
                {approvingRefundData.status !== 'waiting' && (
                  <p className="text-gray-600 text-base">Current Status: {approvingRefundData.status}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Receipt Photo</label>
                
                {/* Show existing receipt if available */}
                {approvingRefundData.receiptPhotoUrl && !receiptPhoto && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">Current receipt:</p>
                    <div className="relative">
                      <img
                        src={approvingRefundData.receiptPhotoUrl}
                        alt="Current receipt"
                        className="w-full h-48 object-cover rounded-lg border"
                      />
                      <button
                        onClick={() => {
                          setReceiptPhoto({ url: approvingRefundData.receiptPhotoUrl, path: approvingRefundData.photoPath || '' });
                        }}
                        className="absolute top-2 right-2 bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-blue-600 transition-colors"
                        title="Use this receipt"
                      >
                        ✓
                      </button>
                    </div>
                  </div>
                )}
                
                <PhotoUpload
                  onPhotoUploaded={(photoUrl, photoPath) => {
                    // Store the photo URL for the receipt
                    setReceiptPhoto({ url: photoUrl, path: photoPath });
                  }}
                  onPhotoRemoved={() => {
                    setReceiptPhoto(null);
                  }}
                  currentPhotoUrl={receiptPhoto?.url || null}
                  uploadPath={`refunds/${approvingRefundData.ownerUid || 'admin'}`}
                />
              </div>
            </div>
            
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              {approvingRefundData.status === 'waiting' ? (
                // For waiting requests: Approve or Deny
                <>
                  <button
                    onClick={() => confirmApproveRefund(receiptPhoto?.url || '')}
                    disabled={!receiptPhoto?.url}
                    className="flex-1 px-4 sm:px-6 py-3 rounded-lg font-semibold text-white text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: colors.primaryGreen }}
                  >
                    Save & Approve
                  </button>
                  <button
                    onClick={() => confirmApproveRefund('')}
                    className="flex-1 px-4 sm:px-6 py-3 rounded-lg font-semibold text-white text-lg"
                    style={{ background: colors.gold }}
                  >
                    Go Without Receipt
                  </button>
                </>
              ) : (
                // For past requests: Change status options
                <>
                  <button
                    onClick={() => handleStatusChange('approved', receiptPhoto?.url || '')}
                    disabled={!receiptPhoto?.url}
                    className="flex-1 px-4 sm:px-6 py-3 rounded-lg font-semibold text-white text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: colors.primaryGreen }}
                  >
                    Approve Request
                  </button>
                  <button
                    onClick={() => handleStatusChange('denied', '')}
                    className="flex-1 px-4 sm:px-6 py-3 rounded-lg font-semibold text-white text-lg"
                    style={{ background: colors.red }}
                  >
                    Deny Request
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Export PDF Modal */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 p-5">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-gray-800 mb-2">Export Refund Requests</h3>
              <p className="text-gray-600">Choose the date range for your PDF export</p>
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
                <span className="text-gray-700 font-medium">Past Day</span>
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
                <span className="text-gray-700 font-medium">Past Week</span>
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
                <span className="text-gray-700 font-medium">Past Month</span>
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
                <span className="text-gray-700 font-medium">Custom Dates</span>
              </label>
            </div>
            
            {/* Custom Date Inputs */}
            {exportDateRange === 'custom' && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                  <StyledDateTimeInput
                    value={exportCustomFrom || ''}
                    onChange={(e) => setExportCustomFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
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
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (isGeneratingPDF) return;

                  setIsGeneratingPDF(true);
                  setPdfProgressText(i18n.t('pdf_generating', { ns: 'admin' }));

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
                        setPdfProgressText(`Loading image ${current}/${total}...`);
                      },
                    });
                    setSuccess(i18n.t('pdf_success', { ns: 'admin' }));
                    setExportModalOpen(false);
                  } catch (err) {
                    setError(i18n.t('pdf_error', { ns: 'admin' }));
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
                {isGeneratingPDF ? 'Generating PDF...' : 'Export PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isGeneratingPDF && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 shadow-xl flex flex-col items-center gap-2 min-w-[220px]">
            <HouseLoader size={70} text={pdfProgressText || i18n.t('pdf_generating', { ns: 'admin' })} />
          </div>
        </div>
      )}

      <AdminBottomNavBar active="expenses" />
    </main>
  );
}
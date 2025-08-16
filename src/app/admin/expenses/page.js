"use client";

import { useEffect, useRef, useState } from "react";
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
import colors from "@/app/colors";

function ApprovalRequestsBody({ items, loading, onApprove, onReject, processingId }) {
  return (
    <div className="flex-1 overflow-auto">
      {loading ? (
        <div className="p-4">Loading...</div>
      ) : items.length === 0 ? (
        <div className="p-4">No pending approval requests</div>
      ) : (
        <ul className="space-y-3">
          {items.map((req) => (
            <li key={req.id} className="bg-white rounded-xl border p-4 shadow">
              <div className="flex items-start gap-3">
                <span className="text-2xl">👤</span>
                <div className="flex-1">
                  <div className="font-semibold text-lg">{req.userName || req.firstName || ''} {req.lastName || ''}</div>
                  {req.userEmail && <div className="text-sm text-gray-600">{req.userEmail}</div>}
                  {req.jobTitle && <div className="text-sm text-gray-600">Job: {req.jobTitle}</div>}
                  <div className="text-xs text-gray-500 mt-1">Requested: {req.createdAt?.toDate?.()?.toLocaleString?.() || ''}</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => onApprove && onApprove(req)}
                  disabled={processingId === req.id}
                  className="px-4 py-2 rounded-lg font-semibold text-white flex items-center justify-center gap-1"
                  style={{ background: colors.primaryGreen }}
                >
                  <span>✅</span> <span>{processingId === req.id ? 'Processing...' : 'Accept'}</span>
                </button>
                <button
                  onClick={() => onReject && onReject(req)}
                  disabled={processingId === req.id}
                  className="px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-1"
                  style={{ borderColor: '#dc2626', color: '#dc2626', borderWidth: 2, borderStyle: 'solid' }}
                >
                  <span>❌</span> <span>Deny</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const CATEGORIES = ["Food","Equipment","Maintenance","Transport","Utilities","Other"];
const REIMBURSEMENT_METHODS = ["Credit Card","Bank Transfer","Cash","Other"];

export default function AdminExpensesPage() {
  const router = useRouter();
  const [userDoc, setUserDoc] = useState(null);

  const [form, setForm] = useState({
    title: "",
    amount: "",
    category: "Food",
    categoryOther: "",
    reimbursementMethod: "Credit Card",
    notes: "",
    linkedSoldierUid: "",
    expenseDate: new Date().toISOString().slice(0,16),
    photoUrl: "",
    photoPath: "",
  });
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // List state
  const [items, setItems] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [filters, setFilters] = useState({ from: "", to: "", category: "" });
  const [expandedId, setExpandedId] = useState(null);

  // Report modal state
  const [reportOpen, setReportOpen] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [reportItems, setReportItems] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportFilters, setReportFilters] = useState({
    dateRange: "all",
    category: "",
    customFrom: "",
    customTo: ""
  });

  // Edit/Delete state
  const [editingExpense, setEditingExpense] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);

  // Photo viewer state
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  // Approval state
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalItems, setApprovalItems] = useState([]);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalProcessingId, setApprovalProcessingId] = useState("");

  // Prevent background scrolling when modals are open
  useEffect(() => {
    if (reportOpen || editingExpense || deleteConfirmOpen || photoViewerOpen || approvalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup function to restore scrolling when component unmounts
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [reportOpen, editingExpense, deleteConfirmOpen, photoViewerOpen, approvalOpen]);

  // Access control: only admins
  useEffect(() => {
    const check = async () => {
      try {
        console.log('Checking user access...');
        const user = auth.currentUser;
        if (!user) { 
          console.log('No user, redirecting to /');
          router.push("/"); 
          return; 
        }
        
        console.log('User found:', user.uid);
        const uRef = doc(db, "users", user.uid);
        const uSnap = await getDoc(uRef);
        
        if (!uSnap.exists()) { 
          console.log('User doc does not exist, redirecting to /home');
          router.push("/home"); 
          return; 
        }
        
        const userData = uSnap.data();
        console.log('User data:', userData);
        
        if (userData?.userType !== "admin") { 
          console.log('User is not admin, redirecting to /home');
          router.push("/home"); 
          return; 
        }
        
        console.log('User is admin, setting userDoc');
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

  const handlePhotoUploaded = (photoUrl, photoPath) => {
    console.log('Photo uploaded:', photoUrl, photoPath);
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
  };

  const handleEditExpense = (expense) => {
    // Remember the current view state before editing
    const wasInSearchResults = showSearchResults;
    
    setEditingExpense(expense);
    setForm({
      title: expense.title || "",
      amount: expense.amount?.toString() || "",
      category: expense.category || "Food",
      categoryOther: expense.categoryOther || "",
      reimbursementMethod: expense.reimbursementMethod || "Credit Card",
      notes: expense.notes || "",
      linkedSoldierUid: expense.linkedSoldierUid || "",
      expenseDate: expense.expenseDate?.toDate?.()?.toISOString().slice(0,16) || new Date().toISOString().slice(0,16),
      photoUrl: expense.photoUrl || "",
      photoPath: expense.photoPath || "",
    });
    setReportOpen(false);
    
    // Store the view state to restore later
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
      setForm({
        title: "",
        amount: "",
        category: "Food",
        categoryOther: "",
        reimbursementMethod: "Credit Card",
        notes: "",
        linkedSoldierUid: "",
        expenseDate: new Date().toISOString().slice(0,16),
        photoUrl: "",
        photoPath: "",
      });
      
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
    setError(""); setSuccess("");
    const v = validate(); if (v) { showError(v); return; }
    try {
      setSaving(true);
      const user = auth.currentUser; if (!user) { showError("Please sign in again"); return; }
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
      await addDoc(collection(db, "expenses"), payload);
      showSuccess("Expense saved");
      
      // Reset form completely including photo
      setForm({ 
        title: "", 
        amount: "", 
        category: "Food", 
        categoryOther: "", 
        reimbursementMethod: "Credit Card", 
        notes: "", 
        linkedSoldierUid: "", 
        expenseDate: new Date().toISOString().slice(0,16),
        photoUrl: "",
        photoPath: "",
      });
      
      // Refresh the expenses list
      await fetchList();
      
    } catch (e) {
      showError(e?.message || "Failed to save expense");
    } finally { setSaving(false); }
  };

  const fetchList = async () => {
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
  };

  useEffect(() => { fetchList(); }, []);

  const amountFormatted = (amt) => new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS" }).format(amt || 0);

  // Report and approvals (kept minimal, unchanged)
  const fetchPendingRequests = async () => {
    try { setApprovalLoading(true); const qReq = query(collection(db, 'approvalRequests'), where('status','==','pending')); const snap = await getDocs(qReq); setApprovalItems(snap.docs.map(d=>({ id:d.id, ...d.data() }))); } finally { setApprovalLoading(false); }
  };

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
    console.log('fetchReportData called');
    console.log('Current filters:', reportFilters);
    setReportLoading(true);
    try {
      // Super simple query - fetch all expenses without any constraints
      console.log('Fetching all expenses...');
      const querySnapshot = await getDocs(collection(db, "expenses"));
      console.log('Query completed, docs found:', querySnapshot.docs.length);
      
      // Convert to array
      let expenses = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Apply category filtering in JavaScript
      if (reportFilters.category) {
        console.log('Filtering by category:', reportFilters.category);
        expenses = expenses.filter(expense => expense.category === reportFilters.category);
        console.log('After category filter:', expenses.length, 'expenses');
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
          console.log('Filtering by date from:', startDate);
          expenses = expenses.filter(expense => {
            const expenseDate = expense.expenseDate?.toDate?.() || new Date(expense.expenseDate);
            return expenseDate >= startDate;
          });
          console.log('After date filter:', expenses.length, 'expenses');
        }
      }
      
      // Sort by date (newest first)
      expenses.sort((a, b) => {
        const dateA = a.expenseDate?.toDate?.() || new Date(a.expenseDate);
        const dateB = b.expenseDate?.toDate?.() || new Date(b.expenseDate);
        return dateB - dateA;
      });
      
      console.log('Search results after filtering:', expenses.length, 'expenses found');
      console.log('First expense sample:', expenses[0]);
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

  const exportToPDF = () => {
    if (reportItems.length === 0) return;
    
    // Create PDF content using jsPDF-like structure
    const pdfContent = {
      title: 'Expenses Report',
      generatedOn: new Date().toLocaleDateString(),
      totalExpenses: reportItems.length,
      totalAmount: amountFormatted(getTotalAmount(reportItems)),
      expenses: reportItems.map(expense => ({
        title: expense.title || '',
        category: expense.category || '',
        amount: amountFormatted(expense.amount || 0),
        date: expense.expenseDate?.toDate?.()?.toLocaleDateString?.() || 'No date',
        notes: expense.notes || '',
        reimbursementMethod: expense.reimbursementMethod || '',
        photoUrl: expense.photoUrl || null
      }))
    };

    // Create HTML content for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Expenses Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: bold; color: #333; margin-bottom: 10px; }
            .subtitle { font-size: 14px; color: #666; margin-bottom: 5px; }
            .summary { display: flex; justify-content: space-around; margin: 30px 0; }
            .summary-item { text-align: center; }
            .summary-value { font-size: 20px; font-weight: bold; color: #2563eb; }
            .summary-label { font-size: 12px; color: #666; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f8f9fa; font-weight: bold; }
            .amount { text-align: right; }
            .category { color: #666; }
            .notes { font-size: 12px; color: #666; max-width: 200px; }
            .photo-link { text-align: center; }
            .photo-link a { color: #2563eb; text-decoration: underline; }
            .photo-link a:hover { color: #1d4ed8; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${pdfContent.title}</div>
            <div class="subtitle">Generated on: ${pdfContent.generatedOn}</div>
          </div>
          
          <div class="summary">
            <div class="summary-item">
              <div class="summary-value">${pdfContent.totalExpenses}</div>
              <div class="summary-label">Total Expenses</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">${pdfContent.totalAmount}</div>
              <div class="summary-label">Total Amount</div>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Notes</th>
                <th>Reimbursement Method</th>
                <th>Photo</th>
              </tr>
            </thead>
            <tbody>
              ${pdfContent.expenses.map(expense => `
                <tr>
                  <td>${expense.title}</td>
                  <td class="category">${expense.category}</td>
                  <td class="amount">${expense.amount}</td>
                  <td>${expense.date}</td>
                  <td class="notes">${expense.notes}</td>
                  <td>${expense.reimbursementMethod}</td>
                  <td class="photo-link">
                    ${expense.photoUrl ? 
                      `<a href="${expense.photoUrl}" target="_blank" style="color: #2563eb; text-decoration: underline;">View Receipt</a>` : 
                      '<span style="color: #999;">No photo</span>'
                    }
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    // Create and download the HTML file (can be opened in browser and printed to PDF)
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `expenses_report_${new Date().toISOString().slice(0, 10)}.html`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Show success message
    setSuccess('PDF report downloaded! Open the HTML file in your browser and use Print → Save as PDF');
  };

  const exportToExcel = () => {
    if (reportItems.length === 0) return;
    
    // Create CSV content (Excel can open CSV files)
    const headers = ['Title', 'Category', 'Amount', 'Date', 'Notes', 'Reimbursement Method', 'Photo URL'];
    const csvContent = [
      headers.join(','),
      ...reportItems.map(expense => [
        `"${(expense.title || '').replace(/"/g, '""')}"`,
        `"${(expense.category || '').replace(/"/g, '""')}"`,
        expense.amount || 0,
        `"${expense.expenseDate?.toDate?.()?.toLocaleDateString?.() || 'No date'}"`,
        `"${(expense.notes || '').replace(/"/g, '""')}"`,
        `"${(expense.reimbursementMethod || '').replace(/"/g, '""')}"`,
        `"${expense.photoUrl || 'No photo'}"`
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

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-200/60 to-green-100/60 font-body flex flex-col items-center pt-6 pb-32 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 rounded-2xl p-6 shadow-xl" style={{ background: "rgba(0,0,0,0.22)" }}>
          <h2 className="text-white font-extrabold text-2xl mb-4">Add Expense</h2>
          {error && <div className="mb-3 text-red-600 text-sm bg-white rounded px-3 py-2">{error}</div>}
          {success && <div className="mb-3 text-green-700 text-sm bg-white rounded px-3 py-2">{success}</div>}
          <div className="grid grid-cols-1 gap-4">
            <input className="w-full px-4 py-3 rounded-xl border text-lg" placeholder="Title" value={form.title} onChange={(e)=>setForm(f=>({...f,title:e.target.value}))} />
            <input className="w-full px-4 py-3 rounded-xl border text-lg" placeholder="Amount (₪)" inputMode="decimal" value={form.amount} onChange={(e)=>setForm(f=>({...f,amount:e.target.value}))} />
            <div className="grid grid-cols-2 gap-3">
              <select className="w-full px-4 py-3 rounded-xl border text-lg" value={form.category} onChange={(e)=>setForm(f=>({...f,category:e.target.value}))}>
                {CATEGORIES.map(c=> <option key={c} value={c}>{c}</option>)}
              </select>
              {form.category === "Other" && (
                <input className="w-full px-4 py-3 rounded-xl border text-lg" placeholder="Other category" value={form.categoryOther} onChange={(e)=>setForm(f=>({...f,categoryOther:e.target.value}))} />
              )}
            </div>
            <select className="w-full px-4 py-3 rounded-xl border text-lg" value={form.reimbursementMethod} onChange={(e)=>setForm(f=>({...f,reimbursementMethod:e.target.value}))}>
              {REIMBURSEMENT_METHODS.map(m=> <option key={m} value={m}>{m}</option>)}
            </select>
            <div>
              <div className="flex gap-2 items-center">
                <button onClick={()=>setForm(f=>({...f,expenseDate:new Date().toISOString().slice(0,16)}))} className="px-4 py-2 rounded-full text-sm font-semibold text-white" style={{ background: colors.gold }}>Today</button>
                <button onClick={()=>setDatePickerOpen(true)} className="px-4 py-2 rounded-full text-sm font-semibold border" style={{ borderColor: colors.primaryGreen, color: colors.primaryGreen }}>Other date</button>
              </div>
              {form.expenseDate && (
                <div className="mt-2 text-white text-sm">Selected: {new Date(form.expenseDate).toLocaleString()}</div>
              )}
            </div>
            <textarea className="w-full px-4 py-3 rounded-xl border text-lg" placeholder="Notes (optional)" value={form.notes} onChange={(e)=>setForm(f=>({...f,notes:e.target.value}))} />
            
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
            
            <button onClick={handleSave} disabled={saving} className="w-full px-4 py-3 rounded-xl text-white font-semibold disabled:opacity-70 text-lg" style={{ background: colors.gold }}>{saving?"Saving...":"Save Expense"}</button>
          </div>
        </div>

        {/* Expenses List with Photos */}
        <div className="mb-3 rounded-2xl p-5 shadow-xl" style={{ background: "rgba(0,0,0,0.22)" }}>
          <div className="flex items-center justify-between"><h3 className="text-white font-extrabold text-xl">Expenses</h3></div>
          <button onClick={()=>{ setReportOpen(true); setShowSearchResults(false); }} className="w-full mt-4 px-6 py-4 rounded-full text-white font-bold text-lg" style={{ background: colors.gold }}>View Expenses</button>
          <button onClick={()=>{ fetchPendingRequests(); setApprovalOpen(true); }} className={`w-full mt-3 px-6 py-4 rounded-full font-bold text-lg flex items-center justify-center gap-2 ${approvalItems.length>0 ? 'text-white' : ''}`} style={approvalItems.length>0 ? { background: colors.primaryGreen } : { borderColor: colors.primaryGreen, color: colors.white, borderWidth: 2, borderStyle: 'solid' }}>
            <span>{`Pending (${approvalItems.length})`}</span>
          </button>
        </div>
      </div>

      {/* Comprehensive Report Modal */}
      {reportOpen && (
        <div className="fixed inset-0 z-[55] bg-black/50 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
          <div className="rounded-2xl w-full h-full sm:h-auto sm:max-h-[90vh] mx-0 sm:mx-4 p-3 sm:p-5 flex flex-col overflow-hidden" style={{ background: colors.surface }}>
            <div className="flex items-center justify-between mb-4 border-b pb-3 flex-shrink-0" style={{ borderColor: colors.gray400 }}>
              <h3 className="text-xl sm:text-2xl font-bold" style={{ color: colors.text }}>View Expenses</h3>
              <button onClick={handleCloseReportModal} className="text-xl sm:text-2xl font-bold transition-colors duration-200" style={{ color: colors.muted }} onMouseEnter={(e) => e.target.style.color = colors.text} onMouseLeave={(e) => e.target.style.color = colors.muted }>✕</button>
            </div>
            
            {/* Filters and Search Button - Only show when NOT displaying search results */}
            {!showSearchResults && (
              <>
                {/* Filters */}
                <div className="grid grid-cols-1 gap-3 sm:gap-4 mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg" style={{ background: colors.background }}>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>Date Range</label>
                    <select 
                      className="w-full px-3 py-2 border rounded-lg text-base"
                      style={{ borderColor: colors.gray400 }}
                      value={reportFilters.dateRange}
                      onChange={(e) => setReportFilters(prev => ({ ...prev, dateRange: e.target.value }))}
                    >
                      <option value="all">All Time</option>
                      <option value="lastDay">Last Day</option>
                      <option value="lastWeek">Last Week</option>
                      <option value="lastMonth">Last Month</option>
                      <option value="last3Months">Last 3 Months</option>
                      <option value="lastYear">Last Year</option>
                      <option value="custom">Custom Range</option>
                    </select>
                  </div>
                  
                  {reportFilters.dateRange === "custom" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>From</label>
                        <input 
                          type="date" 
                          className="w-full px-3 py-2 border rounded-lg text-base"
                          style={{ borderColor: colors.gray400 }}
                          value={reportFilters.customFrom}
                          onChange={(e) => setReportFilters(prev => ({ ...prev, customFrom: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>To</label>
                        <input 
                          type="date" 
                          className="w-full px-3 py-2 border rounded-lg text-base"
                          style={{ borderColor: colors.gray400 }}
                          value={reportFilters.customTo}
                          onChange={(e) => setReportFilters(prev => ({ ...prev, customTo: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>Category</label>
                    <select 
                      className="w-full px-3 py-2 border rounded-lg text-base"
                      style={{ borderColor: colors.gray400 }}
                      value={reportFilters.category}
                      onChange={(e) => setReportFilters(prev => ({ ...prev, category: e.target.value }))}
                    >
                      <option value="">All Categories</option>
                      {CATEGORIES.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Search Button */}
                <div className="flex justify-center mb-6 sm:mb-4 flex-shrink-0">
                  <button 
                    onClick={() => {
                      console.log('Search button clicked');
                      console.log('Current filters:', reportFilters);
                      fetchReportData();
                    }}
                    disabled={reportLoading}
                    className="w-full sm:w-auto px-6 py-3 border-2 font-bold text-base sm:text-lg rounded-lg transition-colors duration-200"
                    style={{ 
                      borderColor: colors.gold, 
                      color: colors.gold,
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
                        e.target.style.color = colors.gold;
                      }
                    }}
                  >
                    🔍 Search Expenses
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
                      {items.slice(0, expandedId === 'recent' ? items.length : 3).map(expense => (
                        <div key={expense.id} className="border rounded-lg p-3 sm:p-4 hover:bg-white transition-colors duration-200" style={{ borderColor: colors.gray400 }}>
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                            <div className="flex-1">
                              <h5 className="text-lg sm:text-xl font-bold mb-2" style={{ color: colors.text }}>{expense.title}</h5>
                              <p className="text-sm sm:text-base font-semibold mb-1" style={{ color: colors.primaryGreen }}>{expense.category}</p>
                              <p className="text-base sm:text-lg font-bold mb-2" style={{ color: colors.text }}>{amountFormatted(expense.amount)}</p>
                              <p className="text-xs sm:text-sm font-medium" style={{ color: colors.muted }}>
                                📅 {expense.expenseDate?.toDate?.()?.toLocaleDateString?.() || 'No date'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 sm:ml-3">
                              {expense.photoUrl && (
                                <img
                                  src={expense.photoUrl}
                                  alt="Receipt"
                                  className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded border cursor-pointer"
                                  onClick={() => {
                                    setSelectedPhoto({ url: expense.photoUrl, title: expense.title });
                                    setPhotoViewerOpen(true);
                                    // Don't close the report modal - user should return to where they were
                                  }}
                                  title="Click to view receipt"
                                />
                              )}
                              <div className="flex flex-col sm:flex-row gap-2">
                                <button
                                  onClick={() => handleEditExpense(expense)}
                                  className="px-3 sm:px-4 py-2 border-2 font-bold text-xs sm:text-sm rounded-lg transition-colors duration-200"
                                  style={{ borderColor: colors.primaryGreen, color: colors.primaryGreen }}
                                  onMouseEnter={(e) => {
                                    e.target.style.background = colors.primaryGreen;
                                    e.target.style.color = 'white';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.background = 'transparent';
                                    e.target.style.color = colors.primaryGreen;
                                  }}
                                  title="Edit expense"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteExpense(expense)}
                                  className="px-3 sm:px-4 py-2 border-2 font-bold text-xs sm:text-sm rounded-lg transition-colors duration-200"
                                  style={{ borderColor: colors.red, color: colors.red }}
                                  onMouseEnter={(e) => {
                                    e.target.style.background = colors.red;
                                    e.target.style.color = 'white';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.background = 'transparent';
                                    e.target.style.color = colors.red;
                                  }}
                                  title="Delete expense"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                          {expense.notes && (
                            <p className="text-xs sm:text-sm mt-3 p-2 rounded" style={{ color: colors.muted, background: colors.surface }}>{expense.notes}</p>
                          )}
                        </div>
                      ))}
                      
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
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Summary Stats - Fixed */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 flex-shrink-0">
                  <div className="p-4 rounded-lg text-center" style={{ background: colors.background }}>
                    <div className="text-2xl font-bold" style={{ color: colors.primaryGreen }}>{reportItems.length}</div>
                    <div className="text-sm" style={{ color: colors.muted }}>Total Expenses</div>
                  </div>
                  <div className="p-4 rounded-lg text-center" style={{ background: colors.background }}>
                    <div className="text-2xl font-bold" style={{ color: colors.gold }}>{amountFormatted(getTotalAmount(reportItems))}</div>
                    <div className="text-sm" style={{ color: colors.muted }}>Total Amount</div>
                  </div>
                </div>
                
                {/* Export Buttons - Fixed */}
                <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 mb-6 flex-shrink-0">
                  <button 
                    onClick={exportToPDF}
                    className="px-4 sm:px-6 py-3 border-2 font-bold text-base sm:text-lg rounded-lg transition-colors duration-200"
                    style={{ borderColor: colors.primaryGreen, color: colors.primaryGreen }}
                    onMouseEnter={(e) => {
                      e.target.style.background = colors.primaryGreen;
                      e.target.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'transparent';
                      e.target.style.color = colors.primaryGreen;
                    }}
                  >
                    📄 Export to PDF
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
                
                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto min-h-0">
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
                  
                  {/* Detailed List */}
                  <div>
                    <h4 className="text-lg font-semibold mb-3" style={{ color: colors.text }}>Expense Details</h4>
                    <div className="space-y-3">
                      {reportItems.map(expense => (
                        <div key={expense.id} className="border rounded-lg p-4 hover:bg-white transition-colors duration-200" style={{ borderColor: colors.gray400 }}>
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h5 className="text-xl font-bold mb-2" style={{ color: colors.text }}>{expense.title}</h5>
                              <p className="text-base font-semibold mb-1" style={{ color: colors.primaryGreen }}>{expense.category}</p>
                              <p className="text-sm font-medium mb-2" style={{ color: colors.muted }}>
                                📅 {expense.expenseDate?.toDate?.()?.toLocaleDateString?.() || 'No date'}
                              </p>
                              {expense.notes && (
                                <p className="text-sm mt-2 p-2 rounded" style={{ color: colors.muted, background: colors.surface }}>{expense.notes}</p>
                              )}
                            </div>
                            <div className="text-right ml-4">
                              <div className="text-xl font-bold mb-2" style={{ color: colors.text }}>{amountFormatted(expense.amount)}</div>
                              <div className="flex items-center gap-2 mt-2">
                                {expense.photoUrl && (
                                  <img
                                    src={expense.photoUrl}
                                    alt="Receipt"
                                    className="w-12 h-12 object-cover rounded border cursor-pointer"
                                    onClick={() => {
                                      setSelectedPhoto({ url: expense.photoUrl, title: expense.title });
                                      setPhotoViewerOpen(true);
                                      // Don't close the report modal - user should return to where they were
                                    }}
                                    title="Click to view receipt"
                                  />
                                )}
                                <div className="flex flex-col gap-1">
                                  <button
                                    onClick={() => handleEditExpense(expense)}
                                    className="px-4 py-2 border-2 font-bold text-sm rounded-lg transition-colors duration-200"
                                    style={{ borderColor: colors.primaryGreen, color: colors.primaryGreen }}
                                    onMouseEnter={(e) => {
                                      e.target.style.background = colors.primaryGreen;
                                      e.target.style.color = 'white';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.target.style.background = 'transparent';
                                      e.target.style.color = colors.primaryGreen;
                                    }}
                                    title="Edit expense"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteExpense(expense)}
                                    className="px-4 py-2 border-2 font-bold text-sm rounded-lg transition-colors duration-200"
                                    style={{ borderColor: colors.red, color: colors.red }}
                                    onMouseEnter={(e) => {
                                      e.target.style.background = colors.red;
                                      e.target.style.color = 'white';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.target.style.background = 'transparent';
                                      e.target.style.color = colors.red;
                                    }}
                                    title="Delete expense"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
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
            
            {/* Back to Recent Button - Only show when displaying search results */}
            {showSearchResults && (
              <div className="flex justify-center mb-4 sm:mb-6">
                <button 
                  onClick={() => setShowSearchResults(false)}
                  className="px-4 sm:px-6 py-3 border-2 font-bold text-base sm:text-lg rounded-lg transition-colors duration-200"
                  style={{ borderColor: colors.primaryGreen, color: colors.primaryGreen }}
                  onMouseEnter={(e) => {
                    e.target.style.background = colors.primaryGreen;
                    e.target.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'transparent';
                    e.target.style.color = colors.primaryGreen;
                  }}
                >
                  ← Back to Recent Expenses
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Photo Viewer Modal */}
      {photoViewerOpen && selectedPhoto && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-2 sm:p-4">
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

      <DatePickerModal open={datePickerOpen} mode="single" title="Choose expense date" onClose={()=>setDatePickerOpen(false)} onSelect={({date})=>{ const dt=new Date(date+"T12:00"); setForm(f=>({...f,expenseDate:dt.toISOString().slice(0,16)})); setDatePickerOpen(false); }} />

      {/* Approval Requests Modal */}
      {approvalOpen && (
        <div className="fixed inset-0 z-[56] bg-black/50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl w-full h-full sm:h-auto sm:max-w-2xl mx-0 sm:mx-4 p-3 sm:p-5 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg sm:text-xl font-bold">Approval requests</h3>
              <div className="flex items-center gap-2">
                <button onClick={fetchPendingRequests} className="px-3 py-1 rounded-full border text-sm" style={{ borderColor: colors.primaryGreen, color: colors.primaryGreen }}>Refresh</button>
                <button onClick={()=>setApprovalOpen(false)} className="text-gray-600">✕</button>
              </div>
            </div>
            <ApprovalRequestsBody items={approvalItems} loading={approvalLoading} onApprove={async (req)=>{ try { setApprovalProcessingId(req.id); await updateDoc(doc(db,'users', req.userId), { userType: 'admin', approvedAt: new Date(), approvedBy: auth.currentUser.uid }); await deleteDoc(doc(db,'approvalRequests', req.id)); await fetchPendingRequests(); } finally { setApprovalProcessingId(""); } }} onReject={async (req)=>{ try { setApprovalProcessingId(req.id); await updateDoc(doc(db,'users', req.userId), { userType: 'user', rejectedAt: new Date(), rejectedBy: auth.currentUser.uid }); await deleteDoc(doc(db,'approvalRequests', req.id)); await fetchPendingRequests(); } finally { setApprovalProcessingId(""); } }} processingId={approvalProcessingId} />
          </div>
        </div>
      )}

      {/* Edit Expense Modal */}
      {editingExpense && (
        <div className="fixed inset-0 z-[57] bg-black/50 flex items-center justify-center p-2 sm:p-4">
          <div className="rounded-2xl w-full h-full sm:h-auto sm:max-w-2xl mx-0 sm:mx-4 flex flex-col" style={{ background: colors.surface, maxHeight: '90vh' }}>
            {/* Header - Fixed */}
            <div className="flex items-center justify-between p-3 sm:p-5 pb-4 border-b" style={{ borderColor: colors.gray400 }}>
              <h3 className="text-xl sm:text-2xl font-bold" style={{ color: colors.text }}>Edit Expense</h3>
              <button onClick={() => setEditingExpense(null)} className="text-xl sm:text-2xl font-bold transition-colors duration-200" style={{ color: colors.muted }} onMouseEnter={(e) => e.target.style.color = colors.text} onMouseLeave={(e) => e.target.style.color = colors.muted }>✕</button>
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-5 pt-0">
              <div className="grid grid-cols-1 gap-3 sm:gap-4">
                <input className="w-full px-3 sm:px-4 py-3 rounded-xl border text-base sm:text-lg" placeholder="Title" value={form.title} onChange={(e)=>setForm(f=>({...f,title:e.target.value}))} />
                <input className="w-full px-3 sm:px-4 py-3 rounded-xl border text-base sm:text-lg" placeholder="Amount (₪)" inputMode="decimal" value={form.amount} onChange={(e)=>setForm(f=>({...f,amount:e.target.value}))} />
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
                    <button onClick={()=>setForm(f=>({...f,expenseDate:new Date().toISOString().slice(0,16)}))} className="w-full sm:w-auto px-4 py-2 rounded-full text-sm font-semibold text-white" style={{ background: colors.gold }}>Today</button>
                    <button onClick={()=>setDatePickerOpen(true)} className="w-full sm:w-auto px-4 py-2 rounded-full text-sm font-semibold border" style={{ borderColor: colors.primaryGreen, color: colors.primaryGreen }}>Other date</button>
                  </div>
                  {form.expenseDate && (
                    <div className="mt-2 text-sm" style={{ color: colors.text }}>Selected: {new Date(form.expenseDate).toLocaleDateString()}</div>
                  )}
                </div>
                <textarea className="w-full px-3 sm:px-4 py-3 rounded-xl border text-base sm:text-lg" placeholder="Notes (optional)" value={form.notes} onChange={(e)=>setForm(f=>({...f,notes:e.target.value}))} />
                
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
              <button onClick={() => setEditingExpense(null)} className="w-full sm:w-auto px-4 sm:px-6 py-3 rounded-lg font-semibold text-white" style={{ background: colors.red }}>
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

      <AdminBottomNavBar active="expenses" />
    </main>
  );
}
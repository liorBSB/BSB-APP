"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  startAfter,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
  uploadBytesResumable,
  uploadString,
} from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";
import { deleteDoc } from "firebase/firestore";
import AdminBottomNavBar from "@/components/AdminBottomNavBar";
import DatePickerModal from "@/components/DatePickerModal";
import CameraCaptureModal from "@/components/CameraCaptureModal";
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

// Lightweight script loader to avoid bundling heavy PDF libs
async function loadScript(url) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = url;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${url}`));
    document.body.appendChild(s);
  });
}

async function ensureJsPdfLoaded() {
  if (!globalThis.window) return;
  if (!window.jspdf || !window.jspdf.jsPDF) {
    await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
  }
  if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('jsPDF failed to load');
  // autotable plugin
  if (!('autoTable' in (window.jspdf || {}))) {
    await loadScript('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js');
  }
}

async function ensureXlsxLoaded() {
  if (!globalThis.window) return;
  if (!window.XLSX) {
    await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
  }
  if (!window.XLSX) throw new Error('XLSX failed to load');
}

const CATEGORIES = [
  "Food",
  "Equipment",
  "Maintenance",
  "Transport",
  "Utilities",
  "Other",
];

const REIMBURSEMENT_METHODS = [
  "Credit Card",
  "Bank Transfer",
  "Cash",
  "Other",
];

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
  });
  const [receiptFile, setReceiptFile] = useState(null);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // List state
  const [items, setItems] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    category: "",
  });
  const [expandedId, setExpandedId] = useState(null);

  // Access control: only admins
  useEffect(() => {
    const check = async () => {
      const user = auth.currentUser;
      if (!user) {
        router.push("/");
        return;
      }
      const uRef = doc(db, "users", user.uid);
      const uSnap = await getDoc(uRef);
      if (!uSnap.exists() || uSnap.data()?.userType !== "admin") {
        router.push("/home");
        return;
      }
      setUserDoc({ id: uSnap.id, ...uSnap.data() });
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
    if (!receiptFile) return "Receipt image is required";
    
    // Validate file type
    if (receiptFile && !receiptFile.type.startsWith('image/')) {
      return "Selected file must be an image";
    }
    
    // Validate file size (max 10MB)
    if (receiptFile && receiptFile.size > 10 * 1024 * 1024) {
      return "Image file size must be less than 10MB";
    }
    
    return "";
  };

  // Compress image to reasonable size for faster uploads
  const compressImageToDataUrl = async (file, maxDim = 1400, quality = 0.85) => {
    try {
      console.log("Starting image compression for file:", file.name, "size:", file.size);
      
      const imgBitmap = await createImageBitmap(file);
      console.log("Image bitmap created, dimensions:", imgBitmap.width, "x", imgBitmap.height);
      
      const scale = Math.min(1, maxDim / Math.max(imgBitmap.width, imgBitmap.height));
      const targetW = Math.max(1, Math.round(imgBitmap.width * scale));
      const targetH = Math.max(1, Math.round(imgBitmap.height * scale));
      console.log("Target dimensions:", targetW, "x", targetH, "scale:", scale);
      
      const canvas = document.createElement('canvas');
      canvas.width = targetW; 
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgBitmap, 0, 0, targetW, targetH);
      
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      console.log("Compression completed, data URL length:", dataUrl.length);
      return dataUrl;
    } catch (e) {
      console.warn("Image compression failed, using fallback:", e);
      // Fallback: read original as data URL
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          console.log("Fallback: original file read as data URL, length:", reader.result.length);
          resolve(reader.result);
        };
        reader.onerror = (error) => {
          console.error("FileReader error:", error);
          reject(error);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleSave = async () => {
    setError("");
    setSuccess("");
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    try {
      setSaving(true);
      if (!receiptFile) {
        setError("Receipt image is required");
        setSaving(false);
        return;
      }
      const ownerUid = auth.currentUser.uid;
      console.log("Starting upload for user:", ownerUid);
      console.log("Receipt file:", receiptFile);
      console.log("File type:", receiptFile.type);
      console.log("File size:", receiptFile.size);
      
      // 1) Upload first
      const mime = "image/jpeg";
      const safeName = `receipt_${Date.now()}.jpg`;
      const path = `receipts/${ownerUid}/${safeName}`;
      console.log("Storage path:", path);
      
      const refObj = storageRef(storage, path);
      console.log("Storage ref created");
      
      const dataUrl = await compressImageToDataUrl(receiptFile);
      console.log("Image compressed, data URL length:", dataUrl.length);
      
      console.log("Starting upload...");
      try {
        // Try data URL method first
        await uploadString(refObj, dataUrl, 'data_url', { contentType: mime });
        console.log("Upload completed with data URL method");
      } catch (uploadError) {
        console.warn("Data URL upload failed, trying blob method:", uploadError);
        // Fallback to blob upload
        const blob = await new Promise((resolve) => {
          const canvas = document.createElement('canvas');
          const img = new Image();
          img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            canvas.toBlob(resolve, 'image/jpeg', 0.9);
          };
          img.src = dataUrl;
        });
        await uploadBytes(refObj, blob, { contentType: mime });
        console.log("Upload completed with blob method");
      }
      
      const url = await getDownloadURL(refObj);
      console.log("Download URL obtained:", url);

      // 2) Then create the expense document including the receipt
      const payload = {
        ownerUid,
        title: form.title.trim(),
        amount: Number(form.amount),
        currency: "ILS",
        category: form.category,
        categoryOther: form.category === "Other" ? form.categoryOther.trim() : "",
        reimbursementMethod: form.reimbursementMethod,
        notes: form.notes.trim(),
        linkedSoldierUid: form.linkedSoldierUid || null,
        expenseDate: new Date(form.expenseDate),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        softDeleted: false,
        receiptUrl: url,
        receiptStoragePath: path,
      };
      await addDoc(collection(db, "expenses"), payload);

      setSuccess("Expense saved");
      setForm({
        title: "",
        amount: "",
        category: "Food",
        categoryOther: "",
        reimbursementMethod: "Credit Card",
        notes: "",
        linkedSoldierUid: "",
        expenseDate: "",
      });
      setReceiptFile(null);
      await fetchList();
    } catch (e) {
      console.error('Failed to save expense', e);
      console.error('Error details:', {
        code: e?.code,
        message: e?.message,
        stack: e?.stack
      });
      
      // Provide more specific error messages
      let errorMessage = "Failed to save expense";
      if (e?.code === 'storage/unauthorized') {
        errorMessage = "Storage access denied. Please check your permissions.";
      } else if (e?.code === 'storage/quota-exceeded') {
        errorMessage = "Storage quota exceeded. Please try with a smaller image.";
      } else if (e?.code === 'storage/unauthenticated') {
        errorMessage = "Please sign in again to upload images.";
      } else if (e?.message) {
        errorMessage = e.message;
      }
      
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const fetchList = async () => {
    try {
      setLoadingList(true);
      let constraints = [];
      if (filters.category) constraints.push(where("category", "==", filters.category));
      if (filters.from) constraints.push(where("expenseDate", ">=", new Date(filters.from)));
      if (filters.to) constraints.push(where("expenseDate", "<=", new Date(filters.to)));
      // no status filtering
      const q = query(
        collection(db, "expenses"),
        ...constraints,
        orderBy("expenseDate", "desc"),
        limit(100)
      );
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setItems(data);
    } catch (e) {
      // noop UI error below
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    // Fetch expenses list on first load
    fetchList();
    // Also preload pending requests for the count badge only
    (async () => {
      try {
        const qReq = query(collection(db, 'approvalRequests'), where('status','==','pending'));
        const snap = await getDocs(qReq);
        setApprovalItems(snap.docs.map(d=>({ id:d.id, ...d.data() })));
      } catch {}
    })();
  }, []);

  const amountFormatted = (amt) => new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS" }).format(amt || 0);

  // Report modal state
  const [reportOpen, setReportOpen] = useState(false);
  const [rangePreset, setRangePreset] = useState("last_week");
  const [customRangeOpen, setCustomRangeOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  // Approval modal
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalItems, setApprovalItems] = useState([]);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalProcessingId, setApprovalProcessingId] = useState("");
  
  const fetchPendingRequests = async () => {
    try {
      setApprovalLoading(true);
      const qReq = query(collection(db, 'approvalRequests'), where('status','==','pending'));
      const snap = await getDocs(qReq);
      setApprovalItems(snap.docs.map(d=>({ id:d.id, ...d.data() })));
    } finally { setApprovalLoading(false); }
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
                <button
                  onClick={()=>setForm(f=>({...f,expenseDate:new Date().toISOString().slice(0,16)}))}
                  className="px-4 py-2 rounded-full text-sm font-semibold text-white"
                  style={{ background: colors.gold }}
                >Today</button>
                <button
                  onClick={()=>setDatePickerOpen(true)}
                  className="px-4 py-2 rounded-full text-sm font-semibold border"
                  style={{ borderColor: colors.primaryGreen, color: colors.primaryGreen }}
                >Other date</button>
              </div>
              {form.expenseDate && (
                <div className="mt-2 text-white text-sm">Selected: {new Date(form.expenseDate).toLocaleString()}</div>
              )}
            </div>
            <textarea className="w-full px-4 py-3 rounded-xl border text-lg" placeholder="Notes (optional)" value={form.notes} onChange={(e)=>setForm(f=>({...f,notes:e.target.value}))} />
            <div className="w-full flex items-center justify-between gap-2">
              <button type="button" onClick={()=>setCameraOpen(true)} className="flex-1 px-4 py-3 rounded-xl border bg-white text-sm">Take photo</button>
              <button type="button" onClick={()=>galleryInputRef.current?.click()} className="flex-1 px-4 py-3 rounded-xl border bg-white text-sm">Choose from photos</button>
            </div>
            {/* hidden camera input retained as fallback */}
            <input 
              ref={cameraInputRef} 
              className="hidden" 
              type="file" 
              accept="image/*" 
              capture="environment" 
              onChange={(e)=>{
                const file = e.target.files?.[0];
                console.log("Camera file selected:", file);
                setReceiptFile(file);
              }} 
            />
            <input 
              ref={galleryInputRef} 
              className="hidden" 
              type="file" 
              accept="image/*" 
              onChange={(e)=>{
                const file = e.target.files?.[0];
                console.log("Gallery file selected:", file);
                setReceiptFile(file);
              }} 
            />
            <div className="text-xs text-white/90">{receiptFile ? `Selected: ${receiptFile.name}` : 'No file selected'}</div>
            
            {/* Test storage button */}
            <button 
              onClick={async () => {
                try {
                  console.log("Testing storage access...");
                  const ownerUid = auth.currentUser?.uid;
                  if (!ownerUid) { setError("Not signed in"); return; }
                  const testRef = storageRef(storage, `receipts/${ownerUid}/test_${Date.now()}.txt`);
                  await uploadString(testRef, "test content", 'raw');
                  console.log("Storage test successful");
                  setSuccess("Storage test successful");
                } catch (e) {
                  console.error("Storage test failed:", e);
                  setError(`Storage test failed: ${e.message}`);
                }
              }}
              className="w-full px-4 py-3 rounded-xl text-white font-semibold mb-2 text-sm"
              style={{ background: "#6b7280" }}
            >
              Test Storage Access
            </button>
            
            {/* Test image upload button */}
            <button 
              onClick={async () => {
                try {
                  console.log("Testing image upload...");
                  if (!receiptFile) {
                    setError("Please select an image first");
                    return;
                  }
                  const ownerUid = auth.currentUser?.uid;
                  if (!ownerUid) { setError("Not signed in"); return; }
                  const testRef = storageRef(storage, `receipts/${ownerUid}/image_test_${Date.now()}.jpg`);
                  const dataUrl = await compressImageToDataUrl(receiptFile);
                  await uploadString(testRef, dataUrl, 'data_url', { contentType: 'image/jpeg' });
                  console.log("Image upload test successful");
                  setSuccess("Image upload test successful");
                } catch (e) {
                  console.error("Image upload test failed:", e);
                  setError(`Image upload test failed: ${e.message}`);
                }
              }}
              className="w-full px-4 py-3 rounded-xl text-white font-semibold mb-2 text-sm"
              style={{ background: "#059669" }}
            >
              Test Image Upload
            </button>
            
            <button onClick={handleSave} disabled={saving} className="w-full px-4 py-3 rounded-xl text-white font-semibold disabled:opacity-70 text-lg" style={{ background: colors.gold }}>
              {saving?"Saving...":"Save Expense"}
            </button>
          </div>
        </div>

        <div className="mb-3 rounded-2xl p-5 shadow-xl" style={{ background: "rgba(0,0,0,0.22)" }}>
          <div className="flex items-center justify-between">
            <h3 className="text-white font-extrabold text-xl">Expenses</h3>
          </div>
          <button onClick={()=>setReportOpen(true)} className="w-full mt-4 px-6 py-4 rounded-full text-white font-bold text-lg" style={{ background: colors.gold }}>Get a report</button>
          <button
            onClick={()=>{ fetchPendingRequests(); setApprovalOpen(true); }}
            className={`w-full mt-3 px-6 py-4 rounded-full font-bold text-lg flex items-center justify-center gap-2 ${approvalItems.length>0 ? 'text-white' : ''}`}
            style={
              approvalItems.length>0
                ? { background: colors.primaryGreen }
                : { borderColor: colors.primaryGreen, color: colors.white, borderWidth: 2, borderStyle: 'solid' }
            }
          >
            <span>{`Pending (${approvalItems.length})`}</span>
          </button>
        </div>
      </div>
      {/* Single date picker for add expense */}
      <DatePickerModal
        open={datePickerOpen}
        mode="single"
        title="Choose expense date"
        onClose={()=>setDatePickerOpen(false)}
        onSelect={({date})=>{
          // date is yyyy-mm-dd; convert to local datetime at noon to avoid TZ date shift
          const dt = new Date(date + "T12:00");
          setForm(f=>({...f,expenseDate: dt.toISOString().slice(0,16)}));
          setDatePickerOpen(false);
        }}
      />

      {/* Camera capture modal */}
      <CameraCaptureModal
        open={cameraOpen}
        onClose={()=>setCameraOpen(false)}
        onCapture={(blob)=>{ setReceiptFile(new File([blob], `receipt_${Date.now()}.jpg`, { type: 'image/jpeg' })); setCameraOpen(false); }}
      />

      {/* Report modal */}
      {reportOpen && (
        <div className="fixed inset-0 z-[55] bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-2xl w-full max-w-2xl mx-4 p-5 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-bold">Expenses report</h3>
              <button onClick={()=>setReportOpen(false)} className="text-gray-600">✕</button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={()=>setRangePreset('last_week')} className={`px-3 py-3 rounded-xl border ${rangePreset==='last_week'?'bg-[#EDC381] text-white':'bg-white'}`}>Last week</button>
                <button onClick={()=>setRangePreset('last_month')} className={`px-3 py-3 rounded-xl border ${rangePreset==='last_month'?'bg-[#EDC381] text-white':'bg-white'}`}>Last month</button>
                <button onClick={()=>setRangePreset('last_3_months')} className={`px-3 py-3 rounded-xl border ${rangePreset==='last_3_months'?'bg-[#EDC381] text-white':'bg-white'}`}>Last 3 months</button>
                <button onClick={()=>{setRangePreset('custom'); setCustomRangeOpen(true);}} className={`px-3 py-3 rounded-xl border ${rangePreset==='custom'?'bg-[#EDC381] text-white':'bg-white'}`}>Other</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select className="px-3 py-3 rounded-xl border" value={filters.category} onChange={(e)=>setFilters(f=>({...f,category:e.target.value}))}>
                  <option value="">All categories</option>
                  {CATEGORIES.map(c=> <option key={c} value={c}>{c}</option>)}
                </select>
                <div />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={()=>setReportOpen(false)} className="px-4 py-2 rounded-full border" style={{ borderColor: colors.primaryGreen, color: colors.primaryGreen }}>Close</button>
                <button onClick={()=>{
                  const now = new Date();
                  let fromDate = null;
                  if (rangePreset==='last_week') { const d=new Date(); d.setDate(d.getDate()-7); fromDate=d; }
                  if (rangePreset==='last_month') { const d=new Date(); d.setMonth(d.getMonth()-1); fromDate=d; }
                  if (rangePreset==='last_3_months') { const d=new Date(); d.setMonth(d.getMonth()-3); fromDate=d; }
                  if (rangePreset==='custom') { if (customFrom && customTo) { setFilters(f=>({...f,from:customFrom,to:customTo})); fetchList(); return; } }
                  if (fromDate) { setFilters(f=>({...f,from:fromDate.toISOString().slice(0,10), to: now.toISOString().slice(0,10)})); fetchList(); }
                }} className="px-4 py-2 rounded-full text-white" style={{ background: colors.gold }}>Apply</button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async ()=>{
                    try {
                      await ensureXlsxLoaded();
                      const XLSX = window.XLSX;
                    const rows = items.map(it=>({
                      id: it.id,
                      title: it.title,
                      amount: it.amount,
                      currency: it.currency,
                      category: it.category === "Other" ? it.categoryOther : it.category,
                      reimbursementMethod: it.reimbursementMethod,
                      notes: it.notes || "",
                      linkedSoldierUid: it.linkedSoldierUid || "",
                      expenseDate: (it.expenseDate?.toDate ? it.expenseDate.toDate() : new Date(it.expenseDate)).toISOString(),
                      status: it.status,
                    }));
                      const ws = XLSX.utils.json_to_sheet(rows);
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, "Expenses");
                      XLSX.writeFile(wb, `expenses_${Date.now()}.xlsx`);
                    } catch (e) {
                      alert('Failed to export Excel');
                    }
                  }}
                  className="px-4 py-2 rounded-full text-sm font-semibold text-white" style={{ background: colors.gold }}
                >Export Excel</button>
                <button
                  onClick={async ()=>{
                    try {
                      await ensureJsPdfLoaded();
                      // @ts-ignore
                      const { jsPDF } = window.jspdf;
                      const docPdf = new jsPDF({ unit: "pt", format: "a4" });
                      docPdf.setFontSize(14);
                      docPdf.text("Expenses", 40, 40);
                      const head = [["Date","Title","Category","Amount (ILS)"]];
                      const body = items.map(it=>[
                        (it.expenseDate?.toDate ? it.expenseDate.toDate() : new Date(it.expenseDate)).toLocaleDateString(),
                        it.title,
                        it.category === "Other" ? it.categoryOther : it.category,
                        (Number(it.amount) || 0).toFixed(2),
                      ]);
                      // @ts-ignore
                      docPdf.autoTable({ head, body, startY: 60 });
                      docPdf.save(`expenses_${Date.now()}.pdf`);
                    } catch (e) {
                      alert('Failed to generate PDF');
                    }
                  }}
                  className="px-4 py-2 rounded-full text-sm font-semibold text-white" style={{ background: colors.gold }}
                >Export PDF</button>
              </div>
              <div className="mt-2 overflow-auto border rounded-xl max-h-[45vh]">
                {loadingList ? (
                  <div className="p-4">Loading...</div>
                ) : items.length === 0 ? (
                  <div className="p-4">No expenses found</div>
                ) : (
                  <ul className="divide-y">
                    {items.map(it => {
                      const open = expandedId === it.id;
                      return (
                        <li key={it.id} className="p-0">
                          <button type="button"
                            className="w-full p-3 flex items-center justify-between text-left"
                            onClick={()=> setExpandedId(prev => prev === it.id ? null : it.id)}
                          >
                            <div>
                              <div className="font-semibold">{it.title}</div>
                              <div className="text-xs text-gray-600">{it.expenseDate?.toDate ? it.expenseDate.toDate().toLocaleDateString() : new Date(it.expenseDate).toLocaleDateString()} • {it.category === "Other" ? it.categoryOther : it.category}</div>
                            </div>
                            <div className="font-bold">{amountFormatted(it.amount)}</div>
                          </button>
                          {open && (
                            <div className="px-3 pb-3">
                              <div className="text-sm text-gray-700 space-y-1 mb-2">
                                <div><span className="font-semibold">Amount:</span> {amountFormatted(it.amount)}</div>
                                <div><span className="font-semibold">Date:</span> {it.expenseDate?.toDate ? it.expenseDate.toDate().toLocaleString() : new Date(it.expenseDate).toLocaleString()}</div>
                                <div><span className="font-semibold">Category:</span> {it.category === 'Other' ? it.categoryOther : it.category}</div>
                                <div><span className="font-semibold">Method:</span> {it.reimbursementMethod}</div>
                                {it.notes && <div><span className="font-semibold">Notes:</span> {it.notes}</div>}
                              </div>
                              {it.receiptUrl ? (
                                <img src={it.receiptUrl} alt="Receipt" className="w-full rounded" />
                              ) : (
                                <div className="text-xs text-gray-500">No receipt attached</div>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Nested custom range modal */}
      <DatePickerModal
        open={customRangeOpen}
        mode="range"
        title="Choose date range"
        onClose={()=>setCustomRangeOpen(false)}
        onSelect={({from,to})=>{ setCustomFrom(from); setCustomTo(to); setCustomRangeOpen(false); }}
      />

      {/* Approval requests modal */}
      {approvalOpen && (
        <div className="fixed inset-0 z-[56] bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-2xl w-full max-w-2xl mx-4 p-5 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-bold">Approval requests</h3>
              <div className="flex items-center gap-2">
                <button onClick={fetchPendingRequests} className="px-3 py-1 rounded-full border text-sm" style={{ borderColor: colors.primaryGreen, color: colors.primaryGreen }}>Refresh</button>
                <button onClick={()=>setApprovalOpen(false)} className="text-gray-600">✕</button>
              </div>
            </div>
            <ApprovalRequestsBody
              items={approvalItems}
              loading={approvalLoading}
              onApprove={async (req)=>{
                try {
                  setApprovalProcessingId(req.id);
                  await updateDoc(doc(db,'users', req.userId), { userType: 'admin', approvedAt: new Date(), approvedBy: auth.currentUser.uid });
                  await deleteDoc(doc(db,'approvalRequests', req.id));
                  await fetchPendingRequests();
                } finally { setApprovalProcessingId(""); }
              }}
              onReject={async (req)=>{
                try {
                  setApprovalProcessingId(req.id);
                  await updateDoc(doc(db,'users', req.userId), { userType: 'user', rejectedAt: new Date(), rejectedBy: auth.currentUser.uid });
                  await deleteDoc(doc(db,'approvalRequests', req.id));
                  await fetchPendingRequests();
                } finally { setApprovalProcessingId(""); }
              }}
              processingId={approvalProcessingId}
            />
          </div>
        </div>
      )}
      {/* row-level collapsible shows details; no separate modal anymore */}
      <AdminBottomNavBar active="expenses" />
    </main>
  );
}



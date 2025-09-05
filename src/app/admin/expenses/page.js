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
import colors from "@/app/colors";
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Test function to demonstrate Hebrew translation (remove in production)
const testHebrewTranslation = () => {
  const testCases = [
    'קניית מזון',
    'תיקון מחשב',
    'נסיעה לעבודה',
    'חשמל ומים',
    'כרטיס אשראי',
    'מאושר',
    'ממתין לאישור'
  ];
  
  console.log('Hebrew Translation Test:');
  testCases.forEach(test => {
    console.log(`"${test}" → "${convertHebrewToReadable(test)}"`);
  });
};

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

// Hebrew text converter function - converts Hebrew to English lowercase
const convertHebrewToReadable = (text) => {
  if (!text || typeof text !== 'string') return text;
  
  // Check if text contains Hebrew characters
  const hebrewRegex = /[\u0590-\u05FF]/;
  if (!hebrewRegex.test(text)) return text.toLowerCase();
  
  // Comprehensive Hebrew to English transliteration mapping (lowercase)
  const hebrewMap = {
    // Basic letters
    'א': 'a', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h', 'ו': 'v', 'ז': 'z',
    'ח': 'ch', 'ט': 't', 'י': 'y', 'כ': 'k', 'ל': 'l', 'מ': 'm', 'נ': 'n',
    'ס': 's', 'ע': 'a', 'פ': 'p', 'צ': 'tz', 'ק': 'k', 'ר': 'r', 'ש': 'sh',
    'ת': 't',
    
    // Final letters
    'ם': 'm', 'ן': 'n', 'ץ': 'tz', 'ף': 'f', 'ך': 'ch',
    
    // Common words and phrases for expenses
    'הוצאה': 'expense', 'הוצאות': 'expenses', 'קנייה': 'purchase', 'קניית': 'purchase of',
    'מזון': 'food', 'אוכל': 'food', 'שתייה': 'drink', 'משקאות': 'drinks',
    'נסיעה': 'transportation', 'תחבורה': 'transportation', 'דלק': 'fuel', 'חניה': 'parking',
    'ציוד': 'equipment', 'כלי': 'tools', 'חומרים': 'materials',
    'תיקון': 'repair', 'תחזוקה': 'maintenance', 'שירות': 'service',
    'חשמל': 'electricity', 'מים': 'water', 'גז': 'gas', 'אינטרנט': 'internet',
    'בית': 'home', 'דירה': 'apartment', 'חדר': 'room', 'מטבח': 'kitchen',
    'מחשב': 'computer', 'טלפון': 'phone', 'נייד': 'mobile',
    'ספר': 'book', 'ספרים': 'books', 'חינוך': 'education',
    'בריאות': 'health', 'רפואה': 'medicine', 'תרופות': 'medicines',
    'ביגוד': 'clothing', 'בגדים': 'clothes', 'נעליים': 'shoes',
    'אחר': 'other', 'שונות': 'miscellaneous', 'כללי': 'general',
    
    // Common expense categories
    'מזון ושתייה': 'food and drinks',
    'תחבורה': 'transportation',
    'ציוד ותיקונים': 'equipment and repairs',
    'שירותים': 'utilities',
    'בית ודיור': 'home and housing',
    'טכנולוגיה': 'technology',
    'חינוך ולימודים': 'education and studies',
    'בריאות ורפואה': 'health and medicine',
    'ביגוד וטיפוח': 'clothing and grooming',
    'אחר': 'other',
    
    // Payment methods
    'כרטיס אשראי': 'credit card',
    'העברה בנקאית': 'bank transfer',
    'מזומן': 'cash',
    'צ\'ק': 'check',
    'דיגיטלי': 'digital',
    
    // Status
    'מאושר': 'approved',
    'נדחה': 'denied',
    'ממתין': 'pending',
    'בבדיקה': 'under review'
  };
  
  // Convert Hebrew to transliterated text
  let result = text;
  
  // First, try to match whole words (more accurate)
  Object.entries(hebrewMap).forEach(([hebrew, english]) => {
    const regex = new RegExp(hebrew, 'gi');
    result = result.replace(regex, english);
  });
  
  // Clean up any remaining Hebrew characters with basic transliteration
  const basicHebrewMap = {
    'א': 'a', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h', 'ו': 'v', 'ז': 'z',
    'ח': 'ch', 'ט': 't', 'י': 'y', 'כ': 'k', 'ל': 'l', 'מ': 'm', 'נ': 'n',
    'ס': 's', 'ע': 'a', 'פ': 'p', 'צ': 'tz', 'ק': 'k', 'ר': 'r', 'ש': 'sh',
    'ת': 't', 'ם': 'm', 'ן': 'n', 'ץ': 'tz', 'ף': 'f', 'ך': 'ch'
  };
  
  Object.entries(basicHebrewMap).forEach(([hebrew, english]) => {
    result = result.replace(new RegExp(hebrew, 'g'), english);
  });
  
  // Clean up the result - remove extra spaces, convert to lowercase
  result = result
    .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
    .trim()                // Remove leading/trailing spaces
    .toLowerCase();        // Convert to lowercase
  
  return result;
};

// Unified PDF generation function for both expenses and refund requests
const generateUnifiedPDF = async (items, type = 'expenses', dateRange = null, customFrom = null, customTo = null) => {
  // Create a new PDF document
  const doc = new jsPDF();
  
  // Try to use a font that supports Hebrew characters
  try {
    doc.setFont('times', 'normal');
  } catch (e) {
    // Fallback to default if times font not available
    doc.setFont('helvetica', 'normal');
  }
  
  // Add title based on type
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
  const title = type === 'expenses' ? 'Expenses Report' : 'Refund Report';
  doc.text(title, 105, 25, { align: 'center' });
    
    // Add generation date and date range
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated on: ${new Date().toLocaleDateString('he-IL')}`, 105, 35, { align: 'center' });
  
  if (type === 'refunds' && dateRange) {
    // Show actual date range instead of just "30 Days"
    let dateRangeText;
    if (dateRange === 'custom' && customFrom && customTo) {
      const fromDate = new Date(customFrom).toLocaleDateString('he-IL');
      const toDate = new Date(customTo).toLocaleDateString('he-IL');
      dateRangeText = `From: ${fromDate} To: ${toDate}`;
    } else {
      const now = new Date();
      let fromDate;
      switch (dateRange) {
        case 'pastDay':
          fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'pastWeek':
          fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'pastMonth':
          fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          fromDate = new Date(0); // All time
      }
      const fromStr = fromDate.toLocaleDateString('he-IL');
      const toStr = now.toLocaleDateString('he-IL');
      dateRangeText = `From: ${fromStr} To: ${toStr}`;
    }
    doc.text(`Date Range: ${dateRangeText}`, 105, 45, { align: 'center' });
  }
    
    // Add summary information
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', 20, 60);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
  
  if (type === 'expenses') {
    doc.text(`Total Expenses: ${items.length}`, 20, 70);
    doc.text(`Total Amount: ILS ${items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0).toFixed(2)}`, 20, 80);
  } else {
    doc.text(`Approved: ${items.filter(r => r.status === 'approved').length}`, 20, 70);
    doc.text(`Denied: ${items.filter(r => r.status === 'denied').length}`, 20, 80);
    doc.text(`Pending: ${items.filter(r => r.status === 'waiting').length}`, 20, 90);
    doc.text(`Total Amount: ILS ${items.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0).toFixed(2)}`, 20, 100);
  }
  
  // Prepare table data based on type
  let tableData;
  let tableHeaders;
  
  if (type === 'expenses') {
    tableHeaders = ['#', 'title', 'category', 'amount', 'date', 'notes', 'payment', 'created by', 'photo'];
    tableData = items.map((expense, index) => [
      (index + 1).toString(),
      convertHebrewToReadable(expense.title) || 'n/a',
      convertHebrewToReadable(expense.category) || 'n/a',
      `ILS ${(expense.amount || 0).toFixed(2)}`,
      expense.expenseDate?.toDate?.()?.toLocaleDateString?.() || 'no date',
      convertHebrewToReadable(expense.notes) || 'n/a',
      convertHebrewToReadable(expense.reimbursementMethod) || 'n/a',
      convertHebrewToReadable(expense.createdByName || 'loading...') || 'loading...',
      expense.photoUrl ? 'yes' : 'no'
    ]);
  } else {
    tableHeaders = ['#', 'title', 'amount', 'method', 'name', 'room', 'date', 'status', 'receipt photo'];
    tableData = items.map((request, index) => {
    const status = request.status;
    let statusText = status;
    
    // Add color coding for status
    if (status === 'approved') {
      statusText = 'Approved';
    } else if (status === 'denied') {
      statusText = 'Denied';
    } else if (status === 'waiting') {
      statusText = 'Pending';
    }
    
    // Check for photo URL in multiple possible fields
    const hasPhoto = request.photoUrl || request.receiptPhotoUrl || request.photoPath;
    
    // Extract only numeric part from room number (remove Hebrew letters)
    const roomNumber = request.ownerRoomNumber ? request.ownerRoomNumber.replace(/[^0-9]/g, '') : 'N/A';
    
              return [
        (index + 1).toString(),
        convertHebrewToReadable(request.title) || 'n/a',
      `ILS ${request.amount || '0'}`,
        convertHebrewToReadable(request.repaymentMethod || request.reimbursementMethod) || 'n/a',
        convertHebrewToReadable(request.ownerName) || 'n/a',
      roomNumber,
        request.expenseDate?.toDate?.()?.toLocaleDateString?.() || request.createdAt?.toDate?.()?.toLocaleDateString?.() || 'no date',
        statusText.toLowerCase(),
        hasPhoto ? 'receipt' : 'no photo'
    ];
  });
  }

  // Add table with proper column widths
  autoTable(doc, {
    startY: 115,
    head: [tableHeaders],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: 255,
      fontSize: 10,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 9,
      halign: 'left'
    },
    columnStyles: type === 'expenses' ? {
      0: { cellWidth: 8 },  // Row Number
      1: { cellWidth: 30 }, // Title
      2: { cellWidth: 25 }, // Category (bigger)
      3: { cellWidth: 30 }, // Amount (bigger)
      4: { cellWidth: 18 }, // Date
      5: { cellWidth: 20 }, // Notes
      6: { cellWidth: 25 }, // Payment Method (bigger)
      7: { cellWidth: 22 }, // Created By
      8: { cellWidth: 15 }  // Photo (bigger)
    } : {
      0: { cellWidth: 8 },  // Row Number
      1: { cellWidth: 30 }, // Title
      2: { cellWidth: 25 }, // Amount (bigger)
      3: { cellWidth: 20 }, // Method
      4: { cellWidth: 25 }, // Name
      5: { cellWidth: 12 }, // Room
      6: { cellWidth: 20 }, // Date
      7: { cellWidth: 18 }, // Status
      8: { cellWidth: 15 }  // Receipt Photo (bigger)
    },
    margin: { top: 115, right: 15, bottom: 20, left: 15 },
    styles: {
      lineWidth: 0.5,
      lineColor: [200, 200, 200]
    },
    didDrawCell: function(data) {
      // Handle photo columns for both types (adjusted for row number column)
      const photoColumnIndex = type === 'expenses' ? 8 : 8;
      const photoText = type === 'expenses' ? 'yes' : 'receipt';
      
      if (data.column.index === photoColumnIndex && data.section === 'body') {
        const itemIndex = data.row.index;
        const item = items[itemIndex];
        const photoUrl = type === 'expenses' ? item.photoUrl : (item.photoUrl || item.receiptPhotoUrl || item.photoPath);
        
        if (photoUrl && data.cell.text[0] === photoText) {
          // Calculate the center position for the text
          const cellCenterX = data.cell.x + (data.cell.width / 2);
          const cellCenterY = data.cell.y + (data.cell.height / 2);
          
          // Clear the original text by drawing a white rectangle over it
          doc.setFillColor(255, 255, 255);
          doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
          
          // Redraw the cell border to match the table's border style
          doc.setDrawColor(200, 200, 200); // Light gray to match table borders
          doc.setLineWidth(0.1); // Thin line to match table borders
          doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'S');
          
          // Add the clickable link perfectly centered in the cell
          doc.setTextColor(0, 0, 255); // Blue
          doc.setFontSize(8);
          const linkText = type === 'expenses' ? 'photo' : 'receipt';
          // Better positioning - center the text more precisely
          const textWidth = linkText.length * 2.5; // Approximate character width
          const textX = cellCenterX - (textWidth / 2);
          const textY = cellCenterY + 2;
          doc.textWithLink(linkText, textX, textY, { 
            url: photoUrl
          });
          
          // Reset text properties
          doc.setTextColor(0, 0, 0);
          doc.setLineWidth(0.1); // Reset line width
        }
      }
    }
  });
  
      // Add photos section at the end
    const itemsWithPhotos = items.filter(item => {
      if (type === 'expenses') {
        return item.photoUrl;
      } else {
        return item.photoUrl || item.receiptPhotoUrl || item.photoPath;
      }
    });
    
    console.log('Items with photos:', itemsWithPhotos.length);
    console.log('Photo URLs found:', itemsWithPhotos.map(item => ({
      title: item.title,
      photoUrl: item.photoUrl,
      receiptPhotoUrl: item.receiptPhotoUrl,
      photoPath: item.photoPath
    })));
    
    if (itemsWithPhotos.length > 0) {
      // Add a new page for photos
      doc.addPage();
      
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      const galleryTitle = type === 'expenses' ? 'Photos Gallery' : 'Receipt Photos Gallery';
      doc.text(galleryTitle, 105, 25, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      const totalText = type === 'expenses' ? `Total Photos: ${itemsWithPhotos.length}` : `Total Receipts: ${itemsWithPhotos.length}`;
      doc.text(totalText, 105, 35, { align: 'center' });
    
    let photoY = 50;
    let photoX = 20;
    const photoWidth = 80;
    const photoHeight = 60;
    const maxPhotosPerRow = 2; // Fewer per row since photos are bigger
    let photosInCurrentRow = 0;
    let photoNumber = 1;
    
    // Helper function to add placeholder
    const addPlaceholder = () => {
      // Draw a placeholder rectangle
      doc.setFillColor(245, 245, 245);
      doc.rect(photoX, photoY, photoWidth, photoHeight, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.rect(photoX, photoY, photoWidth, photoHeight, 'S');
      
      // Add photo icon symbol
      doc.setFontSize(16);
      doc.setTextColor(150, 150, 150);
      doc.text('📷', photoX + photoWidth/2 - 8, photoY + photoHeight/2 - 5);
    };

    // Process photos one by one to ensure proper loading
    const processPhotos = async () => {
      for (const item of itemsWithPhotos) {
      try {
        const photoUrl = type === 'expenses' ? item.photoUrl : (item.photoUrl || item.receiptPhotoUrl || item.photoPath);
        
        // Find the original table row number for this item
        const originalRowNumber = items.findIndex(originalItem => 
          originalItem.id === item.id || 
          (originalItem.title === item.title && originalItem.amount === item.amount)
        ) + 1; // +1 because table rows start at 1, not 0
        
        // Add photo number label above photo (matching original table row number)
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`${originalRowNumber}`, photoX, photoY - 5);
        
        // Try to load and add the actual image
        console.log(`Attempting to load photo for: ${item.title}`, photoUrl);
        
        // Load image through proxy to avoid CORS issues
        const imageLoaded = await new Promise((resolve) => {
          const img = new Image();
          
          // Use proxy route to avoid CORS issues
          const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(photoUrl)}`;
          img.crossOrigin = 'anonymous';
          
          // Add timeout to prevent hanging
          const timeout = setTimeout(() => {
            console.warn(`Image load timeout for: ${photoUrl}`);
            addPlaceholder();
            resolve(false);
          }, 20000); // 20 second timeout
          
          img.onload = () => {
            clearTimeout(timeout);
            try {
              // Try different image formats
              let format = 'JPEG';
              if (photoUrl.toLowerCase().includes('.png')) {
                format = 'PNG';
              } else if (photoUrl.toLowerCase().includes('.gif')) {
                format = 'GIF';
              }
              
              // Add the actual image to PDF
              doc.addImage(img, format, photoX, photoY, photoWidth, photoHeight);
                              console.log(`Successfully added photo #${originalRowNumber} from: ${photoUrl} (format: ${format})`);
              resolve(true);
            } catch (error) {
              console.warn(`Failed to add image to PDF:`, error);
              addPlaceholder();
              resolve(false);
            }
          };
          
          img.onerror = (error) => {
            clearTimeout(timeout);
            console.warn(`Failed to load image via proxy: ${photoUrl}`, error);
            addPlaceholder();
            resolve(false);
          };
          
          console.log(`Attempting to load image via proxy: ${proxyUrl}`);
          img.src = proxyUrl;
        });
        
        // No text below photos - clean gallery
        
        // Move to next position
        photosInCurrentRow++;
        photoNumber++;
        
        if (photosInCurrentRow >= maxPhotosPerRow) {
          photosInCurrentRow = 0;
          photoY += photoHeight + 20; // Height + spacing only
          photoX = 20;
        } else {
          photoX += photoWidth + 15; // Width + spacing
        }
        
        // Check if we need a new page
        if (photoY > 250) {
          doc.addPage();
          photoY = 20;
          photoX = 20;
          photosInCurrentRow = 0;
        }
        
      } catch (error) {
        console.warn(`Failed to load photo for item: ${item.title}`, error);
        // Continue with next photo
      }
    }
    };
    
    // Call the async photo processing function
    await processPhotos();
    
          // No reference table - clean photo gallery only
  }
  
  // Save the PDF
  const fileName = type === 'expenses' 
    ? `expenses_report_${new Date().toISOString().slice(0, 10)}.pdf`
    : `RefundReport-${getDateRangeText(dateRange, customFrom, customTo)}.pdf`;
  doc.save(fileName);
  
  // Show success message
  alert('PDF report downloaded successfully!');
};

// Helper function to get date range text
const getDateRangeText = (dateRange, customFrom, customTo) => {
  switch (dateRange) {
    case 'pastDay':
      return '1 Day';
    case 'pastWeek':
      return '7 Days';
    case 'pastMonth':
      return '30 Days';
    case 'custom':
      return 'Custom Range';
    default:
      return 'All Time';
  }
};

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
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

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
    if (reportOpen || editingExpense || deleteConfirmOpen || photoViewerOpen || approvalOpen || exportModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup function to restore scrolling when component unmounts
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [reportOpen, editingExpense, deleteConfirmOpen, photoViewerOpen, approvalOpen, exportModalOpen]);

  // Test Hebrew translation on component mount (remove in production)
  useEffect(() => {
    testHebrewTranslation();
  }, []);

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
    setReportFilters({
      dateRange: 'all',
      category: '',
      paymentMethod: '',
      customFrom: '',
      customTo: ''
    });
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
      
      await addDoc(collection(db, "expenses"), payload);
      showSuccess("Expense saved successfully!");
      
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
        console.log('Filtering by category:', reportFilters.category);
        expenses = expenses.filter(expense => expense.category === reportFilters.category);
        console.log('After category filter:', expenses.length, 'expenses');
      }
      
      // Apply payment method filtering in JavaScript
      if (reportFilters.paymentMethod) {
        console.log('Filtering by payment method:', reportFilters.paymentMethod);
        expenses = expenses.filter(expense => expense.reimbursementMethod === reportFilters.paymentMethod);
        console.log('After payment method filter:', expenses.length, 'expenses');
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
    if (isGeneratingPDF) return; // Prevent double clicks
    
    setIsGeneratingPDF(true);
    setSuccess('Generating PDF with images... This may take a moment.');
    
    try {
      await generateUnifiedPDF(reportItems, 'expenses');
      setSuccess('PDF report downloaded successfully!');
    } catch (error) {
      setError('Failed to generate PDF. Please try again.');
      console.error('PDF generation error:', error);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const exportToExcel = () => {
    if (reportItems.length === 0) return;
    
    // Create CSV content (Excel can open CSV files)
    const headers = ['title', 'category', 'amount', 'date', 'notes', 'payment method', 'created by', 'photo'];
    const csvContent = [
      headers.join(','),
      ...reportItems.map(expense => [
        `"${(convertHebrewToReadable(expense.title) || '').replace(/"/g, '""')}"`,
        `"${(convertHebrewToReadable(expense.category) || '').replace(/"/g, '""')}"`,
        expense.amount || 0,
        `"${expense.expenseDate?.toDate?.()?.toLocaleDateString?.() || 'no date'}"`,
        `"${(convertHebrewToReadable(expense.notes) || '').replace(/"/g, '""')}"`,
        `"${(convertHebrewToReadable(expense.reimbursementMethod) || '').replace(/"/g, '""')}"`,
        `"${(convertHebrewToReadable(expense.createdByName) || '').replace(/"/g, '""')}"`,
        `"${expense.photoUrl || 'no photo'}"`
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
              inputMode="decimal" 
              value={form.amount} 
              onChange={(e)=>setForm(f=>({...f,amount:e.target.value}))}
              autoComplete="off"
              pattern="[0-9]*[.,]?[0-9]*"
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
                  onClick={()=>setForm(f=>({...f,expenseDate:new Date().toISOString().slice(0,16)}))} 
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
                <div className="mt-2 text-white text-sm">Selected: {new Date(form.expenseDate).toLocaleString()}</div>
              )}
            </div>
            <textarea 
              className="w-full px-4 py-3 rounded-xl border text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 resize-none" 
              placeholder="Notes (optional)" 
              value={form.notes} 
              onChange={(e)=>setForm(f=>({...f,notes:e.target.value}))}
              rows={3}
              autoComplete="off"
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
                    onClick={() => {
                      console.log('Search button clicked');
                      console.log('Current filters:', reportFilters);
                      fetchReportData();
                    }}
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
                      {items.slice(0, expandedId === 'recent' ? items.length : 3).map(expense => (
                        <div key={expense.id} className="border rounded-lg p-3 sm:p-4 hover:bg-white transition-colors duration-200" style={{ borderColor: colors.gray400 }}>
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                            <div className="flex-1">
                              <h5 className="text-lg sm:text-xl font-bold mb-2" style={{ color: colors.text }}>{expense.title}</h5>
                              <p className="text-sm sm:text-base font-semibold mb-1" style={{ color: colors.primaryGreen }}>{expense.category}</p>
                              <p className="text-sm sm:text-base font-medium mb-1" style={{ color: colors.muted }}>
                                💳 {expense.reimbursementMethod || 'N/A'}
                              </p>
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
              <div className="flex-1 overflow-y-auto min-h-0">
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
                    {reportItems.map(expense => (
                      <div key={expense.id} className="border rounded-lg p-4 hover:bg-white transition-colors duration-200" style={{ borderColor: colors.gray400 }}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h5 className="text-xl font-bold mb-2" style={{ color: colors.text }}>{expense.title}</h5>
                            <p className="text-base font-semibold mb-1" style={{ color: colors.primaryGreen }}>{expense.category}</p>
                            <p className="text-sm font-medium mb-1" style={{ color: colors.muted }}>
                              💳 {expense.reimbursementMethod || 'N/A'}
                            </p>
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
                    setExportCustomFrom(pastMonth.toISOString().slice(0, 16));
                    setExportCustomTo(now.toISOString().slice(0, 16));
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
                  <input
                    type="datetime-local"
                    value={exportCustomFrom || ''}
                    onChange={(e) => setExportCustomFrom(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                  <input
                    type="datetime-local"
                    value={exportCustomTo || ''}
                    onChange={(e) => setExportCustomTo(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
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
                  if (isGeneratingPDF) return; // Prevent double clicks
                  
                  setIsGeneratingPDF(true);
                  setSuccess('Generating PDF with images... This may take a moment.');
                  
                  try {
                    // Filter refund requests based on selected date range
                    let filteredRequests = [...refundRequests];
                  
                  if (exportDateRange !== 'custom') {
                    const now = new Date();
                    let startDate = new Date();
                    
                    switch (exportDateRange) {
                      case 'pastDay':
                        startDate.setDate(now.getDate() - 1);
                        break;
                      case 'pastWeek':
                        startDate.setDate(now.getDate() - 7);
                        break;
                      case 'pastMonth':
                        startDate.setMonth(now.getMonth() - 1);
                        break;
                    }
                    
                    filteredRequests = refundRequests.filter(request => {
                      const requestDate = request.expenseDate?.toDate?.() || request.createdAt?.toDate?.() || new Date();
                      return requestDate >= startDate && requestDate <= now;
                    });
                  } else {
                    // Custom date range
                    if (exportCustomFrom && exportCustomTo) {
                      const fromDate = new Date(exportCustomFrom);
                      const toDate = new Date(exportCustomTo);
                      
                      filteredRequests = refundRequests.filter(request => {
                        const requestDate = request.expenseDate?.toDate?.() || request.createdAt?.toDate?.() || new Date();
                        return requestDate >= fromDate && requestDate <= toDate;
                      });
                    }
                  }
                  
                    // Generate and export PDF
                    await generateUnifiedPDF(filteredRequests, 'refunds', exportDateRange, exportCustomFrom, exportCustomTo);
                    setSuccess('PDF report downloaded successfully!');
                    setExportModalOpen(false);
                  } catch (error) {
                    setError('Failed to generate PDF. Please try again.');
                    console.error('PDF generation error:', error);
                  } finally {
                    setIsGeneratingPDF(false);
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

      <AdminBottomNavBar active="expenses" />
    </main>
  );
}
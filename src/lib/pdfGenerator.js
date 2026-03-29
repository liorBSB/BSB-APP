import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import i18n from '@/i18n';

const PAGE_WIDTH = 210;
const MARGIN = 15;
const USABLE_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const HEADER_COLOR = [7, 99, 50]; // primaryGreen
const LINK_COLOR = [0, 90, 200];

// ---------------------------------------------------------------------------
// Font loading — fetches from public/fonts/ and caches in memory
// ---------------------------------------------------------------------------

const fontCache = {};

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunks = [];
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    chunks.push(String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize)));
  }
  return btoa(chunks.join(''));
}

async function loadFontAsBase64(url) {
  if (fontCache[url]) return fontCache[url];
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load font: ${res.status}`);
  const buf = await res.arrayBuffer();
  const b64 = arrayBufferToBase64(buf);
  fontCache[url] = b64;
  return b64;
}

let fontReady = false;
const FONT = 'NotoSansHebrew';
const FALLBACK = 'helvetica';

async function registerFonts(doc) {
  try {
    const [regular, bold] = await Promise.all([
      loadFontAsBase64('/fonts/NotoSansHebrew-Regular.ttf'),
      loadFontAsBase64('/fonts/NotoSansHebrew-Bold.ttf'),
    ]);

    doc.addFileToVFS('NotoSansHebrew-Regular.ttf', regular);
    doc.addFont('NotoSansHebrew-Regular.ttf', FONT, 'normal');

    doc.addFileToVFS('NotoSansHebrew-Bold.ttf', bold);
    doc.addFont('NotoSansHebrew-Bold.ttf', FONT, 'bold');

    fontReady = true;
    doc.setFont(FONT, 'normal');
  } catch (err) {
    console.warn('Font registration failed, using helvetica:', err);
    fontReady = false;
    doc.setFont(FALLBACK, 'normal');
  }
}

function font() { return fontReady ? FONT : FALLBACK; }

// ---------------------------------------------------------------------------
// RTL helpers
//
// prepareText     — full string reversal for doc.text() calls.  The reader
//                   scans the whole line R→L so everything reverses back.
//
// prepareCellText — word-by-word reversal for autotable cells.  Autotable
//                   wraps text LTR, so we only flip each Hebrew word's
//                   characters and keep word order intact.
// ---------------------------------------------------------------------------

const HEBREW_RE = /[\u0590-\u05FF]/;

function prepareText(text) {
  if (!text || typeof text !== 'string') return text || '';
  if (!HEBREW_RE.test(text)) return text;
  return [...text].reverse().join('');
}

function prepareCellText(text) {
  if (!text || typeof text !== 'string') return text || '';
  if (!HEBREW_RE.test(text)) return text;
  return text
    .split(' ')
    .map(word => HEBREW_RE.test(word) ? [...word].reverse().join('') : word)
    .join(' ');
}

function isRTL() { return i18n.language === 'he'; }

function reverseColumnStyles(styles, colCount) {
  const reversed = {};
  for (const [key, value] of Object.entries(styles)) {
    reversed[colCount - 1 - parseInt(key)] = value;
  }
  return reversed;
}

// ---------------------------------------------------------------------------
// Image loading — fetch via proxy, detect format from Content-Type
// ---------------------------------------------------------------------------

async function loadImageAsBase64(photoUrl, timeoutMs = 10000) {
  const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(photoUrl)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(proxyUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    let format = 'JPEG';
    if (contentType.includes('png')) format = 'PNG';
    else if (contentType.includes('gif')) format = 'GIF';
    else if (contentType.includes('webp')) format = 'WEBP';

    const buf = await res.arrayBuffer();
    const b64 = arrayBufferToBase64(buf);
    return { data: `data:${contentType};base64,${b64}`, format };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Date formatting — always dd/mm/yy
// ---------------------------------------------------------------------------

function fmtDate(d) {
  if (!d) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

function t(key, fallback) {
  const fromExpenses = i18n.t(key, { ns: 'expenses' });
  if (fromExpenses && fromExpenses !== key) return fromExpenses;
  const fromAdmin = i18n.t(key, { ns: 'admin' });
  return fromAdmin === key ? fallback : fromAdmin;
}

function addHeader(doc, title, dateInfo) {
  doc.setFontSize(22);
  doc.setFont(font(), 'bold');
  doc.text(prepareText(title), PAGE_WIDTH / 2, 22, { align: 'center' });

  const genText = `${t('pdf_generated_on', 'Generated on')}: ${fmtDate(new Date())}`;
  doc.setFontSize(11);
  doc.setFont(font(), 'normal');
  doc.setTextColor(100);
  doc.text(prepareText(genText), PAGE_WIDTH / 2, 30, { align: 'center' });

  let y = 33;
  if (dateInfo) {
    doc.text(prepareText(dateInfo), PAGE_WIDTH / 2, 38, { align: 'center' });
    y = 41;
  }

  doc.setTextColor(0);
  return y;
}

function addSummaryLines(doc, lines, startY) {
  let y = startY + 8;
  const summaryLabel = t('pdf_summary', 'Summary');
  const rtl = isRTL();
  const x = rtl ? PAGE_WIDTH - MARGIN : MARGIN;
  const align = rtl ? { align: 'right' } : {};

  doc.setFontSize(14);
  doc.setFont(font(), 'bold');
  doc.text(prepareText(summaryLabel), x, y, align);
  y += 7;

  doc.setFontSize(11);
  doc.setFont(font(), 'normal');
  for (const line of lines) {
    doc.text(prepareText(line), x, y, align);
    y += 6;
  }
  return y;
}

// ---------------------------------------------------------------------------
// Photo gallery
// ---------------------------------------------------------------------------

async function addPhotoGallery(doc, items, getAllPhotoUrls, galleryTitle, onProgress) {
  const entries = [];
  for (let idx = 0; idx < items.length; idx++) {
    const urls = getAllPhotoUrls(items[idx]);
    for (const url of urls) {
      entries.push({ url, originalIndex: idx + 1 });
    }
  }

  if (entries.length === 0) return;

  doc.addPage();
  doc.setFontSize(16);
  doc.setFont(font(), 'bold');
  doc.text(prepareText(galleryTitle), PAGE_WIDTH / 2, 22, { align: 'center' });

  const totalText = `${t('pdf_total_photos', 'Total Photos')}: ${entries.length}`;
  doc.setFontSize(11);
  doc.setFont(font(), 'normal');
  doc.text(prepareText(totalText), PAGE_WIDTH / 2, 30, { align: 'center' });

  const photoW = 120;
  const photoH = 90;
  const labelH = 8;
  const gap = 10;
  let y = 42;

  for (let i = 0; i < entries.length; i++) {
    const { url, originalIndex } = entries[i];
    const x = (PAGE_WIDTH - photoW) / 2;

    if (y + labelH + photoH > 280) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(10);
    doc.setFont(font(), 'bold');
    doc.text(`#${originalIndex}`, x, y);

    const imgResult = await loadImageAsBase64(url);
    if (imgResult) {
      try {
        doc.addImage(imgResult.data, imgResult.format, x, y + 3, photoW, photoH);
      } catch {
        drawPlaceholder(doc, x, y + 3, photoW, photoH);
      }
    } else {
      drawPlaceholder(doc, x, y + 3, photoW, photoH);
    }

    if (onProgress) onProgress(i + 1, entries.length);

    y += photoH + labelH + gap;
  }
}

function drawPlaceholder(doc, x, y, w, h) {
  doc.setFillColor(245, 245, 245);
  doc.rect(x, y, w, h, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(x, y, w, h, 'S');
  doc.setFontSize(10);
  doc.setFont(font(), 'normal');
  doc.setTextColor(150);
  doc.text('No image', x + w / 2, y + h / 2 + 3, { align: 'center' });
  doc.setTextColor(0);
}

// ---------------------------------------------------------------------------
// Table link rendering (photo column) — clean approach
// ---------------------------------------------------------------------------

function createTableHooks(items, photoColIndex, getPhotoUrl) {
  return {
    didParseCell(data) {
      if (data.section === 'body' && fontReady) {
        data.cell.styles.font = FONT;
      }
      if (data.column.index === photoColIndex && data.section === 'body') {
        const item = items[data.row.index];
        if (getPhotoUrl(item)) {
          data.cell.styles.textColor = LINK_COLOR;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    didDrawCell(data) {
      if (data.column.index === photoColIndex && data.section === 'body') {
        const item = items[data.row.index];
        const url = getPhotoUrl(item);
        if (url) {
          const rowNum = data.row.index + 1;
          const downloadUrl = `${window.location.origin}/api/proxy-image?download=1&name=receipt_${rowNum}&url=${encodeURIComponent(url)}`;
          data.doc.link(
            data.cell.x, data.cell.y,
            data.cell.width, data.cell.height,
            { url: downloadUrl },
          );
        }
      }
    },
  };
}

// ---------------------------------------------------------------------------
// PDF file delivery
// ---------------------------------------------------------------------------

function triggerPdfDownload(doc, fileName) {
  const blob = doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);

  try {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch {
    // Fallback for environments that block programmatic anchor downloads.
    doc.save(fileName);
  } finally {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
  }
}

// ---------------------------------------------------------------------------
// Date range helpers
// ---------------------------------------------------------------------------

function formatDateRange(dateRange, customFrom, customTo) {
  if (!dateRange || dateRange === 'all') return null;

  if (dateRange === 'custom' && customFrom && customTo) {
    return `${t('pdf_from', 'From')}: ${fmtDate(new Date(customFrom))}  ${t('pdf_to', 'To')}: ${fmtDate(new Date(customTo))}`;
  }

  const DAY = 86400000;
  const now = new Date();
  let start;
  switch (dateRange) {
    case 'pastDay':    case 'lastDay':     start = new Date(now.getTime() - DAY); break;
    case 'pastWeek':   case 'lastWeek':    start = new Date(now.getTime() - 7 * DAY); break;
    case 'pastMonth':  case 'lastMonth':   start = new Date(now.getTime() - 30 * DAY); break;
    case 'last3Months':                     start = new Date(now.getTime() - 90 * DAY); break;
    case 'lastYear':                        start = new Date(now.getTime() - 365 * DAY); break;
    default:          return null;
  }
  return `${t('pdf_from', 'From')}: ${fmtDate(start)}  ${t('pdf_to', 'To')}: ${fmtDate(now)}`;
}

export function getDateRangeLabel(dateRange) {
  switch (dateRange) {
    case 'pastDay':   return '1_Day';
    case 'pastWeek':  return '7_Days';
    case 'pastMonth': return '30_Days';
    case 'custom':    return 'Custom';
    default:          return 'All';
  }
}

// ---------------------------------------------------------------------------
// Expenses PDF
// ---------------------------------------------------------------------------

export async function generateExpensesPDF(items, options = {}) {
  const { dateRange, customFrom, customTo, onProgress } = options;

  if (!items || items.length === 0) throw new Error('No items to export');

  const doc = new jsPDF();
  await registerFonts(doc);

  let dateInfo = formatDateRange(dateRange, customFrom, customTo);
  if (!dateInfo) {
    const dates = items
      .map(i => i.expenseDate?.toDate?.() || null)
      .filter(Boolean)
      .sort((a, b) => a - b);
    if (dates.length > 0) {
      dateInfo = `${t('pdf_from', 'From')}: ${fmtDate(dates[0])}  ${t('pdf_to', 'To')}: ${fmtDate(dates[dates.length - 1])}`;
    }
  }
  let y = addHeader(doc, t('pdf_expenses_title', 'Expenses Report'), dateInfo);

  const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  y = addSummaryLines(doc, [
    `${t('pdf_total_items', 'Total Expenses')}: ${items.length}`,
    `${t('pdf_total_amount', 'Total Amount')}: ${totalAmount.toFixed(2)} ₪`,
  ], y);

  //  #   Title  Category Amount Date  Notes  Payment  CreatedBy  Photo
  //  8   26     22       18     20    18     24       20         24    = 180
  let headers = [
    t('pdf_col_row', '#'),
    t('pdf_col_title', 'Title'),
    t('pdf_col_category', 'Category'),
    t('pdf_col_amount', 'Amount'),
    t('pdf_col_date', 'Date'),
    t('pdf_col_notes', 'Notes'),
    t('pdf_col_payment', 'Payment'),
    t('pdf_col_created_by', 'Created By'),
    t('pdf_col_photo', 'Photo'),
  ].map(prepareCellText);

  const getPhotoUrl = (item) => item.photos?.[0]?.url || item.photoUrl || null;
  const getAllPhotoUrls = (item) => {
    if (item.photos?.length > 0) return item.photos.map(p => p.url);
    return item.photoUrl ? [item.photoUrl] : [];
  };

  let colStyles = {
    0: { cellWidth: 8, halign: 'center' },
    1: { cellWidth: 26 },
    2: { cellWidth: 22 },
    3: { cellWidth: 22, halign: 'right' },
    4: { cellWidth: 20, halign: 'center' },
    5: { cellWidth: 16 },
    6: { cellWidth: 22 },
    7: { cellWidth: 20 },
    8: { cellWidth: 24, halign: 'center' },
  };

  const body = items.map((expense, i) => [
    (i + 1).toString(),
    prepareCellText(expense.title) || '-',
    prepareCellText(expense.category) || '-',
    `${(parseFloat(expense.amount) || 0).toFixed(0)} ILS`,
    fmtDate(expense.expenseDate?.toDate?.()),
    prepareCellText(expense.notes) || '-',
    prepareCellText(expense.reimbursementMethod) || '-',
    prepareCellText(expense.createdByName) || '-',
    getPhotoUrl(expense) ? prepareCellText(t('pdf_link_download', 'Download')) : '-',
  ]);

  const rtl = isRTL();
  let photoColIdx = 8;
  if (rtl) {
    headers = headers.reverse();
    body.forEach(row => row.reverse());
    colStyles = reverseColumnStyles(colStyles, 9);
    photoColIdx = 0;
  }

  const hooks = createTableHooks(items, photoColIdx, getPhotoUrl);

  autoTable(doc, {
    startY: y + 4,
    head: [headers],
    body,
    theme: 'grid',
    headStyles: {
      fillColor: HEADER_COLOR,
      textColor: 255,
      fontSize: 11,
      fontStyle: 'bold',
      halign: 'center',
      font: font(),
    },
    bodyStyles: { fontSize: 10, halign: rtl ? 'right' : 'left', font: font() },
    columnStyles: colStyles,
    margin: { top: 20, right: MARGIN, bottom: 20, left: MARGIN },
    styles: { lineWidth: 0.3, lineColor: [200, 200, 200] },
    didParseCell: hooks.didParseCell,
    didDrawCell: hooks.didDrawCell,
  });

  await addPhotoGallery(
    doc, items, getAllPhotoUrls,
    t('pdf_photo_gallery', 'Photos Gallery'),
    onProgress,
  );

  const fileName = `expenses_report_${new Date().toISOString().slice(0, 10)}.pdf`;
  triggerPdfDownload(doc, fileName);
}

// ---------------------------------------------------------------------------
// Refund Requests PDF
// ---------------------------------------------------------------------------

export async function generateRefundsPDF(items, options = {}) {
  const { dateRange, customFrom, customTo, onProgress } = options;

  if (!items || items.length === 0) throw new Error('No items to export');

  const doc = new jsPDF();
  await registerFonts(doc);

  const dateInfo = formatDateRange(dateRange, customFrom, customTo);
  let y = addHeader(doc, t('pdf_refund_title', 'Refund Requests Report'), dateInfo);

  const approved = items.filter(r => r.status === 'approved').length;
  const denied   = items.filter(r => r.status === 'denied').length;
  const pending  = items.filter(r => r.status === 'waiting').length;
  const totalAmt = items.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  y = addSummaryLines(doc, [
    `${t('pdf_approved', 'Approved')}: ${approved}`,
    `${t('pdf_denied', 'Denied')}: ${denied}`,
    `${t('pdf_pending', 'Pending')}: ${pending}`,
    `${t('pdf_total_amount', 'Total Amount')}: ${totalAmt.toFixed(2)} ₪`,
  ], y);

  //  #   Title  Amount  Method  Name   Room  Date   Status  Receipt
  //  8   24     18      20      28     12    22     18      30       = 180
  let headers = [
    t('pdf_col_row', '#'),
    t('pdf_col_title', 'Title'),
    t('pdf_col_amount', 'Amount'),
    t('pdf_col_method', 'Method'),
    t('pdf_col_name', 'Name'),
    t('pdf_col_room', 'Room'),
    t('pdf_col_date', 'Date'),
    t('pdf_col_status', 'Status'),
    t('pdf_col_receipt', 'Receipt'),
  ].map(prepareCellText);

  const getPhotoUrl = (item) => item.photos?.[0]?.url || item.photoUrl || item.receiptPhotoUrl || null;
  const getAllPhotoUrls = (item) => {
    if (item.photos?.length > 0) return item.photos.map(p => p.url);
    if (item.photoUrl) return [item.photoUrl];
    if (item.receiptPhotoUrl) return [item.receiptPhotoUrl];
    return [];
  };

  const statusLabel = (s) => {
    if (s === 'approved') return t('pdf_approved', 'Approved');
    if (s === 'denied')   return t('pdf_denied', 'Denied');
    if (s === 'waiting')  return t('pdf_pending', 'Pending');
    return s || '-';
  };

  let colStyles = {
    0: { cellWidth: 8, halign: 'center' },
    1: { cellWidth: 24 },
    2: { cellWidth: 18, halign: 'right' },
    3: { cellWidth: 20 },
    4: { cellWidth: 28 },
    5: { cellWidth: 12, halign: 'center' },
    6: { cellWidth: 22, halign: 'center' },
    7: { cellWidth: 18, halign: 'center' },
    8: { cellWidth: 30, halign: 'center' },
  };

  const body = items.map((req, i) => {
    const room = req.ownerRoomNumber ? req.ownerRoomNumber.replace(/[^0-9]/g, '') : '-';
    const date = fmtDate(req.expenseDate?.toDate?.() || req.createdAt?.toDate?.());

    return [
      (i + 1).toString(),
      prepareCellText(req.title) || '-',
      `${parseFloat(req.amount) || 0} ILS`,
      prepareCellText(req.repaymentMethod || req.reimbursementMethod) || '-',
      prepareCellText(req.ownerName) || '-',
      room,
      date,
      prepareCellText(statusLabel(req.status)),
      getPhotoUrl(req) ? prepareCellText(t('pdf_link_download', 'Download')) : '-',
    ];
  });

  const rtl = isRTL();
  let photoColIdx = 8;
  if (rtl) {
    headers = headers.reverse();
    body.forEach(row => row.reverse());
    colStyles = reverseColumnStyles(colStyles, 9);
    photoColIdx = 0;
  }

  const hooks = createTableHooks(items, photoColIdx, getPhotoUrl);

  autoTable(doc, {
    startY: y + 4,
    head: [headers],
    body,
    theme: 'grid',
    headStyles: {
      fillColor: HEADER_COLOR,
      textColor: 255,
      fontSize: 11,
      fontStyle: 'bold',
      halign: 'center',
      font: font(),
    },
    bodyStyles: { fontSize: 10, halign: rtl ? 'right' : 'left', font: font() },
    columnStyles: colStyles,
    margin: { top: 20, right: MARGIN, bottom: 20, left: MARGIN },
    styles: { lineWidth: 0.3, lineColor: [200, 200, 200] },
    didParseCell: hooks.didParseCell,
    didDrawCell: hooks.didDrawCell,
  });

  await addPhotoGallery(
    doc, items, getAllPhotoUrls,
    t('pdf_receipt_gallery', 'Receipt Photos Gallery'),
    onProgress,
  );

  const fileName = `RefundReport_${getDateRangeLabel(dateRange)}_${new Date().toISOString().slice(0, 10)}.pdf`;
  triggerPdfDownload(doc, fileName);
}

/**
 * Single source of truth for the mapping between Hebrew Google Sheet columns
 * and English field names used in the app (Firestore + UI).
 *
 * Every entry: { sheet: 'Hebrew column header', app: 'englishFieldName', ... }
 *   - isDate:       true if the value needs date-format conversion
 *   - isCalculated:  true if the column is auto-calculated in the sheet
 *                   (read from sheet, NEVER written back by the app)
 */

export const FIELD_MAP = [
  // ── Identity ───────────────────────────────────────────────────────
  { sheet: 'שם פרטי', app: 'firstName' },
  { sheet: 'שם משפחה', app: 'lastName' },
  { sheet: 'שם מלא                                  (מילוי אוטומטי: לא לגעת)', app: 'fullName', isCalculated: true },
  { sheet: 'מספר זהות', app: 'idNumber' },
  { sheet: 'סוג תעודה', app: 'idType' },
  { sheet: 'מגדר', app: 'gender' },
  { sheet: 'תאריך לידה', app: 'dateOfBirth', isDate: true },
  { sheet: 'גיל', app: 'age', isCalculated: true },
  { sheet: 'ארץ מוצא', app: 'countryOfOrigin' },

  // ── Contact ────────────────────────────────────────────────────────
  { sheet: 'מספר סלולרי', app: 'phone' },
  { sheet: 'כתובת מייל חייל', app: 'email' },

  // ── Housing ────────────────────────────────────────────────────────
  { sheet: 'חדר', app: 'roomNumber' },
  { sheet: 'קומה', app: 'floor' },
  { sheet: 'אפיון חדר', app: 'roomType' },
  { sheet: 'סטטוס חדר (מילוי אוטומטי: לא לגעת)', app: 'roomStatus', isCalculated: true },
  { sheet: 'מגדר חדר', app: 'roomGender', isCalculated: true },
  { sheet: 'תאריך כניסה לבית (חתימת החוזה)', app: 'contractDate', isDate: true },

  // ── Background ─────────────────────────────────────────────────────
  { sheet: 'מקום מגורים לפני הבית', app: 'previousAddress' },
  { sheet: 'השכלה', app: 'education' },
  { sheet: 'רישיון', app: 'license' },

  // ── Family ─────────────────────────────────────────────────────────
  { sheet: 'משפחה בארץ', app: 'familyInIsrael' },
  { sheet: 'שם האב', app: 'fatherName' },
  { sheet: 'טלפון האב', app: 'fatherPhone' },
  { sheet: 'שם האם', app: 'motherName' },
  { sheet: 'טלפון האם', app: 'motherPhone' },
  { sheet: 'מצב ההורים', app: 'parentsStatus' },
  { sheet: 'כתובת מגורים הורים', app: 'parentsAddress' },
  { sheet: 'כתובת מייל הורים', app: 'parentsEmail' },
  { sheet: 'קשר עם ההורים', app: 'contactWithParents' },

  // ── Emergency contact ──────────────────────────────────────────────
  { sheet: 'שם איש קשר בארץ', app: 'emergencyContactName' },
  { sheet: 'מספר טלפון איש קשר בארץ', app: 'emergencyContactPhone' },
  { sheet: 'כתובת מגורים איש קשר בארץ', app: 'emergencyContactAddress' },
  { sheet: 'כתובת מייל איש קשר בארץ', app: 'emergencyContactEmail' },

  // ── Military ───────────────────────────────────────────────────────
  { sheet: 'מספר אישי', app: 'personalNumber' },
  { sheet: 'תאריך גיוס', app: 'enlistmentDate', isDate: true },
  { sheet: 'תאריך שחרור סדיר ', app: 'releaseDate', isDate: true },
  { sheet: 'יחידה', app: 'unit' },
  { sheet: 'גדוד', app: 'battalion' },
  { sheet: 'שם משקית תש', app: 'mashakitTash' },
  { sheet: 'טלפון משקית תש', app: 'mashakitPhone' },
  { sheet: 'שם קצין', app: 'officerName' },
  { sheet: 'טלפון קצין', app: 'officerPhone' },
  { sheet: 'עברות משמעת', app: 'disciplinaryRecord' },

  // ── Calculated military fields ─────────────────────────────────────
  { sheet: 'חודשי שרות', app: 'serviceMonths', isCalculated: true },
  { sheet: 'טווח           חודשי שרות', app: 'serviceRange', isCalculated: true },
  { sheet: 'חודשים עד שחרור', app: 'monthsUntilRelease', isCalculated: true },
  { sheet: 'תאריך שחרור משוקלל', app: 'calculatedReleaseDate', isCalculated: true },

  // ── Health & welfare ───────────────────────────────────────────────
  { sheet: 'קופת חולים לפני הצבא', app: 'healthFund' },
  { sheet: 'בעיות רפואיות', app: 'medicalProblems' },
  { sheet: 'אלרגיות', app: 'allergies' },
  { sheet: 'אשפוזים', app: 'hospitalizations' },
  { sheet: 'טיפול פסיכיאטרי', app: 'psychiatricTreatment' },
  { sheet: 'תרופות קבועות', app: 'regularMedication' },

  // ── House-specific ─────────────────────────────────────────────────
  { sheet: 'רמת ניקיון', app: 'cleanlinessLevel' },
  { sheet: 'תרומות', app: 'contributions' },
  { sheet: 'הערות', app: 'notes' },
];

// ── Primary key ──────────────────────────────────────────────────────
export const PRIMARY_KEY_SHEET = 'מספר זהות';
export const PRIMARY_KEY_APP = 'idNumber';

// ── Derived look-ups (built once at import time) ─────────────────────

/** Map Hebrew column name -> entry */
export const bySheet = Object.fromEntries(FIELD_MAP.map(f => [f.sheet, f]));

/** Map English app field -> entry */
export const byApp = Object.fromEntries(FIELD_MAP.map(f => [f.app, f]));

/** Writable entries only (exclude calculated) */
export const writableFields = FIELD_MAP.filter(f => !f.isCalculated);

/** Date entries */
export const dateFields = FIELD_MAP.filter(f => f.isDate);

// ── Conversion helpers ───────────────────────────────────────────────

/**
 * Normalize any date value (Date object, ISO string, DD/MM/YY, DD/MM/YYYY)
 * into a consistent DD/MM/YYYY string for storage.
 * Returns '' for falsy / unparseable input.
 */
export function normalizeDate(value) {
  if (!value) return '';

  if (typeof value === 'string') {
    const ddmm = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (ddmm) {
      const day = ddmm[1].padStart(2, '0');
      const month = ddmm[2].padStart(2, '0');
      let year = ddmm[3];
      if (year.length === 2) year = `20${year}`;
      return `${day}/${month}/${year}`;
    }
  }

  try {
    const d = typeof value === 'string' ? new Date(value) : value;
    if (!(d instanceof Date) || isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '';
  }
}

/**
 * Convert a full Google Sheets row (keyed by Hebrew headers) into an
 * app-format object (keyed by English field names).
 */
export function sheetRowToApp(sheetRow) {
  const result = {};
  for (const field of FIELD_MAP) {
    let value = sheetRow[field.sheet];
    if (value === undefined || value === null) value = '';
    if (field.isDate && value) value = normalizeDate(value);
    if (field.app === 'familyInIsrael') {
      value = value === 'כן' || value === true || value === 'TRUE';
    }
    result[field.app] = value;
  }
  return result;
}

/**
 * Convert an app-format object into a partial Google Sheets row
 * (only writable, non-calculated fields). Used for app -> sheet writes.
 */
export function appToSheetRow(appData) {
  const result = {};
  for (const field of writableFields) {
    let value = appData[field.app];
    if (value === undefined || value === null) continue;
    if (field.isDate && value) value = normalizeDate(value);
    if (field.app === 'familyInIsrael') {
      value = value === true ? 'כן' : value === false ? 'לא' : value;
    }
    result[field.sheet] = value;
  }
  return result;
}

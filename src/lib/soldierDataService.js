// src/lib/soldierDataService.js

// ============================================================================
// SOLDIER DATA SERVICE - Google Sheets Integration
// ============================================================================

/**
 * Service for managing soldier data from Google Sheets
 * Handles reading soldier information and syncing with the app
 */

// Configuration for soldier data sheet
const SOLDIER_SHEETS_CONFIG = {
  // Use the correct environment variable for soldier data
  spreadsheetId: process.env.NEXT_PUBLIC_SOLDIER_SHEETS_ID,
  sheetName: 'soldiers', // Name of the sheet with soldier data
  // Use the correct Google Apps Script URL from environment
  scriptUrl: process.env.NEXT_PUBLIC_SOLDIER_SHEETS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbxoHAGC70TiJ5wrad25gsWtqjIi_oC_bkPCCmxPEdfXI9Xq_ZZn_ZYgpfmMY63E6lhmuQ/exec'
};


/**
 * Get all soldiers from Google Sheets
 * Returns array of soldier objects with all their data
 */
export const getAllSoldiers = async () => {
  try {
    if (!SOLDIER_SHEETS_CONFIG.spreadsheetId) {
      throw new Error('Google Sheets ID is not configured. Please set NEXT_PUBLIC_SOLDIER_SHEETS_ID environment variable.');
    }
    
    const url = `${SOLDIER_SHEETS_CONFIG.scriptUrl}?action=getAllSoldiers&spreadsheetId=${SOLDIER_SHEETS_CONFIG.spreadsheetId}&sheetName=${SOLDIER_SHEETS_CONFIG.sheetName}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch soldiers: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch soldiers');
    }
    
    return data.soldiers || [];
  } catch (error) {
    console.error('Error fetching soldiers:', error);
    throw error;
  }
};

/**
 * Search soldiers by name (for autocomplete)
 * @param {string} searchTerm - Partial name to search for
 * @returns {Array} Array of matching soldiers
 */
export const searchSoldiersByName = async (searchTerm) => {
  try {
    if (!searchTerm || searchTerm.length < 2) {
      return [];
    }
    
    if (!SOLDIER_SHEETS_CONFIG.spreadsheetId) {
      throw new Error('Google Sheets ID is not configured. Please set NEXT_PUBLIC_SOLDIER_SHEETS_ID environment variable.');
    }
    
    // Normalize the search term - remove extra spaces
    const normalizedSearchTerm = searchTerm.replace(/\s+/g, ' ').trim();
    
    const url = `${SOLDIER_SHEETS_CONFIG.scriptUrl}?action=searchSoldiers&searchTerm=${encodeURIComponent(normalizedSearchTerm)}&spreadsheetId=${SOLDIER_SHEETS_CONFIG.spreadsheetId}&sheetName=${SOLDIER_SHEETS_CONFIG.sheetName}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to search soldiers: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to search soldiers');
    }
    
    // Also try a search without spaces as fallback
    if (data.soldiers.length === 0 && normalizedSearchTerm.includes(' ')) {
      const searchWithoutSpaces = normalizedSearchTerm.replace(/\s/g, '');
      const fallbackUrl = `${SOLDIER_SHEETS_CONFIG.scriptUrl}?action=searchSoldiers&searchTerm=${encodeURIComponent(searchWithoutSpaces)}&spreadsheetId=${SOLDIER_SHEETS_CONFIG.spreadsheetId}&sheetName=${SOLDIER_SHEETS_CONFIG.sheetName}`;
      
      const fallbackResponse = await fetch(fallbackUrl);
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        if (fallbackData.success) {
          return fallbackData.soldiers || [];
        }
      }
    }
    
    return data.soldiers || [];
  } catch (error) {
    console.error('Error searching soldiers:', error);
    throw error;
  }
};



/**
 * Get value from sheet data, preserving 0 and other falsy values
 * @param {Object} sheetData - The sheet data object
 * @param {string} key - The key to look for
 * @returns {*} The value or empty string if undefined/null
 */
const getSheetValue = (sheetData, key) => {
  return sheetData[key] !== undefined && sheetData[key] !== null ? sheetData[key] : '';
};

/**
 * Map Google Sheets data to app format
 * Converts the Hebrew column names to English field names
 */
export const mapSoldierData = (sheetData) => {
  if (!sheetData) return null;
  
  
  return {
    // Basic info
    fullName: sheetData['שם מלא                                  (מילוי אוטומטי: לא לגעת)'] || '',
    firstName: sheetData['שם פרטי'] || '',
    lastName: sheetData['שם משפחה'] || '',
    
    // Room info
    roomNumber: sheetData['חדר'] || '',
    floor: getSheetValue(sheetData, 'קומה'),
    roomType: sheetData['אפיון חדר'] || '',
    roomStatus: sheetData['סטטוס חדר (מילוי אוטומטי: לא לגעת)'] || '',
    serviceMonths: getSheetValue(sheetData, 'חודשי שרות'),
    serviceRange: sheetData['טווח           חודשי שרות'] || '',
    monthsUntilRelease: getSheetValue(sheetData, 'חודשים עד שחרור'),
    age: getSheetValue(sheetData, 'גיל'),
    calculatedReleaseDate: sheetData['תאריך שחרור משוקלל'] || '',
    roomGender: sheetData['מגדר חדר'] || '',
    
    // Personal info
    gender: sheetData['מגדר'] || '',
    dateOfBirth: sheetData['תאריך לידה'] || '',
    idNumber: sheetData['מספר זהות'] || '',
    idType: sheetData['סוג תעודה'] || '',
    countryOfOrigin: sheetData['ארץ מוצא'] || '',
    phone: sheetData['מספר סלולרי'] || '',
    email: sheetData['כתובת מייל חייל'] || '',
    previousAddress: sheetData['מקום מגורים לפני הבית'] || '',
    education: sheetData['השכלה'] || '',
    license: sheetData['רישיון'] || '',
    
    // Family info
    familyInIsrael: sheetData['משפחה בארץ'] || false,
    fatherName: sheetData['שם האב'] || '',
    fatherPhone: sheetData['טלפון האב'] || '',
    motherName: sheetData['שם האם'] || '',
    motherPhone: sheetData['טלפון האם'] || '',
    parentsStatus: sheetData['מצב ההורים'] || '',
    parentsAddress: sheetData['כתובת מגורים הורים'] || '',
    parentsEmail: sheetData['כתובת מייל הורים'] || '',
    contactWithParents: sheetData['קשר עם ההורים'] || '',
    
    // Emergency contact
    emergencyContactName: sheetData['שם איש קשר בארץ'] || '',
    emergencyContactPhone: sheetData['מספר טלפון איש קשר בארץ'] || '',
    emergencyContactAddress: sheetData['כתובת מגורים איש קשר בארץ'] || '',
    emergencyContactEmail: sheetData['כתובת מייל איש קשר בארץ'] || '',
    
    // Military info
    personalNumber: sheetData['מספר אישי'] || '',
    enlistmentDate: sheetData['תאריך גיוס'] || '',
    releaseDate: getSheetValue(sheetData, 'תאריך שחרור סדיר '),
    unit: sheetData['יחידה'] || '',
    battalion: getSheetValue(sheetData, 'גדוד'),
    mashakitTash: sheetData['שם משקית תש'] || '',
    mashakitPhone: sheetData['טלפון משקית תש'] || '',
    officerName: sheetData['שם קצין'] || '',
    officerPhone: sheetData['טלפון קצין'] || '',
    disciplinaryRecord: sheetData['עברות משמעת'] || '',
    
    // Medical info
    healthFund: getSheetValue(sheetData, 'קופת חולים לפני הצבא'),
    
    // Additional info
    cleanlinessLevel: getSheetValue(sheetData, 'רמת ניקיון'),
    contractDate: sheetData['תאריך כניסה לבית (חתימת החוזה)'] || '',
    
    // Metadata
    lastUpdated: new Date().toISOString()
  };
};

/**
 * Validate soldier data
 * @param {Object} soldierData - Soldier data to validate
 * @returns {Object} Validation result
 */
export const validateSoldierData = (soldierData) => {
  const errors = [];
  
  if (!soldierData.fullName || soldierData.fullName.trim() === '') {
    errors.push('Full name is required');
  }
  
  if (!soldierData.roomNumber || soldierData.roomNumber.trim() === '') {
    errors.push('Room number is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Cache management
 */
let soldiersCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get soldiers with cache
 * @param {boolean} forceRefresh - Force refresh cache
 * @returns {Array} Array of soldiers
 */
export const getSoldiersWithCache = async (forceRefresh = false) => {
  const now = Date.now();
  
  if (!forceRefresh && soldiersCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
    return soldiersCache;
  }
  
  try {
    const soldiers = await getAllSoldiers();
    soldiersCache = soldiers;
    cacheTimestamp = now;
    return soldiers;
  } catch (error) {
    console.error('Error fetching soldiers with cache:', error);
    // Return cached data if available, even if expired
    return soldiersCache || [];
  }
};

/**
 * Clear cache
 */
export const clearSoldiersCache = () => {
  soldiersCache = null;
  cacheTimestamp = null;
};

export default {
  getAllSoldiers,
  searchSoldiersByName,
  mapSoldierData,
  validateSoldierData,
  getSoldiersWithCache,
  clearSoldiersCache
};

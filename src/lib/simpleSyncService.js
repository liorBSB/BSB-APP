// src/lib/simpleSyncService.js

// ============================================================================
// SIMPLE TWO-WAY SYNC SERVICE
// ============================================================================

import { 
  collection, 
  doc, 
  updateDoc, 
  getDocs, 
  getDoc,
  query, 
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { COLLECTIONS } from './database';

// Configuration
const SYNC_CONFIG = {
  spreadsheetId: process.env.NEXT_PUBLIC_SOLDIER_SHEETS_ID,
  sheetName: 'soldiers',
  scriptUrl: process.env.NEXT_PUBLIC_SOLDIER_SHEETS_SCRIPT_URL,
  syncInterval: 5 * 60 * 1000 // 5 minutes
};

/**
 * Simple sync from app to Google Sheets
 * Only updates if app data is newer than sheet data
 */
export const syncToSheets = async (userId, soldierData) => {
  try {
    console.log('📤 Syncing to sheets:', { userId, soldierName: soldierData.fullName });
    
    if (!SYNC_CONFIG.spreadsheetId || !SYNC_CONFIG.scriptUrl) {
      console.warn('⚠️ Google Sheets sync not configured');
      return { success: false, message: 'Not configured' };
    }

    // Get the current soldier data to find the original name/ID
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    const userSnap = await getDoc(userRef);
    const currentData = userSnap.exists() ? userSnap.data() : {};
    
    // Prepare data for sheets - use original identifiers for lookup
    const updateData = {
      // Use original name/ID for finding the row in sheets
      originalFullName: currentData.fullName,
      originalIdNumber: currentData.idNumber || currentData.personalNumber,
      
      // New data to update
      fullName: soldierData.fullName,
      identifier: soldierData.idNumber || soldierData.personalNumber,
      ...soldierData,
      lastAppUpdate: new Date().toISOString()
    };

    // Call Google Apps Script
    const url = `${SYNC_CONFIG.scriptUrl}?action=updateSoldierData&spreadsheetId=${SYNC_CONFIG.spreadsheetId}&sheetName=${SYNC_CONFIG.sheetName}&data=${encodeURIComponent(JSON.stringify(updateData))}`;
    
    console.log('📡 Calling Google Apps Script URL:', SYNC_CONFIG.scriptUrl);
    console.log('📦 Sending data:', {
      originalFullName: updateData.originalFullName,
      originalIdNumber: updateData.originalIdNumber,
      newFullName: updateData.fullName,
      newIdentifier: updateData.identifier,
      userId: userId
    });
    
    const response = await fetch(url, { method: 'GET' });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('✅ Synced to sheets:', soldierData.fullName);
    return { success: true };

  } catch (error) {
    console.warn('⚠️ Failed to sync to sheets:', error.message);
    return { success: false, message: error.message };
  }
};

/**
 * Simple sync from Google Sheets to app
 * Sheets data always wins in conflicts
 */
export const syncFromSheets = async () => {
  try {
    if (!SYNC_CONFIG.spreadsheetId || !SYNC_CONFIG.scriptUrl) {
      return { success: false, message: 'Not configured' };
    }

    // Get soldiers from sheets
    const url = `${SYNC_CONFIG.scriptUrl}?action=getAllSoldiers&spreadsheetId=${SYNC_CONFIG.spreadsheetId}&sheetName=${SYNC_CONFIG.sheetName}`;
    
    const response = await fetch(url, { method: 'GET' });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error);
    }

    const sheetsSoldiers = result.soldiers || [];
    
    // Get app soldiers
    const usersQuery = query(
      collection(db, COLLECTIONS.USERS),
      where('userType', '==', 'user')
    );
    const usersSnap = await getDocs(usersQuery);
    const appSoldiers = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    let updatedCount = 0;

    // Process each soldier from sheets
    for (const sheetSoldier of sheetsSoldiers) {
      let fullName = 'unknown';
      let idNumber = 'unknown';
      let matchingSoldier = null;
      
      try {
        fullName = String(sheetSoldier['שם מלא                                  (מילוי אוטומטי: לא לגעת)'] || '').trim();
        idNumber = String(sheetSoldier['מספר זהות'] || '').trim();
        
        if (!fullName && !idNumber) continue;

        // Find matching soldier in app
        matchingSoldier = appSoldiers.find(soldier => 
          (soldier.fullName && String(soldier.fullName).trim() === fullName) ||
          (soldier.idNumber && String(soldier.idNumber).trim() === idNumber)
        );

        if (!matchingSoldier) continue;

        // Map sheet data to app format
        const mappedData = mapSheetDataToApp(sheetSoldier);
        
        // Simple rule: Only update if there are actual differences
        const hasChanges = Object.keys(mappedData).some(key => {
          const appValue = String(matchingSoldier[key] || '').trim();
          const sheetValue = String(mappedData[key] || '').trim();
          return appValue !== sheetValue;
        });

        if (hasChanges) {
          // Update soldier data in app (sheets data wins)
          const userRef = doc(db, COLLECTIONS.USERS, matchingSoldier.id);
          await updateDoc(userRef, {
            ...mappedData,
            lastSyncFromSheets: Timestamp.now(),
            updatedAt: Timestamp.now()
          });

          updatedCount++;
          console.log('📥 Updated from sheets:', fullName);
        }

      } catch (error) {
        console.error('Error processing soldier:', {
          fullName,
          idNumber,
          error: error.message,
          soldierData: matchingSoldier ? {
            id: matchingSoldier.id,
            fullName: matchingSoldier.fullName,
            idNumber: matchingSoldier.idNumber,
            idNumberType: typeof matchingSoldier.idNumber
          } : 'not found'
        });
      }
    }

    console.log(`✅ Sync from sheets complete: ${updatedCount} soldiers updated`);
    return { success: true, updated: updatedCount };

  } catch (error) {
    console.warn('⚠️ Failed to sync from sheets:', error.message);
    return { success: false, message: error.message };
  }
};

/**
 * Map Google Sheets data to app format (simplified)
 * Excludes calculated fields that should stay in sheets
 */
const mapSheetDataToApp = (sheetData) => {
  // Helper function to convert dates from sheets format to app format
  const convertSheetDate = (dateValue) => {
    if (!dateValue) return '';
    
    // If it's already in DD/MM/YY format, keep it
    if (typeof dateValue === 'string' && dateValue.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) {
      return dateValue;
    }
    
    // If it's a date object or ISO string, convert to DD/MM/YY
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return '';
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear()).slice(-2);
      
      return `${day}/${month}/${year}`;
    } catch (error) {
      return '';
    }
  };

  return {
    fullName: sheetData['שם מלא                                  (מילוי אוטומטי: לא לגעת)'] || '',
    firstName: sheetData['שם פרטי'] || '',
    lastName: sheetData['שם משפחה'] || '',
    roomNumber: sheetData['חדר'] || '',
    floor: sheetData['קומה'] || '',
    gender: sheetData['מגדר'] || '',
    dateOfBirth: convertSheetDate(sheetData['תאריך לידה']),
    idNumber: sheetData['מספר זהות'] || '',
    idType: sheetData['סוג תעודה'] || '',
    countryOfOrigin: sheetData['ארץ מוצא'] || '',
    phone: sheetData['מספר סלולרי'] || '',
    email: sheetData['כתובת מייל חייל'] || '',
    previousAddress: sheetData['מקום מגורים לפני הבית'] || '',
    education: sheetData['השכלה'] || '',
    license: sheetData['רישיון'] || '',
    familyInIsrael: sheetData['משפחה בארץ'] === 'כן' || sheetData['משפחה בארץ'] === true,
    fatherName: sheetData['שם האב'] || '',
    fatherPhone: sheetData['טלפון האב'] || '',
    motherName: sheetData['שם האם'] || '',
    motherPhone: sheetData['טלפון האם'] || '',
    parentsStatus: sheetData['מצב ההורים'] || '',
    parentsAddress: sheetData['כתובת מגורים הורים'] || '',
    parentsEmail: sheetData['כתובת מייל הורים'] || '',
    contactWithParents: sheetData['קשר עם ההורים'] || '',
    emergencyContactName: sheetData['שם איש קשר בארץ'] || '',
    emergencyContactPhone: sheetData['מספר טלפון איש קשר בארץ'] || '',
    emergencyContactAddress: sheetData['כתובת מגורים איש קשר בארץ'] || '',
    emergencyContactEmail: sheetData['כתובת מייל איש קשר בארץ'] || '',
    personalNumber: sheetData['מספר אישי'] || '',
    enlistmentDate: convertSheetDate(sheetData['תאריך גיוס']),
    releaseDate: convertSheetDate(sheetData['תאריך שחרור סדיר ']),
    unit: sheetData['יחידה'] || '',
    battalion: sheetData['גדוד'] || '',
    mashakitTash: sheetData['שם משקית תש'] || '',
    mashakitPhone: sheetData['טלפון משקית תש'] || '',
    officerName: sheetData['שם קצין'] || '',
    officerPhone: sheetData['טלפון קצין'] || '',
    disciplinaryRecord: sheetData['עברות משמעת'] || '',
    healthFund: sheetData['קופת חולים לפני הצבא'] || '',
    cleanlinessLevel: sheetData['רמת ניקיון'] || '',
    contractDate: convertSheetDate(sheetData['תאריך כניסה לבית (חתימת החוזה)'])
    
    // EXCLUDED calculated fields that should stay in sheets:
    // - גיל (age) - calculated from date of birth
    // - טווח חודשי שירות (service range) - calculated
    // - חודשי שירות (service months) - calculated
  };
};

// Simple background scheduler
class SimpleScheduler {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) return;
    
    console.log('🔄 Starting simple sync scheduler (5 min intervals)');
    this.isRunning = true;
    
    // Initial sync after 10 seconds
    setTimeout(() => {
      this.performSync();
    }, 10000);
    
    // Then every 5 minutes
    this.intervalId = setInterval(() => {
      this.performSync();
    }, SYNC_CONFIG.syncInterval);
  }

  stop() {
    if (!this.isRunning) return;
    
    console.log('⏹️ Stopping sync scheduler');
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async performSync() {
    console.log('🔄 Running scheduled sync from sheets...');
    
    // Safety check - don't run if not properly configured
    if (!SYNC_CONFIG.spreadsheetId || !SYNC_CONFIG.scriptUrl) {
      console.warn('⚠️ Sync not configured properly, skipping');
      return;
    }
    
    const result = await syncFromSheets();
    
    if (result.success) {
      console.log(`✅ Scheduled sync complete: ${result.updated || 0} updates`);
    } else {
      console.warn('⚠️ Scheduled sync failed:', result.message);
    }
  }
}

// Create singleton scheduler
const simpleScheduler = new SimpleScheduler();

// Auto-start scheduler in browser
if (typeof window !== 'undefined') {
  // Clear any existing intervals first
  for (let i = 1; i < 99999; i++) {
    clearInterval(i);
  }
  
  setTimeout(() => {
    if (SYNC_CONFIG.spreadsheetId && SYNC_CONFIG.scriptUrl) {
      console.log('🔄 Starting simple sync scheduler (v2.0 - all old schedulers cleared)');
      simpleScheduler.start();
    } else {
      console.warn('⚠️ Sync not configured - missing environment variables');
    }
  }, 3000);
}

export { simpleScheduler };
export default {
  syncToSheets,
  syncFromSheets,
  simpleScheduler
};

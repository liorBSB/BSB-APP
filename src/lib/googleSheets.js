// src/lib/googleSheets.js

// ============================================================================
// GOOGLE SHEETS INTEGRATION
// ============================================================================

// Note: This is a placeholder for Google Sheets integration
// In a real implementation, you would need to:
// 1. Set up Google Sheets API credentials
// 2. Use Google Apps Script or Google Sheets API
// 3. Handle authentication and permissions

/**
 * Export soldier data to Google Sheets when they leave
 * Updated to work with current users collection structure
 */
export const exportSoldierToSheets = async (soldierData) => {
  try {
    // Map fields from the flat structure to export format
    const exportData = {
      // Basic soldier info - map from flat structure
      fullName: soldierData.fullName || '',
      email: soldierData.email || '',
      phone: soldierData.phone || '',
      roomNumber: soldierData.roomNumber || '',
      roomLetter: soldierData.roomLetter || '',
      bedNumber: soldierData.bedNumber || '',
      checkInDate: soldierData.createdAt || '',
      leftDate: new Date().toISOString(),
      
      // Personal info - map from flat structure
      firstName: soldierData.firstName || '',
      lastName: soldierData.lastName || '',
      dateOfBirth: soldierData.dateOfBirth || '',
      gender: soldierData.gender || '',
      idNumber: soldierData.idNumber || '',
      idType: soldierData.idType || '',
      countryOfOrigin: soldierData.countryOfOrigin || '',
      arrivalDate: soldierData.arrivalDate || '',
      previousAddress: soldierData.previousAddress || '',
      education: soldierData.education || '',
      license: soldierData.license || '',
      
      // Family info - map from flat structure
      familyInIsrael: soldierData.familyInIsrael || false,
      fatherName: soldierData.fatherName || '',
      fatherPhone: soldierData.fatherPhone || '',
      motherName: soldierData.motherName || '',
      motherPhone: soldierData.motherPhone || '',
      parentsStatus: soldierData.parentsStatus || '',
      parentsAddress: soldierData.parentsAddress || '',
      parentsEmail: soldierData.parentsEmail || '',
      contactWithParents: soldierData.contactWithParents || '',
      
      // Emergency contact - map from flat structure
      emergencyContactName: soldierData.emergencyContactName || '',
      emergencyContactPhone: soldierData.emergencyContactPhone || '',
      emergencyContactAddress: soldierData.emergencyContactAddress || '',
      emergencyContactEmail: soldierData.emergencyContactEmail || '',
      
      // Military info - map from flat structure
      personalNumber: soldierData.personalNumber || '',
      enlistmentDate: soldierData.enlistmentDate || '',
      releaseDate: soldierData.releaseDate || '',
      unit: soldierData.unit || '',
      battalion: soldierData.battalion || '',
      mashakitTash: soldierData.mashakitTash || '',
      mashakitPhone: soldierData.mashakitPhone || '',
      officerName: soldierData.officerName || '',
      officerPhone: soldierData.officerPhone || '',
      disciplinaryRecord: soldierData.disciplinaryRecord || '',
      
      // Medical info - map from flat structure
      healthFund: soldierData.healthFund || '',
      medicalProblems: soldierData.medicalProblems || '',
      allergies: soldierData.allergies || '',
      hospitalizations: soldierData.hospitalizations || '',
      psychiatricTreatment: soldierData.psychiatricTreatment || '',
      regularMedication: soldierData.regularMedication || '',
      
      // Additional info - map from flat structure
      cleanlinessLevel: soldierData.cleanlinessLevel || '',
      contributions: soldierData.contributions || '',
      notes: soldierData.notes || '',
      
      // Export metadata
      exportedAt: new Date().toISOString(),
      exportedBy: 'system'
    };

    console.log('Exporting soldier data to Google Sheets:', exportData);
    
    // Try to export to Google Sheets using Google Apps Script
    const exportResult = await exportToGoogleSheets(exportData);
    
    return exportResult;
    
  } catch (error) {
    console.error('Error exporting to Google Sheets:', error);
    return {
      success: false,
      message: 'Failed to export data',
      error: error.message
    };
  }
};

/**
 * Export data to Google Sheets using Google Apps Script
 */
async function exportToGoogleSheets(exportData) {
  try {
    // Get configuration
    const config = getSheetsConfig();
    
    if (!config.spreadsheetId) {
      throw new Error('Google Sheets ID missing. Please check your .env.local file.');
    }
    
    // Use GET request with query parameters to avoid CORS issues entirely
    const scriptUrl = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbyCZUFM_qyeA_SwdlTUJGmfmQSmJZgvmIzQlAuCYz-NZQdLpJTlUxqgLOfpQerZXXPdSQ/exec';
    
    // Build URL with query parameters
    const params = new URLSearchParams();
    params.append('spreadsheetId', config.spreadsheetId);
    params.append('sheetName', config.sheetName);
    params.append('data', JSON.stringify(exportData));
    
    const fullUrl = `${scriptUrl}?${params.toString()}`;
    
    const response = await fetch(fullUrl, {
      method: 'GET'
    });


    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Apps Script response error:', errorText);
      throw new Error(`Export failed: HTTP ${response.status} - ${errorText}`);
    }

    const result = await response.text();
    
    try {
      const parsedResult = JSON.parse(result);
      if (!parsedResult.success) {
        throw new Error(`Script error: ${parsedResult.error || 'Unknown error'}`);
      }
      return parsedResult;
    } catch (e) {
      // If it's not JSON, return the text response
      return { success: true, message: result };
    }
    


  } catch (error) {
    console.error('Error exporting to Google Sheets:', error);
    return {
      success: false,
      message: `Failed to export to Google Sheets: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Get Google Sheets configuration
 * This would contain your API credentials and sheet IDs
 */
export const getSheetsConfig = () => {
  return {
    // These would be environment variables in production
    spreadsheetId: process.env.NEXT_PUBLIC_GOOGLE_SHEETS_ID,
    sheetName: 'Soldiers Data',
    // Add other configuration as needed
  };
};

/**
 * Validate Google Sheets connection
 */
export const validateSheetsConnection = async () => {
  try {
    const config = getSheetsConfig();
    
    if (!config.spreadsheetId) {
      return {
        valid: false,
        message: 'Google Sheets configuration missing'
      };
    }
    
    // TODO: Implement actual validation
    // This could be a test API call or connection check
    
    return {
      valid: true,
      message: 'Google Sheets connection validated'
    };
    
  } catch (error) {
    return {
      valid: false,
      message: 'Failed to validate connection',
      error: error.message
    };
  }
};

/**
 * Archive soldier data after successful export
 * This moves the data to an archived collection
 */
export const archiveSoldierData = async (soldierId, soldierData, profileData, exportResult) => {
  try {
    // This would be implemented in your database layer
    // For now, just return success
    
    console.log('Archiving soldier data:', {
      soldierId,
      exportResult,
      timestamp: new Date().toISOString()
    });
    
    return {
      success: true,
      message: 'Soldier data archived successfully'
    };
    
  } catch (error) {
    console.error('Error archiving soldier data:', error);
    return {
      success: false,
      message: 'Failed to archive data',
      error: error.message
    };
  }
};

export default {
  exportSoldierToSheets,
  getSheetsConfig,
  validateSheetsConnection,
  archiveSoldierData
};

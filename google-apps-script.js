// Google Apps Script for Soldier Data Management
// This script should be deployed as a web app in Google Apps Script

/**
 * Handle GET requests to the web app
 * @param {Object} e - Event object with query parameters
 * @returns {Object} JSON response
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    const spreadsheetId = e.parameter.spreadsheetId;
    const sheetName = e.parameter.sheetName;
    
    // Debug logging
    console.log('doGet called with action:', action);
    console.log('Parameters:', Object.keys(e.parameter));
    
    if (!action || !spreadsheetId || !sheetName) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'Missing required parameters: action, spreadsheetId, sheetName'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Open the spreadsheet
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName(sheetName);
    
    if (!sheet) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'Sheet not found: ' + sheetName
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Get all data from the sheet
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    // Convert rows to objects
    const soldiers = rows.map(row => {
      const soldier = {};
      headers.forEach((header, index) => {
        soldier[header] = row[index] || '';
      });
      return soldier;
    });
    
    switch (action) {
      case 'getAllSoldiers':
        return handleGetAllSoldiers(soldiers);
      
      case 'searchSoldiers':
        const searchTerm = e.parameter.searchTerm;
        return handleSearchSoldiers(soldiers, searchTerm);
      
      case 'getSoldierByName':
        const fullName = e.parameter.fullName;
        return handleGetSoldierByName(soldiers, fullName);
      
      case 'updateSoldierData':
        const updateData = JSON.parse(e.parameter.data || '{}');
        return handleUpdateSoldierData(sheet, updateData);
      
      
      default:
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            error: 'Unknown action: ' + action
          }))
          .setMimeType(ContentService.MimeType.JSON);
    }
    
  } catch (error) {
    console.error('Error in doGet:', error);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle POST requests to the web app
 * @param {Object} e - Event object with post data
 * @returns {Object} JSON response
 */
function doPost(e) {
  try {
    const action = e.parameter.action;
    const spreadsheetId = e.parameter.spreadsheetId;
    const sheetName = e.parameter.sheetName;
    
    if (!action || !spreadsheetId || !sheetName) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'Missing required parameters: action, spreadsheetId, sheetName'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Open the spreadsheet
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName(sheetName);
    
    if (!sheet) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'Sheet not found: ' + sheetName
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    switch (action) {
      case 'updateSoldier':
        const soldierData = JSON.parse(e.parameter.data);
        return handleUpdateSoldier(sheet, soldierData);
      
      default:
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            error: 'Unknown action: ' + action
          }))
          .setMimeType(ContentService.MimeType.JSON);
    }
    
  } catch (error) {
    console.error('Error in doPost:', error);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle getAllSoldiers action
 * @param {Array} soldiers - Array of soldier objects
 * @returns {Object} JSON response
 */
function handleGetAllSoldiers(soldiers) {
  try {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        soldiers: soldiers,
        count: soldiers.length
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: 'Failed to get all soldiers: ' + error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle searchSoldiers action
 * @param {Array} soldiers - Array of soldier objects
 * @param {string} searchTerm - Search term
 * @returns {Object} JSON response
 */
function handleSearchSoldiers(soldiers, searchTerm) {
  try {
    if (!searchTerm || searchTerm.length < 2) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: true,
          soldiers: [],
          count: 0
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Don't use toLowerCase() for Hebrew text - it can cause issues
    const searchTrimmed = searchTerm.trim();
    const filteredSoldiers = soldiers.filter(soldier => {
      const fullName = (soldier['שם מלא                                  (מילוי אוטומטי: לא לגעת)'] || '').trim();
      
      // Since there's no separate first/last name columns, we only search in the full name
      // Normalize spaces in both search term and full name
      const normalizedSearch = searchTrimmed.replace(/\s+/g, ' ').trim();
      const normalizedFullName = fullName.replace(/\s+/g, ' ').trim();
      
      // Split search into words and check if all words appear in the full name
      const searchWords = normalizedSearch.split(/\s+/).filter(word => word.length > 0);
      const fullNameWords = normalizedFullName.split(/\s+/).filter(word => word.length > 0);
      
      // Check if all search words appear in the full name
      return searchWords.every(searchWord => 
        fullNameWords.some(nameWord => nameWord.includes(searchWord))
      );
    });
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        soldiers: filteredSoldiers,
        count: filteredSoldiers.length
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: 'Failed to search soldiers: ' + error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle getSoldierByName action
 * @param {Array} soldiers - Array of soldier objects
 * @param {string} fullName - Full name to search for
 * @returns {Object} JSON response
 */
function handleGetSoldierByName(soldiers, fullName) {
  try {
    if (!fullName) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'Full name is required'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const soldier = soldiers.find(s => 
      (s['שם מלא                                  (מילוי אוטומטי: לא לגעת)'] || '').trim() === fullName.trim()
    );
    
    if (!soldier) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'Soldier not found'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        soldier: soldier
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: 'Failed to get soldier by name: ' + error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle updateSoldier action
 * @param {Sheet} sheet - Google Sheet object
 * @param {Object} soldierData - Updated soldier data
 * @returns {Object} JSON response
 */
function handleUpdateSoldier(sheet, soldierData) {
  try {
    if (!soldierData.fullName) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'Full name is required for update'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Get all data to find the row
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    // Find the row with matching full name
    const rowIndex = rows.findIndex(row => 
      (row[headers.indexOf('שם מלא')] || '').trim() === soldierData.fullName.trim()
    );
    
    if (rowIndex === -1) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'Soldier not found for update'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Update the row
    const actualRowIndex = rowIndex + 2; // +2 because we skipped header and arrays are 0-indexed
    const updateRow = [];
    
    headers.forEach(header => {
      updateRow.push(soldierData[header] || '');
    });
    
    sheet.getRange(actualRowIndex, 1, 1, updateRow.length).setValues([updateRow]);
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        message: 'Soldier updated successfully'
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: 'Failed to update soldier: ' + error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle updateSoldierData action - updates soldier data in the sheet
 * @param {Sheet} sheet - Google Sheet object
 * @param {Object} updateData - Updated soldier data
 * @returns {Object} JSON response
 */
function handleUpdateSoldierData(sheet, updateData) {
  try {
    // Use ID number only for lookup (unique identifier)
    const lookupId = updateData.originalIdNumber || updateData.identifier || updateData.idNumber;
    
    if (!lookupId) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'ID number is required for update'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Get all data to find the row
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    // Find the row with matching original identifiers
    let rowIndex = -1;
    const fullNameCol = 'שם מלא                                  (מילוי אוטומטי: לא לגעת)';
    const idCol = 'מספר זהות';
    
    // Find row by ID number only
    const idColIndex = headers.indexOf(idCol);
    
    // Debug: log what we're looking for and what's in the sheet
    console.log('Looking for ID:', lookupId);
    console.log('ID column index:', idColIndex);
    console.log('First 3 IDs in sheet:', rows.slice(0, 3).map(row => row[idColIndex]));
    
    rowIndex = rows.findIndex(row => 
      String(row[idColIndex] || '').trim() === String(lookupId).trim()
    );
    
    if (rowIndex === -1) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'Soldier not found for update'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Update the row with new data
    const actualRowIndex = rowIndex + 2; // +2 because we skipped header and arrays are 0-indexed
    const currentRow = rows[rowIndex];
    
    // Helper function to format dates to DD/MM/YY
    const formatDateForSheet = (dateValue) => {
      if (!dateValue) return '';
      
      try {
        // If it's already in DD/MM/YY format, keep it
        if (typeof dateValue === 'string' && dateValue.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) {
          return dateValue;
        }
        
        // Convert ISO date to DD/MM/YY
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

    // Map app fields to sheet columns (EXCLUDING calculated fields)
    const fieldMappings = {
      'fullName': fullNameCol,
      'firstName': 'שם פרטי',
      'lastName': 'שם משפחה',
      'roomNumber': 'חדר',
      'floor': 'קומה',
      'roomType': 'אפיון חדר',
      'gender': 'מגדר',
      'dateOfBirth': 'תאריך לידה',
      'idNumber': 'מספר זהות',
      'idType': 'סוג תעודה',
      'countryOfOrigin': 'ארץ מוצא',
      'phone': 'מספר סלולרי',
      'email': 'כתובת מייל חייל',
      'previousAddress': 'מקום מגורים לפני הבית',
      'education': 'השכלה',
      'license': 'רישיון',
      'familyInIsrael': 'משפחה בארץ',
      'fatherName': 'שם האב',
      'fatherPhone': 'טלפון האב',
      'motherName': 'שם האם',
      'motherPhone': 'טלפון האם',
      'parentsStatus': 'מצב ההורים',
      'parentsAddress': 'כתובת מגורים הורים',
      'parentsEmail': 'כתובת מייל הורים',
      'contactWithParents': 'קשר עם ההורים',
      'emergencyContactName': 'שם איש קשר בארץ',
      'emergencyContactPhone': 'מספר טלפון איש קשר בארץ',
      'emergencyContactAddress': 'כתובת מגורים איש קשר בארץ',
      'emergencyContactEmail': 'כתובת מייל איש קשר בארץ',
      'personalNumber': 'מספר אישי',
      'enlistmentDate': 'תאריך גיוס',
      'releaseDate': 'תאריך שחרור סדיר ',
      'unit': 'יחידה',
      'battalion': 'גדוד',
      'mashakitTash': 'שם משקית תש',
      'mashakitPhone': 'טלפון משקית תש',
      'officerName': 'שם קצין',
      'officerPhone': 'טלפון קצין',
      'disciplinaryRecord': 'עברות משמעת',
      'healthFund': 'קופת חולים לפני הצבא',
      'cleanlinessLevel': 'רמת ניקיון',
      'contractDate': 'תאריך כניסה לבית (חתימת החוזה)'
      
      // EXCLUDED calculated fields (don't sync these from app to sheets):
      // 'age' -> 'גיל' - calculated in sheets
      // 'serviceMonths' -> 'חודשי שירות' - calculated in sheets  
      // 'serviceRange' -> 'טווח חודשי שירות' - calculated in sheets
      // 'monthsUntilRelease' -> calculated in sheets
    };
    
    // Update only the fields that were provided
    let updatedFields = [];
    Object.keys(updateData).forEach(appField => {
      if (fieldMappings[appField]) {
        const sheetColumn = fieldMappings[appField];
        const columnIndex = headers.indexOf(sheetColumn);
        
        if (columnIndex !== -1) {
          let newValue = updateData[appField] || '';
          
          // Format dates properly for sheets
          if (appField === 'dateOfBirth' || appField === 'enlistmentDate' || appField === 'releaseDate' || appField === 'contractDate') {
            newValue = formatDateForSheet(newValue);
          }
          
          const currentValue = currentRow[columnIndex] || '';
          
          if (String(newValue) !== String(currentValue)) {
            sheet.getRange(actualRowIndex, columnIndex + 1).setValue(newValue);
            updatedFields.push(appField);
          }
        }
      }
    });
    
    // Add timestamp column if it doesn't exist
    const timestampCol = 'Last Updated From App';
    let timestampColIndex = headers.indexOf(timestampCol);
    
    if (timestampColIndex === -1) {
      // Add new column for timestamp
      timestampColIndex = headers.length;
      sheet.getRange(1, timestampColIndex + 1).setValue(timestampCol);
    }
    
    // Update timestamp
    sheet.getRange(actualRowIndex, timestampColIndex + 1).setValue(new Date().toISOString());
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        message: 'Soldier data updated successfully',
        updatedFields: updatedFields,
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('Error updating soldier data:', error);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: 'Failed to update soldier data: ' + error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


/**
 * Test function to verify the script works
 */
function testScript() {
  const testData = [
    {
      'שם מלא': 'יוחנן כהן',
      'שם פרטי': 'יוחנן',
      'שם משפחה': 'כהן',
      'חדר': '101',
      'בניין': 'א',
      'קומה': '1'
    },
    {
      'שם מלא': 'שרה לוי',
      'שם פרטי': 'שרה',
      'שם משפחה': 'לוי',
      'חדר': '202',
      'בניין': 'ב',
      'קומה': '2'
    }
  ];
  
  console.log('Testing searchSoldiers:');
  const searchResult = handleSearchSoldiers(testData, 'יוחנן');
  console.log(JSON.parse(searchResult.getContent()));
  
  console.log('Testing getSoldierByName:');
  const getResult = handleGetSoldierByName(testData, 'יוחנן כהן');
  console.log(JSON.parse(getResult.getContent()));
}

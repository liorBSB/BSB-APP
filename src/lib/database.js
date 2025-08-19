// src/lib/database.js
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { exportSoldierToSheets } from './googleSheets';

// ============================================================================
// DATABASE STRUCTURE & CONSTANTS
// ============================================================================

// Collection names
export const COLLECTIONS = {
  USERS: 'users' // Main collection for all user/soldier data
};

// Question categories for the questionnaire
export const QUESTION_CATEGORIES = {
  PERSONAL_BASIC: 'personal_basic',
  FAMILY_INFO: 'family_info', 
  EMERGENCY_CONTACT: 'emergency_contact',
  MILITARY_INFO: 'military_info',
  MEDICAL_INFO: 'medical_info',
  ADDITIONAL_INFO: 'additional_info'
};

// ============================================================================
// USERS COLLECTION (All user/soldier data)
// ============================================================================

/**
 * Update user's current status
 */
export const updateUserStatus = async (uid, statusData) => {
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  await updateDoc(userRef, {
    ...statusData,
    updatedAt: Timestamp.now()
  });
};

/**
 * Mark user as left (admin only)
 */
export const markUserAsLeft = async (uid, adminUid) => {
  try {
    // Get user data before marking as left
    const userData = await getDoc(doc(db, COLLECTIONS.USERS, uid));
    
    if (!userData.exists()) {
      throw new Error('User not found');
    }
    
    // Export to Google Sheets
    const exportResult = await exportSoldierToSheets(userData.data());
    
    if (!exportResult.success) {
      throw new Error(`Export failed: ${exportResult.message}`);
    }
    
    // Delete the user data
    await deleteDoc(doc(db, COLLECTIONS.USERS, uid));
    
    return {
      success: true,
      message: 'User marked as left and data exported successfully',
      exportResult
    };
    
  } catch (error) {
    console.error('Error marking soldier as left:', error);
    throw error;
  }
};

/**
 * Get user by UID
 */
export const getUser = async (uid) => {
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    return { id: userSnap.id, ...userSnap.data() };
  }
  return null;
};

/**
 * Get all users (soldiers)
 */
export const getActiveUsers = async () => {
  const usersQuery = query(
    collection(db, COLLECTIONS.USERS),
    where('userType', '==', 'user'),
    orderBy('fullName')
  );
  
  const usersSnap = await getDocs(usersQuery);
  return usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};




/**
 * Update specific answer in profile
 */
export const updateProfileAnswer = async (uid, questionId, answer) => {
  const userRef = doc(db, 'users', uid);
  
  try {
    // Try to update existing document
    await updateDoc(userRef, {
      [questionId]: answer,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating user answer:', error);
    throw error;
  }
};



/**
 * Create all questionnaire fields for a new soldier user
 * This function initializes all questionnaire fields as empty in the users collection
 */
export const createQuestionnaireFields = async (userId) => {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    
    // Get the updated questionnaire structure
    const { QUESTIONNAIRE_STRUCTURE } = await import('./questionnaire.js');
    
    // Create an object with all questionnaire fields initialized as empty
    const questionnaireFields = {};
    
    QUESTIONNAIRE_STRUCTURE.forEach(category => {
      category.questions.forEach(question => {
        // Initialize based on question type
        switch (question.type) {
          case 'text':
          case 'textarea':
          case 'phone':
          case 'email':
            questionnaireFields[question.id] = '';
            break;
          case 'date':
            questionnaireFields[question.id] = null;
            break;
          case 'select':
          case 'boolean':
            questionnaireFields[question.id] = '';
            break;
          case 'number':
            questionnaireFields[question.id] = null;
            break;
          case 'multi_select':
            questionnaireFields[question.id] = [];
            break;
          default:
            questionnaireFields[question.id] = '';
        }
      });
    });
    
    // Add all questionnaire fields to the user document
    // Use setDoc with merge: true to ensure all fields are added
    await setDoc(userRef, questionnaireFields, { merge: true });
    
    console.log('Questionnaire fields created successfully for user:', userId);
    console.log('Fields created:', Object.keys(questionnaireFields));
    return true;
  } catch (error) {
    console.error('Error creating questionnaire fields:', error);
    return false;
  }
};

/**
 * Verify that all required fields exist for a user
 */
export const verifyUserFields = async (userId) => {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      console.error('User document does not exist');
      return false;
    }
    
    const userData = userSnap.data();
    const { QUESTIONNAIRE_STRUCTURE } = await import('./questionnaire.js');
    
    // Check registration fields
    const requiredRegistrationFields = [
      'uid', 'email', 'userType', 'isAdmin', 'status', 'roomNumber', 'roomLetter', 
      'questionnaireComplete', 'createdAt'
    ];
    
    const missingRegistrationFields = requiredRegistrationFields.filter(field => 
      !(field in userData)
    );
    
    if (missingRegistrationFields.length > 0) {
      console.warn('Missing registration fields:', missingRegistrationFields);
    }
    
    // Check questionnaire fields
    const missingQuestionnaireFields = [];
    QUESTIONNAIRE_STRUCTURE.forEach(category => {
      category.questions.forEach(question => {
        if (!(question.id in userData)) {
          missingQuestionnaireFields.push(question.id);
        }
      });
    });
    
    if (missingQuestionnaireFields.length > 0) {
      console.warn('Missing questionnaire fields:', missingQuestionnaireFields);
      // Try to create missing fields
      await createQuestionnaireFields(userId);
    }
    
    console.log('User fields verification complete');
    return true;
  } catch (error) {
    console.error('Error verifying user fields:', error);
    return false;
  }
};

// ============================================================================
// SEARCH FUNCTIONS
// ============================================================================

/**
 * Search users (soldiers) in the users collection
 * Supports both text search and date range search
 */
export const searchUsers = async (searchTerm, options = {}) => {
  const results = [];

  try {
    // Get all users (no complex queries to avoid index issues)
    const usersQuery = query(
      collection(db, COLLECTIONS.USERS),
      where('userType', '==', 'user')
    );
    const usersSnap = await getDocs(usersQuery);
    
    usersSnap.docs.forEach(doc => {
      const data = doc.data();
      let shouldInclude = false;
      
      // Date range search
      if (options.startDate && options.endDate) {
        if (data.entryDate) {
          const entryDate = new Date(data.entryDate.seconds * 1000);
          const startDate = new Date(options.startDate);
          const endDate = new Date(options.endDate);
          
          if (entryDate >= startDate && entryDate <= endDate) {
            shouldInclude = true;
          }
        }
      }
      // Text search
      else if (searchTerm && searchTerm.trim().length >= 2) {
        const term = searchTerm.trim().toLowerCase();
        if (
          data.fullName?.toLowerCase().includes(term) ||
          data.roomNumber?.includes(term) ||
          data.email?.toLowerCase().includes(term) ||
          data.personalNumber?.includes(term) ||
          data.unit?.toLowerCase().includes(term) ||
          data.battalion?.toLowerCase().includes(term) ||
          data.mashakitTash?.toLowerCase().includes(term) ||
          data.officerName?.toLowerCase().includes(term) ||
          data.emergencyContactName?.toLowerCase().includes(term)
        ) {
          shouldInclude = true;
        }
      }
      
      if (shouldInclude) {
        results.push({
          id: doc.id,
          ...data
        });
      }
    });

  } catch (error) {
    console.error('Search error:', error);
  }

  return results;
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if soldier profile is complete
 */
export const isProfileComplete = (profile, questionnaireStructure) => {
  if (!profile || !questionnaireStructure) return false;
  
  // Check all questionnaire fields
  for (const category of questionnaireStructure) {
    for (const question of category.questions) {
      const value = profile[question.id];
      
      // Check if field is empty
      if (value === undefined || value === null || value === '') {
        // Check for arrays (multi_select)
        if (Array.isArray(value)) {
          if (value.length === 0) {
            return false; // Field is empty
          }
        } else {
          return false; // Field is empty
        }
      }
    }
  }
  
  return true; // All fields are filled
};

/**
 * Get total questions count for progress tracking
 */
export const getTotalQuestionsCount = async () => {
  try {
    // Get the updated questionnaire structure
    const { QUESTIONNAIRE_STRUCTURE } = await import('./questionnaire.js');
    
    // Calculate total questions from the structure
    return QUESTIONNAIRE_STRUCTURE.reduce((total, category) => {
      return total + category.questions.length;
    }, 0);
  } catch (error) {
    console.error('Error getting total questions count:', error);
    return 0;
  }
};

export default {
  COLLECTIONS,
  QUESTION_CATEGORIES,
  updateUserStatus,
  markUserAsLeft,
  getUser,
  getActiveUsers,
  searchUsers,
  updateProfileAnswer,
  isProfileComplete,
  getTotalQuestionsCount,
  createQuestionnaireFields,
  verifyUserFields
};

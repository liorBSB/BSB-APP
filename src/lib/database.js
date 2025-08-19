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
import { exportSoldierToSheets, archiveSoldierData } from './googleSheets';

// ============================================================================
// DATABASE STRUCTURE & CONSTANTS
// ============================================================================

// Collection names
export const COLLECTIONS = {
  SOLDIERS: 'soldiers',
  SOLDIER_PROFILES: 'soldierProfiles',
  ARCHIVED_SOLDIERS: 'archivedSoldiers',
  USERS: 'users' // Added for questionnaire fields
};

// Soldier status constants
export const SOLDIER_STATUS = {
  ACTIVE: 'active',
  LEFT: 'left',
  ARCHIVED: 'archived'
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
// SOLDIERS COLLECTION (Current daily data)
// ============================================================================

/**
 * Create a new soldier record
 */
export const createSoldier = async (uid, basicData) => {
  const soldierData = {
    uid,
    basicInfo: {
      fullName: basicData.fullName || '',
      email: basicData.email || '',
      phone: basicData.phone || ''
    },
    currentStatus: {
      roomNumber: basicData.roomNumber || '',
      roomLetter: basicData.roomLetter || '',
      bedNumber: basicData.bedNumber || '',
      isPresent: true,
      lastSeen: Timestamp.now()
    },
    dailyInfo: {
      lastMeal: null,
      notes: ''
    },
    profilePhoto: basicData.profilePhoto || '',
    profileComplete: false,
    answeredQuestions: 0,
    totalQuestions: 0, // Will be calculated
    status: SOLDIER_STATUS.ACTIVE,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };

  await setDoc(doc(db, COLLECTIONS.SOLDIERS, uid), soldierData);
  return soldierData;
};

/**
 * Update soldier's current status
 */
export const updateSoldierStatus = async (uid, statusData) => {
  const soldierRef = doc(db, COLLECTIONS.SOLDIERS, uid);
  await updateDoc(soldierRef, {
    ...statusData,
    updatedAt: Timestamp.now()
  });
};

/**
 * Mark soldier as left (admin only)
 */
export const markSoldierAsLeft = async (uid, adminUid) => {
  try {
    // Get soldier data before marking as left
    const soldierData = await getSoldier(uid);
    const profileData = await getSoldierProfile(uid);
    
    if (!soldierData) {
      throw new Error('Soldier not found');
    }
    
    // Export to Google Sheets
    const exportResult = await exportSoldierToSheets(soldierData, profileData);
    
    if (!exportResult.success) {
      throw new Error(`Export failed: ${exportResult.message}`);
    }
    
    // Archive the data
    await archiveSoldierData(uid, soldierData, profileData, exportResult);
    
    // Mark soldier as left in the database
    const soldierRef = doc(db, COLLECTIONS.SOLDIERS, uid);
    await updateDoc(soldierRef, {
      status: SOLDIER_STATUS.LEFT,
      leftAt: Timestamp.now(),
      leftBy: adminUid,
      updatedAt: Timestamp.now()
    });
    
    // Delete profile data (optional - you might want to keep it for audit)
    if (profileData) {
      const profileRef = doc(db, COLLECTIONS.SOLDIER_PROFILES, uid);
      await deleteDoc(profileRef);
    }
    
    return {
      success: true,
      message: 'Soldier marked as left and data exported successfully',
      exportResult
    };
    
  } catch (error) {
    console.error('Error marking soldier as left:', error);
    throw error;
  }
};

/**
 * Get soldier by UID
 */
export const getSoldier = async (uid) => {
  const soldierRef = doc(db, COLLECTIONS.SOLDIERS, uid);
  const soldierSnap = await getDoc(soldierRef);
  
  if (soldierSnap.exists()) {
    return { id: soldierSnap.id, ...soldierSnap.data() };
  }
  return null;
};

/**
 * Get all active soldiers
 */
export const getActiveSoldiers = async () => {
  const soldiersQuery = query(
    collection(db, COLLECTIONS.SOLDIERS),
    where('status', '==', SOLDIER_STATUS.ACTIVE),
    orderBy('basicInfo.fullName')
  );
  
  const soldiersSnap = await getDocs(soldiersQuery);
  return soldiersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// ============================================================================
// SOLDIER PROFILES COLLECTION (Long-term questionnaire data)
// ============================================================================

/**
 * Create or update soldier profile
 */
export const createSoldierProfile = async (uid, profileData) => {
  const profileRef = doc(db, COLLECTIONS.SOLDIER_PROFILES, uid);
  
  const profile = {
    soldierId: uid,
    personalInfo: {
      firstName: profileData.firstName || '',
      lastName: profileData.lastName || '',
      dateOfBirth: profileData.dateOfBirth || null,
      gender: profileData.gender || '',
      idNumber: profileData.idNumber || '',
      idType: profileData.idType || '',
      countryOfOrigin: profileData.countryOfOrigin || '',
      arrivalDate: profileData.arrivalDate || null,
      previousAddress: profileData.previousAddress || '',
      education: profileData.education || '',
      license: profileData.license || ''
    },
    familyInfo: {
      familyInIsrael: profileData.familyInIsrael || false,
      fatherName: profileData.fatherName || '',
      fatherPhone: profileData.fatherPhone || '',
      motherName: profileData.motherName || '',
      motherPhone: profileData.motherPhone || '',
      parentsStatus: profileData.parentsStatus || '',
      parentsAddress: profileData.parentsAddress || '',
      parentsEmail: profileData.parentsEmail || '',
      contactWithParents: profileData.contactWithParents || ''
    },
    emergencyContact: {
      name: profileData.emergencyContactName || '',
      phone: profileData.emergencyContactPhone || '',
      address: profileData.emergencyContactAddress || '',
      email: profileData.emergencyContactEmail || ''
    },
    militaryInfo: {
      personalNumber: profileData.personalNumber || '',
      enlistmentDate: profileData.enlistmentDate || null,
      releaseDate: profileData.releaseDate || null,
      unit: profileData.unit || '',
      battalion: profileData.battalion || '',
      mashakitTash: profileData.mashakitTash || '',
      mashakitPhone: profileData.mashakitPhone || '',
      officerName: profileData.officerName || '',
      officerPhone: profileData.officerPhone || '',
      disciplinaryRecord: profileData.disciplinaryRecord || ''
    },
    medicalInfo: {
      healthFund: profileData.healthFund || '',
      medicalProblems: profileData.medicalProblems || '',
      allergies: profileData.allergies || '',
      hospitalizations: profileData.hospitalizations || '',
      psychiatricTreatment: profileData.psychiatricTreatment || '',
      regularMedication: profileData.regularMedication || ''
    },
    additionalInfo: {
      cleanlinessLevel: profileData.cleanlinessLevel || '',
      contributions: profileData.contributions || '',
      notes: profileData.notes || ''
    },
    answers: profileData.answers || {},
    status: 'active',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };

  await setDoc(profileRef, profile);
  return profile;
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
 * Get soldier profile by UID
 */
export const getSoldierProfile = async (uid) => {
  const profileRef = doc(db, COLLECTIONS.SOLDIER_PROFILES, uid);
  const profileSnap = await getDoc(profileRef);
  
  if (profileSnap.exists()) {
    return { id: profileSnap.id, ...profileSnap.data() };
  }
  return null;
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
    
    // Update the user document with all questionnaire fields
    await updateDoc(userRef, questionnaireFields);
    
    console.log('Questionnaire fields created successfully for user:', userId);
    return true;
  } catch (error) {
    console.error('Error creating questionnaire fields:', error);
    return false;
  }
};

// ============================================================================
// SEARCH FUNCTIONS
// ============================================================================

/**
 * Search soldiers across all collections
 */
export const searchSoldiers = async (searchTerm) => {
  if (!searchTerm || searchTerm.trim().length < 2) {
    return [];
  }

  const term = searchTerm.trim().toLowerCase();
  const results = [];

  try {
    // Search in soldiers collection (current data)
    const soldiersQuery = query(
      collection(db, COLLECTIONS.SOLDIERS),
      where('status', '==', SOLDIER_STATUS.ACTIVE)
    );
    const soldiersSnap = await getDocs(soldiersQuery);
    
    soldiersSnap.docs.forEach(doc => {
      const data = doc.data();
      if (
        data.basicInfo.fullName?.toLowerCase().includes(term) ||
        data.currentStatus.roomNumber?.includes(term) ||
        data.basicInfo.email?.toLowerCase().includes(term)
      ) {
        results.push({
          id: doc.id,
          collection: COLLECTIONS.SOLDIERS,
          ...data,
          searchMatch: 'current'
        });
      }
    });

    // Search in soldier profiles collection (long-term data)
    const profilesQuery = query(
      collection(db, COLLECTIONS.SOLDIER_PROFILES),
      where('status', '==', 'active')
    );
    const profilesSnap = await getDocs(profilesQuery);
    
    profilesSnap.docs.forEach(doc => {
      const data = doc.data();
      if (
        data.personalInfo.idNumber?.includes(term) ||
        data.militaryInfo.mashakitTash?.toLowerCase().includes(term) ||
        data.militaryInfo.officerName?.toLowerCase().includes(term) ||
        data.emergencyContact.name?.toLowerCase().includes(term)
      ) {
        // Check if we already have this soldier in results
        const existingIndex = results.findIndex(r => r.id === doc.id);
        if (existingIndex >= 0) {
          results[existingIndex].searchMatch = 'both';
          results[existingIndex].profileData = data;
        } else {
          results.push({
            id: doc.id,
            collection: COLLECTIONS.SOLDIER_PROFILES,
            profileData: data,
            searchMatch: 'profile'
          });
        }
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
  SOLDIER_STATUS,
  QUESTION_CATEGORIES,
  createSoldier,
  createSoldierProfile,
  updateSoldierStatus,
  markSoldierAsLeft,
  getSoldier,
  getActiveSoldiers,
  searchSoldiers,
  isProfileComplete,
  getTotalQuestionsCount,
  createQuestionnaireFields
};

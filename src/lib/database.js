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
    
    // Create archived data structure with timestamps
    const archivedData = {
      ...userData.data(),
      archivedAt: Timestamp.now(),
      archivedBy: adminUid,
      originalUid: uid,
      leftDate: Timestamp.now()
    };
    
    // Export to Google Sheets before archiving
    const exportResult = await exportSoldierToSheets(userData.data());
    
    if (!exportResult.success) {
      throw new Error(`Export failed: ${exportResult.message}`);
    }
    
    // Move data to archivedUsers collection
    const archivedUserRef = doc(db, 'archivedUsers', uid);
    await setDoc(archivedUserRef, archivedData);
    
    // Hard delete from main users collection
    await deleteDoc(doc(db, COLLECTIONS.USERS, uid));
    
    return {
      success: true,
      message: 'User archived and data exported successfully',
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
 * Get archived users (admin only)
 */
export const getArchivedUsers = async () => {
  try {
    const archivedUsersRef = collection(db, 'archivedUsers');
    const querySnapshot = await getDocs(archivedUsersRef);
    
    const archivedUsers = [];
    querySnapshot.forEach((doc) => {
      archivedUsers.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return archivedUsers;
  } catch (error) {
    console.error('Error getting archived users:', error);
    throw error;
  }
};

/**
 * Get all users (soldiers)
 */
export const getActiveUsers = async () => {
  try {
    console.log('getActiveUsers: Starting query...');
    
    // First try with ordering by fullName
    let usersQuery = query(
      collection(db, COLLECTIONS.USERS),
      where('userType', '==', 'user'),
      orderBy('fullName')
    );
    
    let usersSnap = await getDocs(usersQuery);
    console.log('getActiveUsers: Query with orderBy successful, found:', usersSnap.docs.length);
    
    if (usersSnap.docs.length > 0) {
      return usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    
    // If no results, try without ordering (in case fullName is empty)
    console.log('getActiveUsers: No results with ordering, trying without orderBy...');
    usersQuery = query(
      collection(db, COLLECTIONS.USERS),
      where('userType', '==', 'user')
    );
    
    usersSnap = await getDocs(usersQuery);
    console.log('getActiveUsers: Query without orderBy successful, found:', usersSnap.docs.length);
    
    return usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
  } catch (error) {
    console.error('getActiveUsers: Error in query:', error);
    
    // If there's an error with the query, try to get all users and filter manually
    try {
      console.log('getActiveUsers: Trying manual filter...');
      const allUsersQuery = query(collection(db, COLLECTIONS.USERS));
      const allUsersSnap = await getDocs(allUsersQuery);
      const allUsers = allUsersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const filteredUsers = allUsers.filter(user => user.userType === 'user');
      console.log('getActiveUsers: Manual filter found:', filteredUsers.length);
      
      return filteredUsers;
    } catch (fallbackError) {
      console.error('getActiveUsers: Fallback also failed:', fallbackError);
      throw error; // Throw the original error
    }
  }
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
          String(data.fullName || '').toLowerCase().includes(term) ||
          String(data.roomNumber || '').includes(term) ||
          String(data.email || '').toLowerCase().includes(term) ||
          String(data.phoneNumber || '').includes(term) ||
          String(data.phone || '').includes(term) ||
          String(data.personalNumber || '').includes(term) ||
          String(data.unit || '').toLowerCase().includes(term) ||
          String(data.battalion || '').toLowerCase().includes(term) ||
          String(data.mashakitTash || '').toLowerCase().includes(term) ||
          String(data.officerName || '').toLowerCase().includes(term) ||
          String(data.emergencyContactName || '').toLowerCase().includes(term)
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



export default {
  COLLECTIONS,
  updateUserStatus,
  markUserAsLeft,
  getUser,
  getArchivedUsers,
  getActiveUsers,
  searchUsers,
  updateProfileAnswer
};

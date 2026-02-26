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
import { syncToSheets } from './simpleSyncService';

export const COLLECTIONS = {
  USERS: 'users'
};

/**
 * Update user's current status
 */
export const updateUserStatus = async (uid, statusData) => {
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  await updateDoc(userRef, {
    ...statusData,
    updatedAt: Timestamp.now()
  });
  
  syncToSheets(uid, { ...statusData, updatedAt: new Date().toISOString() }).catch(err => console.error('[Sheet Sync]', err));
};

/**
 * Mark user as left (admin only)
 */
export const markUserAsLeft = async (uid, adminUid) => {
  const userData = await getDoc(doc(db, COLLECTIONS.USERS, uid));
  
  if (!userData.exists()) {
    throw new Error('User not found');
  }
  
  const archivedData = {
    ...userData.data(),
    archivedAt: Timestamp.now(),
    archivedBy: adminUid,
    originalUid: uid,
    leftDate: Timestamp.now()
  };
  
  const exportResult = await exportSoldierToSheets(userData.data());
  
  if (!exportResult.success) {
    throw new Error(`Export failed: ${exportResult.message}`);
  }
  
  const archivedUserRef = doc(db, 'archivedUsers', uid);
  await setDoc(archivedUserRef, archivedData);
  
  await deleteDoc(doc(db, COLLECTIONS.USERS, uid));
  
  return {
    success: true,
    message: 'User archived and data exported successfully',
    exportResult
  };
};

/**
 * Reset a soldier's account link — deletes the Firestore user document so
 * the soldier can re-register with a new Google account.
 * No archiving (that's for alumni via markUserAsLeft).
 */
export const resetSoldierAccount = async (uid) => {
  const userData = await getDoc(doc(db, COLLECTIONS.USERS, uid));
  if (!userData.exists()) throw new Error('User not found');
  await deleteDoc(doc(db, COLLECTIONS.USERS, uid));
  return { success: true };
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
  const archivedUsersRef = collection(db, 'archivedUsers');
  const querySnapshot = await getDocs(archivedUsersRef);
  
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));
};

/**
 * Get all active users (soldiers)
 */
export const getActiveUsers = async () => {
  try {
    const usersQuery = query(
      collection(db, COLLECTIONS.USERS),
      where('userType', '==', 'user')
    );
    
    const usersSnap = await getDocs(usersQuery);
    return usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
  } catch (error) {
    // Fallback: get all users and filter manually if index is missing
    const allUsersQuery = query(collection(db, COLLECTIONS.USERS));
    const allUsersSnap = await getDocs(allUsersQuery);
    const allUsers = allUsersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    return allUsers.filter(user => user.userType === 'user');
  }
};

/**
 * Update specific answer in profile
 */
export const updateProfileAnswer = async (uid, questionId, answer) => {
  const userRef = doc(db, 'users', uid);
  
  await updateDoc(userRef, {
    [questionId]: answer,
    updatedAt: Timestamp.now()
  });
  
  const updateData = { [questionId]: answer, updatedAt: new Date().toISOString() };
  syncToSheets(uid, updateData).catch(err => console.error('[Sheet Sync]', err));
};

/**
 * Search users (soldiers) in the users collection.
 * Supports both text search and date range search.
 */
export const searchUsers = async (searchTerm, options = {}) => {
  const results = [];

  try {
    const usersQuery = query(
      collection(db, COLLECTIONS.USERS),
      where('userType', '==', 'user')
    );
    const usersSnap = await getDocs(usersQuery);
    
    usersSnap.docs.forEach(doc => {
      const data = doc.data();
      let shouldInclude = false;
      
      if (options.startDate && options.endDate) {
        if (data.entryDate) {
          const entryDate = new Date(data.entryDate.seconds * 1000);
          const startDate = new Date(options.startDate);
          const endDate = new Date(options.endDate);
          
          if (entryDate >= startDate && entryDate <= endDate) {
            shouldInclude = true;
          }
        }
      } else if (searchTerm && searchTerm.trim().length >= 2) {
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
        results.push({ id: doc.id, ...data });
      }
    });

  } catch (error) {
    console.error('Search error:', error);
  }

  return results;
};

/**
 * Update user data with automatic sync to Google Sheets
 */
export const updateUserData = async (uid, updateData, syncToSheet = true) => {
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  const dataWithTimestamp = {
    ...updateData,
    updatedAt: Timestamp.now()
  };
  
  await updateDoc(userRef, dataWithTimestamp);
  
  if (syncToSheet) {
    const syncData = { ...updateData, updatedAt: new Date().toISOString() };
    syncToSheets(uid, syncData).then(result => {
      if (!result.success) console.error('[Sheet Sync] Failed:', result.message);
      else console.log('[Sheet Sync] Success');
    }).catch(err => console.error('[Sheet Sync] Error:', err));
  }
};

const databaseService = {
  COLLECTIONS,
  updateUserStatus,
  markUserAsLeft,
  resetSoldierAccount,
  getUser,
  getArchivedUsers,
  getActiveUsers,
  searchUsers,
  updateProfileAnswer,
  updateUserData
};

export default databaseService;

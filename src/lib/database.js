import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  addDoc,
  query, 
  where, 
  orderBy, 
  limit,
  writeBatch,
  Timestamp,
  setDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { deleteUserStorageEverywhere } from './storageCleanup';
import { exportSoldierToSheets } from './googleSheets';
import { syncToSheets } from './simpleSyncService';

export const COLLECTIONS = {
  USERS: 'users',
  SOLDIERS: 'soldiers',
  SOLDIER_PROFILES: 'soldierProfiles',
  REFUND_REQUESTS: 'refundRequests',
  PROBLEM_REPORTS: 'problemReports',
  APPROVAL_REQUESTS: 'approvalRequests',
  DEPARTURE_REQUESTS: 'departureRequests',
};

/**
 * Delete all operational data related to a user across secondary collections.
 * Shared by both "delete account" and "mark as left" flows.
 * Does NOT delete the users/{uid} doc — callers handle that separately.
 */
export const deleteRelatedUserData = async (uid, options = {}) => {
  const { includeAdminOnly = true } = options;
  const batch = writeBatch(db);

  const uidKeyedCollections = [
    COLLECTIONS.SOLDIERS,
    COLLECTIONS.SOLDIER_PROFILES,
  ];
  for (const col of uidKeyedCollections) {
    batch.delete(doc(db, col, uid));
  }

  const ownerQueryCounts = {};
  if (includeAdminOnly) {
    const ownerQueryCollections = [
      COLLECTIONS.REFUND_REQUESTS,
      COLLECTIONS.PROBLEM_REPORTS,
    ];
    for (const col of ownerQueryCollections) {
      const q = query(collection(db, col), where('ownerUid', '==', uid));
      const snap = await getDocs(q);
      ownerQueryCounts[col] = snap.size;
      snap.docs.forEach(d => batch.delete(d.ref));
    }

    batch.delete(doc(db, COLLECTIONS.APPROVAL_REQUESTS, uid));
  }

  try {
    await batch.commit();
  } catch (error) {
    throw error;
  }
};

/**
 * Delete ALL Firestore data for a user (users doc + all related collections).
 * Used by the self-service "delete account" flow.
 */
export const deleteAllUserData = async (uid) => {
  await deleteRelatedUserData(uid, { includeAdminOnly: false });
  await deleteDoc(doc(db, COLLECTIONS.USERS, uid));
};

/**
 * Delete ALL Firestore data owned by a user.
 *
 * This is used by both:
 * - self-service account deletion
 * - admin-driven deletion flows
 *
 * NOTE: This relies on Firestore rules permitting owners to delete their own
 * approvalRequests/refundRequests/problemReports.
 */
export const deleteUserEverywhere = async (uid) => {
  const refsToDelete = [];

  // uid-keyed docs
  refsToDelete.push(doc(db, COLLECTIONS.USERS, uid));
  refsToDelete.push(doc(db, COLLECTIONS.SOLDIERS, uid));
  refsToDelete.push(doc(db, COLLECTIONS.SOLDIER_PROFILES, uid));
  refsToDelete.push(doc(db, COLLECTIONS.APPROVAL_REQUESTS, uid));

  // owner-keyed docs
  const ownerCollections = [
    COLLECTIONS.REFUND_REQUESTS,
    COLLECTIONS.PROBLEM_REPORTS,
  ];
  for (const col of ownerCollections) {
    const q = query(collection(db, col), where('ownerUid', '==', uid));
    const snap = await getDocs(q);
    snap.docs.forEach(d => refsToDelete.push(d.ref));
  }

  // Firestore batch limit is 500 ops
  const CHUNK_SIZE = 450;
  for (let i = 0; i < refsToDelete.length; i += CHUNK_SIZE) {
    const chunk = refsToDelete.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(ref => batch.delete(ref));
    await batch.commit();
  }
};

/**
 * Admin-only: wipe a user's app data (Firestore + Storage files).
 * Note: This cannot delete the user's Firebase Auth account from the client.
 */
export const adminWipeUserData = async (uid) => {
  await deleteUserEverywhere(uid);
  await deleteUserStorageEverywhere(uid);
};

/**
 * Reset the current signed-in user back to the pre-selection state.
 * Keeps Auth session, deletes the user doc + profile docs, then recreates base users/{uid}.
 * Intended for “I chose the wrong option” recovery.
 */
export const resetUserToPreSelection = async (user) => {
  if (!user?.uid) throw new Error('No authenticated user found');

  const uid = user.uid;
  const batch = writeBatch(db);
  batch.delete(doc(db, COLLECTIONS.USERS, uid));
  batch.delete(doc(db, COLLECTIONS.SOLDIERS, uid));
  batch.delete(doc(db, COLLECTIONS.SOLDIER_PROFILES, uid));
  batch.delete(doc(db, COLLECTIONS.APPROVAL_REQUESTS, uid));
  await batch.commit();

  await createBaseUserDoc(user);
};

/**
 * Create or update a base user document with shared, role-agnostic fields.
 * Used on first login before the user chooses their role.
 */
export const createBaseUserDoc = async (user) => {
  if (!user?.uid) return;

  const userRef = doc(db, COLLECTIONS.USERS, user.uid);
  const snap = await getDoc(userRef);
  const payload = {
    uid: user.uid,
    email: user.email || '',
    fullName: user.displayName || ''
  };
  // Only set createdAt on first write. Owner updates are forbidden from touching
  // createdAt (firestore.rules); setDoc+merge on an existing doc is an update.
  if (!snap.exists()) {
    payload.createdAt = Timestamp.now();
  }
  await setDoc(userRef, payload, { merge: true });
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
  
  const exportResult = await exportSoldierToSheets(userData.data());
  
  if (!exportResult.success) {
    throw new Error(`Export failed: ${exportResult.message}`);
  }
  
  await deleteDoc(doc(db, COLLECTIONS.USERS, uid));
  await deleteRelatedUserData(uid);
  
  return {
    success: true,
    message: 'Soldier exported to archive sheet and removed',
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

/**
 * Promote a user to admin with standard audit fields.
 */
export const promoteUserToAdmin = async (uid, approverUid) => {
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  await updateDoc(userRef, {
    userType: 'admin',
    approvedAt: Timestamp.now(),
    approvedBy: approverUid
  });
};

// ── Departure Requests ───────────────────────────────────────────────

const SNOOZE_DAYS = 30;

/**
 * Create a departure request for a soldier missing from the Google Sheet.
 * Skips creation if a pending request already exists, or a dismissed request
 * whose snooze window has not yet expired.
 */
export const createDepartureRequest = async (soldierData) => {
  const { userId, soldierName, idNumber, roomNumber } = soldierData;
  if (!userId) return null;

  const col = collection(db, COLLECTIONS.DEPARTURE_REQUESTS);
  const existingQuery = query(col, where('userId', '==', userId));
  const snap = await getDocs(existingQuery);

  for (const d of snap.docs) {
    const data = d.data();
    if (data.status === 'pending') return null;
    if (data.status === 'dismissed') {
      const until = data.dismissedUntil?.toDate?.() ?? new Date(0);
      if (until > new Date()) return null;
      await deleteDoc(d.ref);
    }
  }

  return addDoc(col, {
    userId,
    soldierName: soldierName || '',
    idNumber: idNumber || '',
    roomNumber: roomNumber || '',
    detectedAt: Timestamp.now(),
    status: 'pending',
    dismissedUntil: null,
  });
};

/**
 * Return all departure requests with status === 'pending'.
 */
export const getPendingDepartureRequests = async () => {
  const q = query(
    collection(db, COLLECTIONS.DEPARTURE_REQUESTS),
    where('status', '==', 'pending'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

/**
 * Snooze a departure request for 30 days.
 */
export const dismissDepartureRequest = async (requestId) => {
  const ref = doc(db, COLLECTIONS.DEPARTURE_REQUESTS, requestId);
  const dismissedUntil = new Date();
  dismissedUntil.setDate(dismissedUntil.getDate() + SNOOZE_DAYS);
  await updateDoc(ref, {
    status: 'dismissed',
    dismissedUntil: Timestamp.fromDate(dismissedUntil),
  });
};

/**
 * Hard-delete a departure request (used after marking a soldier as left).
 */
export const deleteDepartureRequest = async (requestId) => {
  await deleteDoc(doc(db, COLLECTIONS.DEPARTURE_REQUESTS, requestId));
};

const databaseService = {
  COLLECTIONS,
  deleteRelatedUserData,
  deleteAllUserData,
  deleteUserEverywhere,
  createBaseUserDoc,
  updateUserStatus,
  markUserAsLeft,
  resetSoldierAccount,
  getUser,
  getActiveUsers,
  searchUsers,
  updateProfileAnswer,
  updateUserData,
  promoteUserToAdmin,
  createDepartureRequest,
  getPendingDepartureRequests,
  dismissDepartureRequest,
  deleteDepartureRequest,
};

export default databaseService;

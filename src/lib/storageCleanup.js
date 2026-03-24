import { deleteObject, listAll, ref } from 'firebase/storage';
import { collection, getDocs, query, where, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { storage, db } from './firebase';

async function deleteAllUnderPrefix(prefix) {
  const rootRef = ref(storage, prefix);
  const toVisit = [rootRef];

  while (toVisit.length) {
    const current = toVisit.pop();
    // listAll is non-recursive; we explicitly traverse prefixes
    // eslint-disable-next-line no-await-in-loop
    const res = await listAll(current);

    res.prefixes.forEach(p => toVisit.push(p));

    // eslint-disable-next-line no-await-in-loop
    for (const item of res.items) {
      try {
        await deleteObject(item);
      } catch (err) {
        const code = err?.code || '';
        // Ignore already-gone files
        if (code !== 'storage/object-not-found') throw err;
      }
    }
  }
}

/**
 * Delete a single file from Firebase Storage by its full path.
 * Silently ignores files that are already gone.
 */
export async function deleteStorageFile(path) {
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch (err) {
    if (err?.code !== 'storage/object-not-found') throw err;
  }
}

/**
 * Delete all Firebase Storage files owned by a user.
 */
export async function deleteUserStorageEverywhere(uid) {
  if (!uid) return;

  await Promise.all([
    deleteAllUnderPrefix(`reports/${uid}`),
    deleteAllUnderPrefix(`refunds/${uid}`),
    deleteAllUnderPrefix(`user-profiles/${uid}/${uid}`)
  ]);
}

const RETENTION_CONFIG = [
  {
    collectionName: 'fixedProblems',
    dateField: 'fixedAt',
    yearsToKeep: 1,
    photoUrlField: 'photoUrl',
    photoPathField: 'photoPath',
  },
  {
    collectionName: 'problemReports',
    dateField: 'createdAt',
    yearsToKeep: 1,
    photoUrlField: 'photoUrl',
    photoPathField: 'photoPath',
  },
  {
    collectionName: 'expenses',
    dateField: 'createdAt',
    yearsToKeep: 3,
    photoUrlField: 'photoUrl',
    photoPathField: 'photoPath',
  },
  {
    collectionName: 'refundRequests',
    dateField: 'createdAt',
    yearsToKeep: 3,
    photoUrlField: 'receiptPhotoUrl',
    photoPathField: 'photoPath',
  },
  {
    collectionName: 'users',
    dateField: 'updatedAt',
    yearsToKeep: 5,
    photoUrlField: 'profilePhotoUrl',
    photoPathField: 'profilePhotoPath',
  },
];

/**
 * Delete photos from Firestore documents older than the configured retention
 * periods. Only deletes files where photoPath is stored (legacy docs without
 * paths are untouched). Clears the Firestore fields AFTER successful storage
 * deletion.
 *
 * @param {(progress: {collection: string, deleted: number, total: number}) => void} onProgress
 * @returns {Promise<Record<string, number>>} summary of deleted counts per collection
 */
export async function cleanupExpiredPhotos(onProgress) {
  const summary = {};

  for (const cfg of RETENTION_CONFIG) {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - cfg.yearsToKeep);
    const cutoffTs = Timestamp.fromDate(cutoff);

    let snap;
    try {
      const q = query(
        collection(db, cfg.collectionName),
        where(cfg.dateField, '<', cutoffTs),
      );
      snap = await getDocs(q);
    } catch (err) {
      console.error(`cleanupExpiredPhotos: failed to query ${cfg.collectionName}`, err);
      summary[cfg.collectionName] = 0;
      continue;
    }

    const candidates = snap.docs.filter((d) => {
      const data = d.data();
      const hasPhotosArray = Array.isArray(data.photos) && data.photos.length > 0;
      return hasPhotosArray || data[cfg.photoPathField];
    });

    let deleted = 0;
    const errors = [];

    for (const d of candidates) {
      const data = d.data();
      const photosArray = data.photos || [];
      const legacyPath = data[cfg.photoPathField];

      const pathsToDelete = photosArray.length > 0
        ? photosArray.map(p => p.path).filter(Boolean)
        : (legacyPath ? [legacyPath] : []);

      if (pathsToDelete.length === 0) continue;

      try {
        for (const p of pathsToDelete) {
          await deleteStorageFile(p);
        }
        await updateDoc(doc(db, cfg.collectionName, d.id), {
          photos: [],
          [cfg.photoUrlField]: '',
          [cfg.photoPathField]: '',
        });
        deleted += pathsToDelete.length;
      } catch (err) {
        errors.push(`${cfg.collectionName}/${d.id}: ${err.message}`);
        console.error(`cleanupExpiredPhotos: skipped ${cfg.collectionName}/${d.id}`, err);
      }

      onProgress?.({
        collection: cfg.collectionName,
        deleted,
        total: candidates.length,
      });
    }

    if (errors.length) {
      console.warn(`cleanupExpiredPhotos: ${errors.length} error(s) in ${cfg.collectionName}`, errors);
    }

    summary[cfg.collectionName] = deleted;
  }

  return summary;
}


import { deleteObject, listAll, ref } from 'firebase/storage';
import { storage } from './firebase';

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
 * Delete all Firebase Storage files owned by a user.
 */
export async function deleteUserStorageEverywhere(uid) {
  if (!uid) return;

  await Promise.all([
    deleteAllUnderPrefix(`reports/${uid}`),
    deleteAllUnderPrefix(`refunds/${uid}`),
    // Storage rules for user-profiles expect: user-profiles/{userId}/{uploaderId}/{fileName}
    // Our uploaderId is the same uid in the app, so we delete under that deeper prefix.
    deleteAllUnderPrefix(`user-profiles/${uid}/${uid}`)
  ]);
}


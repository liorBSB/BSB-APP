import { auth, googleProvider } from './firebase';
import { reauthenticateWithPopup } from 'firebase/auth';
import { deleteUserEverywhere } from './database';
import { deleteUserStorageEverywhere } from './storageCleanup';

/**
 * Fully delete the currently signed-in user:
 * Firestore data + Storage files + Auth user.
 *
 * Reauth is performed only when required by Firebase.
 */
export async function fullyDeleteCurrentUser({ onStep } = {}) {
  const user = auth.currentUser;
  if (!user?.uid) throw new Error('No authenticated user found');

  const uid = user.uid;

  onStep?.('deleting_data');
  await deleteUserEverywhere(uid);

  onStep?.('deleting_files');
  await deleteUserStorageEverywhere(uid);

  onStep?.('deleting_auth');
  try {
    await user.delete();
  } catch (err) {
    const code = err?.code || '';
    if (code === 'auth/requires-recent-login') {
      onStep?.('reauth');
      await reauthenticateWithPopup(user, googleProvider);
      onStep?.('deleting_auth');
      await user.delete();
    } else {
      throw err;
    }
  }

  onStep?.('done');
}


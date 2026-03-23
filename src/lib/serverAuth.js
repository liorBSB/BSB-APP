import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

export async function requireAuth(request) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Missing bearer token' };
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    return { ok: false, status: 401, error: 'Empty bearer token' };
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return { ok: true, uid: decoded.uid, decoded };
  } catch {
    return { ok: false, status: 401, error: 'Invalid auth token' };
  }
}

export async function requireAdmin(request) {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult;

  try {
    const userDoc = await getAdminDb().collection('users').doc(authResult.uid).get();
    const userType = userDoc.exists ? userDoc.data()?.userType : null;
    if (userType !== 'admin') {
      return { ok: false, status: 403, error: 'Admin access required' };
    }
    return { ok: true, uid: authResult.uid };
  } catch {
    return { ok: false, status: 500, error: 'Failed to verify role' };
  }
}

export async function requireOwnerOrAdmin(request, ownerUid) {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult;
  if (authResult.uid === ownerUid) return { ok: true, uid: authResult.uid };
  return requireAdmin(request);
}

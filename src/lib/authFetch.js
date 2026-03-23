'use client';

import { auth } from '@/lib/firebase';

export async function getAuthHeaders(extraHeaders = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('User is not authenticated');
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    ...extraHeaders,
  };
}

export async function authedFetch(url, options = {}) {
  const headers = await getAuthHeaders(options.headers || {});
  return fetch(url, { ...options, headers });
}

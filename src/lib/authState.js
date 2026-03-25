export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getStableAuthUser(auth, options = {}) {
  const timeoutMs = options.timeoutMs ?? 5000;
  const pollMs = options.pollMs ?? 120;

  if (!auth) return null;
  if (auth.currentUser) return auth.currentUser;

  if (typeof auth.authStateReady === 'function') {
    try {
      await Promise.race([auth.authStateReady(), delay(timeoutMs)]);
    } catch {
      // If authStateReady fails, continue with polling fallback.
    }
    if (auth.currentUser) return auth.currentUser;
  }

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await delay(pollMs);
    if (auth.currentUser) return auth.currentUser;
  }

  return null;
}

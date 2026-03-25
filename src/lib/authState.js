export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getStableAuthUser(auth, options = {}) {
  const timeoutMs = options.timeoutMs ?? 1800;
  const pollMs = options.pollMs ?? 120;

  if (!auth) return null;
  if (auth.currentUser) return auth.currentUser;

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await delay(pollMs);
    if (auth.currentUser) return auth.currentUser;
  }

  return null;
}

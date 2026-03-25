import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getStableAuthUser } from '../authState.js';

describe('authState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-25T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns current user immediately when available', async () => {
    const auth = { currentUser: { uid: 'u-1' } };
    const user = await getStableAuthUser(auth, { timeoutMs: 500, pollMs: 100 });
    expect(user).toEqual({ uid: 'u-1' });
  });

  it('waits briefly and returns user when auth restores', async () => {
    const auth = { currentUser: null };
    const promise = getStableAuthUser(auth, { timeoutMs: 500, pollMs: 100 });

    setTimeout(() => {
      auth.currentUser = { uid: 'u-2' };
    }, 180);

    await vi.advanceTimersByTimeAsync(250);
    const user = await promise;
    expect(user).toEqual({ uid: 'u-2' });
  });

  it('returns null after timeout when no user is restored', async () => {
    const auth = { currentUser: null };
    const promise = getStableAuthUser(auth, { timeoutMs: 300, pollMs: 100 });
    await vi.advanceTimersByTimeAsync(400);
    const user = await promise;
    expect(user).toBeNull();
  });

  it('uses authStateReady when available', async () => {
    const auth = {
      currentUser: null,
      authStateReady: () =>
        new Promise((resolve) => {
          setTimeout(() => {
            auth.currentUser = { uid: 'u-3' };
            resolve();
          }, 80);
        }),
    };

    const promise = getStableAuthUser(auth, { timeoutMs: 300, pollMs: 100 });
    await vi.advanceTimersByTimeAsync(120);
    const user = await promise;
    expect(user).toEqual({ uid: 'u-3' });
  });
});

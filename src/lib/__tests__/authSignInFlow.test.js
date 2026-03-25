import { describe, it, expect } from 'vitest';
import {
  isStorageAvailable,
  shouldPreferRedirectForAuth,
  mapAuthErrorCodeToKey,
} from '../authSignInFlow.js';

describe('authSignInFlow', () => {
  it('prefers redirect on iPhone user agent', () => {
    const shouldUseRedirect = shouldPreferRedirectForAuth({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      platform: 'iPhone',
      maxTouchPoints: 5,
      hasWorkingStorage: true,
    });

    expect(shouldUseRedirect).toBe(true);
  });

  it('prefers redirect on iPad desktop-mode signature', () => {
    const shouldUseRedirect = shouldPreferRedirectForAuth({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
      platform: 'MacIntel',
      maxTouchPoints: 5,
      hasWorkingStorage: true,
    });

    expect(shouldUseRedirect).toBe(true);
  });

  it('prefers redirect for in-app browser user agents', () => {
    const shouldUseRedirect = shouldPreferRedirectForAuth({
      userAgent: 'Mozilla/5.0 Instagram 325.0.0.0.2 iPhone',
      platform: 'iPhone',
      maxTouchPoints: 5,
      hasWorkingStorage: true,
    });

    expect(shouldUseRedirect).toBe(true);
  });

  it('prefers redirect when storage is unavailable', () => {
    const shouldUseRedirect = shouldPreferRedirectForAuth({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0',
      platform: 'Win32',
      maxTouchPoints: 0,
      hasWorkingStorage: false,
    });

    expect(shouldUseRedirect).toBe(true);
  });

  it('keeps popup flow on normal desktop browsers with storage', () => {
    const shouldUseRedirect = shouldPreferRedirectForAuth({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0',
      platform: 'Win32',
      maxTouchPoints: 0,
      hasWorkingStorage: true,
    });

    expect(shouldUseRedirect).toBe(false);
  });

  it('detects available storage correctly', () => {
    const fakeStorage = {
      setItem: () => {},
      removeItem: () => {},
    };

    expect(isStorageAvailable(fakeStorage)).toBe(true);
  });

  it('returns false when storage access throws', () => {
    const throwingStorage = {
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {},
    };

    expect(isStorageAvailable(throwingStorage)).toBe(false);
  });

  it('maps auth error codes to i18n keys', () => {
    expect(mapAuthErrorCodeToKey('auth/missing-initial-state')).toBe('error_open_in_browser');
    expect(mapAuthErrorCodeToKey('auth/no-auth-event')).toBe('error_open_in_browser');
    expect(mapAuthErrorCodeToKey('auth/web-storage-unsupported')).toBe('error_open_in_browser');
    expect(mapAuthErrorCodeToKey('auth/unauthorized-domain')).toBe('error_unauthorized_domain');
    expect(mapAuthErrorCodeToKey('auth/network-request-failed')).toBe('error_network');
    expect(mapAuthErrorCodeToKey('auth/account-exists-with-different-credential')).toBe('error_account_exists');
    expect(mapAuthErrorCodeToKey('auth/email-already-in-use')).toBe('error_email_in_use');
    expect(mapAuthErrorCodeToKey('auth/some-unknown-code')).toBe('error_auth_failed');
  });
});

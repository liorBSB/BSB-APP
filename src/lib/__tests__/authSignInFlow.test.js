import { describe, it, expect } from 'vitest';
import {
  isStorageAvailable,
  shouldAvoidRedirectForAuth,
  mapAuthErrorCodeToKey,
} from '../authSignInFlow.js';

describe('authSignInFlow', () => {
  it('does not force redirect on iPhone user agent', () => {
    const shouldAvoidRedirect = shouldAvoidRedirectForAuth({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      hasWorkingStorage: true,
    });

    expect(shouldAvoidRedirect).toBe(false);
  });

  it('does not force redirect on iPad desktop-mode signature', () => {
    const shouldAvoidRedirect = shouldAvoidRedirectForAuth({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
      hasWorkingStorage: true,
    });

    expect(shouldAvoidRedirect).toBe(false);
  });

  it('avoids redirect for in-app browser user agents', () => {
    const shouldAvoidRedirect = shouldAvoidRedirectForAuth({
      userAgent: 'Mozilla/5.0 Instagram 325.0.0.0.2 iPhone FBAN/FBIOS',
      hasWorkingStorage: true,
    });

    expect(shouldAvoidRedirect).toBe(true);
  });

  it('detects WhatsApp in-app browser as unsupported auth context', () => {
    const shouldAvoidRedirect = shouldAvoidRedirectForAuth({
      userAgent: 'Mozilla/5.0 iPhone WhatsApp/24.4.78 Mobile',
      hasWorkingStorage: true,
    });

    expect(shouldAvoidRedirect).toBe(true);
  });

  it('avoids redirect when storage is unavailable', () => {
    const shouldAvoidRedirect = shouldAvoidRedirectForAuth({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0',
      hasWorkingStorage: false,
    });

    expect(shouldAvoidRedirect).toBe(true);
  });

  it('keeps redirect fallback available on normal desktop with storage', () => {
    const shouldAvoidRedirect = shouldAvoidRedirectForAuth({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0',
      hasWorkingStorage: true,
    });

    expect(shouldAvoidRedirect).toBe(false);
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

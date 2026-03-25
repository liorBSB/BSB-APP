export function isStorageAvailable(storage) {
  if (!storage) return false;

  try {
    const key = '__auth_probe__';
    storage.setItem(key, '1');
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function shouldPreferRedirectForAuth({
  userAgent = '',
  platform = '',
  maxTouchPoints = 0,
  hasWorkingStorage = true,
} = {}) {
  const isIOS =
    /iPad|iPhone|iPod/.test(userAgent) ||
    (platform === 'MacIntel' && maxTouchPoints > 1);
  const isInAppBrowser = /FBAN|FBAV|Instagram|Line|MicroMessenger|wv/i.test(userAgent);

  return isIOS || isInAppBrowser || !hasWorkingStorage;
}

export function mapAuthErrorCodeToKey(errorCode) {
  if (
    errorCode === 'auth/missing-initial-state' ||
    errorCode === 'auth/no-auth-event' ||
    errorCode === 'auth/web-storage-unsupported'
  ) {
    return 'error_open_in_browser';
  }
  if (errorCode === 'auth/unauthorized-domain') {
    return 'error_unauthorized_domain';
  }
  if (errorCode === 'auth/network-request-failed') {
    return 'error_network';
  }
  if (errorCode === 'auth/account-exists-with-different-credential') {
    return 'error_account_exists';
  }
  if (errorCode === 'auth/email-already-in-use') {
    return 'error_email_in_use';
  }
  return 'error_auth_failed';
}

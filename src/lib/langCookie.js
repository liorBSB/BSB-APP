/** Persist locale for SSR so the server can render the same strings as the first client paint (avoids i18n hydration errors). */

const MAX_AGE_SEC = 60 * 60 * 24 * 365;

export function setLangCookie(lang) {
  if (typeof document === 'undefined') return;
  if (lang !== 'he' && lang !== 'en') return;
  document.cookie = `lang=${lang};path=/;max-age=${MAX_AGE_SEC};SameSite=Lax`;
}

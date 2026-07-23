export interface GuestInfo {
  full_name: string;
  email: string;
  company: string;
  phone_number: string;
  role: string;
}

const COOKIE_NAME = 'meeting_guest_info';
const COOKIE_MAX_AGE_DAYS = 365;

export function setGuestCookie(info: GuestInfo): void {
  if (typeof document === 'undefined') return;
  try {
    const jsonValue = JSON.stringify(info);
    const encodedValue = encodeURIComponent(jsonValue);
    const maxAgeSeconds = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
    document.cookie = `${COOKIE_NAME}=${encodedValue}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
  } catch (err) {
    console.warn('Failed to set guest cookie:', err);
  }
}

export function getGuestCookie(): GuestInfo | null {
  if (typeof document === 'undefined') return null;
  try {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [key, value] = cookie.trim().split('=');
      if (key === COOKIE_NAME && value) {
        const decoded = decodeURIComponent(value);
        return JSON.parse(decoded) as GuestInfo;
      }
    }
  } catch (err) {
    console.warn('Failed to parse guest cookie:', err);
  }
  return null;
}

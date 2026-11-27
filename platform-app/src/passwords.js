import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEYLEN = 32;

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(String(password), salt, KEYLEN).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const parts = String(stored || '').split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const actual = scryptSync(String(password), parts[1], KEYLEN);
  const expected = Buffer.from(parts[2], 'hex');
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function passwordIsHashed(stored) {
  return String(stored || '').startsWith('scrypt:');
}

import { createHash } from 'node:crypto';

export function canonicalString(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalString(item)).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalString(value[key])}`).join(',')}}`;
}

export function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function digestOf(value) {
  return sha256(canonicalString(value));
}

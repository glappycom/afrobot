export function packBinary(value) {
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return { __bin: value.toString('base64') };
  if (value instanceof Uint8Array) return { __bin: Buffer.from(value).toString('base64') };
  return value === undefined ? null : value;
}

export function unpackBinary(value) {
  if (value && typeof value === 'object' && !Array.isArray(value) && typeof value.__bin === 'string' && Object.keys(value).length === 1) {
    return Buffer.from(value.__bin, 'base64');
  }
  if (typeof value === 'string' && /^\\x[0-9a-fA-F]+$/.test(value)) return Buffer.from(value.slice(2), 'hex');
  return value;
}

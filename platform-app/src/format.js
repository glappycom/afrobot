export function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function show(value) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

export function rateLabel(numerator, denominator) {
  if (numerator == null || denominator == null || denominator === 0) return null;
  const pct = Math.round((numerator / denominator) * 1000) / 10;
  const pctText = Number.isInteger(pct) ? String(pct) : String(pct);
  return `${numerator}/${denominator} = ${pctText}%`;
}

export function sdgLabel(code) {
  const labels = {
    4: '4 Quality Education',
    6: '6 Clean Water and Sanitation',
    12: '12 Responsible Consumption and Production',
    0: 'Other',
  };
  if (code == null) return null;
  return labels[code] || 'Other';
}

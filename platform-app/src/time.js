const PREVIEW_ZONE = process.env.AFROBOT_TIME_ZONE || 'America/Chicago';

export function displayZone() {
  return PREVIEW_ZONE;
}

export function localDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso).slice(0, 10);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: displayZone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function localStamp(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: displayZone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return `${formatted} CT`;
}

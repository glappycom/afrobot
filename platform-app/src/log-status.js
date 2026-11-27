export function logUiState({ online = true, confirmed = false, failed = false } = {}) {
  if (confirmed) return { status: 'Sent', send: false, retry: false };
  if (failed) return { status: 'Not sent.', send: false, retry: true };
  if (!online) return { status: 'Pending sync', send: true, retry: false };
  return { status: 'Not sent yet.', send: true, retry: false };
}

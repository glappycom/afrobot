export function logUiState({ online = true, confirmed = false, failed = false, sending = false } = {}) {
  if (confirmed) return { status: 'Sent', send: false, retry: false };
  if (failed) return { status: 'Failed', send: false, retry: true };
  if (sending) return { status: 'Sending', send: false, retry: false };
  if (!online) return { status: 'Pending sync', send: true, retry: false };
  return { status: 'Draft', send: true, retry: false };
}

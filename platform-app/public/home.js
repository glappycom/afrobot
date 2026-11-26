document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-copy]');
  if (!button) return;
  const value = button.getAttribute('data-copy') || '';
  if (navigator.clipboard) navigator.clipboard.writeText(value);
  button.setAttribute('aria-label', 'Copied');
});

document.addEventListener('submit', (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (!form.action.includes('/coach/log/save') || navigator.onLine) return;
  event.preventDefault();
  const queue = JSON.parse(localStorage.getItem('afrobot-offline-logs') || '[]');
  queue.push({ at: new Date().toISOString() });
  localStorage.setItem('afrobot-offline-logs', JSON.stringify(queue));
  location.href = '/coach/log/saved';
});

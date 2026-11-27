document.addEventListener('submit', (event) => {
  const note = document.getElementById('loading');
  if (note) note.hidden = false;
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (!form.action.includes('/coach/log/save') || navigator.onLine) return;
  event.preventDefault();
  const queue = JSON.parse(localStorage.getItem('afrobot-offline-logs') || '[]');
  queue.push({ at: new Date().toISOString() });
  localStorage.setItem('afrobot-offline-logs', JSON.stringify(queue));
  location.href = '/coach/log/saved';
});

(function () {
  const form = document.getElementById('capture-form');
  if (!form) return;
  const status = document.getElementById('sync-status');
  const detail = document.getElementById('sync-detail');
  const paper = document.getElementById('paper-fallback');
  const labels = {
    'saved-on-device': 'Saved on this device',
    'pending-sync': 'Pending sync',
    sent: 'Sent',
    'needs-attention': 'Needs attention',
  };
  let memory = null;
  function storageOk() {
    try {
      localStorage.setItem('afrobot-storage-probe', '1');
      localStorage.removeItem('afrobot-storage-probe');
      return true;
    } catch {
      return false;
    }
  }
  function load() {
    if (!storageOk()) {
      paper.hidden = false;
      return memory;
    }
    try {
      return JSON.parse(localStorage.getItem('afrobot-capture-v1') || 'null');
    } catch {
      paper.hidden = false;
      return memory;
    }
  }
  function save(draft) {
    memory = draft;
    if (!storageOk()) {
      paper.hidden = false;
      return;
    }
    try {
      localStorage.setItem('afrobot-capture-v1', JSON.stringify(draft));
    } catch {
      paper.hidden = false;
    }
  }
  function current() {
    const existing = load() || {};
    const attendance = [];
    for (const input of form.querySelectorAll('input[type="radio"]:checked')) {
      attendance.push({ learnerId: input.name.slice(5), present: input.value === 'present' });
    }
    return {
      idempotencyKey: existing.idempotencyKey || (crypto.randomUUID ? crypto.randomUUID() : `capture-${Date.now()}`),
      meetingId: document.getElementById('meetingId').value,
      numerator: document.getElementById('numerator').value,
      denominator: document.getElementById('denominator').value,
      projectResult: document.getElementById('projectResult').value,
      note: document.getElementById('note').value,
      attendance,
      status: existing.recordId ? 'sent' : (existing.status || 'saved-on-device'),
      recordId: existing.recordId || '',
    };
  }
  function show(draft) {
    status.textContent = labels[draft.status] || labels['saved-on-device'];
    const who = `${draft.numerator} completions of ${draft.denominator} starters`;
    detail.textContent = draft.recordId
      ? `${who}. Record ${draft.recordId}.`
      : `${who}. ${draft.status === 'needs-attention' ? draft.error || 'Needs attention.' : 'Not sent yet.'}`;
  }
  async function send() {
    const draft = current();
    document.getElementById('idempotencyKey').value = draft.idempotencyKey;
    if (!navigator.onLine) {
      draft.status = 'pending-sync';
      save(draft);
      show(draft);
      return;
    }
    draft.status = 'pending-sync';
    save(draft);
    show(draft);
    try {
      const token = form.querySelector('input[name="csrf"]').value;
      const response = await fetch('/api/captures', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', 'x-csrf-token': token },
        body: JSON.stringify(draft),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.id) {
        draft.status = 'needs-attention';
        draft.error = body.error || 'The server did not confirm the record.';
        save(draft);
        show(draft);
        return;
      }
      draft.status = 'sent';
      draft.recordId = body.id;
      draft.error = '';
      save(draft);
      show(draft);
    } catch {
      draft.status = 'needs-attention';
      draft.error = 'The send did not finish.';
      save(draft);
      show(draft);
    }
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    send();
  });
  document.getElementById('retry-capture').addEventListener('click', send);
  const saved = load();
  if (saved) show(saved);
  else show(current());
})();

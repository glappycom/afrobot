(function () {
  const KEY = 'afrobot-result-v1';
  const form = document.getElementById('result-form');
  if (!form) return;
  const status = document.getElementById('sync-status');
  const detail = document.getElementById('sync-detail');
  const retry = document.getElementById('retry-result');
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
      const probe = 'afrobot-storage-probe';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
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
      return JSON.parse(localStorage.getItem(KEY) || 'null');
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
      localStorage.setItem(KEY, JSON.stringify(draft));
    } catch {
      paper.hidden = false;
    }
  }
  function show(draft) {
    status.textContent = labels[draft.status] || labels['saved-on-device'];
    const who = `${draft.numerator} completions of ${draft.denominator} starters`;
    detail.textContent = draft.recordId ? `${who}. Record ${draft.recordId}.` : `${who}. This session needs attention until it is sent.`;
  }
  function current() {
    const existing = load() || {};
    return {
      idempotencyKey: existing.idempotencyKey || (crypto.randomUUID ? crypto.randomUUID() : `accept-${Date.now()}`),
      numerator: document.getElementById('numerator').value,
      denominator: document.getElementById('denominator').value,
      activityDate: '2026-11-26',
      status: existing.status || 'saved-on-device',
      recordId: existing.recordId || '',
    };
  }
  async function send() {
    const draft = current();
    draft.status = navigator.onLine ? 'pending-sync' : 'pending-sync';
    if (!navigator.onLine) {
      save(draft);
      show(draft);
      return;
    }
    save(draft);
    show(draft);
    try {
      const token = form.querySelector('input[name="csrf"]').value;
      const response = await fetch('/api/results', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', 'x-csrf-token': token },
        body: JSON.stringify({
          idempotencyKey: draft.idempotencyKey,
          numerator: draft.numerator,
          denominator: draft.denominator,
          activityDate: draft.activityDate,
        }),
      });
      if (!response.ok && response.status !== 200 && response.status !== 201) throw new Error('not sent');
      const body = await response.json();
      if (!body.id) throw new Error('not sent');
      draft.status = 'sent';
      draft.recordId = body.id;
      save(draft);
      show(draft);
    } catch {
      draft.status = 'needs-attention';
      save(draft);
      show(draft);
    }
  }
  const saved = load();
  if (saved) {
    document.getElementById('numerator').value = saved.numerator;
    document.getElementById('denominator').value = saved.denominator;
    show(saved);
  } else {
    show(current());
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const draft = current();
    draft.status = 'saved-on-device';
    save(draft);
    send();
  });
  retry.addEventListener('click', send);
  document.getElementById('print-result').addEventListener('click', () => window.print());
})();

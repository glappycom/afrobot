import { logUiState } from '/log-status.js';

(function () {
  const capture = document.getElementById('capture-form');
  const fix = document.getElementById('fix-form');
  const sessionPhoto = document.getElementById('session-photo-form');
  if (!capture && !fix && !sessionPhoto) return;

  function tokenOf(form) {
    return form.querySelector('input[name="_csrf"], input[name="csrf"]').value;
  }

  function attendanceOf(form) {
    const attendance = [];
    for (const input of form.querySelectorAll('input[type="radio"]:checked')) {
      attendance.push({ learnerId: input.name.slice(5), present: input.value === 'present' });
    }
    return attendance;
  }

  function photoPayload(form) {
    const learnerIds = [...form.querySelectorAll('input[name="photoLearner"]:checked')].map((input) => input.value);
    const noStudents = form.querySelector('#photo-none')?.checked === true && learnerIds.length === 0;
    return { learnerIds, noStudents: noStudents && learnerIds.length === 0, tagged: learnerIds.length > 0 };
  }

  function fileToData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Could not read the photo.'));
      reader.readAsDataURL(file);
    });
  }

  async function uploadSelected(form, claimId, token) {
    if (form.querySelector('#no-photo')?.checked) return { skipped: true };
    const file = form.querySelector('#photo-file');
    if (!file || !file.files || !file.files[0]) return { skipped: true };
    const chosen = file.files[0];
    if (chosen.size > 5 * 1024 * 1024) return { error: 'That photo is over 5 MB.' };
    const image = await fileToData(chosen);
    const tags = photoPayload(form);
    if (!tags.noStudents && !tags.tagged) return { error: 'Say who is in the photo, or mark that no students are shown.' };
    const response = await fetch(`/api/claims/${claimId}/photos`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', 'x-csrf-token': token },
      body: JSON.stringify({ image, learnerIds: tags.learnerIds, noStudents: tags.noStudents }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { error: body.error || 'The photo was not stored.' };
    return { id: body.id };
  }

  if (capture) {
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
      return {
        idempotencyKey: existing.idempotencyKey || (crypto.randomUUID ? crypto.randomUUID() : `capture-${Date.now()}`),
        meetingId: document.getElementById('meetingId').value,
        numerator: document.getElementById('numerator').value,
        denominator: document.getElementById('denominator').value,
        projectResult: document.getElementById('projectResult').value,
        note: document.getElementById('note').value,
        attendance: attendanceOf(capture),
        status: existing.recordId ? 'sent' : (existing.status || 'saved-on-device'),
        recordId: existing.recordId || '',
        error: existing.error || '',
      };
    }
    function paint(state, detailText) {
      const send = document.getElementById('submit-capture');
      const retry = document.getElementById('retry-capture');
      status.textContent = state.status;
      if (detail) detail.textContent = detailText || '';
      if (send) send.hidden = !state.send;
      if (retry) retry.hidden = !state.retry;
    }
    function show(draft) {
      if (draft.recordId) {
        paint(logUiState({ confirmed: true }), draft.error || '');
        return;
      }
      if (draft.status === 'needs-attention') {
        paint(logUiState({ failed: true }), draft.error || 'The send did not finish.');
        return;
      }
      if (draft.status === 'pending-sync') {
        paint(logUiState({ online: false }));
        return;
      }
      paint(logUiState({}));
    }
    async function send() {
      const draft = current();
      document.getElementById('idempotencyKey').value = draft.idempotencyKey;
      if (!navigator.onLine) {
        draft.status = 'pending-sync';
        draft.recordId = '';
        save(draft);
        show(draft);
        return;
      }
      try {
        const token = tokenOf(capture);
        const response = await fetch('/api/captures', {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json', 'x-csrf-token': token },
          body: JSON.stringify(draft),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !body.id) {
          draft.status = 'needs-attention';
          draft.recordId = '';
          draft.error = body.error || 'The server did not confirm the record.';
          save(draft);
          show(draft);
          return;
        }
        const photo = await uploadSelected(capture, body.id, token);
        draft.status = 'sent';
        draft.recordId = body.id;
        draft.error = photo.error || '';
        save(draft);
        show(draft);
      } catch {
        draft.status = 'needs-attention';
        draft.recordId = '';
        draft.error = 'The send did not finish.';
        save(draft);
        show(draft);
      }
    }
    capture.addEventListener('submit', (event) => {
      event.preventDefault();
      send();
    });
    const retry = document.getElementById('retry-capture');
    if (retry) retry.addEventListener('click', send);
    document.querySelectorAll('[data-step]').forEach((button) => {
      button.addEventListener('click', () => {
        const input = document.getElementById(button.getAttribute('data-step'));
        if (!input) return;
        input.value = String(Math.max(0, Number(input.value || 0) + Number(button.getAttribute('data-dir'))));
      });
    });
    const file = document.getElementById('photo-file');
    const preview = document.getElementById('photo-preview');
    if (file && preview) {
      file.addEventListener('change', () => {
        const chosen = file.files && file.files[0];
        if (!chosen) {
          preview.hidden = true;
          return;
        }
        preview.src = URL.createObjectURL(chosen);
        preview.hidden = false;
      });
    }
    const saved = load();
    if (saved) show(saved);
    else show(current());
  }

  if (fix) {
    const photoStatus = document.getElementById('photo-status');
    fix.addEventListener('submit', async (event) => {
      event.preventDefault();
      const token = tokenOf(fix);
      const payload = {
        numerator: fix.querySelector('#numerator').value,
        denominator: fix.querySelector('#denominator').value,
        projectResult: fix.querySelector('#projectResult').value,
        note: fix.querySelector('#note').value,
        attendance: attendanceOf(fix),
      };
      const response = await fetch(fix.action.replace('/coach/claims/', '/api/claims/'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', 'x-csrf-token': token },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.id) {
        if (photoStatus) photoStatus.textContent = body.error || 'The new version was not stored.';
        return;
      }
      const photo = await uploadSelected(fix, body.id, token);
      if (photoStatus) {
        photoStatus.textContent = photo.error
          ? `Version ${body.version} stored. ${photo.error}`
          : `Version ${body.version} stored.${photo.skipped ? '' : ' Photo stored.'}`;
      }
    });
  }

  if (sessionPhoto) {
    sessionPhoto.addEventListener('submit', async (event) => {
      event.preventDefault();
      const token = tokenOf(sessionPhoto);
      const claimId = sessionPhoto.action.match(/claims\/([a-z0-9-]+)\/photos/)?.[1];
      const photo = await uploadSelected(sessionPhoto, claimId, token);
      const status = document.createElement('p');
      status.setAttribute('role', 'alert');
      status.textContent = photo.error || (photo.id ? 'Photo stored.' : 'Choose a photo.');
      sessionPhoto.prepend(status);
      if (photo.id) window.location.reload();
    });
  }
})();

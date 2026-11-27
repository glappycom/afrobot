(function () {
  const photo = document.getElementById('log-photo');
  const next = document.getElementById('log-next');
  if (photo && next) {
    next.addEventListener('click', () => {
      const file = document.getElementById('log-file');
      const chosen = file && file.files ? file.files[0] : null;
      if (!chosen) {
        sessionStorage.removeItem('afrobot-phone-photo');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const learnerIds = [...photo.querySelectorAll('input[name="photoLearner"]:checked')].map((input) => input.value);
        const noStudents = document.getElementById('log-none')?.checked === true && learnerIds.length === 0;
        sessionStorage.setItem('afrobot-phone-photo', JSON.stringify({
          image: String(reader.result || ''),
          learnerIds,
          noStudents,
        }));
      };
      reader.readAsDataURL(chosen);
    });
  }

  const form = document.getElementById('log-save');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    const stored = sessionStorage.getItem('afrobot-phone-photo');
    if (!stored) return;
    event.preventDefault();
    const error = document.getElementById('log-error');
    const token = form.querySelector('input[name="csrf"]').value;
    const skills = [...form.querySelectorAll('input[name="skills"]:checked')].map((input) => input.value);
    const letters = form.querySelector('input[name="letters"]').value;
    let photoBody = {};
    try { photoBody = JSON.parse(stored); } catch { photoBody = {}; }
    const response = await fetch('/api/phone-log', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', 'x-csrf-token': token },
      body: JSON.stringify({
        letters,
        skills,
        image: photoBody.image,
        learnerIds: photoBody.learnerIds || [],
        noStudents: photoBody.noStudents !== false && !(photoBody.learnerIds || []).length,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (error) {
        error.hidden = false;
        error.textContent = body.error || 'The session was not stored.';
      }
      return;
    }
    sessionStorage.removeItem('afrobot-phone-photo');
    window.location = '/coach/log/saved';
  });
})();

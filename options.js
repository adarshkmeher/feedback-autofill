const { DEFAULTS, SCALES, CHOICE_KEYS, TEXT_KEYS, normalizeText, textProblem, wordCount } = globalThis.FeedbackCore;

const $ = (id) => document.getElementById(id);

for (const id of CHOICE_KEYS) {
  for (const o of SCALES[id]) $(id).add(new Option(o, o));
}

function show(values) {
  $('autoFill').checked = !!values.autoFill;
  for (const id of CHOICE_KEYS) $(id).value = values[id];
  for (const k of TEXT_KEYS) $(k).value = values[k];
  $('unsaved').hidden = !!values.savedAt;
  check();
}

// Checks the text as it will be saved (whitespace collapsed).
function check() {
  let ok = true;
  for (const k of TEXT_KEYS) {
    const text = normalizeText($(k).value);
    const problem = textProblem(k, text);
    const hint = document.querySelector(`[data-for="${k}"]`);
    hint.textContent = problem || `${wordCount(text)} words`;
    hint.classList.toggle('bad', !!problem);
    if (problem) ok = false;
  }
  return ok;
}

for (const k of TEXT_KEYS) $(k).addEventListener('input', check);

$('save').addEventListener('click', () => {
  if (!check()) {
    $('status').textContent = 'Fix the red word counts first; the ERP rejects them.';
    return;
  }
  const values = { autoFill: $('autoFill').checked, savedAt: Date.now() };
  for (const id of CHOICE_KEYS) values[id] = $(id).value;
  for (const k of TEXT_KEYS) values[k] = normalizeText($(k).value);
  chrome.storage.sync.set(values, () => {
    if (chrome.runtime.lastError) {
      $('status').textContent = `Not saved: ${chrome.runtime.lastError.message}`;
      return;
    }
    for (const k of TEXT_KEYS) $(k).value = values[k];
    $('unsaved').hidden = true;
    $('status').textContent = 'Saved. Open ERP tabs use it at once.';
  });
});

$('reset').addEventListener('click', () => {
  show({ ...DEFAULTS, savedAt: $('unsaved').hidden ? 1 : 0 });
  $('status').textContent = 'Defaults shown. Press Save to keep them.';
});

chrome.storage.sync.get(DEFAULTS, show);

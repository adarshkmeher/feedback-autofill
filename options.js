const { DEFAULTS, RATING, PACE, LOAD, TEXT_KEYS, textProblem, wordCount } = globalThis.FeedbackCore;

const SELECTS = { rating: RATING, pace: PACE, effort: LOAD, workload: LOAD };
const $ = (id) => document.getElementById(id);

for (const [id, options] of Object.entries(SELECTS)) {
  for (const o of options) $(id).add(new Option(o, o));
}

function show(values) {
  $('autoFill').checked = !!values.autoFill;
  for (const id of Object.keys(SELECTS)) $(id).value = values[id];
  for (const k of TEXT_KEYS) $(k).value = values[k];
  check();
}

function check() {
  let ok = true;
  for (const k of TEXT_KEYS) {
    const problem = textProblem(k, $(k).value);
    const hint = document.querySelector(`[data-for="${k}"]`);
    hint.textContent = problem || `${wordCount($(k).value)} words`;
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
  const values = { autoFill: $('autoFill').checked };
  for (const id of Object.keys(SELECTS)) values[id] = $(id).value;
  for (const k of TEXT_KEYS) values[k] = $(k).value.trim();
  chrome.storage.sync.set(values, () => {
    $('status').textContent = 'Saved. Open tabs pick it up at once.';
  });
});

$('reset').addEventListener('click', () => {
  show(DEFAULTS);
  $('status').textContent = 'Defaults shown. Press Save to keep them.';
});

chrome.storage.sync.get(DEFAULTS, show);

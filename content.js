// Runs inside the ERP feedback page (it loads in the "myframe" iframe of the
// ERP menu page, so the manifest uses all_frames).
//
// How the page behaves (checked on the live form, November 2026):
// - Picking a subject or a teacher sends an AJAX request and replaces the
//   whole question table, wiping anything typed. While a request runs the page
//   shows a full-screen #overlay, so "no #overlay" means the page is idle.
// - Submit posts the answers first and only then asks "Do you want to save
//   the details?". Cancel there leaves the answers saved but the Submit button
//   still on screen, so a second click would submit twice.
//
// So this script never keeps references to form elements across renders,
// keeps a per-tab draft of every answer so a re-render loses nothing, and
// locks Submit for a form whose first submission has no visible outcome.
// It never types the security code and never presses Submit. After the user's
// own Submit succeeds it opens and fills the next open form.
(function () {
  if (globalThis.__feedbackAutofill) return;
  globalThis.__feedbackAutofill = true;

  const C = globalThis.FeedbackCore;
  const PANEL_ID = 'fb-autofill-panel';
  const SEEN = 'data-fb-form'; // form key stamped on each question table once handled
  const STORE = 'fb-autofill:'; // sessionStorage prefix
  const WAIT_MS = 20000; // longest wait for one ERP request
  const NEED_SAVE =
    'Click the extension icon, check the answers and press Save once. Autofill types only answers you saved.';
  const LOCKED =
    'Submit was sent but the page showed no result. The ERP saves before it asks "Do you want to save the details?", ' +
    'so pressing Cancel there still saves. Submit is locked for this form to avoid a duplicate. ' +
    'Pick the teacher again to see whether it was saved.';

  const STALE =
    'The form on screen is not the teacher now selected: the ERP did not load the new one. ' +
    'Submitting would send these answers for the wrong teacher, so Submit is blocked. Pick the teacher again.';

  const byId = (id) => document.getElementById(id);
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const val = (id) => (byId(id) && byId(id).value) || '';

  let settings = null; // null until loaded from chrome.storage
  let running = false; // an Autofill click is being handled
  let filling = false; // our own clicks are firing change events
  let lockedKey = null; // form whose Submit outcome is unknown

  // ---- per-tab cache: submitted forms, teacher lists, drafts ----------------

  function readStore(name, fallback) {
    try {
      const v = sessionStorage.getItem(STORE + name);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeStore(name, value) {
    try {
      if (value === undefined) sessionStorage.removeItem(STORE + name);
      else sessionStorage.setItem(STORE + name, JSON.stringify(value));
    } catch {
      // Storage blocked or full: drafts and the cache are conveniences only.
    }
  }

  const scope = () => `${val('hid_session')}|${val('semester')}`;
  const formKey = (subject, teacher) => `${scope()}|${subject}|${teacher}`;
  const currentKey = () => formKey(val('hid_subno'), val('hid_assignee_id'));
  const doneSet = () => new Set(readStore('done', []));

  function markDone(key) {
    const done = doneSet();
    done.add(key);
    writeStore('done', [...done]);
    writeStore('draft:' + key, undefined);
  }

  // ---- reading the form -------------------------------------------------------

  function questionTable() {
    const qc = byId('questionContainer');
    const t = qc && qc.querySelector('table');
    return t && t.querySelector('[name^="question_"]') ? t : null;
  }

  // Key of the form on screen, stamped when its table was rendered. The page
  // changes the hidden fields before each request and leaves them changed when
  // the request fails, so they alone can name a form that is not on screen.
  function shownKey() {
    const t = questionTable();
    return t ? t.getAttribute(SEEN) || currentKey() : '';
  }

  // True when a failed request left another form on screen.
  const isStale = () => !!questionTable() && shownKey() !== currentKey();

  // The page hides #captcha_block for a submitted form and after a
  // successful Submit.
  function isSubmitted() {
    const cap = byId('captcha_block');
    return !!cap && cap.style.display === 'none';
  }

  const teacherRadios = () => [...document.querySelectorAll('input[type=radio][name="teacherSelection"]')];

  // <label><input> Excellent<span class=checkmark></span><span class=tooltip-text>Excellent</span></label>
  function optionLabel(r) {
    const own = r.nextSibling && r.nextSibling.nodeType === Node.TEXT_NODE ? clean(r.nextSibling.textContent) : '';
    return own || clean(r.parentElement && r.parentElement.textContent);
  }

  function questionCell(el) {
    const tr = el.closest('tr');
    return tr && tr.children[1] ? clean(tr.children[1].textContent) : '';
  }

  // "Q11 Strength", "Q4", for status messages.
  function fieldName(el) {
    const tr = el.closest('tr');
    const no = tr && tr.children[0] ? 'Q' + clean(tr.children[0].textContent).replace(/:$/, '') : el.name;
    if (el.tagName !== 'TEXTAREA' || el.classList.contains('suggestion_text')) return no;
    return `${no} ${clean(el.placeholder).replace(/\(.*$/, '')}`.trim();
  }

  function radioGroups(root) {
    const groups = new Map();
    for (const r of root.querySelectorAll('input[type=radio][name^="question_"]')) {
      if (!groups.has(r.name)) groups.set(r.name, []);
      groups.get(r.name).push(r);
    }
    return groups;
  }

  const textareas = (root) => root.querySelectorAll('textarea[name^="question_"]');

  function setText(ta, text) {
    ta.value = text;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function describe() {
    const t = teacherRadios().find((r) => r.checked);
    return `${val('hid_subno') || '?'}${t ? ' / ' + optionLabel(t) : ''}`;
  }

  // ---- filling and checking ---------------------------------------------------

  // Fills only blank questions, so answers the user picked or typed stay.
  function fill(root) {
    const r = { filled: 0, kept: 0, skipped: [] };
    for (const radios of radioGroups(root).values()) {
      if (radios.some((x) => x.checked)) {
        r.kept++;
        continue;
      }
      const labels = radios.map(optionLabel);
      const kind = C.classifyRadioGroup(labels, questionCell(radios[0]));
      const i = kind ? C.pickIndex(labels, settings[kind]) : -1;
      if (i < 0 || radios[i].disabled) {
        r.skipped.push(fieldName(radios[0]));
        continue;
      }
      radios[i].click(); // runs the page's own handlers
      r.filled++;
    }
    for (const ta of textareas(root)) {
      if (ta.value.trim()) {
        r.kept++;
        continue;
      }
      const key = C.classifyTextarea(ta.placeholder, questionCell(ta));
      const text = key ? C.normalizeText(settings[key]) : '';
      if (!key || ta.disabled || ta.readOnly || C.textProblem(key, text)) {
        r.skipped.push(fieldName(ta));
        continue;
      }
      setText(ta, text);
      r.filled++;
    }
    return r;
  }

  // The page's own Submit checks, plus the 50-word limit its labels state.
  function check(root) {
    const bad = [];
    for (const radios of radioGroups(root).values()) {
      if (!radios.some((x) => x.checked)) bad.push(`${fieldName(radios[0])} has no answer`);
    }
    for (const ta of textareas(root)) {
      const key = ta.classList.contains('suggestion_text') ? 'suggestion' : 'comment';
      const p = C.textProblem(key, ta.value);
      if (p) bad.push(`${fieldName(ta)}: ${p}`);
    }
    return bad;
  }

  // ---- drafts: survive the page's re-render ----------------------------------

  function saveDraft() {
    const root = questionTable();
    if (!root || isSubmitted()) return;
    const d = { radios: {}, texts: {} };
    for (const r of root.querySelectorAll('input[type=radio][name^="question_"]:checked')) d.radios[r.name] = r.value;
    for (const ta of textareas(root)) if (ta.value) d.texts[ta.name] = ta.value;
    writeStore('draft:' + shownKey(), d);
  }

  function restoreDraft(root) {
    const d = readStore('draft:' + shownKey(), null);
    if (!d) return 0;
    let n = 0;
    for (const [name, radios] of radioGroups(root)) {
      const want = d.radios && d.radios[name];
      const r = want && !radios.some((x) => x.checked) && radios.find((x) => x.value === want && !x.disabled);
      if (r) {
        r.click();
        n++;
      }
    }
    for (const ta of textareas(root)) {
      const want = d.texts && d.texts[ta.name];
      if (want && !ta.value.trim()) {
        setText(ta, want);
        n++;
      }
    }
    return n;
  }

  // ---- panel ---------------------------------------------------------------------

  function panel() {
    let p = byId(PANEL_ID);
    if (p) return p;
    p = document.createElement('div');
    p.id = PANEL_ID;
    p.style.cssText =
      'display:flex;align-items:center;gap:10px;margin:8px 0;padding:8px 10px;border:1px solid #2a6496;' +
      'border-radius:6px;background:#f5f9fc;font:13px/1.4 system-ui,sans-serif;color:#222';
    const btn = document.createElement('button');
    btn.type = 'button'; // never a form submit button
    btn.className = 'btn btn-primary btn-sm';
    btn.dataset.role = 'autofill';
    btn.textContent = 'Autofill';
    btn.addEventListener('click', onAutofill);
    const msg = document.createElement('div');
    msg.dataset.role = 'status';
    msg.setAttribute('role', 'status');
    msg.setAttribute('aria-live', 'polite');
    p.append(btn, msg);
    return p;
  }

  // Under the questions while a form is open, so the button, the status and
  // the security code sit together; above the form otherwise.
  function placePanel() {
    const p = panel();
    const qc = byId('questionContainer');
    const form = byId('studentFeedbackResponseForm');
    if (qc && questionTable()) {
      if (p.previousElementSibling !== qc) qc.after(p);
    } else if (form) {
      if (p.nextElementSibling !== form) form.before(p);
    } else if (!p.isConnected) {
      document.body.prepend(p);
    }
  }

  function status(text, tone) {
    const p = panel();
    const msg = p.querySelector('[data-role=status]');
    msg.textContent = text;
    msg.style.color = tone === 'ok' ? '#1b6e20' : tone === 'bad' ? '#b00020' : '#222';
    p.querySelector('[data-role=autofill]').disabled = running || !settings;
  }

  function idleStatus() {
    if (!settings) return status('Loading saved answers...');
    if (!settings.savedAt) return status(NEED_SAVE, 'bad');
    status('Press Autofill to open and fill the next form that is not submitted.');
  }

  function focusCaptcha() {
    const cap = byId('captchaInput');
    if (!cap) return;
    // Never touch the code itself: a code the user already typed stays valid.
    const target = cap.value ? byId('save_btn') || cap : cap;
    target.scrollIntoView({ block: 'center' });
    if (!cap.value) cap.focus({ preventScroll: true });
  }

  // ---- render handling -----------------------------------------------------------

  function fillCurrent() {
    const root = questionTable();
    if (!root || isSubmitted()) return false;
    if (isStale()) {
      status(STALE, 'bad');
      return true;
    }
    let r;
    filling = true;
    try {
      r = fill(root);
    } finally {
      filling = false;
    }
    saveDraft();
    const bad = check(root);
    let text = `${describe()}: filled ${r.filled}`;
    if (r.kept) text += `, kept ${r.kept} already answered`;
    text += '.';
    if (r.skipped.length) text += ` Left blank (no saved answer fits): ${r.skipped.join(', ')}.`;
    if (bad.length) {
      status(`${text} Fix before Submit: ${bad.join('; ')}.`, 'bad');
    } else if (lockedKey === shownKey()) {
      status(`${text} ${LOCKED}`, 'bad');
    } else {
      status(`${text} Every question passes the form's checks. Type the security code, then press Submit.`, 'ok');
    }
    focusCaptcha();
    return true;
  }

  function handleNewRender() {
    const root = questionTable();
    if (!root || root.hasAttribute(SEEN)) return;
    const key = currentKey(); // right after a render the hidden fields match it
    root.setAttribute(SEEN, key);
    if (lockedKey === key) lockedKey = null; // the server just sent this form's true state
    placePanel();
    if (isSubmitted()) {
      markDone(key);
      if (!running) status(`${describe()}: already submitted. Press Autofill for the next form.`, 'ok');
      return;
    }
    filling = true;
    let restored = 0;
    try {
      restored = restoreDraft(root);
    } finally {
      filling = false;
    }
    if (running) return; // onAutofill fills it next
    if (settings && settings.savedAt && settings.autoFill) fillCurrent();
    else status(`${describe()} loaded${restored ? `; ${restored} earlier answers restored` : ''}. Press Autofill.`);
  }

  function onDomChange() {
    const p = byId(PANEL_ID);
    const wasUnderForm = !!p && p.previousElementSibling === byId('questionContainer');
    handleNewRender();
    placePanel();
    // The user picked another subject: the old form's status no longer applies.
    if (wasUnderForm && !questionTable() && !running) idleStatus();
  }

  // Resolves once `done()` is true, checking on every DOM change.
  function waitFor(done, ms) {
    return new Promise((resolve, reject) => {
      if (done()) return resolve();
      const obs = new MutationObserver(() => {
        if (done()) finish(resolve);
      });
      const timer = setTimeout(() => finish(() => reject(new Error('the ERP did not answer in time'))), ms);
      function finish(fn) {
        obs.disconnect();
        clearTimeout(timer);
        fn();
      }
      obs.observe(document.body, { childList: true, subtree: true });
    });
  }

  // Clicks one of the page's own radios and waits for its request to end.
  async function pageClick(el) {
    el.click();
    await waitFor(() => !byId('overlay'), WAIT_MS);
  }

  // Opens the first (subject, teacher) form that is not submitted. Submitted
  // forms and teacher lists are cached per tab, so later runs skip them
  // without asking the ERP again.
  // Returns true once a form is open, or the subjects whose teacher list came
  // back empty (an ERP error clears the list too), so the caller does not
  // claim everything is submitted.
  async function openNextPending() {
    const done = doneSet();
    const unloaded = [];
    for (const s of document.querySelectorAll('input[type=radio][name="subject"]')) {
      const listKey = `teachers:${scope()}|${s.value}`;
      const cached = readStore(listKey, null);
      if (cached && cached.every((t) => done.has(formKey(s.value, t)))) continue;
      // The page sets hid_subno before its request, and a failed request leaves
      // the old teacher list. So trust a list on screen only when it matches the
      // one cached from a fresh load of this subject.
      const old = teacherRadios();
      const shownIsThis =
        s.checked && val('hid_subno') === s.value && cached && old.map((r) => r.value).join() === cached.join();
      if (!shownIsThis) {
        await pageClick(s);
        const fresh = teacherRadios();
        if (fresh.some((r) => old.includes(r))) throw new Error(`could not load the teachers of ${s.value}`);
        if (!fresh.length) {
          unloaded.push(s.value);
          continue;
        }
      }
      const teachers = teacherRadios();
      writeStore(
        listKey,
        teachers.map((t) => t.value),
      );
      for (const t of teachers) {
        const key = formKey(s.value, t.value);
        if (done.has(key)) continue;
        if (shownKey() !== key) {
          // Same rule for the questions: a failed request leaves the previous
          // teacher's form on screen while hid_assignee_id already names this one.
          const old = questionTable();
          await pageClick(t);
          const fresh = questionTable();
          if (!fresh || fresh === old) throw new Error(`could not load the form of ${s.value} / ${optionLabel(t)}`);
        }
        handleNewRender();
        if (!isSubmitted()) return true;
        done.add(key);
      }
    }
    return unloaded;
  }

  async function onAutofill() {
    if (running || !settings) return;
    if (!settings.savedAt) return status(NEED_SAVE, 'bad');
    running = true;
    status('Working...');
    try {
      if (fillCurrent()) return;
      status('Opening the next form that is not submitted...');
      const result = await openNextPending();
      if (result === true) fillCurrent();
      else if (result.length) {
        status(`No open form found, but no teacher list came for ${result.join(', ')}. Pick those by hand.`, 'bad');
      } else status('Every subject and teacher is already submitted. Nothing left to fill.', 'ok');
    } catch (e) {
      status(`Autofill stopped: ${e.message}. Check the page, then press Autofill again.`, 'bad');
    } finally {
      running = false;
      panel().querySelector('[data-role=autofill]').disabled = false;
    }
  }

  // ---- duplicate-submission guard ------------------------------------------------

  async function watchSubmit(key) {
    lockedKey = key; // until the page shows a result
    status('Submitting. Answer the page\'s question, then wait for its result.');
    try {
      await waitFor(() => !byId('overlay'), 10 * 60 * 1000); // the page's confirm() can stay open
    } catch {
      // Fall through and judge by what is on screen.
    }
    // Bootstrap adds its result dialog after a short fade.
    const dialogShown = () =>
      [...document.querySelectorAll('.bootstrap-dialog, .modal')].some((el) => getComputedStyle(el).display !== 'none');
    await waitFor(() => isSubmitted() || dialogShown(), 2000).catch(() => {});
    if (shownKey() !== key) return;
    const dialog = dialogShown();
    if (isSubmitted()) {
      lockedKey = null;
      markDone(key);
      status(`${describe()}: submitted. Opening the next form...`, 'ok');
      // The user typed the code and pressed Submit for this form. Open and fill
      // the next one so only the next code is left to type. onAutofill stops on
      // any error and never presses Submit.
      if (!running) await onAutofill();
    } else if (dialog) {
      lockedKey = null; // the ERP answered with an error and saved nothing
      status('The ERP refused this submission; read its message. Fix it, check the security code and press Submit again.', 'bad');
    } else {
      status(LOCKED, 'bad');
    }
  }

  const isSave = (e) => e.target instanceof Element && !!e.target.closest('#save_btn');

  // Capture phase: runs before the page's onclick, so a locked Submit never
  // reaches it.
  document.addEventListener(
    'click',
    (e) => {
      if (!isSave(e)) return;
      const message = isStale() ? STALE : lockedKey && lockedKey === shownKey() ? LOCKED : null;
      if (!message) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      status(message, 'bad');
    },
    true,
  );

  // Bubble phase: runs right after the page's onclick. The page adds #overlay
  // synchronously when its checks pass and it sends the answers; no overlay
  // means it stopped on a validation message and sent nothing.
  document.addEventListener('click', (e) => {
    if (isSave(e) && byId('overlay')) watchSubmit(shownKey());
  });

  // Keep a draft of every change the user makes.
  for (const type of ['input', 'change']) {
    document.addEventListener(
      type,
      (e) => {
        if (filling || !(e.target instanceof Element)) return;
        const qc = byId('questionContainer');
        if (qc && qc.contains(e.target)) saveDraft();
      },
      true,
    );
  }

  // ---- start -------------------------------------------------------------------

  try {
    chrome.storage.sync.get(C.DEFAULTS, (got) => {
      settings = { ...C.DEFAULTS, ...got };
      placePanel();
      idleStatus();
      new MutationObserver(onDomChange).observe(document.body, { childList: true, subtree: true });
      handleNewRender();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync' || !settings) return;
      for (const [k, v] of Object.entries(changes)) settings[k] = v.newValue ?? C.DEFAULTS[k];
      if (!running && !questionTable()) idleStatus();
    });
  } catch {
    // The extension was reloaded under this tab; this old copy stays idle.
  }
})();

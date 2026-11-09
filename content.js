// Runs inside the ERP feedback page (it loads in the "myframe" iframe of the
// ERP menu page, so the manifest uses all_frames).
//
// The page does not keep the form: choosing a subject or a teacher sends
// POST displayFeedbackQuestions.htm and replaces the whole question block,
// which wipes anything typed. So this script never holds on to form
// elements. It watches the DOM, and each freshly rendered form gets filled
// once. A fresh render is spotted by a marker attribute that the old DOM
// carried and the new DOM does not.
(function () {
  const { DEFAULTS, classifyRadioGroup, classifyTextarea, pickIndex } = globalThis.FeedbackCore;
  const FORM_ID = 'studentFeedbackResponseForm';
  const MARK = 'data-fb-autofilled';
  const PANEL_ID = 'fb-autofill-panel';

  let settings = { ...DEFAULTS };
  let timer = null;

  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

  function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(DEFAULTS, (got) => {
        settings = { ...DEFAULTS, ...got };
        resolve();
      });
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    for (const [k, v] of Object.entries(changes)) settings[k] = v.newValue ?? DEFAULTS[k];
    renderPanel(document.getElementById(FORM_ID));
  });

  function questionText(el) {
    const tr = el.closest('tr');
    return clean(tr ? tr.textContent : '');
  }

  function radioLabel(r) {
    if (r.labels && r.labels[0]) {
      // <label><input> Excellent<span class=checkmark/><span class=tooltip-text>Excellent</span></label>
      const own = r.nextSibling && r.nextSibling.nodeType === Node.TEXT_NODE ? clean(r.nextSibling.textContent) : '';
      return own || clean(r.labels[0].textContent);
    }
    return clean(r.nextSibling ? r.nextSibling.textContent : '');
  }

  // Text shown just before the textarea, e.g. "Strength(10-50 words)".
  function labelBefore(el) {
    let n = el;
    for (let i = 0; i < 8 && n; i++) {
      n = n.previousSibling || (n.parentElement && n.parentElement !== document.body ? n.parentElement.previousSibling : null);
      if (n && clean(n.textContent)) return clean(n.textContent);
    }
    return '';
  }

  function isSubmitted() {
    return /has been submitted/i.test(document.body.textContent);
  }

  function radioGroups(form) {
    const groups = new Map();
    for (const r of form.querySelectorAll('input[type=radio][name^="question_"]')) {
      if (!groups.has(r.name)) groups.set(r.name, []);
      groups.get(r.name).push(r);
    }
    return groups;
  }

  function fill(form, { overwrite }) {
    const report = { radios: 0, texts: 0, unknown: [] };

    for (const [name, radios] of radioGroups(form)) {
      if (!overwrite && radios.some((r) => r.checked)) continue;
      const labels = radios.map(radioLabel);
      const kind = classifyRadioGroup(labels, questionText(radios[0]));
      if (!kind) {
        report.unknown.push(name);
        continue;
      }
      const i = pickIndex(labels, settings[kind]);
      if (i < 0 || radios[i].disabled) {
        report.unknown.push(name);
        continue;
      }
      if (!radios[i].checked) radios[i].click(); // fires the page's own change handlers
      report.radios++;
    }

    for (const ta of form.querySelectorAll('textarea[name^="question_"]')) {
      if (ta.disabled || ta.readOnly) continue;
      if (!overwrite && ta.value.trim()) continue;
      const key = classifyTextarea(labelBefore(ta), questionText(ta));
      if (!key) {
        report.unknown.push(ta.name);
        continue;
      }
      ta.value = settings[key];
      for (const type of ['input', 'keyup', 'change']) ta.dispatchEvent(new Event(type, { bubbles: true }));
      report.texts++;
    }
    return report;
  }

  function describe(form) {
    const sub = form.querySelector('#hid_subno')?.value || '?';
    const kind = form.querySelector('#subject_type')?.value === 'L' ? 'lab' : 'theory';
    const teacher = document.querySelector('input[name=teacherSelection]:checked');
    const tName = teacher ? radioLabel(teacher) : '';
    return `${sub} (${kind})${tName ? ' / ' + tName : ''}`;
  }

  function runFill(form, overwrite) {
    const r = fill(form, { overwrite });
    form.setAttribute(MARK, '1');
    let msg = `Filled ${r.radios} ratings and ${r.texts} comments for ${describe(form)}. Type the captcha and press Submit.`;
    if (r.unknown.length) msg += ` Not filled: ${r.unknown.join(', ')}.`;
    renderPanel(form, msg);
    const cap = document.getElementById('captchaInput');
    if (cap) {
      cap.scrollIntoView({ block: 'center' });
      cap.focus({ preventScroll: true });
    }
  }

  function renderPanel(form, message) {
    let panel = document.getElementById(PANEL_ID);
    if (!form) {
      panel?.remove();
      return;
    }
    if (!panel) {
      panel = document.createElement('div');
      panel.id = PANEL_ID;
      panel.style.cssText =
        'position:fixed;right:16px;bottom:16px;z-index:2147483647;max-width:340px;padding:10px 12px;' +
        'background:#fff;border:1px solid #2a6496;border-radius:6px;box-shadow:0 2px 10px rgba(0,0,0,.25);' +
        'font:13px/1.4 system-ui,sans-serif;color:#222';
      panel.innerHTML =
        '<div style="font-weight:600;margin-bottom:4px">Feedback autofill</div>' +
        '<div data-role="msg"></div>' +
        '<div style="margin-top:8px;display:flex;gap:6px">' +
        '<button type="button" data-role="fill">Fill now</button>' +
        '<label style="display:flex;align-items:center;gap:4px"><input type="checkbox" data-role="auto"> Auto-fill</label>' +
        '</div>';
      panel.querySelector('[data-role=fill]').addEventListener('click', () => {
        const f = document.getElementById(FORM_ID);
        if (f && !isSubmitted()) runFill(f, true);
      });
      panel.querySelector('[data-role=auto]').addEventListener('change', (e) => {
        chrome.storage.sync.set({ autoFill: e.target.checked });
      });
      document.body.appendChild(panel);
    }
    panel.querySelector('[data-role=auto]').checked = !!settings.autoFill;
    const submitted = isSubmitted();
    panel.querySelector('[data-role=fill]').disabled = submitted;
    if (submitted) message = `${describe(form)}: already submitted. Pick another subject or teacher.`;
    if (message) panel.querySelector('[data-role=msg]').textContent = message;
    else if (!panel.querySelector('[data-role=msg]').textContent)
      panel.querySelector('[data-role=msg]').textContent = 'Pick a subject and a teacher.';
  }

  function onDomChange() {
    const form = document.getElementById(FORM_ID);
    if (!form || !form.querySelector('[name^="question_"]')) {
      renderPanel(form);
      return;
    }
    // A new render carries no marker, so it is filled once; later mutations
    // on the same render (our panel, the busy spinner) leave it alone.
    const fresh = !form.hasAttribute(MARK) || !form.querySelector('[name^="question_"]').hasAttribute(MARK);
    if (!fresh) return;
    form.querySelector('[name^="question_"]').setAttribute(MARK, '1');
    form.setAttribute(MARK, '1');
    if (isSubmitted()) {
      renderPanel(form);
      return;
    }
    if (settings.autoFill) runFill(form, false);
    else renderPanel(form, `${describe(form)} loaded. Press Fill now.`);
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(onDomChange, 300); // let the AJAX render settle
  }

  loadSettings().then(() => {
    new MutationObserver((records) => {
      const ours = records.every((r) => document.getElementById(PANEL_ID)?.contains(r.target));
      if (!ours) schedule();
    }).observe(document.body, { childList: true, subtree: true });
    schedule();
  });
})();

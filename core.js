// Pure logic shared by the content script, the options page and the tests.
// No DOM access here, so `node --test` can load it directly.
(function (root) {
  const RATING = ['Excellent', 'Very good', 'Good', 'Fair', 'Poor'];
  const PACE = ['Too Fast', 'Fast', 'Just Right', 'Slow', 'Too Slow'];
  const LOAD = ['Very Heavy', 'Heavy', 'Average', 'Light', 'Very Light'];

  // `savedAt` stays 0 until the user presses Save on the settings page. The
  // content script fills nothing before that, so every answer it types is one
  // the user has seen and approved.
  const DEFAULTS = {
    savedAt: 0,
    autoFill: false,
    rating: 'Very good',
    pace: 'Just Right',
    effort: 'Average',
    workload: 'Average',
    teacherStrength:
      'The teacher knows the subject well and explains the core ideas clearly with examples, which made the lectures easy to follow.',
    teacherWeakness:
      'Sometimes the pace was a little uneven, and a few more worked examples before the tests would help students practise.',
    courseStrength:
      'The course covers the important fundamentals in a logical order and links the theory to practical engineering applications.',
    courseWeakness:
      'Some topics near the end of the semester felt rushed, so a little more time for them would improve understanding.',
    suggestion:
      'Sharing slides and practice problems in advance and holding a short revision session before each test would help students a lot.',
  };

  const TEXT_KEYS = ['teacherStrength', 'teacherWeakness', 'courseStrength', 'courseWeakness', 'suggestion'];
  const CHOICE_KEYS = ['rating', 'pace', 'effort', 'workload'];
  const SCALES = { rating: RATING, pace: PACE, effort: LOAD, workload: LOAD };

  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();

  // The ERP rejects any comment that contains two whitespace characters in a
  // row (its check is /\s{2,}/, so a line break followed by a space fails).
  const normalizeText = (s) => String(s || '').replace(/\s+/g, ' ').trim();

  function wordCount(s) {
    const t = String(s || '').trim();
    return t ? t.split(/\s+/).length : 0;
  }

  // Rules from the form: strength and weakness boxes say 10-50 words, the
  // suggestions box needs at least 10 words and has maxlength=500. The server
  // limit for the other boxes is unknown, so every comment keeps under 500
  // characters. `text` is checked as typed, like the page's own check.
  const MAX_CHARS = 500;
  function textProblem(key, text) {
    const raw = String(text || '');
    if (/\s{2,}/.test(raw)) return 'two spaces or a line break in a row; the form allows one space between words';
    const n = wordCount(raw);
    if (n < 10) return `${n} words; the form needs at least 10`;
    if (key !== 'suggestion' && n > 50) return `${n} words; the form allows at most 50`;
    if (raw.trim().length > MAX_CHARS) return `${raw.trim().length} characters; keep it to ${MAX_CHARS}`;
    return null;
  }

  // Problems that make saved settings unusable. Empty list means usable.
  function settingsProblems(s) {
    const out = [];
    for (const k of CHOICE_KEYS) if (!SCALES[k].includes(s[k])) out.push(`${k}: unknown choice "${s[k]}"`);
    for (const k of TEXT_KEYS) {
      const p = textProblem(k, s[k]);
      if (p) out.push(`${k}: ${p}`);
    }
    return out;
  }

  function sameSet(labels, scale) {
    const a = labels.map(norm).sort().join('|');
    const b = scale.map(norm).sort().join('|');
    return a === b;
  }

  // Field names change meaning between templates (question_13 is "effort" on a
  // theory form but "teaching assistants" on a lab form), so classify each
  // radio group by its option labels and question text, never by its name.
  // A group that matches no known scale returns null and stays blank.
  function classifyRadioGroup(optionLabels, questionText) {
    if (sameSet(optionLabels, RATING)) return 'rating';
    if (sameSet(optionLabels, PACE)) return 'pace';
    if (sameSet(optionLabels, LOAD)) {
      if (/workload/i.test(questionText)) return 'workload';
      if (/effort/i.test(questionText)) return 'effort';
    }
    return null;
  }

  // `label` is the textarea's placeholder ("Strength(10-50 words)",
  // "Suggestions"); `questionText` is the question cell beside it.
  function classifyTextarea(label, questionText) {
    if (/suggestion/i.test(label) || /^suggestion/i.test(norm(questionText))) return 'suggestion';
    const subject = /course contents|course structure/i.test(questionText)
      ? 'course'
      : /teacher/i.test(questionText)
        ? 'teacher'
        : null;
    if (!subject) return null;
    if (/strength/i.test(label)) return subject + 'Strength';
    if (/weakness/i.test(label)) return subject + 'Weakness';
    return null;
  }

  function pickIndex(optionLabels, wanted) {
    const w = norm(wanted);
    return optionLabels.findIndex((l) => norm(l) === w);
  }

  root.FeedbackCore = {
    RATING,
    PACE,
    LOAD,
    DEFAULTS,
    TEXT_KEYS,
    CHOICE_KEYS,
    SCALES,
    MAX_CHARS,
    normalizeText,
    wordCount,
    textProblem,
    settingsProblems,
    classifyRadioGroup,
    classifyTextarea,
    pickIndex,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

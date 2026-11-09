// Pure logic shared by the content script, the options page and the tests.
// No DOM access here, so `node --test` can load it directly.
(function (root) {
  const RATING = ['Excellent', 'Very good', 'Good', 'Fair', 'Poor'];
  const PACE = ['Too Fast', 'Fast', 'Just Right', 'Slow', 'Too Slow'];
  const LOAD = ['Very Heavy', 'Heavy', 'Average', 'Light', 'Very Light'];

  const DEFAULTS = {
    autoFill: true,
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

  const TEXT_KEYS = [
    'teacherStrength',
    'teacherWeakness',
    'courseStrength',
    'courseWeakness',
    'suggestion',
  ];

  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();

  function wordCount(s) {
    const t = String(s || '').trim();
    return t ? t.split(/\s+/).length : 0;
  }

  // ERP rules from the form labels: strength/weakness 10-50 words, suggestions
  // at least 10. Only the suggestions box carries maxlength=500, but the server
  // limit for the others is unknown, so every comment keeps under 500 characters.
  const MAX_CHARS = 500;
  function textProblem(key, text) {
    const t = String(text || '').trim();
    const n = wordCount(t);
    if (n < 10) return `${n} words; the form needs at least 10`;
    if (key !== 'suggestion' && n > 50) return `${n} words; the form allows at most 50`;
    if (t.length > MAX_CHARS) return `${t.length} characters; keep it to ${MAX_CHARS}`;
    return null;
  }

  function sameSet(labels, scale) {
    const a = labels.map(norm).sort().join('|');
    const b = scale.map(norm).sort().join('|');
    return a === b;
  }

  // Field names change meaning between templates (question_13 is "effort" on a
  // theory form but "teaching assistants" on a lab form), so classify each
  // radio group by its option labels and question text, never by its name.
  function classifyRadioGroup(optionLabels, questionText) {
    if (sameSet(optionLabels, RATING)) return 'rating';
    if (sameSet(optionLabels, PACE)) return 'pace';
    if (sameSet(optionLabels, LOAD)) {
      if (/workload/i.test(questionText)) return 'workload';
      if (/effort/i.test(questionText)) return 'effort';
      return 'workload';
    }
    return null;
  }

  // `label` is the text right before the textarea ("Strength(10-50 words)").
  function classifyTextarea(label, questionText) {
    if (/suggestion/i.test(questionText) || /^minimum/i.test(norm(label))) return 'suggestion';
    const subject = /course contents|course structure/i.test(questionText) ? 'course' : 'teacher';
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
    wordCount,
    textProblem,
    classifyRadioGroup,
    classifyTextarea,
    pickIndex,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

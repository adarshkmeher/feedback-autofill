import { test } from 'node:test';
import assert from 'node:assert/strict';
import './core.js';

const C = globalThis.FeedbackCore;

test('rating, pace and load groups are told apart by labels', () => {
  assert.equal(C.classifyRadioGroup(['Excellent', 'Very good', 'Good', 'Fair', 'Poor'], '1: Knowledge'), 'rating');
  assert.equal(C.classifyRadioGroup(['Too Fast', 'Fast', 'Just Right', 'Slow', 'Too Slow'], '4: Pace'), 'pace');
  assert.equal(
    C.classifyRadioGroup(['Very Heavy', 'Heavy', 'Average', 'Light', 'Very Light'], '13: Your effort in studying the course'),
    'effort',
  );
  assert.equal(
    C.classifyRadioGroup(
      ['Very Heavy', 'Heavy', 'Average', 'Light', 'Very Light'],
      '14: Workload of this course in comparison with other courses',
    ),
    'workload',
  );
  assert.equal(C.classifyRadioGroup(['Yes', 'No'], 'x'), null);
});

test('lab question_13 (teaching assistants) is a rating, not effort', () => {
  assert.equal(
    C.classifyRadioGroup(['Excellent', 'Very good', 'Good', 'Fair', 'Poor'], '13: Knowledge and skills of teaching assitants'),
    'rating',
  );
});

test('textareas map by label and question', () => {
  const teacherQ = '11: Mention the strength and weakness of the teacher considering all aspects of teaching';
  const courseQ = '12: Mention the strength and weakness of course contents and structure';
  const labQ = '9: Mention the strength and weakness of the teacher considering all aspects of laboratory classes';
  assert.equal(C.classifyTextarea('Strength(10-50 words)', teacherQ), 'teacherStrength');
  assert.equal(C.classifyTextarea('Weakness(10-50 words)', teacherQ), 'teacherWeakness');
  assert.equal(C.classifyTextarea('Strength(10-50 words)', courseQ), 'courseStrength');
  assert.equal(C.classifyTextarea('Weakness(10-50 words)', courseQ), 'courseWeakness');
  assert.equal(C.classifyTextarea('Weakness(10-50 words)', labQ), 'teacherWeakness');
  assert.equal(C.classifyTextarea('Minimum : 10 words', '15: Suggestions Minimum : 10 words'), 'suggestion');
});

test('pickIndex ignores case and spacing', () => {
  assert.equal(C.pickIndex(['Excellent', 'Very good', 'Good'], 'very  good'), 1);
  assert.equal(C.pickIndex(['Excellent'], 'Poor'), -1);
});

test('default comments meet the ERP word limits', () => {
  for (const k of C.TEXT_KEYS) assert.equal(C.textProblem(k, C.DEFAULTS[k]), null, k);
});

test('word limits', () => {
  assert.match(C.textProblem('teacherStrength', 'too short'), /at least 10/);
  assert.match(C.textProblem('teacherStrength', 'w '.repeat(51)), /at most 50/);
  assert.equal(C.textProblem('suggestion', 'w '.repeat(80)), null);
});

test('every comment stays within 500 characters', () => {
  const long = Array.from({ length: 40 }, () => 'abcdefghijklmn').join(' '); // 40 words, 599 chars
  assert.match(C.textProblem('teacherStrength', long), /599 characters/);
  assert.match(C.textProblem('suggestion', long), /599 characters/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import './core.js';

const C = globalThis.FeedbackCore;
const LOAD = ['Very Heavy', 'Heavy', 'Average', 'Light', 'Very Light'];

test('rating, pace and load groups are told apart by labels', () => {
  assert.equal(C.classifyRadioGroup(['Excellent', 'Very good', 'Good', 'Fair', 'Poor'], 'Knowledge'), 'rating');
  assert.equal(C.classifyRadioGroup(['Too Fast', 'Fast', 'Just Right', 'Slow', 'Too Slow'], 'Pace / speed'), 'pace');
  assert.equal(C.classifyRadioGroup(LOAD, 'Your effort in studying the course'), 'effort');
  assert.equal(C.classifyRadioGroup(LOAD, 'Workload of this course in comparison with other courses'), 'workload');
  assert.equal(C.classifyRadioGroup(['Yes', 'No'], 'x'), null);
});

test('an unknown question on a known scale stays blank', () => {
  assert.equal(C.classifyRadioGroup(LOAD, 'Difficulty of the examinations'), null);
});

test('lab question_13 (teaching assistants) is a rating, not effort', () => {
  assert.equal(
    C.classifyRadioGroup(['Excellent', 'Very good', 'Good', 'Fair', 'Poor'], 'Knowledge and skills of teaching assitants'),
    'rating',
  );
});

test('textareas map by placeholder and question, as on the live form', () => {
  const teacherQ = 'Mention the strength and weakness of the teacher considering all aspects of teaching';
  const courseQ = 'Mention the strength and weakness of course contents and structure';
  const labQ = 'Mention the strength and weakness of the teacher considering all aspects of laboratory classes';
  assert.equal(C.classifyTextarea('Strength(10-50 words)', teacherQ), 'teacherStrength');
  assert.equal(C.classifyTextarea('Weakness(10-50 words)', teacherQ), 'teacherWeakness');
  assert.equal(C.classifyTextarea(' Strength(10-50 words) ', courseQ), 'courseStrength');
  assert.equal(C.classifyTextarea(' Weakness(10-50 words) ', courseQ), 'courseWeakness');
  assert.equal(C.classifyTextarea('Weakness(10-50 words)', labQ), 'teacherWeakness');
  assert.equal(C.classifyTextarea('Suggestions', 'Suggestions'), 'suggestion');
  assert.equal(C.classifyTextarea('Strength', 'Mention the strength of the library'), null);
});

test('pickIndex ignores case and spacing', () => {
  assert.equal(C.pickIndex(['Excellent', 'Very good', 'Good'], 'very  good'), 1);
  assert.equal(C.pickIndex(['Excellent'], 'Poor'), -1);
});

test('default answers meet the ERP rules', () => {
  assert.deepEqual(C.settingsProblems(C.DEFAULTS), []);
  assert.equal(C.DEFAULTS.savedAt, 0, 'defaults are not approved until saved');
});

test('settingsProblems flags a choice that is not on the scale', () => {
  assert.match(C.settingsProblems({ ...C.DEFAULTS, pace: 'Average' })[0], /pace/);
});

test('word limits', () => {
  assert.match(C.textProblem('teacherStrength', 'too short'), /at least 10/);
  assert.match(C.textProblem('teacherStrength', Array(51).fill('w').join(' ')), /at most 50/);
  assert.equal(C.textProblem('suggestion', Array(80).fill('w').join(' ')), null);
});

test('the ERP rejects two whitespace characters in a row', () => {
  const ok = 'one two three four five six seven eight nine ten';
  assert.equal(C.textProblem('suggestion', ok), null);
  assert.match(C.textProblem('suggestion', ok.replace('two', ' two')), /one space/);
  assert.match(C.textProblem('suggestion', ok.replace(' two', '\r\ntwo')), /one space/);
  assert.equal(C.textProblem('suggestion', C.normalizeText(`  ${ok.replace(' two', '\n\n two')}  `)), null);
});

test('every comment stays within 500 characters', () => {
  const long = Array.from({ length: 40 }, () => 'abcdefghijklmn').join(' '); // 40 words, 599 chars
  assert.match(C.textProblem('teacherStrength', long), /599 characters/);
  assert.match(C.textProblem('suggestion', long), /599 characters/);
});

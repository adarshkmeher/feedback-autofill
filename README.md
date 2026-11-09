# IIT KGP ERP Feedback Autofill

A Chrome extension that fills the subject feedback form on the IIT Kharagpur ERP
(Academic > Feedback > Feedback Form) with answers you save once. One click on
**Autofill** opens the next form that is not submitted and fills every question.
You still type the security code and press **Submit** yourself. The extension
never submits.

## Install

1. Open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked**
   and pick this folder.
2. Click the extension's toolbar icon, check the ratings and comments, then press
   **Save**. Autofill does nothing until you have saved once, so it only ever types
   answers you have approved.

After you change any file here, press the reload button on the extension's card
in `chrome://extensions`, then hard-reload the ERP tab (`Ctrl+Shift+R`). Chrome
keeps running the old content script until both happen.

## Use

1. Open ERP > Academic > Feedback > Feedback Form.
2. Press **Autofill** in the panel. It skips every subject and teacher that is
   already submitted, opens the first open one and fills it. The status line says
   what it filled and whether every answer passes the form's checks.
3. Check the answers, type the security code and press **Submit**.
4. Press **Autofill** again for the next form.

Autofill fills only blank questions. Answers you picked or typed stay as they are.
If you tick **Also fill each form as soon as it opens** on the settings page, a
form you open by hand is filled without pressing the button.

## How the form behaves

These facts come from inspecting the live form in November 2026.

- The form lives in an iframe (`myframe`) at
  `/Academic/studentFeedbackResponseView.htm`, so the content script runs with
  `all_frames`.
- Every subject and teacher pair is a separate form with its own security code and
  Submit. Picking a subject or a teacher sends an AJAX request and replaces the
  whole question block, which wipes anything already filled. While a request runs
  the page shows a full-screen `#overlay`; the extension waits for it to go.
- The extension keeps a draft of every answer for the current tab in
  `sessionStorage`, so answers come back after the page re-renders a form. It also
  remembers which forms are submitted, so later clicks skip them without asking the
  ERP again. Closing the tab clears both.
- There are two templates. Theory subjects (`sub_type` `T`) have 15 questions; lab
  subjects (`L`) have 14. Field names mean different things in each: `question_13`
  is "your effort" on a theory form and "teaching assistants" on a lab form. So the
  extension classifies every radio group by its option labels (Excellent...Poor,
  Too Fast...Too Slow, Very Heavy...Very Light) and every textarea by its
  placeholder (Strength, Weakness, Suggestions) and question, never by field name
  or value. A question it does not recognise is left blank and named in the status.
- Submitted forms hide the security code block and show "Feedback for subject has
  been submitted. No further changes are allowed." The extension leaves those alone.
- Strength and weakness answers need 10 to 50 words; suggestions need at least 10
  words. The page also rejects two whitespace characters in a row (`/\s{2,}/`), so a
  line break or a double space fails. The settings page collapses whitespace on save
  and refuses text that breaks the limits.
- Submit posts the answers **before** the page asks "Do you want to save the
  details?". Pressing Cancel there still saves, but leaves Submit on screen. When a
  submission ends with no visible result, the extension locks Submit for that form
  until you pick the teacher again, which reloads its true state from the ERP. An
  ERP error message (for example a wrong security code) unlocks it at once.

## Test

```sh
node --test core.test.mjs
```

The tests cover the label-based classification, the word and whitespace rules and
the default answers in `core.js`. The DOM code in `content.js` was tested by
injecting it into the live form: filling theory and lab forms, skipping a submitted
form, restoring a draft after a re-render, keeping a typed security code, and the
Submit lock (with the page's `saveFormDetails` stubbed so nothing was sent).

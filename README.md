# IIT KGP ERP Feedback Autofill

A Chrome extension that fills the subject feedback form on the IIT Kharagpur ERP
(Academic > Feedback > Feedback Form) with answers you save once. You still type
the captcha and press **Submit** yourself. The extension never submits.

## Install

1. Open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked**
   and pick this folder.
2. Click the extension's toolbar icon to set your ratings and comments, then
   press **Save**.

After you change any file here, press the reload button on the extension's card
in `chrome://extensions`, then hard-reload the ERP tab (`Ctrl+Shift+R`). Chrome
keeps running the old content script until both happen.

## Use

1. Open ERP > Academic > Feedback > Feedback Form.
2. Pick a subject, then a teacher. The form fills on its own (turn this off with
   the **Auto-fill** box in the panel at the bottom right).
3. Check the answers, type the captcha and press **Submit**.
4. Pick the next teacher or subject.

**Fill now** in the panel refills every field, overwriting anything you typed.
Auto-fill only fills blank fields.

## How the form behaves

These facts come from inspecting the live form in November 2026.

- The form lives in an iframe (`myframe`) at
  `/Academic/studentFeedbackResponseView.htm`, so the content script runs with
  `all_frames`.
- The page keeps no state. Choosing a subject or a teacher sends
  `POST /Academic/displayFeedbackQuestions.htm` and replaces the whole question
  block, which wipes anything already filled. The extension therefore never keeps
  references to form elements. A `MutationObserver` spots each new render (it has
  no `data-fb-autofilled` marker yet) and fills it once.
- There are two templates. Theory subjects (`sub_type` `T`) have 15 questions; lab
  subjects (`L`) have 14. Field names mean different things in each: `question_13`
  is "your effort" on a theory form and "teaching assistants" on a lab form. So the
  extension classifies every radio group by its option labels (Excellent...Poor,
  Too Fast...Too Slow, Very Heavy...Very Light) and every textarea by the label
  above it (Strength, Weakness, Suggestions), never by field name or value.
- Submitted subjects show "Feedback for subject has been submitted. No further
  changes are allowed." The extension leaves those alone.
- Strength and weakness answers need 10 to 50 words; suggestions need at least 10
  words. Only the suggestions box has `maxlength=500`, but the extension keeps every
  comment under 500 characters because the server limit is unknown. The settings
  page refuses to save text that breaks these limits.

## Test

```sh
node --test core.test.mjs
```

The tests cover the label-based classification and the word limits in `core.js`.

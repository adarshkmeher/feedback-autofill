# Chrome Web Store listing

Copy each block into the matching field of the Chrome Web Store developer dashboard.

## Store listing tab

**Name** (from the manifest): IIT KGP ERP Feedback Autofill

**Summary** (132 characters at most):
Fills the IIT KGP ERP subject feedback form with answers you save once. You type the security code and press Submit.

**Category:** Productivity

**Language:** English

**Description**

Unofficial tool. Not made by or affiliated with IIT Kharagpur or the ERP team.

Every semester the ERP asks you to fill one feedback form for each subject and teacher. Each form has 14 or 15 questions, and each needs its own security code. This extension does the repeated typing and leaves the code to you.

How it works
1. Click the extension icon, check the ratings and comments, and press Save. You do this once. Autofill stays off until you have saved, so it only types answers you approved.
2. Open ERP > Academic > Feedback > Feedback Form and press Autofill. The extension skips every subject and teacher that is already submitted, opens the next open form and fills every question.
3. Type the security code and press Submit yourself.
4. When the ERP confirms your submission, the next open form opens and fills by itself, and the cursor waits in its security code box. Repeat step 3 until every form is done.

What you get
- Ratings and comments filled for theory forms and lab forms, which have different questions. The extension reads the option labels, so one set of answers covers both.
- Comment checks that match the form: 10 to 50 words for strength and weakness, at least 10 words for suggestions, and no double spaces.
- A duplicate-submit guard. If a Submit ends with no visible result, Submit is locked for that form until you pick the teacher again.
- A wrong-teacher guard. If the ERP fails to load the next form, Submit is blocked so answers never go to the wrong teacher.

What it does not do
- It never types the security code and never solves it.
- It never presses Submit. You always do.
- It sends your answers nowhere except the ERP form you submit yourself. It has no server and no analytics.

Open source: https://github.com/adarshkmeher/feedback-autofill

## Graphic assets

| Field | File |
|---|---|
| Store icon, 128x128 | `icons/icon128.png` |
| Screenshots, 1280x800 | `store/out/screenshot-1-settings.png`, `screenshot-2-autofill.png`, `screenshot-3-code.png`, `screenshot-4-next-form.png` |
| Small promo tile, 440x280 | `store/out/promo-small-440x280.png` |
| Marquee promo tile, 1400x560 (optional) | `store/out/promo-marquee-1400x560.png` |

The screenshots are drawn illustrations with sample subject and teacher names. They contain no real student data and no ERP logo. The listing's screenshots caption says "illustration".

## Privacy practices tab

**Single purpose:**
Fill the IIT KGP ERP subject feedback form with the answers the user saved, so the user only types the security code and presses Submit.

**Permission justifications**

- `storage`: Saves the user's ratings, comments and settings in `chrome.storage.sync` so they persist and sync across the user's own Chrome profile.
- Host access to `https://erp.iitkgp.ac.in/Academic/studentFeedbackResponseView.htm*` (the content script match): The extension must read and fill the feedback form on this page. It runs on no other page.

**Remote code:** No. All code is in the package. The extension loads no remote scripts and uses no `eval`.

**Data usage disclosures:** Tick none of the data collection boxes. The extension collects no user data. Answers the user types stay in `chrome.storage.sync` and in the page's `sessionStorage` (drafts, cleared when the tab closes).

Tick all three certifications: no sale of data, no use unrelated to the single purpose, no use for creditworthiness or lending.

**Privacy policy URL:** needs a public URL. Use the GitHub Pages or public-repo link to `PRIVACY.md` (see below).

## Test instructions (for the reviewer)

The feedback form is behind an IIT Kharagpur student login, so a reviewer cannot reach it without a student account. Paste this into the "Test instructions" box:

> The extension only runs on erp.iitkgp.ac.in/Academic/studentFeedbackResponseView.htm, a page that needs an IIT Kharagpur student login. Without that login the extension does nothing except show its settings page (click the toolbar icon). The settings page saves answers to chrome.storage.sync. There are no other features, no remote calls and no accounts.

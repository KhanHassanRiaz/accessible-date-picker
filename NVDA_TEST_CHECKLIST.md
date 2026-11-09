# NVDA manual test checklist

This checklist covers checks that automated tests cannot prove. Run it in a normal Windows Chrome profile with NVDA. The automated Playwright suite proves that the controls and code paths exist; it does not prove what a screen reader says.

Record the Chrome version, NVDA version, Windows version, and the date of the test at the bottom.

## Setup

1. Install NVDA and start it.
2. Load the production `dist/` folder from `chrome://extensions` with Developer mode on.
3. Confirm the extension appears without errors.
4. In a terminal at the project root, run `npm run serve:fixtures`.
5. Open `http://127.0.0.1:4173/` in Chrome.
6. Confirm the fixture index page lists the test pages.

If the extension cannot be loaded, stop and record the Chrome error before continuing.

## Basic dialog

Use `/native.html` for this section.

- [ ] Focus the date field and press `Alt+Shift+D`.
- [ ] NVDA announces a dialog and a title containing the field label.
- [ ] NVDA announces the Day, Month, and Year controls in a useful order.
- [ ] Focus starts on the Day list.
- [ ] The dialog is described as modal or otherwise clearly separate from the page.
- [ ] Tab moves through Day, Month, Year, Apply, Cancel, and Copy diagnostic report without leaving the dialog.
- [ ] Shift+Tab moves backwards and also stays inside the dialog.
- [ ] Pressing `Escape` closes the dialog, announces "Cancelled.", and returns focus to the field.

Expected opening message: "Date picker for ... Day, month and year."

## Setting a date

Use `/native.html`.

- [ ] Choose 10 June 2026 with the three lists.
- [ ] Press `Enter` from a list or activate Apply.
- [ ] NVDA announces a success message that includes the exact value now in the field, for example "Date set: 2026-06-10."
- [ ] The field contains 2026-06-10.
- [ ] Focus returns to the field.
- [ ] Open the dialog again. The lists start on the value already in the field.

Use `/text-format.html` for a text field with a visible format.

- [ ] Set 10 June 2026 and apply.
- [ ] NVDA announces the exact text written to the field.
- [ ] The field value matches the spoken value.
- [ ] Repeat the same date on the same page. The learned format should be used without a refusal message.

## Day clamping

Use `/native.html` or `/month-year.html`.

- [ ] Open the dialog and choose 31 January.
- [ ] Change the month to February.
- [ ] NVDA announces that the day changed, including the month, year, and number of days.
- [ ] The Day list shows 28 or 29, not 31.
- [ ] Apply and confirm the spoken result matches the field.

Expected pattern: "February 2026, 28 days, day changed to 28."

## Refusing an ambiguous date

Use `/ambiguous.html`.

- [ ] Open the dialog and try to apply a date.
- [ ] NVDA announces "I could not find the date format for this field, so I did not enter a date."
- [ ] The field is unchanged.
- [ ] The dialog remains open and usable.

This refusal is required behavior. A guessed date would be a failure, even if the guess happened to be right.

## Focus isolation

Use `/two-fields.html`.

- [ ] Focus the first date field and set a date.
- [ ] Only the first field changes.
- [ ] Focus the second date field and set a different date.
- [ ] Only the second field changes.
- [ ] Focus a non-field element and press the shortcut.
- [ ] NVDA announces "Focus is not on an input field." and no dialog opens.

## Calendar driver

Use `/custom.html`.

- [ ] Open the dialog from the date field and apply 10 June 2026.
- [ ] NVDA announces the actual field value after the calendar is driven.
- [ ] The custom calendar shows June 2026 and the correct day selected.
- [ ] Repeat with `/jquery-ui.html` and confirm the page status text updates to the chosen date.

## Month and year calendars

Use `/month-year.html`.

- [ ] Open the dialog and apply June 2026.
- [ ] NVDA announces a month-only result and says the calendar only allows month and year.
- [ ] The field shows the month and year expected by the page.

## Read-only and disabled fields

Use `/readonly.html`.

- [ ] Set a date in the read-only text field.
- [ ] NVDA announces the real value.
- [ ] The field remains read-only afterwards.

Use `/minmax.html`.

- [ ] Try a date outside the declared minimum or maximum.
- [ ] NVDA announces that the site does not allow that date.
- [ ] The field is unchanged.

## Frames and shadow DOM

Use `/iframe.html` and `/shadow.html`.

- [ ] Set a date inside the same-origin iframe.
- [ ] NVDA announces the result and the iframe field changes.
- [ ] Set a date inside the open shadow root.
- [ ] NVDA announces the result and the shadow field changes.
- [ ] Focus does not jump to the page behind the dialog while it is open.

The cross-origin fixture is covered by automated tests with test-only host permission. In a production install, record whether it works and note that Chrome may block cross-origin frames when no host permission exists.

## Library adapters

Use these pages with the calendar deliberately blocked by the fixture:

- `/jquery-ui-blocked.html`
- `/flatpickr-blocked.html`
- `/pikaday-blocked.html`
- `/bootstrap.html` with the popup hidden by the test stylesheet if needed.

For each page:

- [ ] Set 10 June 2026.
- [ ] NVDA announces the actual value written by the library.
- [ ] The value matches the page's format.
- [ ] No dialog remains after success.

Record any page where the driver works instead of the adapter. A correct date from the visible calendar is still a pass for the user, but note which layer ran in the diagnostic report.

## Diagnostics

- [ ] Open the dialog and activate Copy diagnostic report.
- [ ] NVDA announces "Report copied."
- [ ] Paste the clipboard into a plain text editor.
- [ ] The report contains the field HTML, nearby elements, detected libraries, steps, and result.
- [ ] The report does not contain script contents.
- [ ] The report does not contain the temporary `data-adp-target` attribute.

## Options page

Open the extension options.

- [ ] NVDA reads the headings and the purpose of each section.
- [ ] The shortcut button opens `chrome://extensions/shortcuts`.
- [ ] Change the earliest year and future years, save, and hear "Year range saved."
- [ ] Enter an invalid range and hear the validation message.
- [ ] Activate Forget learned formats and hear "Learned formats forgotten."
- [ ] Close and reopen the options page. Saved years are still present.

## Display modes

- [ ] Switch Windows to a dark theme and confirm the dialog text and controls remain readable.
- [ ] Turn on high contrast or forced colors and confirm the dialog border, text, buttons, and focus outline remain distinguishable.
- [ ] Turn on reduced motion in Windows and confirm the dialog does not animate.
- [ ] Zoom Chrome to 200 percent and confirm all three lists and buttons remain reachable.

## Restricted pages

- [ ] Open `chrome://extensions` and press the shortcut.
- [ ] The extension shows an `ERR` badge and does not inject a dialog.
- [ ] Open a normal page and confirm the badge clears after a successful start.

## Speech-only check

- [ ] Turn the monitor off, or use NVDA's speech viewer only, and complete one full date change.
- [ ] Confirm every step is understandable from speech alone: opening, choosing a date, success, and cancellation.
- [ ] Confirm no meaning depends on color or layout.

## Sign-off

Record any failure with the fixture page, the exact spoken text, the expected text, and the field value.

- Date:
- Windows version:
- Chrome version:
- NVDA version:
- Extension version:
- Tester:
- Result: pass / pass with notes / fail
- Notes:

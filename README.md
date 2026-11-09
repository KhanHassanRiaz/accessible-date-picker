# Accessible Date Picker

Accessible Date Picker is a Chrome extension that lets you set a date on websites whose own calendars are hard or impossible to use with a keyboard and a screen reader. Focus a date field, press a shortcut, choose a day, month, and year in a plain dialog, and the extension writes the date back into the page.

The extension works with the keyboard alone. It verifies what the page actually contains after every write and announces the real field value. It never guesses between an ambiguous day and month. It makes no network requests and stores no dates.

## Install

The repository includes a prebuilt, loadable extension in `dist/`.

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Choose **Load unpacked** and select the `dist` directory.
4. Optionally pin the Accessible Date Picker button to the toolbar.

To build the zip package instead, run `npm install` and then `npm run package`. The package command always builds the production extension first, then writes `accessible-date-picker-1.0.0.zip` in the project root. Unzip it and load the unzipped directory as an unpacked extension.

Chrome 102 or newer is required.

## Use

1. Put keyboard focus in a date field. Focus may also be on a calendar button that controls a nearby date field.
2. Press `Alt+Shift+D`, or click the Accessible Date Picker toolbar button.
3. The dialog opens with Day, Month, and Year lists. The day list is focused first.
4. Choose the date. The day list adjusts when a month or year has fewer days.
5. Press `Enter` or choose **Apply**.

The extension announces the result. For example, it says "Date set: 10/06/2026." and includes the exact text now in the field. If the site rejects or rewrites the value, the extension reports the failure instead of claiming success.

Press `Escape` or choose **Cancel** to close the dialog without changing the field. Focus returns to the field or calendar button that had it before.

The dialog keeps `Tab` and `Shift+Tab` inside its own controls. Result messages are announced and kept available for about ten seconds.

To change the shortcut, open the extension options and choose **Open Chrome keyboard shortcuts**, or visit `chrome://extensions/shortcuts`. Chrome controls shortcut assignment.

### Diagnostic report

The dialog has a **Copy diagnostic report** button. It copies a plain-text report containing sanitized HTML for the field and nearby elements, any visible calendar, detected libraries, the steps the extension tried, and the final result. This helps when a site refuses a date. The report is only copied when you ask for it. It is not sent anywhere.

## How dates are set

The extension tries four layers in order and stops at the first one that verifies correctly.

1. **Native input.** If the field is an `input type="date"` or `input type="month"`, the extension sets its value directly.
2. **Site calendar driver.** It looks for an open or openable calendar near the field, reads the visible month and year, changes the controls, clicks the correct day, and checks the field afterwards. The driver has a ten-second and forty-step budget so it cannot loop forever.
3. **Library adapter.** It detects jQuery UI datepicker, bootstrap-datepicker, flatpickr, and Pikaday, then calls the library's public API in the page's main world. A temporary `data-adp-target` attribute identifies the field without exposing any value.
4. **Direct write.** If a format is proven by the current value, placeholder, a format attribute, accessible text, the library configuration, or another date field on the page, the extension writes a formatted value and dispatches the usual input and change events.

After every layer, the extension reads the field again. If the value does not match the requested date, it tries the next layer. The final check happens after focus returns to the field, so a late site script cannot silently replace the date.

### When the format is ambiguous

A value such as `03/04/2026` does not say whether the third of April or the fourth of March is meant. Unless a placeholder, attribute, library setting, learned format, or another field proves the order, the extension refuses to write. It announces "I could not find the date format for this field, so I did not enter a date." and leaves the field unchanged.

Two-digit years use the common rule: 00 through 68 mean 2000 through 2068, and 69 through 99 mean 1969 through 1999.

### Learned formats

After a verified successful write, the extension may remember the date pattern for that origin and field. It stores only the pattern and the time it was learned. It never stores the date or the field value. Up to 500 patterns are kept, and a pattern may be at most 40 characters.

A field key is built from the field's name, id, label, placeholder, or accessible label, in that order. Two fields with the same key on the same origin share a learned pattern. Use **Forget learned formats** in the options page to remove all of them.

## What is supported

- `input` elements of type `text`, `search`, `date`, and `month`.
- Open shadow roots.
- Same-origin iframes. Cross-origin iframes work only when Chrome grants access to those frame origins. The production manifest requests no host permissions, so some cross-origin frames may be skipped; the test build grants access to its local fixture origins so this path can be tested.
- Read-only text fields. The extension removes `readonly` only for the write and restores it afterwards.
- Sites that reject values, move focus, or reformat the field. The extension reports what actually happened.

## What is not supported

- Closed shadow roots. Page scripts inside them cannot be reached from the extension.
- Calendars drawn only on a canvas or image, with no readable DOM controls.
- Custom widgets that expose no input field, buttons, grid cells, or useful attributes.
- Non-input fields such as `textarea` or `contenteditable` elements.
- Dates that remain ambiguous after all format clues are checked.
- Month names other than English. The dialog and parser currently use English month names.
- Chrome internal pages, the Chrome Web Store, and the built-in PDF viewer. The extension shows an `ERR` badge because Chrome does not allow content scripts there.
- Sites whose scripts require fully trusted user events for every change. The extension dispatches standard DOM events, but a site may still ignore them.
- File URLs unless **Allow access to file URLs** is enabled for the extension on `chrome://extensions`.

`min` and `max` attributes are read when they can be parsed. Otherwise the dialog uses the configured year range. The year list is built from the earliest year to the current year plus the configured future years. A site that declares an extremely wide range can create a long year list.

## Options

The options page provides:

- A button that opens Chrome's keyboard shortcut page.
- **Earliest year**, from 1900 to 2100.
- **Number of future years**, from 0 to 200.
- **Forget learned formats**.

Defaults are 1900 and 30 future years.

## Privacy and permissions

The extension makes no network requests, loads no remote code, uses no analytics, and has no telemetry. All code is bundled locally.

Permissions:

- `activeTab`: temporary access to the page where you invoked the extension.
- `scripting`: injects the content script on demand and runs the library adapter in the page's main world.
- `storage`: local settings and learned format patterns only.

No date value is written to extension storage. The diagnostic report is copied to the clipboard only when you press its button.

The production manifest has no host permissions. The test build adds `http://127.0.0.1/*` and `http://localhost/*` so end-to-end tests can start the flow without a real keyboard shortcut. Those permissions are not present in the production build.

## Development

Requirements: Node.js 20 or newer and npm.

```sh
npm install
npm run build
npm run lint
npm run test:unit
npm run test:e2e
npm run package
```

On Windows PowerShell, use `npm.cmd` and `npx.cmd` if script execution policy blocks the `.ps1` wrappers.

`npm run build` writes the production extension to `dist/`. `npm run test:e2e` first writes a test build to the same directory, so run `npm run build` again before loading or packaging the production extension.

Other useful commands:

- `npm run clean` removes generated output.
- `npm run icons` regenerates the PNG icons.
- `npm run serve:fixtures` serves the local test fixtures at `http://127.0.0.1:4173/`.
- `npm run format` and `npm run format:check` run Prettier.

Unit tests use Vitest with jsdom. End-to-end tests use Playwright with a persistent Chromium profile and the built extension. The tests use local fixtures under `tests/fixtures/public`; they do not contact real websites.

Playwright's Chromium build must be installed separately. If `npm run test:e2e` reports a missing executable, run `npx playwright install chromium`.

## Project layout

- `manifest.json`: Chrome extension manifest.
- `src/background/`: service worker, command handling, injection, library bridge.
- `src/bridge/`: the function that runs in the page's main world.
- `src/content/`: dialog, calendar driver, layers, focus detection, announcements, diagnostics.
- `src/options/`: the options page.
- `src/shared/`: dates, formats, verification, messages, storage.
- `tests/unit/`: Vitest tests.
- `tests/e2e/`: Playwright tests and local fixtures.
- `scripts/`: build, icon, clean, and package scripts.
- `dist/`: the prebuilt production extension.

## Accessibility notes

The dialog is rendered in an open shadow root on the page's document element. It uses `role="dialog"`, `aria-modal="true"`, an accessible title, native `select` controls, visible focus outlines, and a focus trap. It supports dark mode, forced-colors mode, and reduced motion. Announcements use separate polite and assertive live regions.

These features are designed for speech-first use, but automated tests cannot prove how a real screen reader will speak them. See `NVDA_TEST_CHECKLIST.md` for the manual checks that still need to be done.

## Testing status

Automated tests cover: native date and month inputs, dialog structure and keyboard trapping, day clamping, min and max bounds, the custom calendar driver, direct writing, ambiguous format refusal, focus isolation, month and year calendars, React, unresponsive calendars, read-only fields, open shadow roots, same-origin iframes, cross-origin iframes with the test build's fixture host permission, diagnostics, the options page, jQuery UI, bootstrap-datepicker, flatpickr, and Pikaday. The dialog is also checked with axe.

Not covered automatically: real NVDA speech output, real commercial websites, every browser and operating system combination, and Chrome Web Store installation.

## License

MIT. See `LICENSE`.

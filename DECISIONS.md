# Decisions

This file records the main design choices for Accessible Date Picker and why they were made. Each entry states the decision and its consequence.

## 1. Manifest V3 with on-demand injection

The extension uses Manifest V3 with `activeTab`, `scripting`, and `storage`. It does not declare a permanent content script and does not request host permissions in production.

When the shortcut or toolbar button fires, the service worker injects `content.js` into all frames of the active tab, then sends `adp:start`. The frame that owns the focused element handles the message. The parent document ignores it when the active element is a child iframe.

Consequences: the extension cannot run until the user invokes it, which matches the permission model and keeps the extension out of pages the user never uses it on. Cross-origin subframes are only reachable when Chrome grants access to those origins; with `activeTab` alone, some cross-origin frames are skipped. This limit is documented in the README.

## 2. Four layers with verification after each

The flow is native input, site calendar driver, known library adapter, then direct write. Each layer reports a value and a verification result. A layer that does not verify falls through to the next one. A final verification runs after focus returns to the field.

Consequences: the extension cannot claim success from an optimistic write. It pays an extra read and delay, and a site that reformats the value after a short delay can still defeat it, but that late change is reported as a failure rather than hidden.

## 3. Never guess an ambiguous date format

If the day and month order is not proven, the direct-write layer refuses and announces `formatUnknown`. Format evidence comes from the learned format, current value, placeholder, format attributes, accessible text, library configuration, or another date field. A value such as `03/04/2026` with no other clue is ambiguous and is refused.

Consequences: some sites that could have been handled by guessing remain unsupported. This is deliberate: entering a wrong date silently is worse than refusing.

## 4. Announce the value the page actually contains

Success messages include the final field text. The flow reads the field again after closing the dialog and returning focus. If the value no longer matches the target, the extension announces the site-rejected message.

Consequences: the spoken result reflects the page, not the requested date. Users can notice when a site rewrites or ignores the value.

## 5. Learn only formats, never dates

On verified success, the extension derives a date pattern and stores it under a key made from the origin and a field key. Only the pattern and `learnedAt` timestamp are stored. The format store is capped at 500 entries and patterns are limited to 40 characters. The key uses the first non-empty value from name, id, label, placeholder, and accessible label.

Consequences: repeat visits can skip format detection. Two fields with the same key on the same origin share a pattern. The options page can remove all learned patterns.

## 6. Dialog in an open shadow root

The dialog is a host element appended to `document.documentElement`, with an open shadow root. It uses `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, native selects, and a capture-phase key handler. Tab and Shift+Tab are trapped inside the dialog.

An open shadow root was chosen so automated tests can reach the controls with standard locators. It does not expose any private value. Closed shadow roots in the page are still unreachable and are reported as unsupported.

## 7. Temporary target token for the main-world adapter

The library adapter must run in the page's main world to reach library instances. The content script adds a random `data-adp-target` attribute to the focused field, asks the background worker to run the adapter in the sender's frame, and removes the attribute afterwards.

The adapter receives only the token and the date parts. No field value is sent to the background, and the token is removed in a `finally` path. The adapter searches open shadow roots for the token.

## 8. Library adapter details

- **jQuery UI:** Uses the public plugin call `wrapped.datepicker("setDate", date)` and then `jq.datepicker._selectDate(element)` so the site's `onSelect` handler runs. Reading `.data("datepicker")` alone does not provide a reliable `setDate`.
- **bootstrap-datepicker:** Calls the instance's `setDate` or `update` method.
- **flatpickr:** Calls `setDate(date, true)` and reads the configured `dateFormat`.
- **Pikaday:** Calls `setDate(date, true)`. If the site supplies its own `toString` formatter, it is preserved. If not, the adapter temporarily installs a formatter that respects the configured pattern, then restores or deletes it.

The temporary Pikaday formatter exists because Pikaday without Moment ignores its `format` option when writing the field and falls back to `Date.toDateString()`. The adapter does not leave the injected function behind.

## 9. Library format token conversion

Library format strings are converted to the extension's own pattern language. Flatpickr tokens need special care: `d` and `m` are padded, while `j` and `n` are not padded. `y` is a two-digit year and `Y` is a four-digit year. Earlier assumptions that treated `d` and `m` as unpadded were wrong and were corrected.

Padded tokens in the extension parser accept one or two digits. This is forgiving of sites that say `DD/MM/YYYY` but display `1/2/2026`.

Commas are accepted as date separators alongside slash, dot, hyphen, and space, because sites commonly use forms such as `June 10, 2026`.

## 10. Focused field resolution

Focus is read through open shadow roots. A text-like input is used directly. If focus is on a button, link, or element with a button role, the extension may use an input named by `aria-controls`, an input in the same small container, or a nearby sibling input.

The search stops before `body` and `documentElement`, so an unrelated input elsewhere on the page is never chosen. Only `text`, `search`, `date`, and `month` inputs qualify. `textarea` and `contenteditable` elements are not treated as date fields.

Consequences: calendar icon buttons work without touching an unrelated field. Focus on a page heading or background does not start the dialog.

## 11. Calendar driver limits

The driver has a ten-second budget, a forty-step limit, and an eighty-iteration loop guard. It uses visibility checks, reads calendar headers and cell metadata, supports day, month, year, and decade views, and stops with a `stuck` message when the calendar does not respond.

Consequences: an unresponsive widget cannot hang the page. Some very large or unusual calendars stop early rather than risking a long interaction.

## 12. Discovery and safety rules

Page text and attributes are treated as untrusted data. The driver only clicks elements that are visible, connected, close to the field, and not part of the extension UI. It validates that a day is inside the displayed month before clicking. It rejects disabled controls.

The diagnostic report removes `script` elements, strips `value` attributes from non-target inputs, removes the temporary target token, and truncates long HTML. It includes the focused field's value because that is what the user asked to diagnose.

## 13. Storage and configuration

Storage keys are `adp:config` and `adp:formats`. Config is clamped on read and write: earliest year 1900 to 2100, future years 0 to 200. Corrupt or missing records fall back to defaults. Learned formats are sanitized and pruned to the 500 most recent entries.

Consequences: a damaged storage record cannot crash the extension. The year controls stay within a practical range even if storage is edited by hand.

## 14. Test-only build changes

`scripts/build.mjs` adds host permissions for `http://127.0.0.1/*` and `http://localhost/*` only when `--test` is passed. The test build also exposes `__adpTestStartTab` and `__adpTestStartActive` on the service worker so Playwright can start the flow without sending a real Chrome command.

The production build does not include the host permissions or the test globals. The test hook exists because `chrome.commands` cannot be triggered from Playwright.

## 15. Pikaday fixture

The Pikaday fixture used to create a picker with `bound: false`, which leaves the calendar visible. The site-calendar driver could click it and succeed, so the test never exercised the Pikaday adapter. The fixture now hides the calendar with CSS and supplies an explicit `toString` formatter. That makes the library adapter the only working path and keeps the field in the site's `DD/MM/YYYY` format.

## 16. Prettier ignores build output

Prettier skips `dist/`, `release/`, test output, and zip files. Generated bundles are not hand-formatted. Source, tests, scripts, and documentation are checked.

## 17. Prebuilt output is committed

`dist/` is committed as the loadable production extension so the project can be reviewed without a build step. `npm run build:test` and `npm run test:e2e` overwrite `dist/` with a test build; always run `npm run build` before packaging or publishing the production extension.

## 18. Plain-language documentation

Documentation uses real headings, short paragraphs, and direct statements. It avoids ASCII art and emoji. It separates automated coverage from manual screen-reader checks so no unverified accessibility claim is presented as tested.

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

The driver has a twenty-second budget, a forty-step limit, and an eighty-iteration loop guard. It uses visibility checks, reads calendar headers and cell metadata, supports day, month, year, and decade views, and stops with a `stuck` message when the calendar does not respond.

The budget is larger than the first ten-second version because many widgets animate view changes for roughly a quarter of a second and ignore input while they animate. The driver now waits for the page to stop changing before it reads or clicks again.

Consequences: an unresponsive widget cannot hang the page, but a slow calendar can hold the tab for up to twenty seconds. Some very large or unusual calendars stop early rather than risking a long interaction.

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

`dist/` is committed as the loadable production extension so the project can be reviewed without a build step. `npm run build:test` and `npm run test:e2e` overwrite `dist/` with a test build. `npm run package` always rebuilds the production extension before writing the zip, so a test manifest cannot be packaged by accident.

## 18. Plain-language documentation

Documentation uses real headings, short paragraphs, and direct statements. It avoids ASCII art and emoji. It separates automated coverage from manual screen-reader checks so no unverified accessibility claim is presented as tested.

## 19. Enter applies from the selects

The dialog applies on Enter while focus is on the Day, Month, or Year select, matching the help text and the expectation that Enter activates the dialog. Modified presses such as Alt+Enter are ignored. On Windows Chrome, Enter does not open a closed select list, and key presses inside an open list belong to the native popup, so this does not conflict with choosing a value.

The behavior is covered by an end-to-end test. It is still worth checking with NVDA during the manual pass.

## 20. ASP.NET AJAX CalendarExtender support

CalendarExtender is handled by the site-calendar driver, not by a library adapter. Its popup keeps the day, month, and year views in the DOM at the same time and slides the inactive views below a body with `overflow: hidden`. A plain visibility check therefore sees several views at once.

The calendar analysis now uses clipping-aware visibility. An element counts as hidden when it lies completely outside the box of a clipping ancestor. Inactive views are ignored, and the active day, month, or year grid is the only one read.

The driver also requires a recognized view kind. It refuses a candidate whose analysis produces no day, month, year, or decade grid, so a container that does not present date cells is not accepted.

Consequences: this pattern is supported without special-casing the library name. Other widgets that stack views in a clipped container are handled by the same rule.

## 21. Candidate discovery rejects broad containers

A page, form, or layout region can contain a nested day table without being a calendar. The candidate search rejects elements that match `form`, `main`, `nav`, `header`, `footer`, `article`, or `section` unless they carry an explicit calendar hint such as a calendar class, `role="grid"`, `role="dialog"`, `data-datepicker`, or `data-calendar`.

Unhinted candidates are also rejected when they contain the target field, hold more than twelve form controls, or contain more than twelve thousand characters of text. Explicitly hinted containers are exempt because a real calendar may deliberately be large.

The diagnostic report prefers the calendar element returned by the driver when it is still connected. A failed run therefore shows the popup that was actually opened instead of the whole surrounding form.

Consequences: the Bank of Punjab report showed the entire `aspnetForm` as the open calendar because the form was selected as a candidate. That selection is now blocked, and the same rule protects future diagnostics.

## 22. Header zoom and closing the right calendar

When the visible year is far from the target, the driver first tries the calendar header. Many calendars switch from a month grid to a year or decade grid, which reaches a distant year in a few page steps instead of one year at a time. One-year navigation remains as a fallback.

Closing is restricted to the calendar element the driver actually opened. Escape is pressed once, then an outside click is used only if that same element is still visible and still recognized. Unrelated calendars on the page are not touched.

Consequences: a date many years away can be reached within the current time budget, and a failed attempt cannot close a different widget on the same page.

## 23. Equal day and month numbers are not ambiguous

A numeric value such as `2/2/2026` has two possible readings, day-first and month-first, but both produce the same date. The parser now marks only values whose two readings differ as ambiguous. This keeps refusal for values such as `03/04/2026` while allowing a site that writes the same number twice to verify successfully.

Consequences: the readonly Bank of Punjab field can be verified after the calendar writes `2/2/2001` even when no format clue exists. The success message still shows the exact text the page contains.

## 24. Wait for calendar animations before reading or clicking

Calendar widgets often animate a view change and ignore input while the animation runs. The ASP.NET AJAX CalendarExtender is one example: it moves the day, month, and year views for about 250 milliseconds and discards clicks until the movement ends. The driver previously read the calendar and clicked the next control during that window. The result was an ignored click, a half-moved view, or a `null` reading that looked like a closed popup.

After every click, focus, and select change, the driver now waits for DOM mutations to become quiet. It also waits for any running element animations to finish and requires two matching view readings before it acts on a view signature. A separate re-read confirms that the view is stable.

The local CalendarExtender fixture now animates its view changes and ignores clicks while animating, so the end-to-end test reproduces the real behaviour instead of testing a static popup.

Consequences: each calendar action can take a little longer, which is why the time budget is twenty seconds. The driver no longer treats a mid-animation empty reading as a successful close, and it no longer loses clicks that the page ignored.

## 25. Compact diagnostics and clearing collected steps

The diagnostic report used to list every driver action twice: once in the flow log and once in the driver log. It now records one summary line for the calendar driver, with its status, mode, step count, elapsed time, last step, and detail. The Steps section contains the flow, layer, verification, and driver summary lines only.

The collected steps are cleared after every copy. They are also cleared when the dialog is dismissed with Escape, when a failed flow returns focus to the field, and when a successful flow closes the dialog. The final result line is kept so a second copy in the same dialog still reports the outcome. The report still includes sanitized field, ancestor, and calendar HTML because that evidence is what makes a broken widget diagnosable.

Consequences: reports are much shorter and are not carried forward from an earlier action. A second copy immediately after the first shows `None` under Steps, which is intentional and is covered by an end-to-end test.

## 26. Distribution is a zip, with the Chrome Web Store for public install

The build produces a normal Manifest V3 directory. `npm run package` always rebuilds the production extension and zips the contents of `dist/` with `manifest.json` at the zip root. That zip is both the file a person can unzip for **Load unpacked** and the file the Chrome Web Store expects for an upload.

No `.crx` file is produced. Chrome restricts installation of `.crx` files that do not come from the Web Store, so a self-hosted CRX is not a reliable sharing path.

Consequences: sharing with a few people means sending the zip and asking them to enable Developer mode. Sharing with the public means a Web Store listing, which also provides installation and updates without Developer mode. Unpacked copies do not update automatically.

## 27. Zebra DatePicker support and dependent fields

The Punjab Jobs profile form uses Zebra DatePicker on its date of birth field and calculates the age field only inside the widget's `onClose` callback. A plain value write left the age empty.

Two changes handle this. First, the calendar driver now recognizes Zebra's `.dp_caption` header and its `dp_previous` and `dp_next` controls, so clicking the header opens the year grid and a distant year is reached in a few steps instead of walking month by month. Without that recognition the driver exhausted its budget and never triggered the widget's close handler.

Second, a Zebra adapter uses the widget's public `set_date` method with the site's own format pattern. It then dispatches `input` and `change`, calls `show()`, and calls `hide()`. Zebra runs the site's `onChange` while rendering and its `onClose` when the calendar hides, so the site's own dependent-field logic runs. The adapter is a fallback for the case where the calendar cannot be shown or driven.

Zebra format tokens differ from the extension's pattern language, so they are converted separately: `d` is a padded day, `j` is an unpadded day, `m` and `n` are padded and unpadded month, `M` and `F` are short and long month names, and `y` and `Y` are two-digit and four-digit years.

Consequences: the profile form updates both the date and the age from the extension dialog. The test fixture vendors the Zebra script served by the real site and checks the age field on both the driver path and the blocked-popup adapter path. This is proven locally against that vendored script, not yet against the live site.

## 28. The project is published on GitHub with a release zip

The public home of the project is `github.com/KhanHassanRiaz/accessible-date-picker`. The repository contains the full source, tests, fixtures, documentation, and the prebuilt `dist/` directory. The versioned zip built by `npm run package` is not committed: it is attached to a GitHub release under the matching `v` tag, which is the file people download to load the extension unpacked.

`dist/` stays in the repository even though it is generated, because cloning the repo and choosing **Load unpacked** on `dist/` is the shortest keyboard path for a person who already knows git. The zip in the release serves people who do not. `.gitignore` excludes `node_modules`, test output, and `*.zip` so the release zip can never be committed by accident.

The README is written for that public repository: installation first from a release zip, then from the repository, then from source. The earlier local "Share or publish" store instructions were folded into the install section and the development release checklist.

Consequences: publishing a new version means raising the version in `manifest.json` and `package.json`, running `npm run package`, committing, tagging, and attaching the fresh zip to the release. Every zip must come from a fresh production build so a test-build manifest with local host permissions can never be shipped to users.

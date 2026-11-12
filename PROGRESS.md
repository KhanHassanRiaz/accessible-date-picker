# Progress

Last updated: 2026-11-10

## Status

The extension is feature-complete for the planned scope. A prebuilt production extension is in `dist/`, and the test suite passes locally.

- TypeScript check: pass (`npx tsc --noEmit`).
- ESLint: pass (`npm run lint`).
- Unit tests: 114 passing in 8 files (`npm run test:unit`).
- End-to-end tests: 28 passing (`npm run test:e2e`).
- Prettier check: pass for source, tests, scripts, and documentation (`npm run format:check`).
- Manual NVDA testing: not yet done. See `NVDA_TEST_CHECKLIST.md`.

The end-to-end run uses Playwright headless Chromium, the test build of the extension, and local fixtures. It does not prove how NVDA, JAWS, or VoiceOver will speak the dialog, and it does not prove behavior on real third-party sites. The ASP.NET AJAX fix is proven against a local CalendarExtender-style fixture, not against the Bank of Punjab form itself.

## Completed phases

### Phase 1: Project scaffold and tooling

- Manifest V3 manifest, TypeScript strict configuration, esbuild build, Vitest, Playwright, ESLint, Prettier.
- Icon generation with pngjs.
- Clean and package scripts.
- MIT license and project rules.

### Phase 2: Date and format core

- Civil date helpers, ISO parsing, day clamping, leap years, two-digit year resolution.
- Format detection, parsing, writing, library token conversion, learned-format derivation.
- Ambiguity detection that refuses unproven day and month order.
- Field verification after writes.

### Phase 3: Dialog and announcements

- Shadow-root dialog with Day, Month, and Year selects.
- Apply, Cancel, and Copy diagnostic report controls.
- Focus trap, Enter (including from the selects), Escape, busy state, and focus return.
- Day list clamping with a spoken notice.
- Polite and assertive live regions with ten-second cleanup.
- Dark mode, forced colors, and reduced motion styles.

### Phase 4: Background, content flow, and layers

- On-demand injection into all frames.
- Restricted-page detection and `ERR` badge.
- Native input layer.
- Site calendar driver with day, month, year, and decade views.
- Main-world library adapter for jQuery UI, bootstrap-datepicker, flatpickr, and Pikaday.
- Direct write with format detection and refusal.
- Learned-format storage keyed by origin and field key.

### Phase 5: Options and diagnostics

- Options page for shortcut page, earliest year, future years, and forgetting formats.
- Sanitized diagnostic report copied to the clipboard.
- Keyboard and screen-reader text for all outcomes.

### Phase 6: Tests and fixtures

- 114 unit tests across dates, formats, verification, storage, field detection, labels, calendar analysis, clipped CalendarExtender views, candidate rejection, and the main-world adapter.
- 28 end-to-end tests covering native inputs, dialog behavior, Enter to apply from a select, the calendar driver, an ASP.NET AJAX CalendarExtender-style popup with a distant year and a disabled day, direct write, ambiguity refusal, focus isolation, month and year calendars, React, unresponsive calendars, read-only fields, open shadow roots, same-origin and cross-origin iframes, diagnostics, options, and all four library adapters.
- axe accessibility check on the dialog.

### Phase 7: Documentation and packaging

- `README.md`, `DECISIONS.md`, this file, and `NVDA_TEST_CHECKLIST.md`.
- Production build and zip packaging.

## Fixes made during verification

- Added the missing Playwright Chromium build.
- Corrected flatpickr token semantics: `d` and `m` are padded, `j` and `n` are not.
- Changed the flatpickr fixture to a format that proves library formatting.
- Reworked the jQuery UI adapter to use the plugin API and run the site's `onSelect` handler.
- Added a temporary Pikaday formatter because Pikaday without Moment ignores its `format` option.
- Changed the Pikaday fixture to hide its calendar and supply its own formatter, so the adapter path is actually exercised.
- Stopped focused-field resolution from climbing to the page body and choosing an unrelated input.
- Allowed commas as date separators.
- Fixed the test build's host permissions so the test hook can start the flow on local fixtures.
- Added a Prettier ignore file so generated bundles do not fail formatting checks.
- Fixed the ASP.NET AJAX CalendarExtender path: inactive views that sit below a clipped body are ignored, unhinted forms and oversized layout containers are no longer selected as calendars, the month header opens a year grid for distant years, and closing only touches the calendar the driver opened.
- Treated equal day and month numbers such as `2/2/2026` as unambiguous, because both day-first and month-first readings give the same date. Other ambiguous numeric values are still refused.
- Added a local CalendarExtender-style fixture with a readonly field, image trigger, stacked clipped views, out-of-range days, and a distant-year end-to-end test.

## Remaining work

- Re-test the extension on the real Bank of Punjab form after loading the new production build.
- Run the manual NVDA checklist on Windows with Chrome.
- Try the extension on real websites with jQuery UI, bootstrap-datepicker, flatpickr, and Pikaday calendars.
- Try high-contrast and forced-colors display modes manually.
- Confirm shortcut assignment and conflicts in a normal Chrome profile.
- Rebuild the production extension and zip after any further source change.

## Known limits

- Closed shadow roots are not reachable.
- Canvas-only or image-only calendars are not supported.
- Some cross-origin iframes are skipped because the production extension has no host permissions.
- Ambiguous numeric dates are refused.
- Month names are English only.
- A site can still reject or rewrite a value; the extension reports the real result.
- The calendar driver stops after ten seconds or forty steps.
- Automated tests do not prove screen-reader speech quality.

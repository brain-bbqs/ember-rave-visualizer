---
name: visual-snapshots
description: How the Chromatic snapshots (Storybook and Playwright) stay deterministic, and how `?test` live injections drive the page into a state worth capturing. Use when adding or changing a story, a chromatic test, a viewport, or a `?test` param; when a Chromatic run reports a diff with no code change to explain it; or when a Playwright spec is about to stub the network with page.route.
---

# Visual snapshots and live test injections

Lessons earned across the sibling apps (bbqs-uploader, encoding-helper and clip-extractor) while chasing Chromatic diffs that no code change explained.
**They are already implemented** in `tests/chromatic/`, `@brain-bbqs/test-utils/playwright` (`VIEWPORTS`, `forEachViewport`, `expectNoHorizontalOverflow`), `@brain-bbqs/config` (`resolveAppVersion`, `createPlaywrightConfig`), `src/lib/testInjection.ts` and the two Chromatic workflows; the rest of this skill explains what those pieces are doing on your behalf, so that you can tell when you are about to step outside them.

## One test per viewport, with the viewport in the title

Chromatic keys a Playwright archive by the test's title alone.
Run the same test under several Playwright projects and each viewport writes over the last one's manifest, so only the project that ran last reaches Chromatic at all.
So `createPlaywrightConfig` in `@brain-bbqs/config` gives both Playwright configs one Desktop Chrome project, and `tests/chromatic/app.chromatic.test.ts` registers each state through `forEachViewport` from `@brain-bbqs/test-utils/playwright`, which sets each of its `VIEWPORTS` inside the test and names it in the title (`Main page - default [mobile portrait]`).
Add a new page state as another `forEachViewport` call, never as a new project.

## Fail on sideways overflow by name, not by pixel

A narrow viewport's first failure is a row of controls that cannot wrap and runs off the screen.
`expectNoHorizontalOverflow(page)` names the elements that reach past the right edge, which is far easier to act on than a pixel diff in a snapshot.
Call it at the end of every chromatic test.
The fix is usually a `@media (max-width: 600px)` rule that lets the row wrap or stack (the header already does this).

## Pin everything that changes on its own

- **The version string.** The footer shows `package.json`'s version, which bumps on every PR.
  `CHROMATIC_STATIC_VERSION` (set in both Chromatic workflows) makes `resolveAppVersion` inject `0.0.0` instead, so a bump alone never re-snapshots a page.
- **The runner.** Both workflows pin `ubuntu-24.04` rather than `ubuntu-latest`, and print the image version: a runner image bump brings new fonts and rasterizer libraries, which move text pixels with no code change behind them.
  When a diff appears with nothing in the code to explain it, compare the printed image against the baseline run's.
- **The theme.** Storybook's preview pins `data-theme` through a toolbar global and a decorator, and component stories set it explicitly with `withTheme(...)`, so a snapshot never depends on the runner's OS color-scheme preference.
- **Media fixtures.** A fixture re-encoded on every run (encoding-helper builds its demo video with ffmpeg) changes pixels when the encoder's point release does.
  Pin the encoder version in the workflow and print the fixture's hash, so a diff can be traced to it.
  Committing a small fixture is simpler when its license allows.

## Merge main before reading a diff

Chromatic diffs a branch against that branch's own last build.
A branch that has not seen `main` in a week diffs against a week-old UI and reports `main`'s changes as its own.
Both workflows print how far behind `main` the branch is; if it is behind, merge `main` in and read the next run.

## `?test` injections: an honest fake reaches the real rendering

A Chromatic snapshot has to reach a state deterministically, and a person testing the deployed site wants to reach the same state without setting anything up.
Both use the `?test&...` scheme in `src/lib/testInjection.ts`, documented for people in `docs/README.md`.
The rules that keep it honest:

- `?test` alone is a no-op.
  Every field defaults to off, so nothing branches away from the ordinary boot path.
- The module only _parses_ the query string into a plan.
  `src/main.ts` reads it and substitutes the fake at the exact point the real code path would read a file, storage, or the network.
  The state then runs through the same rendering and validation code a real one would, so a screenshot of it is a screenshot of the real UI, not a mockup drawn beside it.
- Nothing writes to `localStorage`, and nothing touches a real token, so any injection is safe to try while signed in.
- Every fake is recognizably fake: a file named `test-injection-mock-file.txt`, an identifier from a range no real dataset occupies, a URL under a `.invalid` host.
- Fakes are fixed, not random: a fixed name, a fixed size, a fixed count, so every snapshot of the state comes out alike.
  A state that would otherwise race (a scan that finishes in milliseconds) gets a `freeze_...` flag that holds it mid-way.
- Prefer an injection over `page.route` stubbing in Playwright specs whenever both reach the same state; the injection is documented, reusable from a URL, and exercised by the boot smoke test.
- Never mention an injection in `CHANGELOG.md`; it is developer tooling, and the changelog feeds the What's New modal.

## If you need something these do not cover

A new determinism rule belongs here, and in [`brain-bbqs/web-app-template`](https://github.com/brain-bbqs/web-app-template), so every app stops repeating the mistake.

# Agent instructions

Setting up a new app from this template is the `setup-web-app` skill's job, and it is more specific than this file.
Read it first.

## What belongs in an app repository

Every BBQS companion app is the same shell around a different job.
The shell is what this template provides: the page frame in `index.html` (header with the logo and the light/dark toggle, the BBQS and CON marks, the footer with the version stamp, the bug and feature links and the "What's New" modal), the shared stylesheet `src/style.css` imports from `@brain-bbqs/ui` (theme tokens, page defaults, header, footer and controls), the tooling under `configs/` (thin calls into `@brain-bbqs/config`), the workflows under `.github/`, and the conventions in this file.
An app adds what it does: pure logic under `src/lib/` (one concern per module, each with a unit test), DOM work under `src/ui/`, the wiring in `src/main.ts`, the markup for it in `index.html` (every id it touches registered in `src/ui/elements.ts`), and its own rules in `src/style.css` below the imports.

Keep the shell recognizably the same as its siblings, [clip-extractor](https://github.com/brain-bbqs/clip-extractor), [encoding-helper](https://github.com/brain-bbqs/encoding-helper) and [bbqs-uploader](https://github.com/brain-bbqs/bbqs-uploader), which this template was abstracted from.
When in doubt about how something should look or behave, look there first: a control one of them already has is the one to copy, not to redesign.

## Check the shared components first

Before adding a component, helper, style, test fixture or config to an app, and before setting a new app up, check the shared packages in [`brain-bbqs/bbqs-web-components`](https://github.com/brain-bbqs/bbqs-web-components).
They are published to npm as `@brain-bbqs/config`, `@brain-bbqs/utils`, `@brain-bbqs/ui`, `@brain-bbqs/ember-client` and `@brain-bbqs/test-utils`, and each package's README lists what it exports and which app files it replaced.

- If a package already provides it, install the package and use it, passing this app's identity (storage keys, OAuth client id, wording) as parameters rather than copying the code in.
- If a package almost fits, extend it there, with a changeset and a test, rather than keeping a local variant that drifts.
- If only a sibling app has it, copy it from that sibling; once a second app carries it, it is a candidate for a package (see that repository's `docs/VENDORING.md`).
- Only when neither a package nor a sibling has it is it this app's own to write.

The template already builds its tooling on `@brain-bbqs/config`, takes its size formatter from `@brain-bbqs/utils`, its stylesheet (theme tokens, page defaults, header, footer, controls and the What's New modal) from `@brain-bbqs/ui`, its Playwright viewport, overflow and theme-seeding helpers from `@brain-bbqs/test-utils/playwright`, and its unit-test boot harness and id contract (`createMainHarness`, `expectIdContract`) from `@brain-bbqs/test-utils/vitest`.
Its shell behaviour comes from `@brain-bbqs/ui` too: `initThemeToggle` flips and stores the theme under the app's `THEME_KEY`, `renderVersion` fills the footer's version stamp, `getShellElements`, `getWhatsNewElements` and `required` back the lookups in `src/ui/elements.ts`, `initWhatsNew` renders `CHANGELOG.md` into the What's New modal and opens it from the footer link or at `#changelog`, and `bindDropzone` with `showDropzoneReject` does the dropzone's drag, click and pick plumbing, leaving `src/ui/dropzone.ts` to say what a drop or a pick means.
The other packages are being adopted app by app in the order `docs/ADOPTION.md` there gives, so a sibling may still carry a local copy of something a package now provides: follow the package, not the copy.

## When the template is at fault, fix it where it came from

A defect in the shell, a config that is wrong for every app, or guidance that led a setup astray belongs in [`brain-bbqs/web-app-template`](https://github.com/brain-bbqs/web-app-template), so the next app is generated with the fix already in place.
This file and the skills under `.claude/skills/` are guidance, and every app holds a generated copy of them, so an edit here reaches this app alone.
Fix it here, and open a pull request against the template as well.

Guidance is at fault when a step was followed as written and still produced a broken app.
The same goes for a failure mode the instructions never mention, an instruction that reads as optional but is not, and an ordering that only works one way without saying so.
A one-off mistake by whoever ran the setup is not a guidance defect, and neither is an upstream outage.

Write the correction as the instruction the next reader follows, not as a story about this incident.
Name the rule, and give just enough of the failure to show why the rule exists.
`.claude/skills/visual-snapshots/SKILL.md` is what that looks like after the fact: a short set of rules distilled from Chromatic diffs that no code change could explain.

## Development guidelines

- Always run `pre-commit` before committing and pushing changes.
- To the best of your ability, ensure tests are passing.
- Follow assertion style (actual on left, expected on right).
- Always bump the version in `package.json` appropriately when any file under `src/`, `configs/`, `index.html`, or `package.json`/`package-lock.json` itself, is changed (`tests/` and `stories/` do not count).
  Bump once per PR: if the version was already bumped by earlier work on the same PR/branch and it hasn't been merged yet, do not bump it again for follow-up commits on that same PR; keep adding entries under the existing top-most `CHANGELOG.md` heading instead.
- This project has no formal releases, so there is no `## Upcoming` staging section in `CHANGELOG.md`.
  Leave a short description of the change or addition directly under the top-most version heading (the same version just bumped in `package.json`; create the heading if it does not yet exist) under the appropriate subsection (`#### 🚀 Enhancement`, `#### 🐛 Bug Fix`, or `#### 🏠 Internal`); create the subsection if it does not yet exist; include the GitHub PR link at the end of each entry in the format `([#N](https://github.com/brain-bbqs/web-app-template/pull/N))`.
- Keep `CHANGELOG.md` entries to a single sentence each, roughly 25 words or fewer: what changed, from the reader's side.
  Not why, not how, not the reasoning behind it, which belong in the code comments and the PR.
  Prefer a single entry per PR, describing the change as a whole at the level someone using the app would notice; follow-up commits on the same PR should usually revise that entry rather than add another.
- Never mention `?test` live test injections (or any other debug-only URL override) in `CHANGELOG.md` entries.
  The changelog is user-facing (it feeds the "What's New" modal); those are developer tooling documented in `docs/README.md` instead.
  If a change mixes user-facing behavior with `?test` tooling, describe only the user-facing part in the changelog entry.
- PR titles should be human-readable and in the past tense; they should NOT use conventional commit style.
- Keep PR descriptions as short and concise as possible: the fewest words that describe the change accurately.
  No walking the diff file by file, no restating what the code already says, no background the reviewer does not need to review it.
- Always keep the PR title and description accurate to what the branch currently does.
  When follow-up commits add, drop or change behaviour, update them in place rather than leaving them describing an earlier state.
- End every PR description with a `<details>` dropdown titled `Original prompt` (`<details><summary>Original prompt</summary>` ... `</details>`) holding the prompts that asked for the work, quoted verbatim and in order: the original request first, then each follow-up as the branch grows.
  The prose above it stays a description of the change, not of the conversation.
- Limit use of em-dashes in all text.
  Before committing any change to `CHANGELOG.md`, grep the newly added entries for `—` and rewrite any hits (commas, parentheses, or separate sentences work well).
- When a request is genuinely ambiguous, ask at the end of your reply and stop there.
  Waiting for an answer is fine, there is no time pressure to guess.
  Bundle related questions into one message rather than asking them one at a time.
- Before storing any new credential/token client-side, adding/changing `innerHTML`/`outerHTML`/`insertAdjacentHTML` usage, adding a runtime dependency, or responding to a CodeQL "clear text storage of sensitive data" alert, read `SECURITY.md` (the `frontend-security` skill is its triggerable summary).
- Every commit must include a `Co-Authored-By` trailer identifying the tool and the model that wrote it.

## Code style

- TypeScript strict throughout; no `any`.
  The type-aware ESLint rules `configs/eslint.config.js` takes from `@brain-bbqs/config/eslint` are the floor, not a suggestion, and the pre-commit `eslint` hook runs them with `--fix`.
- Dynamic strings (file names, API responses, anything a user or a file supplies) reach the DOM through `.textContent`, never by concatenation into `innerHTML`.
  A hardcoded static template assigned via `innerHTML` is fine.
- No third-party `<script>` tags or CDN includes in `index.html`; only this app's own bundled module loads at runtime.
  Keep runtime dependencies minimal and each one justified.
- Controls are drawn as inline SVG stroked with `currentColor` rather than emoji: Windows renders emoji in color presentation, while a stroked path stays monochrome and follows the theme.
  Decorative emoji in body text, marked `aria-hidden`, are fine.
- Light and dark theme values come from `@brain-bbqs/ui`'s `tokens.css`, and its layout knobs are listed in that package's README.
  To add a color or change a value, redeclare it on `:root` after the imports in `src/style.css`, in a light block and two identical dark blocks updated together; never copy a shared rule in to change it.
  Every color is a token; no component carries a hex value of its own.
- Keep inline comments sparse.
  Explain non-obvious "why", never "what".
- In Markdown, give each sentence its own line rather than wrapping prose to a fixed width.
  A reworded sentence is then a one-line diff instead of a reflowed paragraph, which is what makes a prose suggestion on a pull request reviewable.

## Tests

- Unit tests live in `tests/unit/` (Vitest, node by default; a suite that needs a DOM starts with `// @vitest-environment jsdom`), integration tests in `tests/integration/` (Playwright against the built app), and the Chromatic snapshots in `tests/chromatic/`.
- Every module under `src/lib/` has a unit test.
  DOM modules under `src/ui/` are tested in jsdom against hand-built elements.
  `src/main.ts` is tested by booting it against the real `index.html` through `tests/unit/helpers/mainHarness.ts`, one test file per boot scenario.
  That harness is `createMainHarness` from `@brain-bbqs/test-utils/vitest`, created once with the app's own `import("../../../src/main")`; do not hand-roll a boot.
  `tests/unit/elements.test.ts` checks the `index.html`/`elements.ts` id contract both ways with `expectIdContract` from the same entry point.
- The coverage thresholds in `configs/vitest.config.ts` are a ratchet: set just below what is measured, raised as coverage improves, never lowered to make a PR pass.
- A UI state worth a screenshot gets a `?test&...` injection (see `docs/README.md` and the `visual-snapshots` skill), so a Chromatic snapshot and a person can both reach it from a URL.
- Use `it.each` wherever it reduces duplication.

## Verifying a change

```bash
npm ci
npm run typecheck
npm run lint
npm run test:coverage
npm run build
npm run test:integration
pre-commit run --all-files
```

Then `npm run dev` and look at it.
Chromatic runs on every push; read its result against the `visual-snapshots` skill before accepting or rejecting a diff.

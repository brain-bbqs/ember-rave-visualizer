---
name: setup-web-app
description: First-time setup of a new BBQS companion web app generated from brain-bbqs/web-app-template. Use when asked to set up, initialize, or specialize this app from the template, naming it, deciding what it loads and shows, implementing that under src/lib and src/ui, connecting the repository's services, and removing the template scaffolding.
---

# Setting up a new web app from the template

Work through all of these steps in a single setup PR.
`web-app-template` is the placeholder for the hyphenated repository name (e.g., `clip-extractor`) and `Web App Template` for the app's display title (e.g., `Clip Extractor`).
Both are real, buildable values, so the template runs as-is and every occurrence is found by grep.

## What you are and are not writing

Every BBQS companion app is the same shell around a different job: a single-page, backend-free page that loads something, does something with it in the browser, and shows or saves the result.
The shell arrives from the template: the page frame in `index.html`, the shared theme tokens and shell styles that `src/style.css` imports from `@brain-bbqs/ui`, the three shared behaviors at the top of `src/main.ts` (version stamp, theme toggle and What's New modal, through `@brain-bbqs/ui`'s `renderVersion`, `initThemeToggle` and `initWhatsNew`), the tooling under `configs/`, the workflows under `.github/`, and the conventions in `AGENTS.md`.

So this repository adds **what the app does**, in these places, and little else:

| Where                | What goes there                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `index.html`         | The app's own cards, inside `<main>`, below the header and subtitle. The frame around them stays as it is.          |
| `src/lib/`           | Pure logic, one concern per module, no DOM. Each module has a unit test in `tests/unit/`.                           |
| `src/ui/`            | DOM work, taking the elements it needs from `src/ui/elements.ts`, where every id the app touches is registered.     |
| `src/main.ts`        | Wiring only, below the shell section. Reads `?test` injections and substitutes fakes at the one point each applies. |
| `src/style.css`      | The app's own rules, below the `@brain-bbqs/ui` imports, using the shared tokens and controls wherever they fit.    |
| `tests/`, `stories/` | See step 3.                                                                                                         |

Do **not** rewrite, restyle or "improve" any of the following.
They are the shell, shared with every sibling app, and a divergent copy here is a copy that drifts:

- the header, the theme toggle and its pre-paint script, the BBQS watermark, the footer bar, the What's New modal and the version stamp;
- the `@brain-bbqs/ui` imports at the top of `src/style.css`, and the theme tokens and knobs they bring (redeclare a token or knob on `:root` after the imports to change it, add a color as a new token in a light block and two identical dark blocks, never copy a shared rule in, never hardcode a hex in a component);
- anything under `configs/` beyond passing the shared `@brain-bbqs/config` factories an app-specific option, such as a runtime dependency's alias or chunking rule where the build genuinely needs it (a default that is wrong for every app is fixed in that package instead);
- the workflows, beyond the one hostname in `preview.yml` (step 1) and the template guards (step 6);
- the `?test` injection scheme, the `getShell()`/`getElements()` id-lookup pattern (the shell's ids through `@brain-bbqs/ui`'s `getShellElements`), the changelog format.

If something in the shell is wrong for this app, it is probably wrong for its siblings too: fix it in [`brain-bbqs/web-app-template`](https://github.com/brain-bbqs/web-app-template) so the next app gets the fix, and port the same change here.
That is the whole point of it being shared.

## 0. Check the shared components first

Before writing anything in steps 2 and 3, check [`brain-bbqs/bbqs-web-components`](https://github.com/brain-bbqs/bbqs-web-components) for a package that already does it, and repeat the check for every component you are about to add.
It publishes the code the sibling apps have in common as `@brain-bbqs/*` npm packages: `config` (tooling, already used by `configs/`), `utils` (formatting, queues, path sanitization, safe storage; already used for the size formatter), `ui` (theme toggle, account menu, footer, What's New modal, dropzone, human-subjects banner, DOM helpers, shared CSS; already used for the stylesheet `src/style.css` imports, the theme toggle, the version stamp, the What's New modal, the shell's element lookups and the dropzone's plumbing), `ember-client` (EMBER sign-in, API calls, the dataset picker) and `test-utils` (Playwright and Vitest helpers, already used by `tests/`, including the unit tests' `createMainHarness` and `expectIdContract`).
Each package's README says what it exports.

- A package that provides it: `npm install` it and pass this app's identity (storage keys, client id, wording) as options.
- A package that almost fits: extend it in that repository with a changeset, rather than writing a local variant here.
- Only a sibling app has it: copy the sibling's version, and note in the setup PR that a second app now carries it, which makes it a candidate for a package.

The **What belongs in an app repository** and **Check the shared components first** sections of `AGENTS.md` say the same for the app's later life.

## 1. Name the app

Find every occurrence first; the list below is what the template ships with, and grep is what proves nothing was missed:

```bash
grep -rn --exclude-dir=node_modules --exclude-dir=dist --exclude=package-lock.json -e "web-app-template" -e "Web App Template" .
```

- `web-app-template` → the repository name, in: `package.json` (`name`), `index.html` (the footer's issue links and version link), `src/lib/settings.ts` (`THEME_KEY`, which `configs/vite.config.ts` also hands to the pre-paint script), `public/CNAME` and `.github/workflows/preview.yml` (`pages-base-url`, both `<app-name>.brain-bbqs.org`), `README.md` (badges), `AGENTS.md` (the changelog PR-link format), `docs/README.md` (the live links), `CHANGELOG.md` and `tests/integration/smoke.spec.ts`.
  Then `npm install` so `package-lock.json` follows.
- `Web App Template` → the display title, in: `index.html` (`<title>`, `<h1>`, the header logo's `alt`), `README.md`, both files under `.github/ISSUE_TEMPLATE/`, `src/assets/app-logo.svg` and `tests/integration/smoke.spec.ts`.
- The subtitle under the header in `index.html`, and the one-line description at the top of `README.md` and in `package.json`: what the app does, from the reader's side, in one sentence.
- The logo: replace `src/assets/app-logo.svg` with the app's own mark (it is the header logo and the favicon; add PNG favicon sizes the way encoding-helper does if the app wants them).
  Leave `bbqs-logo.png` and `con-logo.png` alone; they are the organization's marks, identical across every app.
- The README's credit lines: keep "Built & maintained by" and the funding line; add a "Conception & prototype by" line if there is one to credit (see clip-extractor's README).
- The workflow guards are not renamed; they are deleted in step 6.

## 2. Decide what the app loads and shows

The template opens on a file dropzone and swaps to a loaded-file card, because every sibling app opens by loading something.
Keep the dropzone (adapting its `accept` attribute and prose to what the app takes, and what `onDrop` and `onPick` do with a file in `src/ui/dropzone.ts`; its drag, click and pick plumbing is `@brain-bbqs/ui`'s `bindDropzone`) or, if the app loads from somewhere else (a URL, an archive listing, a sign-in), replace the picker card while keeping the two-state shape: a picker, and the app once something is loaded.

Then, for the app itself:

- **Logic goes in `src/lib/`, DOM in `src/ui/`, wiring in `src/main.ts`.**
  A module that both computes and renders is two modules.
  Everything that can be unit-tested without a browser goes under `lib/`.
- **Register every id** the app touches in `src/ui/elements.ts`, and reach elements only through it.
  The boot smoke test then fails the moment `index.html` and the code disagree.
- **Dynamic strings reach the DOM through `.textContent`**, never by concatenation into `innerHTML`; read `SECURITY.md` before adding an `innerHTML` use or a runtime dependency.
- **Give every state worth a screenshot a `?test` injection**: extend `TestInjection` in `src/lib/testInjection.ts`, substitute the fake in `src/main.ts` at the one point the real code path would read a file or make a call, and add a row to `docs/README.md`.
  Read the `visual-snapshots` skill before writing one; it says what makes a fake honest.
- **Add runtime dependencies to `package.json` `dependencies`** only with a reason, and lazy-load anything heavy (ffmpeg.wasm, a video parser) so the first paint stays fast; encoding-helper's `configs/vite.config.ts` shows the chunking rule for that.
- Do not add a "Clear cache" footer control, sign-in, or an educational toggle unless the app needs one; when it does, use the `@brain-bbqs/*` package that provides it (sign-in is `@brain-bbqs/ember-client` plus the `ui` account menu), or copy the sibling that has it (bbqs-uploader, clip-extractor and encoding-helper respectively) rather than designing a new one.

## 3. Tests and stories

- A unit test per `src/lib/` module; jsdom tests for `src/ui/` modules against hand-built elements (see `tests/unit/dropzone.test.ts`).
- One `tests/unit/main.<scenario>.test.ts` per boot scenario, through `tests/unit/helpers/mainHarness.ts`; the plain boot and each `?test` injection worth its own file.
  That harness is `createMainHarness` from `@brain-bbqs/test-utils/vitest`; pass it `canvas` or `observers` if `main.ts` draws or observes at boot, rather than stubbing them by hand.
- `tests/unit/elements.test.ts` keeps `index.html` and `src/ui/elements.ts` in step through `expectIdContract` from `@brain-bbqs/test-utils/vitest`; register every new id in `getElements()` rather than listing it in `pageOnly`.- `tests/integration/smoke.spec.ts` covers the shell; add a spec per feature, driving the page the way a person would, with `?test` injections rather than `page.route` stubbing wherever they reach the same state.
- `tests/chromatic/app.chromatic.test.ts` snapshots each page state at every viewport in `VIEWPORTS` and fails on sideways overflow, through `forEachViewport` and `expectNoHorizontalOverflow` from `@brain-bbqs/test-utils/playwright`; add a `forEachViewport` call per new state.
- A story per component state, in both themes (see `stories/Dropzone.stories.ts`), and keep `stories/App.stories.ts` rendering the real `index.html` with each loaded state applied by hand.
- Ratchet the coverage thresholds in `configs/vitest.config.ts` to just below what `npm run test:coverage` measures once the app's tests are in.
- Rewrite `docs/user_tests/template.md`'s app section for what a person would do with this app, and keep the cross-cutting section.

## 4. Connect the repository's own services

None of this is code, and none of it can be done from the template; each is a setting on the generated repository:

- **GitHub Pages**: source is the `gh-pages` branch (the Deploy workflow creates it on the first push to `main`), custom domain `<app-name>.brain-bbqs.org`, with a DNS `CNAME` record for it pointing at `brain-bbqs.github.io`.
  `public/CNAME` is what keeps the custom domain across deploys.
- **Secrets** (Settings → Secrets and variables → Actions): `CODECOV_TOKEN` (from the Codecov project), `CHROMATIC_STORYBOOK_PROJECT_TOKEN` and `CHROMATIC_PLAYWRIGHT_PROJECT_TOKEN` (two Chromatic projects, one per kind of snapshot; each sibling app has both).
  Until they exist, the Lint workflow's upload step and both Chromatic workflows fail.
  The `setup-chromatic` skill walks through creating the two projects and writes the developer-facing section on stories versus Playwright snapshots; the stories, tests, configs and workflows it describes are already here.
- **Codecov**: add the repository; `.github/.codecov.yml` is already in place.
- **pre-commit.ci**: install it on the repository; `.pre-commit-config.yaml` already skips the `eslint` hook there.
- **Dependabot** reviews go to the reviewer named in `.github/dependabot.yml`; change it if this app's maintainer differs.
- **Branch protection** on `main`: require the Lint, Test and Version Check workflows.

## 5. Verify before merging

```bash
npm ci
npm run typecheck
npm run lint
npm run test:coverage
npm run build
npm run test:integration
pre-commit run --all-files
```

Then `npm run dev` and look at every state, in both themes, at a phone width; and `npm run storybook` for the stories.
Push, and read the Chromatic results against the `visual-snapshots` skill.
Run through `docs/user_tests/template.md` on the PR preview once it deploys.

## 6. Remove the template scaffolding

These pieces document the template itself, not the generated app; delete them in this same setup PR:

- The README **How it works** section: the generated app's README should describe only the app itself, in the shape its siblings use (logo, title, badges, one line, credits).
- The README **Repository setup** section (including its **With Claude Code** subsection) and the **Note** block above **How it works**.
- `.claude/skills/setup-web-app/`: this skill has no purpose once setup is done.
  Keep `frontend-security`, `reuse-license-setup`, `setup-chromatic` and `visual-snapshots`; they are about the app, not the template.
- The `if: github.repository != 'brain-bbqs/bbqs-web-app-template'` conditions in `.github/workflows/` (`deploy.yml`, `preview.yml`, both Chromatic workflows, and the Codecov step in `lint.yml`).
  They exist so the template does not deploy a placeholder page or fail on secrets it does not have; this repository is not the template, so each condition is already true and every trigger runs.
  Deleting them is tidiness rather than a fix, and leaving them costs this app nothing.
- `CHANGELOG.md`: replace its contents with a single `## 0.1.0` heading and one `#### 🏠 Internal` entry describing this setup PR, so the What's New modal opens on the app's own history.
  Leave `package.json` at `0.1.0`.
- The **What belongs in an app repository** paragraph in `AGENTS.md` stays; it is about the app.

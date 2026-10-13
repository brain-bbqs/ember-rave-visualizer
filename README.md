<p align="center">
  <img src="src/assets/app-logo.svg" width="120" alt="Web App Template logo"/>
  <h1 align="center">Web App Template</h1>
  <p align="center">
    <a href="https://codecov.io/github/brain-bbqs/web-app-template?branch=main"><img src="https://codecov.io/github/brain-bbqs/web-app-template/coverage.svg?branch=main" alt="codecov"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="License: MIT"></a>
    <a href="https://github.com/prettier/prettier"><img alt="code style: prettier" src="https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat"></a>
  </p>
  <p align="center">
    <a href="https://github.com/brain-bbqs/web-app-template/actions/workflows/chromatic-storybook.yml"><img src="https://github.com/brain-bbqs/web-app-template/actions/workflows/chromatic-storybook.yml/badge.svg" alt="Chromatic (Storybook)"></a>
    <a href="https://github.com/brain-bbqs/web-app-template/actions/workflows/chromatic-playwright.yml"><img src="https://github.com/brain-bbqs/web-app-template/actions/workflows/chromatic-playwright.yml/badge.svg" alt="Chromatic (Playwright)"></a>
  </p>
</p>

`<A one-line description of what this app does, and for whom.>`

---

Built & maintained by the [Center for Open Neuroscience](https://centerforopenneuroscience.org).

Funded by the [National Institutes of Health (NIH)](https://www.nih.gov/brain/research/data-knowledge-resources) grant [R24 MH136632](https://reporter.nih.gov/search/kDbcoCvju0ymZz0fI3zvhA/project-details/10888659) as a part of the [Brain Behavior Quantification and Synchronization (BBQS)](https://brain-bbqs.org/) consortium.

> **Note:** Throughout this template, `web-app-template` stands for the hyphenated repository name (e.g., `clip-extractor`) and `Web App Template` for the app's display title (e.g., `Clip Extractor`).
> They are real, buildable values rather than angle-bracket placeholders, so the template runs and tests as-is; the setup skill replaces every occurrence.

## How it works

Every BBQS companion app is the same shell around a different job: a single-page, backend-free web app built with Vite and TypeScript, deployed to GitHub Pages under its own `*.brain-bbqs.org` hostname, with a PR preview per pull request, unit tests under Vitest, integration tests under Playwright, and visual snapshots of both the page and its Storybook stories under Chromatic.
This template is that shell, abstracted from [clip-extractor](https://github.com/brain-bbqs/clip-extractor), [encoding-helper](https://github.com/brain-bbqs/encoding-helper) and [bbqs-uploader](https://github.com/brain-bbqs/bbqs-uploader).
So a repository generated from it holds only what makes the app different from its siblings: what it loads, what it does with it, and what it shows.

| Where                   | What it is                                                                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`            | The static page: the shared frame (header, light/dark toggle, BBQS and CON marks, footer with version stamp and What's New) around the app's own cards.                                                                   |
| `src/main.ts`           | The wiring: the shell's three shared behaviors (version stamp, What's New modal, theme toggle), then the app.                                                                                                             |
| `src/lib/`              | Pure logic, one concern per module, each unit-tested. Ships with the theme setting and the `?test` injection reader; the size formatter comes from `@brain-bbqs/utils`.                                                   |
| `src/ui/`               | DOM work: the typed id lookups in `elements.ts` (every id the app touches, so a missing one fails on import) and the file dropzone.                                                                                       |
| `src/style.css`         | The shared theme tokens, shell and controls, imported from `@brain-bbqs/ui`, then the app's own rules.                                                                                                                    |
| `tests/unit/`           | Vitest. `main.*.test.ts` boot the real `main.ts` against the real `index.html`, one file per boot scenario.                                                                                                               |
| `tests/integration/`    | Playwright, against the built app, with the shared helpers from `@brain-bbqs/test-utils/playwright` (`seedTheme`, `expectNoHorizontalOverflow`).                                                                          |
| `tests/chromatic/`      | The Chromatic snapshots: each page state at desktop, tablet and phone sizes, in both orientations (`forEachViewport`), naming any element that runs off the side of a narrow viewport.                                    |
| `stories/`              | Storybook. `App.stories.ts` renders `index.html` itself (imported raw, so it cannot drift); component stories render each state in both themes.                                                                           |
| `configs/`              | Every tool's configuration, out of the repository root, each a thin call into the shared `@brain-bbqs/config` package: Vite, Vitest, Playwright, Storybook, ESLint, Prettier, TypeScript; codespell.                      |
| `.github/workflows/`    | Lint (typecheck, lint, unit tests with coverage to Codecov), Test (Playwright), Version Check (a `package.json` bump per PR), Deploy (to `gh-pages`), PR preview, and the two Chromatic runs.                             |
| `CHANGELOG.md`          | One entry per PR, in the reader's words. It is what the What's New modal shows, so it is the app's release notes.                                                                                                         |
| `docs/`                 | `README.md` lists the `?test&...` live test injections; `user_tests/` holds the manual checklist and one filled copy per tester.                                                                                          |
| `AGENTS.md`, `.claude/` | The conventions an agent (or a person) works to, the setup skill, and the skills that survive setup (`frontend-security`, `reuse-license-setup`, `setup-chromatic`, `visual-snapshots`). `CLAUDE.md` imports `AGENTS.md`. |

Three conventions do most of the work of keeping the apps alike:

- **The version stamp.** `package.json`'s version is injected at build time as `__APP_VERSION__` (by `@brain-bbqs/config`'s `resolveAppVersion`), shown in the footer, and bumped on every PR that touches the app (the Version Check workflow enforces it). Chromatic pins it to `0.0.0` so a bump alone never re-snapshots a page.
- **The changelog feeds the page.** `CHANGELOG.md` is imported raw and rendered into the What's New modal (`@brain-bbqs/ui`'s `initWhatsNew`), also reachable at `#changelog`, so a change is described once, for the person using the app.
- **`?test` injections.** A URL like `?test&mock_file` drives the deployed page into a real UI state with no local file, no sign-in and no network, so a person can eyeball each state live and the Chromatic snapshots can capture it deterministically. `?test` alone is a no-op.

Local development:

```bash
npm ci
npm run dev              # the app, with hot reload
npm run storybook        # the component stories
npm test                 # unit tests (add `:coverage`, or `:watch`)
npm run test:integration # Playwright, against a fresh build
npm run lint && npm run typecheck
```

Set `PLAYWRIGHT_CHROMIUM_PATH` to reuse a browser already on the machine instead of `npx playwright install`.

## Repository setup

After generating a repository from this template, the full setup checklist lives in [`.claude/skills/setup-web-app/SKILL.md`](.claude/skills/setup-web-app/SKILL.md): naming the app, deciding what it loads and shows, implementing that under `src/lib/` and `src/ui/`, connecting the repository's own services (Pages, Codecov, Chromatic), and removing the template scaffolding (this section and the **How it works** section above included).

Setting up an app is naming it and writing what it does with what it loads.
Before writing any component for it, check the shared [`@brain-bbqs/*` packages](https://github.com/brain-bbqs/bbqs-web-components) for one that already does the job (see **Check the shared components first** in `AGENTS.md`).
If you find yourself rewriting the header, the theme toggle, the footer, a config under `configs/` or a workflow, stop: it is shared, and the skill says where a real shell defect goes instead.

### With Claude Code

Open a [Claude Code](https://claude.com/claude-code) session in the freshly generated repository and start from a prompt like:

> Set up this new BBQS web app using the setup-web-app skill. The app should `<describe what it does, what it loads or produces, and who uses it>`. Open the result as a single setup PR.

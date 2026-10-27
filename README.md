<p align="center">
  <img src="src/assets/app-logo.svg" width="120" alt="EMBER RAVE Visualizer logo"/>
  <h1 align="center">EMBER RAVE Visualizer</h1>
  <p align="center">
    <a href="https://codecov.io/github/brain-bbqs/ember-rave-visualizer?branch=main"><img src="https://codecov.io/github/brain-bbqs/ember-rave-visualizer/coverage.svg?branch=main" alt="codecov"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="License: MIT"></a>
    <a href="https://github.com/prettier/prettier"><img alt="code style: prettier" src="https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat"></a>
  </p>
  <p align="center">
    <a href="https://github.com/brain-bbqs/ember-rave-visualizer/actions/workflows/chromatic-storybook.yml"><img src="https://github.com/brain-bbqs/ember-rave-visualizer/actions/workflows/chromatic-storybook.yml/badge.svg" alt="Chromatic (Storybook)"></a>
    <a href="https://github.com/brain-bbqs/ember-rave-visualizer/actions/workflows/chromatic-playwright.yml"><img src="https://github.com/brain-bbqs/ember-rave-visualizer/actions/workflows/chromatic-playwright.yml/badge.svg" alt="Chromatic (Playwright)"></a>
  </p>
</p>

Visualize local or remotely hosted electrode-coordinate tables on an interactive RAVE MNI152 template brain.

Tables are tab-separated (`.tsv`) by default, and comma-separated (`.csv`) files work too.
Each row is one electrode contact, with its MNI152 coordinates in millimetres.
The column names are case-sensitive, and extra columns are allowed:

| Electrode | MNI152_x | MNI152_y | MNI152_z | Label |
| --------: | -------: | -------: | -------: | ----- |
|         1 |      -22 |       -5 |      -18 | LA1   |
|         2 |      -27 |       -5 |      -18 | LA2   |
|         3 |      -32 |       -5 |      -18 | LA3   |
|         4 |      -28 |      -22 |      -13 | LH1   |

[Download example table](https://brain-bbqs.github.io/ember-rave-visualizer/examples/example-electrodes.tsv) to try the app with nine contacts in the left amygdala and both hippocampi, or paste that link into the app's **Remote URL** tab.

---

Built & maintained by the [Center for Open Neuroscience](https://centerforopenneuroscience.org).

The embedded viewer engine was created by the [RAVE](https://rave.wiki/) and [three-brain-js](https://github.com/dipterix/three-brain-js) contributors.
Its MPL-2.0 license and the MNI152 template caveat are documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Funded by the [National Institutes of Health (NIH)](https://www.nih.gov/brain/research/data-knowledge-resources) grant [R24 MH136632](https://reporter.nih.gov/search/kDbcoCvju0ymZz0fI3zvhA/project-details/10888659) as a part of the [Brain Behavior Quantification and Synchronization (BBQS)](https://brain-bbqs.org/) consortium.

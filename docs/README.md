# Live Testing

## Live test injections

| URL               | What it should look like                                              | Try it                                                          |
| ----------------- | --------------------------------------------------------------------- | --------------------------------------------------------------- |
| `?test&mock_file` | The loaded-file card, holding a synthesized file, with no picker step | [Open](https://web-app-template.brain-bbqs.org/?test&mock_file) |

`?test` alone (without one of the above) is a no-op that never changes anything by itself.

Every fake is obviously fake (the mock file is named `test-injection-mock-file.txt`) so it is never mistaken for real data.
Nothing is written to `localStorage`, so all of the above are safe to try at any time.

`mock_file` synthesizes a small text file of fixed name and size and hands it to the same code path a dropped file takes, so what the card shows is the real rendering of a loaded file rather than a mockup beside it.
The Chromatic file-loaded snapshot uses this to capture the state deterministically.

Add a row here for every injection the app grows, and read the `visual-snapshots` skill under `.claude/skills/` before adding one.

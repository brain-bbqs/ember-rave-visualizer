# User Test Checklist

|            |         |
| ---------- | ------- |
| **Tester** | <enter> |
| **Date**   | <enter> |

A basic manual pass through the app before a release or after a significant change.
Run through this on the deployed site.
Copy this file to `docs/user_tests/<tester>.md`, fill it in, and open it as a PR titled `User test: <Tester>`.

## Loading a file

- [ ] Dragging and dropping a file onto the dropzone loads it into the summary card
- [ ] Using the browse button loads a file the same way
- [ ] Dropping something that is not a file (dragged text) shows the refusal message instead of doing nothing
- [ ] "Change file" returns to the picker

## The app

Add one section per feature of the app, with one checkbox per thing a person would do with it.

## Cross-cutting

- [ ] Reloading the page mid-task doesn't leave local state (localStorage) in a way that breaks the next load
- [ ] The app is usable in both light and dark OS/browser theme, and the header toggle flips between them
- [ ] Basic responsiveness: window resized narrower doesn't break layout or hide controls
- [ ] Loading the page shows no unexpected errors in the browser console
- [ ] Can navigate to all hyperlinks in the bottom-left, and "What's New" opens with the current version's entry

## Extra notes

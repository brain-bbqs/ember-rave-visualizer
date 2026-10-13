# Security notes

This app is a fully static, backend-free page (see `package.json`'s description).
There is no server to hold a session, set an `httpOnly` cookie, or otherwise keep a credential out of client-side JavaScript.
If the app ever calls an authenticated API, whatever credential it uses has to live somewhere the browser's JS can read it back out.
That constraint doesn't go away; the sections below are about managing it deliberately instead of by accident.

## The actual risk is XSS, not "clear text storage" by itself

A token sitting in `localStorage`/`sessionStorage` is only exploitable remotely if an attacker can first get JavaScript to execute on this origin (XSS), at which point they could just make authenticated requests directly; credential theft is a bonus, not the primary damage.
So before treating a "clear text storage of sensitive information" scanner alert as something to dismiss or work around, actually check whether that precondition holds:

```
grep -rn "innerHTML\|outerHTML\|insertAdjacentHTML" src/
```

For every hit, confirm any _dynamic_ (user-supplied, API-returned, file-derived, or otherwise non-literal) string is assigned via `.textContent` (or an `element.value` type property) rather than concatenated into the HTML string itself.
A fixed, hardcoded template assigned via `innerHTML` is fine; the risk is interpolating untrusted data into HTML source, not the property name.
As shipped, the template's own code under `src/` has no `innerHTML` use: the dropzone's refusal text is built from text nodes and `<br>` elements, and the What's New modal is drawn by `@brain-bbqs/ui`'s `initWhatsNew`, which builds `CHANGELOG.md` into DOM nodes and never parses it as markup.
Keep it that way: this is the property that makes accepting client-side credential storage a reasonable call for an app of this shape.

Also keep an eye on:

- **No third-party runtime scripts.** Nothing in `index.html` loads a CDN `<script>` tag.
  A compromised third-party script is the other realistic way a token in storage gets exfiltrated even without a bug in this app's own code, so keep it that way.
- **Minimal runtime dependencies.** The template ships with none.
  Every added runtime dependency is something that could be compromised upstream and ship code that reads `localStorage`; don't add one without a reason.

## Handling a "clear text storage" alert on a new credential

1. Run the `innerHTML`/XSS check above.
   If it turns up a real injection point, fix _that_; it's a bigger problem than where the token sits, and no storage choice below fixes it.
2. If it doesn't, decide how much persistence the credential actually needs, in order of decreasing exposure:
   - `localStorage` survives browser restarts.
     Lowest friction, largest exposure window (persists until explicitly cleared or signed out).
   - `sessionStorage` survives reloads, clears on tab close.
     Meaningfully smaller window than `localStorage`, but scanners (CodeQL included) generally flag this the same way; expect to still need step 3.
   - In-memory only (a plain module variable, no Storage API) is cleared on any reload/navigation, not just tab close.
     Removes the flagged sink entirely, at the cost of re-authenticating on every page load.
3. If you land on `localStorage` or `sessionStorage`, dismiss the resulting alert as an accepted, documented trade-off (link this file) rather than trying to "encrypt" the value client-side first: any decryption key reachable by this app's own JS is reachable by an attacker's injected JS too, so client-side encryption of a client-held secret is not a real mitigation, just a false sense of one.

**Precedent** from a sibling app: [bbqs-uploader#16](https://github.com/brain-bbqs/bbqs-uploader/pull/16) proposed dropping persistence entirely for a pasted API key (the in-memory option above) rather than dismissing its alert, and [bbqs-uploader#19](https://github.com/brain-bbqs/bbqs-uploader/pull/19) replaced that key with OAuth tokens persisted in `localStorage`, deciding the same question for those tokens with the checklist above.

## Never forward a user's token to a third party

If the app calls a companion service (anything that is not the API the token was issued for), that call carries **no credentials of the user's**.
A service that needs to look something up does so with its own key, server-side.
An earlier version of a sibling app forwarded the signed-in user's live access token to a helper host on every page load, which put a credential capable of acting as that user on a machine the repository doesn't control; a unit test now pins the absence of the `Authorization` header on that call.
Do the same here: if such a service ever needs to know something it can't resolve with its own credentials, change the service, not the header.

## If the app adds sign-in

Document the token lifecycle in this file when it happens: which grant, how long access tokens live, how and when they are refreshed, and what signing out revokes.
The `frontend-security` skill under `.claude/skills/` is the triggerable summary of this file; update both together.

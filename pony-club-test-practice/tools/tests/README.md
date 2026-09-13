# Browser tests

Optional. Nothing here runs on the live site or affects the build — GitHub Pages
ignores it, and the app has no dependencies of its own.

Each test opens the app in a real browser and drives it the way a member would.
Both builds are checked every time: `index.html` served over http, and
`pony-club-c-test-standalone.html` opened from disk. That is deliberate — a bug
once hid in the bundled file alone, because the data is already in the page
there and the code runs in a different order.

## Running them

Needs Node and `python3` (the harness serves the folder itself).

```bash
npm install --no-save playwright
npx playwright install chromium      # first time only
node tools/tests/link-rendering.test.js
node tools/tests/test-filter.test.js
```

Every check prints PASS or FAIL, and the process exits non-zero if anything
failed.

## What each one covers

| File | Covers |
| --- | --- |
| `link-rendering.test.js` | `[label](url)` in an answer becoming a real anchor: attributes, no raw markup, tapping it follows the link instead of flipping, Enter and Space on it, read-aloud saying the label and not the URL, links on the hidden face staying out of the tab order, unlinked answers unchanged |
| `test-filter.test.js` | The Test select and the test-level label: options built from the data in Pony Club order, the card count for each level, topics narrowing with the test, stacking with theme and important-only, Reset clearing it, and the label's text, ordering and screen-reader wording |
| `harness.js` | Shared plumbing — serves the folder, opens both builds, stubs speech |

`test-filter.test.js` reads its expected counts out of `data/questions.json`
rather than hard-coding them, so it keeps working as `test_level` is filled in
across more cards.

## Two things that will trip you up

**The flip animation.** The card takes about half a second to turn, and a click
during it hit-tests against the face that is rotating away. Always settle after
a flip (`flip()` in the harness does) before aiming at anything on the new face.
Two apparent failures during development were this, not the app.

**Stubbing speech.** `window.speechSynthesis` is a read-only accessor, so it has
to be replaced with `Object.defineProperty` — a plain assignment is silently
ignored and the real API runs instead. The stub's `getVoices()` returns an empty
list on purpose: a plain object cannot be assigned to `utterance.voice`, and
that throws.

Also: "Important only" is a visually hidden checkbox behind a custom switch, so
click `.switch__label`, not `#importantOnly`.

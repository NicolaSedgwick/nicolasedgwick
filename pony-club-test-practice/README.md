# Pony Club C Test Practice

A flashcard app for practising The Pony Club **C Standard Test** (Riding, and Horse & Pony Care), Revised 2025.

Tap a card to flip it, tap the loudspeaker to hear it read aloud. Filter by theme, topic, or just the **important** (bold) items, work through a shuffled deck, and choose a male or female reading voice. **Reset** puts the filters back the way they were on load; it greys itself out when there is nothing to reset.

No accounts, no cookies, no analytics, no server, nothing sent anywhere. Everything runs in the browser. Feedback comes in by email — the address is in the page footer.

## Files

```
index.html            markup — the card, the controls, the deck bar
css/styles.css        all styling, including the 3D flip and dark mode
js/app.js             deck logic, filters, read-aloud
data/questions.json   the question bank  ← this is the file you edit
tools/extract.py      regenerates questions.json from the official PDFs (optional)
tools/bundle.py       squashes the whole app into one shareable .html file (optional)
tools/parked/         groundwork for features not currently switched on

pony-club-c-test-standalone.html   the squashed single-file build
```

Only the first four are needed for the site to run. `tools/` is there so the app can be rebuilt if the test sheets change.

## Editing the questions

`data/questions.json` holds one object per card:

```json
{
  "id": "r17",
  "theme": "Riding",
  "topic": "Riding",
  "number": 17,
  "question": "Use legs and hands as aids to increase and decrease pace",
  "answer": "",
  "important": "Yes"
}
```

| Field | Meaning |
| --- | --- |
| `id` | Short unique key (`r` or `c` plus the item number). Not shown to the user. |
| `theme` | `"Riding"` or `"Care"` — from the document title. |
| `topic` | The heading the item sits under, e.g. `"Safety"`, `"Pony Care"`. |
| `number` | The item number on the official test sheet. |
| `question` | The bullet text, verbatim. |
| `answer` | **Blank for now.** Fill these in as you go. |
| `important` | `"Yes"` if the item is in bold on the test sheet, otherwise `"No"`. |

### Filling in an answer

Type it between the quotes on the `answer` line:

```json
"answer": "Squeeze with both legs to ask for more pace; soften the hands to allow the pony forward.",
```

Three rules that keep the file valid:

1. Keep the text on **one line**. For a line break inside an answer, write `\n` — e.g. `"Point one.\nPoint two."`
2. If the answer contains a double quote, escape it as `\"`.
3. Every `,` and `}` that is already there must stay exactly where it is.

You can edit the file straight on GitHub (open it and click the pencil). GitHub will underline the line in red if the JSON is broken, so you'll know before you commit. If you'd rather check first, paste the whole file into <https://jsonlint.com>.

## Publishing on GitHub Pages

This app lives as a subfolder of an existing Pages site — `NicolaSedgwick/nicolasedgwick` — so Pages is already switched on and there is nothing to configure. Drop the whole `pony-club-test-practice` folder into the root of that repository and it goes live at:

```
https://nicolasedgwick.github.io/nicolasedgwick/pony-club-test-practice/
```

(If a custom domain is set on that repo, swap the first part for the domain. Settings → Pages always shows the live address.)

### Uploading through the GitHub website

1. Go to <https://github.com/NicolaSedgwick/nicolasedgwick>.
2. **Add file → Upload files**.
3. Drag the whole `pony-club-test-practice` folder onto the page. GitHub keeps the folder structure, so `data/`, `css/` and `js/` land in the right places. Check the file list shows paths like `pony-club-test-practice/data/questions.json` before continuing.
4. Commit message: *Add Pony Club test practice app*. Commit straight to `main`.
5. Wait a minute or two for the build, then open the address above. A hard refresh (⌘⇧R) clears any cached older version.

Every commit to `main` republishes automatically — editing an answer on the GitHub website is enough to update the live app.

### Why the subfolder works without changes

Every path in the app is relative (`css/styles.css`, `data/questions.json`), so nothing assumes it is at the root of a site. Nothing in the folder starts with `_` and no file contains Jekyll template syntax, so GitHub's Jekyll build copies it through untouched — no `.nojekyll` file needed, which matters here because adding one at the repo root could affect the rest of the site.

## Running it locally

Because the app loads `data/questions.json` with `fetch`, double-clicking `index.html` will not work — browsers block file reads on `file://`. Serve the folder instead:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Read-aloud notes

Uses the browser's built-in Web Speech API — nothing is sent anywhere, and there is no API key or cost. Voice quality depends on the device: iOS and macOS Safari, Chrome, and Edge all have good British English voices. It needs a tap to start (a browser rule, not a bug), which is exactly what the loudspeaker button is.

### The male / female choice

The speech API does not tell a page whether a voice is male or female — there is no such field. What it does give is a list of the voices installed on that device, by name. So `js/app.js` holds two lists of the names British and American voices actually ship under (Daniel, Arthur, George… / Kate, Serena, Hazel…), plus a catch for Chrome's literally-named "Google UK English Male" and "Female", and maps them onto the two buttons.

That means:

- It **starts on a female voice** wherever the device has one, since most members are girls. Failing that, it uses whatever voice the device defaults to.
- On a device with recognised voices of both kinds, both buttons show, and tapping one reads a few words as a sample.
- Where only one kind is installed, the whole control hides itself rather than offering a choice that does nothing.
- An unrecognised voice name is left out of the choice, not guessed at. If you meet a device where the buttons don't appear but the voices are clearly there, send me the voice names and I'll add them to the lists.

The choice lasts for the visit only — there is no storage, so it starts from the device's default voice each time.

## Regenerating the data from the PDFs

If The Pony Club revises the test sheets, drop the new PDFs beside `tools/extract.py` and run it — it re-detects the headings, the item numbering and the bold items, and writes a fresh `questions.json`. It preserves any answers you have already written, matching on `id`.

```bash
pip install pdfplumber
python3 tools/extract.py CTestRidingRevised2025.pdf CTestCareRevised2025.pdf
```

## The single-file build

`pony-club-c-test-standalone.html` is the whole app — questions, styling and code — in one file. Handy for emailing to another branch, dropping on a memory stick, or opening straight from a phone's downloads with no internet. Rebuild it after editing answers:

```bash
python3 tools/bundle.py
```

## Contact

The footer carries `nikki@nicola-sedgwick.com` as a `mailto:` link, so anyone can report a wrong answer or suggest an improvement. To change it, edit the two places it appears in the `<footer>` block of `index.html` — the link target and the visible text — then rebuild the standalone file.

An in-app report button (a warning triangle on the answer side, posting to a Google Sheet) was built and then parked before launch. The Apps Script half of it sits in `tools/parked/report-endpoint.gs` in case it is ever wanted. Nothing in `tools/parked/` runs, and nothing in the app refers to it.

---

Questions are reproduced from The Pony Club C Standard Test Sheets (Revised 2025) for members' personal practice. Always check the current official test sheet.

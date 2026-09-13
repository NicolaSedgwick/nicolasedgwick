#!/usr/bin/env python3
"""RETIRED - kept as a reference, not a tool. Does not run. See RETIRED below.

Built the original 62 cards in data/questions.json from the two C Standard test
sheet PDFs (Revised 2025): section headings, numbered items including wrapped
lines and a)/b)/c) sub-parts, and which items are set in bold.

It is retired because it only ever understood the C sheets' typesetting, and
because questions.json has since grown hand-maintained content it would destroy.
The parsing approach is still worth reading before hand-entering a new sheet -
that is the only reason this file still exists.
"""

import json
import os
import re
import sys
import unicodedata
from datetime import date

import pdfplumber

BOLD_FONT = "CIDFont+F2"          # the bold face used in these sheets
BODY_SIZE = 10.0                  # item text size; smaller text is footer/legal
NOT_A_TOPIC = {"OBJECTIVES"}

# Topic names are derived from the sheet headings, never hand-maintained, so
# two rules live here rather than in the JSON:
#   MINOR         words str.title() would capitalise but shouldn't, so the
#                 filter reads "Management of Horses and Ponies".
#   TOPIC_ALIASES headings that differ between sheets but mean the same thing,
#                 folded onto one name so the topic filter doesn't show
#                 near-duplicates when "All tests" is selected.
MINOR = {"a", "an", "and", "at", "for", "in", "of", "on", "or", "the", "to", "with"}
TOPIC_ALIASES = {
    # C sheets head this "TRAINING PONIES"; C+ heads it "TRAINING PONIES AND
    # HORSES". Same subject, so both sit under the C+ (broader) name.
    "Training Ponies": "Training Ponies and Horses",
}
NUMBER = re.compile(r"^(\d+)\.$")
SUBITEM = re.compile(r"^[a-z]\)")
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "questions.json")


def topic_name(heading):
    """Title-case a sheet heading, then fold it onto its canonical name."""
    words = heading.title().split(" ")
    words = [w if i == 0 or w.lower().strip(",") not in MINOR else w.lower()
             for i, w in enumerate(words)]
    name = " ".join(words)
    return TOPIC_ALIASES.get(name, name)


def theme_of(path, first_page_text):
    name = os.path.basename(path).lower()
    if "riding" in name:
        return "Riding"
    if "care" in name:
        return "Care"
    return "Riding" if "Part 1" in first_page_text else "Care"


def lines_of(page):
    """Group words into visual lines, keeping font and position information."""
    buckets = {}
    for w in page.extract_words(extra_attrs=["fontname", "size"]):
        buckets.setdefault(round(w["top"] / 3), []).append(w)
    out = []
    for key in sorted(buckets):
        words = sorted(buckets[key], key=lambda w: w["x0"])
        out.append({
            "words": words,
            "text": " ".join(w["text"] for w in words).strip(),
            "x0": round(min(w["x0"] for w in words), 1),
            "size": round(max(w["size"] for w in words), 1),
        })
    return out


def parse(path):
    """Yield card dicts for one test sheet."""
    cards = []
    with pdfplumber.open(path) as pdf:
        first = pdf.pages[0].extract_text() or ""
        theme = theme_of(path, first)

        # The continuation indent sits one level in from the item number; measure
        # it rather than hard-coding, so a re-typeset PDF still parses.
        indents = [ln["x0"] for page in pdf.pages for ln in lines_of(page)
                   if ln["size"] >= BODY_SIZE and ln["x0"] > 45]
        indent = min(indents) if indents else 52.2

        topic, current = None, None
        for page in pdf.pages:
            for ln in lines_of(page):
                if ln["size"] < BODY_SIZE or not ln["text"]:
                    continue

                # Section heading: hard left, entirely bold, upper case
                if abs(ln["x0"] - 20.0) < 1 and all(w["fontname"] == BOLD_FONT for w in ln["words"]):
                    head = re.sub(r"\s*\(.*?\)\s*$", "", ln["text"]).strip()
                    if head.upper() == head and head not in NOT_A_TOPIC and not head.endswith(":"):
                        topic, current = topic_name(head), None
                    else:
                        current = None
                    continue

                match = NUMBER.match(ln["words"][0]["text"])
                if match and topic:
                    body = ln["words"][1:]      # the "12." token is never bold
                    current = {
                        "id": "%s%02d" % (theme[0].lower(), int(match.group(1))),
                        "theme": theme,
                        "topic": topic,
                        "number": int(match.group(1)),
                        "question": " ".join(w["text"] for w in body),
                        "answer": "",
                        "_bold": any(w["fontname"] == BOLD_FONT for w in body),
                    }
                    cards.append(current)
                elif current and abs(ln["x0"] - indent) < 1.5:
                    joiner = "\n" if SUBITEM.match(ln["text"]) else " "
                    current["question"] = current["question"].rstrip() + joiner + ln["text"]
                    current["_bold"] |= any(w["fontname"] == BOLD_FONT for w in ln["words"])
                else:
                    current = None
    return cards


RETIRED = """
tools/extract.py is retired and will not run.

WHY
  1. It cannot read anything but the two C Standard sheets. Run against the C+
     sheets it returns ZERO cards: it looks for section headings at x0 ~ 20.0 set
     in CIDFont+F2, and the C+ sheets head their sections at 36.0/41.5 in
     Arial-BoldMT, so `topic` is never set and no item is ever created. Bold
     detection, the continuation-indent measurement and the a)/a. sub-item
     pattern are all C-sheet-specific in the same way.
  2. It rewrites data/questions.json from only the PDFs it is given, so a run
     against the C sheets would delete all 67 hand-entered C+ cards.
  3. Its ids are <theme letter><item number>, which collide across sheets - C+
     Riding 1 is "r01", and so is C Riding 1.
  4. It has no concept of one card serving several tests, so a rebuild would
     recreate the 26 C+ items that were deliberately folded onto existing C
     cards as duplicates.

At stake if it ran anyway: 11 hand-written answers, 129 hand-set test_level
values, and the editorial merge decisions behind the C+ import.

INSTEAD
  Edit data/questions.json by hand, or write a one-off append script for the
  sheet in front of you (that is how the C+ sheets were added on 13 Sep 2026).
  Each syllabus arrives in its own format, so a general extractor is not worth
  building. Background: claude/architecture-decisions.md, "The C+ import".

If you are certain you want the code below, delete this guard deliberately -
and re-read the four points above first.
"""


def main(paths, level="C"):
    sys.exit(RETIRED)

    existing = {}
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as fh:
            for card in json.load(fh).get("cards", []):
                existing[card["id"]] = card

    cards = []
    for path in paths:
        for card in parse(path):
            question = unicodedata.normalize("NFC", card["question"])
            was = existing.get(card["id"], {})
            cards.append({
                "id": card["id"],
                "theme": card["theme"],
                "topic": card["topic"],
                "test_level": was.get("test_level") or [level],
                "number": card["number"],
                "question": re.sub(r"\s+([;,])", r"\1", question).strip(),
                "answer": was.get("answer", ""),
                "important": "Yes" if card.pop("_bold") else "No",
            })

    ids = [c["id"] for c in cards]
    if len(set(ids)) != len(ids):
        sys.exit("Duplicate ids found — check the theme detection: %s" % ids)

    data = {
        "meta": {
            "source": "The Pony Club C Standard Test Sheets, Revised 2025",
            "generated": date.today().isoformat(),
        },
        "cards": cards,
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    kept = sum(1 for c in cards if c["answer"])
    levels = sum(1 for c in cards if existing.get(c["id"], {}).get("test_level"))
    print("Wrote %d cards (%d important, %d answers and %d test levels preserved) to %s"
          % (len(cards), sum(c["important"] == "Yes" for c in cards), kept, levels,
             os.path.normpath(OUT)))


if __name__ == "__main__":
    args = sys.argv[1:]
    new_level = "C"
    while "--level" in args:
        i = args.index("--level")
        if i + 1 >= len(args):
            sys.exit("--level needs a value, e.g. --level D+")
        new_level = args[i + 1]
        del args[i:i + 2]
    if not args:
        sys.exit(__doc__)
    main(args, new_level)

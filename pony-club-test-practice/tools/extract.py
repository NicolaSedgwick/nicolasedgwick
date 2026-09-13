#!/usr/bin/env python3
"""Rebuild data/questions.json from The Pony Club C Standard test sheet PDFs.

    pip install pdfplumber
    python3 tools/extract.py CTestRidingRevised2025.pdf CTestCareRevised2025.pdf
    python3 tools/extract.py --level D+ DPlusTestRevised2025.pdf

Detects the section headings, the numbered items (including wrapped lines and
a)/b)/c) sub-parts) and which items are set in bold. Answers AND test_level
already present in data/questions.json are carried over, matched on `id` —
test_level is maintained by hand, so a rebuild must never flatten it. New cards
get --level (default "C").
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
NUMBER = re.compile(r"^(\d+)\.$")
SUBITEM = re.compile(r"^[a-z]\)")
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "questions.json")


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
                        topic, current = head.title(), None
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


def main(paths, level="C"):
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

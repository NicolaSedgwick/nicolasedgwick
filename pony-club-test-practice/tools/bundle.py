#!/usr/bin/env python3
"""Build a single-file version of the app (data, settings, CSS and JS inlined).

    python3 tools/bundle.py            -> pony-club-c-test-standalone.html   (full page)
    python3 tools/bundle.py --artifact -> preview.html (body content only, for Claude Artifacts)
"""
import json
import os
import re
import sys

root = os.path.join(os.path.dirname(__file__), "..")


def read(*parts):
    with open(os.path.join(root, *parts), encoding="utf-8") as fh:
        return fh.read()


html = read("index.html")
css = read("css", "styles.css")
app = read("js", "app.js")
data = json.loads(read("data", "questions.json"))

payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
inline = (
    "<script>window.PC_DATA=%s;</script>\n"
    "<style>\n%s\n</style>\n"
    "<script>\n%s\n</script>" % (payload, css, app)
)

STYLE_TAG = '<link rel="stylesheet" href="css/styles.css">'
SCRIPT_TAG = '<script src="js/app.js"></script>'

if "--artifact" in sys.argv:
    out = os.path.join(root, "preview.html")
    head = re.search(r"<head>(.*?)</head>", html, re.S).group(1).replace(STYLE_TAG, "")
    body = re.search(r"<body>(.*?)</body>", html, re.S).group(1)
    body = body.replace(SCRIPT_TAG, "")
    page = head.strip() + "\n" + body.strip() + "\n" + inline + "\n"
else:
    out = os.path.join(root, "pony-club-c-test-standalone.html")
    page = html.replace(STYLE_TAG, "").replace(SCRIPT_TAG, inline)

with open(out, "w", encoding="utf-8") as fh:
    fh.write(page)

print("Wrote %s (%.0f KB)" % (os.path.normpath(out), os.path.getsize(out) / 1024))

#!/usr/bin/env python3
"""Inventory of hard-coded Hebrew UI strings in src/ (excluding src/lib/locales/).

Usage: python3 i18n/extract_inventory.py > i18n/inventory.csv
Read-only: scans source files, changes nothing. One row per occurrence.
kind: string (quoted literal), template (`...` literal), jsx_text (JSX text node).
Comments are skipped. core_path = student-facing screen (not admin/teacher/dev).
"""
import csv, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
HEB = re.compile(r"[\u0590-\u05FF]")
EXTS = (".ts", ".tsx", ".js", ".jsx")


def screen_for(rel):
    parts = rel.split("/")
    name = os.path.splitext(parts[-1])[0]
    if parts[1] == "routes":
        if name == "__root":
            return "(root layout)"
        if name == "index":
            return "/"
        segs = [s for s in name.split(".") if s != "index"]
        return "/" + "/".join(segs)
    if parts[1] == "components":
        return "component:" + "/".join(parts[2:-1] + [name])
    return "lib:" + "/".join(parts[2:-1] + [name])


def core_path(rel, screen):
    s = screen
    if s.startswith("/admin") or s.startswith("/teacher") or s == "/beqa-spike":
        return "no"
    if "/admin/" in rel or rel.endswith("AdminShell.tsx"):
        return "no"
    if s.startswith("lib:") and any(k in rel for k in (
        "admin-", "pdf-report", "beqa-report", "beqa-docx", "import-export",
        "ai-agent.functions")):
        return "no"
    return "yes"


def scan(text):
    """Yield (line, kind, value) for Hebrew literals / JSX text, skipping comments."""
    i, n, line = 0, len(text), 1
    out = []
    jsx_buf, jsx_line = [], None

    def flush_jsx():
        nonlocal jsx_buf, jsx_line
        t = " ".join("".join(jsx_buf).split())
        if HEB.search(t):
            out.append((jsx_line, "jsx_text", t))
        jsx_buf, jsx_line = [], None

    while i < n:
        c = text[i]
        if c == "\n":
            line += 1
            if jsx_buf:
                jsx_buf.append(" ")
            i += 1
            continue
        if text.startswith("//", i) and not (i > 0 and text[i - 1] == ":"):
            flush_jsx()
            j = text.find("\n", i)
            i = n if j < 0 else j
            continue
        if text.startswith("/*", i) or text.startswith("{/*", i):
            flush_jsx()
            j = text.find("*/", i)
            j = n if j < 0 else j + 2
            line += text.count("\n", i, j)
            i = j
            continue
        prev = text[i - 1] if i > 0 else ""
        if c in "'\"" and (prev.isalpha() or HEB.match(prev or " ")):
            # quote inside a word (Hebrew abbreviation like סה"כ, or don't): text
            if jsx_line is not None:
                jsx_buf.append(c)
            i += 1
            continue
        if c in "'\"`":
            flush_jsx()
            q, start, sl = c, i + 1, line
            j = start
            while j < n and text[j] != q:
                if text[j] == "\\":
                    j += 1
                elif text[j] == "\n":
                    if q != "`":
                        break
                    line += 1
                j += 1
            if j < n and text[j] == "\n" and q != "`":
                # unterminated quote (stray apostrophe): not a string; resume at newline
                i = j
                continue
            val = text[start:j]
            if HEB.search(val):
                if q == "`" and "\n" in val:
                    # multi-line template (e.g. HTML report): one row per Hebrew line
                    for off, part in enumerate(val.split("\n")):
                        if HEB.search(part):
                            out.append((sl + off, "template", " ".join(part.split())))
                else:
                    out.append((sl, "template" if q == "`" else "string", " ".join(val.split())))
            i = j + 1
            continue
        if HEB.search(c):
            # Hebrew outside quotes => JSX text; collect until a tag/brace boundary
            if jsx_line is None:
                # include preceding text on the same segment
                k = i
                while k > 0 and text[k - 1] not in "<>{}\n'\"`":
                    k -= 1
                jsx_buf = [text[k:i]]
                jsx_line = line
            jsx_buf.append(c)
            i += 1
            continue
        if jsx_line is not None:
            if c in "<>{}":
                flush_jsx()
            else:
                jsx_buf.append(c)
        i += 1
    flush_jsx()
    return out


def main():
    rows = []
    for dp, dn, fn in os.walk(os.path.join(ROOT, "src")):
        dn.sort()
        for f in sorted(fn):
            if not f.endswith(EXTS):
                continue
            path = os.path.join(dp, f)
            rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
            if rel.startswith("src/lib/locales/"):
                continue
            text = open(path, encoding="utf-8").read()
            if not HEB.search(text):
                continue
            scr = screen_for(rel)
            for ln, kind, val in scan(text):
                rows.append((scr, f"{rel}:{ln}", kind, core_path(rel, scr), val))
    w = csv.writer(sys.stdout, lineterminator="\n")
    w.writerow(["id", "screen/route", "file:line", "kind", "core_path", "hebrew_source"])
    for idx, r in enumerate(rows, 1):
        w.writerow([f"he-{idx:04d}", *r])


if __name__ == "__main__":
    main()

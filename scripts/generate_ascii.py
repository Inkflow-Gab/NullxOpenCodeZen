#!/usr/bin/env python3
"""Compose the Nullx reaper ASCII art on an explicit character canvas.

    python3 scripts/generate_ascii.py [--preview]

Hand-drawn strokes are placed on a grid, so alignment is exact and the art stays
crisp at terminal sizes. Two sizes are emitted:

  * assets/mascot-large.txt  (<= 62 cols) for wide terminals
  * assets/mascot.txt        (<= 38 cols) for phones / narrow panes

Both are plain ASCII plus a few block glyphs, so they render in proot, Termux,
SSH, and CI logs without a font dependency.
"""

from __future__ import annotations

import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class Canvas:
    def __init__(self, width: int, height: int) -> None:
        self.width = width
        self.height = height
        self.grid = [[" "] * width for _ in range(height)]

    def put(self, x: int, y: int, text: str) -> None:
        if not 0 <= y < self.height:
            return
        for offset, char in enumerate(text):
            column = x + offset
            if 0 <= column < self.width and char != "\0":
                self.grid[y][column] = char

    def rows(self) -> list[str]:
        return ["".join(row).rstrip() for row in self.grid]

    def text(self) -> str:
        rows = self.rows()
        while rows and not rows[0]:
            rows.pop(0)
        while rows and not rows[-1]:
            rows.pop()
        # Strip the common left margin so the art is not needlessly indented.
        indent = min((len(r) - len(r.lstrip()) for r in rows if r), default=0)
        return "\n".join(row[indent:] if row else "" for row in rows) + "\n"


def large() -> str:
    c = Canvas(62, 30)
    hood = [
        (14, 0, "_,,--~~''''''~~--,,_"),
        (10, 1, ",-~'"), (30, 1, "`~-,"),
        (8, 2, ",'"), (34, 2, "`."),
        (7, 3, "/"), (36, 3, "\\"),
        (6, 4, "|"), (17, 4, "_,,--------,,_"), (37, 4, "|"),
        (6, 5, "|"), (14, 5, ",-'"), (24, 5, "'-,"), (37, 5, "|"),
        (6, 6, "|"), (13, 6, "/"), (18, 6, "/\\    /\\"), (30, 6, "\\"), (37, 6, "|"),
        (6, 7, "|"), (12, 7, "|"), (17, 7, "/  \\  /  \\"), (31, 7, "|"), (37, 7, "|"),
        (6, 8, "|"), (12, 8, "|"), (18, 8, "\\  \\/  /"), (31, 8, "|"), (37, 8, "|"),
        (6, 9, "|"), (12, 9, "|"), (18, 9, "\u2597\u2584\u2584\u2596 \u2597\u2584\u2584\u2596"), (31, 9, "|"), (37, 9, "|"),
        (6, 10, "|"), (12, 10, "|"), (19, 10, "\u259d\u2580\u2580\u2598 \u259d\u2580\u2580\u2598"), (31, 10, "|"), (37, 10, "|"),
        (6, 11, "|"), (12, 11, "\\"), (23, 11, "\u25bd"), (31, 11, "/"), (37, 11, "|"),
        (6, 12, "|"), (13, 12, "\\"), (19, 12, "'----'"), (30, 12, "/"), (37, 12, "|"),
        (6, 13, "|"), (14, 13, "',"), (27, 13, ",'"), (37, 13, "|"),
        (7, 14, "\\"), (16, 14, "'-,,______,,-'"), (36, 14, "/"),
        (8, 15, "',"), (34, 15, ",'"),
        (9, 16, "'-,,_"), (28, 16, "_,,-'"),
    ]
    for x, y, text in hood:
        c.put(x, y, text)

    # Cloak, split by the cyan centre seam.
    cloak = [
        (7, 17, ",-'"), (28, 17, "'-,"),
        (5, 18, ",'"), (12, 18, "/|"), (22, 18, "||"), (28, 18, "|\\"), (34, 18, "',"),
        (4, 19, "/"), (11, 19, "/ |"), (22, 19, "||"), (28, 19, "| \\"), (35, 19, "\\"),
        (3, 20, "|"), (10, 20, "|  |"), (22, 20, "||"), (28, 20, "|  |"), (36, 20, "|"),
        (3, 21, "|"), (10, 21, "|  |"), (22, 21, "||"), (28, 21, "|  |"), (36, 21, "|"),
        (3, 22, "|"), (10, 22, "|  |"), (22, 22, "||"), (28, 22, "|  |"), (36, 22, "|"),
        (4, 23, "\\"), (11, 23, "\\ |"), (22, 23, "||"), (28, 23, "| /"), (35, 23, "/"),
        (5, 24, "\\"), (12, 24, "\\|"), (22, 24, "||"), (28, 24, "|/"), (34, 24, "/"),
        (6, 25, "',"), (13, 25, "\\"), (22, 25, "||"), (28, 25, "/"), (32, 25, ",'"),
        (8, 26, "'-,_"), (14, 26, "\\"), (22, 26, "||"), (27, 26, "/"), (30, 26, "_,,-'"),
        (11, 27, "`'-,,_"), (22, 27, "||"), (25, 27, "_,,-'`"),
        (17, 28, "`'~~~~~~'`"),
    ]
    for x, y, text in cloak:
        c.put(x, y, text)

    # Scythe: a crescent blade sweeping right, on a straight shaft.
    scythe = [
        (47, 0, "__"),
        (46, 1, ",'\\"), (49, 1, "`-,_"),
        (45, 2, "/"), (53, 2, "`-,"),
        (45, 3, "|"), (56, 3, "\\"),
        (45, 4, "\\"), (58, 4, "|"),
        (46, 5, "\\"), (58, 5, "|"),
        (47, 6, "'\\"), (57, 6, "/"),
        (48, 7, "'-,__"), (54, 7, ",-'"),
        (50, 8, "\\\\"), (52, 8, "~~'"),
    ]
    for x, y, text in scythe:
        c.put(x, y, text)
    for y in range(9, 29):
        c.put(50, y, "||")
    return c.text()


def compact() -> str:
    c = Canvas(38, 20)
    strokes = [
        (5, 0, "_,--~''''~--,_"),
        (2, 1, ",-'"), (17, 1, "'-,"),
        (1, 2, "/"), (8, 2, "_,----,_"), (20, 2, "\\"),
        (0, 3, "|"), (6, 3, ",'"), (10, 3, "/\\  /\\"), (17, 3, "',"), (21, 3, "|"),
        (0, 4, "|"), (5, 4, "|"), (9, 4, "/  \\/  \\"), (18, 4, "|"), (21, 4, "|"),
        (0, 5, "|"), (5, 5, "|"), (10, 5, "▗▄▖ ▗▄▖"), (18, 5, "|"), (21, 5, "|"),
        (0, 6, "|"), (5, 6, "|"), (10, 6, "▝▀▘ ▝▀▘"), (18, 6, "|"), (21, 6, "|"),
        (0, 7, "|"), (5, 7, "\\"), (12, 7, "\u25bd"), (18, 7, "/"), (21, 7, "|"),
        (0, 8, "|"), (6, 8, "\\"), (10, 8, "'--'"), (17, 8, "/"), (21, 8, "|"),
        (1, 9, "\\"), (7, 9, "'-,,__,,-'"), (20, 9, "/"),
        (2, 10, "',"), (18, 10, ",'"),
        (1, 11, ",-'"), (7, 11, "/|"), (13, 11, "||"), (16, 11, "|\\"), (20, 11, "'-,"),
        (0, 12, "|"), (6, 12, "| |"), (13, 12, "||"), (16, 12, "| |"), (21, 12, "|"),
        (0, 13, "|"), (6, 13, "| |"), (13, 13, "||"), (16, 13, "| |"), (21, 13, "|"),
        (1, 14, "\\"), (7, 14, "\\|"), (13, 14, "||"), (16, 14, "|/"), (20, 14, "/"),
        (2, 15, "',"), (8, 15, "\\"), (13, 15, "||"), (16, 15, "/"), (19, 15, ",'"),
        (4, 16, "'-,_"), (9, 16, "\\"), (13, 16, "||"), (15, 16, "/"), (17, 16, "_,,-'"),
        (7, 17, "`'-,,_"), (13, 17, "||"), (15, 17, "_,,-'`"),
        (11, 18, "`'~~'`"),
        # Scythe on the right: crescent blade plus shaft.
        (27, 0, "__"),
        (26, 1, ",'\\"), (29, 1, "`-,"),
        (25, 2, "/"), (32, 2, "`,"),
        (25, 3, "\\"), (34, 3, "|"),
        (26, 4, "\\"), (33, 4, "/"),
        (27, 5, "'-,"), (30, 5, ",-'"),
        (28, 6, "\\\\"), (30, 6, "~'"),
    ]
    for x, y, text in strokes:
        c.put(x, y, text)
    for y in range(7, 19):
        c.put(28, y, "||")
    return c.text()


def wordmark() -> str:
    art = (
        "  _   _ _   _ _     _     __  __\n"
        " | \\ | | | | | |   | |    \\ \\/ /\n"
        " |  \\| | | | | |   | |     \\  / \n"
        " | |\\  | |_| | |___| |___  /  \\ \n"
        " |_| \\_|\\___/|_____|_____|/_/\\_\\\n"
    )
    return "\n".join(line.rstrip() for line in art.splitlines()) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview", action="store_true")
    args = parser.parse_args()

    outputs = {
        "mascot-large.txt": large(),
        "mascot.txt": compact(),
        "wordmark.txt": wordmark(),
    }
    limits = {"mascot-large.txt": 62, "mascot.txt": 38, "wordmark.txt": 40}
    for name, text in outputs.items():
        widest = max(len(line) for line in text.splitlines())
        assert widest <= limits[name], f"{name} is {widest} cols, limit {limits[name]}"
        if args.preview:
            print(f"--- {name} ({widest} cols) ---")
            print(text)
        else:
            (ROOT / "assets" / name).write_text(text, encoding="utf-8")
            print(f"{name}: {len(text.splitlines())} rows, {widest} cols")


if __name__ == "__main__":
    main()

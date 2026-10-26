"""Copy the SS-496 hero sprites into the site.

    python tools/import_sprites.py [source_dir]

Source (default C:/Projects/Web/_sprites_ss496) holds meta.json and the sprite
sheets it names. They are copied into img/scene/, where js/scene.js picks them
up; without img/scene/meta.json the scene runs on placeholder shapes.
Each sheet is re-saved as webp unless it already is one.
"""
import json
import shutil
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("C:/Projects/Web/_sprites_ss496")
DST = ROOT / "img" / "scene"
FILE_KEYS = ("file", "image", "src")


def main():
    meta = json.loads((SRC / "meta.json").read_text(encoding="utf-8"))
    DST.mkdir(parents=True, exist_ok=True)
    for old in DST.iterdir():
        old.unlink()
    for name, entry in meta.items():
        if not isinstance(entry, dict):
            continue
        key = next((k for k in FILE_KEYS if k in entry), None)
        if not key:
            continue
        src = SRC / entry[key]
        out = Path(entry[key]).with_suffix(".webp").name
        if src.suffix.lower() == ".webp":
            shutil.copyfile(src, DST / out)
        else:
            Image.open(src).save(DST / out, "WEBP", quality=88, method=6)
        entry[key] = out
        print(f"{name:12} {out:28} {(DST / out).stat().st_size // 1024} KB")
    (DST / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()

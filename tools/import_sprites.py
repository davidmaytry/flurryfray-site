"""Copy the SS-496 hero sprites into the site.

    python tools/import_sprites.py [source_dir]

Source (default C:/Projects/Web/_sprites_ss496) holds meta.json and the sprite
sheets it names, as rendered by tools/site_sprites.gd in the game repo. The
sheets are copied into img/scene/ and the meta is translated into the shape
js/scene.js reads (see the comment at its top): pixel points become 0..1 of a
frame, "foot" becomes "anchor", "faces" becomes "facing", and so on. The
source files are never changed. Without img/scene/meta.json the scene runs on
placeholder shapes. SS-497: "layouts" brings the game-snow backdrops (wide and
tall) with each kid's feet and sprite scale in stage world units.
"""
import json
import shutil
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("C:/Projects/Web/_sprites_ss496")
DST = ROOT / "img" / "scene"
HEROES = ("thrower", "target_hit", "target_fall")
PROPS = ("snowball", "splash", "shadow")


def first(d, *keys, default=None):
    for k in keys:
        if k in d:
            return d[k]
    return default


def norm(pt, fw, fh):
    return [round(pt[0] / fw, 5), round(pt[1] / fh, 5)]


def copy_sheet(entry):
    name = first(entry, "file", "image", "src")
    src = SRC / name
    out = Path(name).with_suffix(".webp").name
    if src.suffix.lower() == ".webp":
        shutil.copyfile(src, DST / out)
    else:
        Image.open(src).save(DST / out, "WEBP", quality=88, method=6)
    return out, Image.open(DST / out).size


def frame_size(entry, sheet_size):
    size = entry.get("size")
    fw = first(entry, "fw", "frame_w", default=size[0] if size else sheet_size[0])
    fh = first(entry, "fh", "frame_h", default=size[1] if size else sheet_size[1])
    return fw, fh


def visible_top(path, fw, fh, foot_y):
    """How far above the feet the first frame reaches, in px."""
    alpha = Image.open(path).crop((0, 0, fw, fh)).getchannel("A")
    box = alpha.point(lambda a: 255 if a > 20 else 0).getbbox()
    return foot_y - box[1]


def main():
    src_meta = json.loads((SRC / "meta.json").read_text(encoding="utf-8"))
    DST.mkdir(parents=True, exist_ok=True)
    for old in DST.iterdir():
        old.unlink()

    out = {}
    # The kids were rendered at one px-per-metre, so they share one scale:
    # "height" is set so that the thrower's height maps to the stage's charH.
    ref = None
    for name in HEROES:
        e = src_meta[name]
        file, sheet = copy_sheet(e)
        fw, fh = frame_size(e, sheet)
        foot = first(e, "foot", "anchor_px")
        if ref is None:
            ref = visible_top(DST / file, fw, fh, foot[1])
        d = {
            "file": file,
            "frames": e.get("frames", 1),
            "cols": max(1, sheet[0] // fw),
            "fw": fw, "fh": fh,
            "anchor": norm(foot, fw, fh),
            "facing": first(e, "facing", "faces"),
            "height": round(ref / fh, 5),
        }
        if "hand_at_release" in e:
            d["hand"] = norm(e["hand_at_release"], fw, fh)
        if "release_frame" in e:
            d["release"] = e["release_frame"]
        if "face" in e:
            d["face"] = norm(e["face"], fw, fh)
        if "contact_frame" in e:
            d["contact"] = e["contact_frame"]
        out[name] = d

    for name in PROPS:
        e = src_meta.get(name)
        if not e:
            continue
        file, sheet = copy_sheet(e)
        fw, fh = frame_size(e, sheet)
        frames = e.get("frames", 1)
        centre = e.get("centre", [fw / 2, fh / 2])
        out[name] = {
            "file": file,
            "frames": frames,
            "cols": max(1, sheet[0] // fw),
            "fw": fw, "fh": fh,
            "anchor": norm(centre, fw, fh),
            "scale_with_heroes": True,
        }
        if "held_scale" in e:  # the ball in the hand is drawn smaller than in flight
            out[name]["held_scale"] = e["held_scale"]

    # SS-497: game-snow backdrops for the two stage shapes. Feet and the
    # sprite scale of each kid come with them, in the stage's world units.
    layouts = src_meta.get("layouts", {})
    if layouts:
        out["layouts"] = {}
        for name, lay in layouts.items():
            shutil.copyfile(SRC / lay["image"], DST / lay["image"])
            out["layouts"][name] = {
                "image": lay["image"],
                "rect": lay["image_rect"],
                "W": lay["world"][0], "H": lay["world"][1],
                "thrower": {"x": lay["thrower"]["foot"][0], "y": lay["thrower"]["foot"][1],
                            "scale": lay["thrower"]["sprite_scale"]},
                "target": {"x": lay["target"]["foot"][0], "y": lay["target"]["foot"][1],
                           "scale": lay["target"]["sprite_scale"]},
            }

    (DST / "meta.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
    for name, d in out.items():
        if name == "layouts":
            for lname, lay in d.items():
                kb = (DST / lay["image"]).stat().st_size // 1024
                print(f"{lname:12} {lay['image']:20} backdrop  {kb} KB")
            continue
        kb = (DST / d["file"]).stat().st_size // 1024
        print(f"{name:12} {d['file']:20} {d['frames']:3} fr  {kb} KB")


if __name__ == "__main__":
    main()

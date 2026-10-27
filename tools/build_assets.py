"""Copy and optimise the site's images and clips from the game's Steam material.

Sources are only read, never changed:
  C:/Projects/Godot/Snowfolk/_context/steam/description/  (clips, screenshots)
  D:/Important/Games/FlurryFray/Steam/Result/png/         (owner's Steam art)

    python tools/build_assets.py

Needs Pillow (with webp) and ffmpeg on PATH. Rerun after the Steam art changes.
"""
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DESC = Path("C:/Projects/Godot/Snowfolk/_context/steam/description")
STEAM = Path("D:/Important/Games/FlurryFray/Steam/Result/png")

IMG = ROOT / "img"
VID = ROOT / "video"

# Feature loops (and the big warming loop). Order does not matter here.
# SS-523: the page now shows video/warming_dusk.* (shot separately at dusk);
# "warming" here is the old daylight loop and is no longer on the page.
CLIPS = ["warming", "volley", "fire", "snowman", "tree", "loot", "split"]
# Gallery, in display order.
SHOTS = ["cozy_a1", "dusk_fight_a1", "dusk_tree_a1", "fight_a1",
         "build_a1", "split_a1", "field_3_a1", "field_2_a1"]


def webp(im, path, width=None, q=82):
    im = im.copy()
    if width and im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "WEBP", quality=q, method=6)


def main():
    hero = Image.open(STEAM / "library_hero_3840x1240.png").convert("RGB")
    webp(hero, IMG / "hero-2400.webp", 2400, 80)
    webp(hero, IMG / "hero-1280.webp", 1280, 80)
    # Phones get a taller crop around the kids instead of a thin strip.
    w, h = hero.size
    cw = h
    left = round(w * 0.45) - cw // 2
    webp(hero.crop((left, 0, left + cw, h)), IMG / "hero-mobile.webp", 900, 80)

    logo = Image.open(STEAM / "library_logo.png").convert("RGBA")
    webp(logo, IMG / "logo.webp", 900, 88)

    # Open Graph / Twitter card: 1200x630 from the main capsule.
    cap = Image.open(STEAM / "main_capsule_1232x706.png").convert("RGB")
    cap = cap.resize((1200, round(cap.height * 1200 / cap.width)), Image.LANCZOS)
    top = (cap.height - 630) // 2
    cap.crop((0, top, 1200, top + 630)).save(IMG / "og.jpg", quality=86, optimize=True)

    icon = Image.open(STEAM / "shortcut_icon_512x512.png").convert("RGBA")
    icon.resize((180, 180), Image.LANCZOS).save(IMG / "apple-touch-icon.png", optimize=True)
    icon.resize((192, 192), Image.LANCZOS).save(IMG / "icon-192.png", optimize=True)
    icon.save(ROOT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])

    for name in SHOTS:
        im = Image.open(DESC / "screenshots" / f"{name}.png").convert("RGB")
        webp(im, IMG / "shots" / f"{name}.webp", 1920, 84)
        webp(im, IMG / "shots" / f"{name}-640.webp", 640, 78)

    VID.mkdir(exist_ok=True)
    for name in CLIPS:
        src = DESC / "media" / f"{name}.mp4"
        # Same picture, no audio track, moov atom first so it starts at once.
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-c", "copy",
                        "-an", "-movflags", "+faststart", str(VID / f"{name}.mp4")],
                       check=True)
        still = Image.open(DESC / "media" / f"{name}.png").convert("RGB")
        webp(still, VID / f"{name}.webp", 1170, 76)

    print("done")


if __name__ == "__main__":
    main()

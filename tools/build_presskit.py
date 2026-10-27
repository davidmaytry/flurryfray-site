"""Build presskit.zip in the site root.

    python tools/build_presskit.py

Studio name, website and contact come from js/config.js (the one place they
live), so after changing them there, rerun this script. Sources are only read.
"""
import io
import re
import zipfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DESC = Path("C:/Projects/Godot/Snowfolk/_context/steam/description")
STEAM = Path("D:/Important/Games/FlurryFray/Steam/Result/png")

FILES = {
    "logo/flurry_fray_logo.png": STEAM / "library_logo.png",
    "logo/flurry_fray_icon_512.png": STEAM / "shortcut_icon_512x512.png",
    "capsules/header_capsule_920x430.png": STEAM / "header_capsule_920x430.png",
    "capsules/main_capsule_1232x706.png": STEAM / "main_capsule_1232x706.png",
    "capsules/library_capsule_600x900.png": STEAM / "library_capsule_600x900.png",
    "capsules/vertical_capsule_748x896.png": STEAM / "vertical_capsule_748x896.png",
}
# SS-532: re-shot with snowflakes tinted by the scene light (SS-507).
SHOTS = ["cozy_a1_v2", "dusk_fight_a1_v2", "dusk_tree_a1_v2", "fight_a1_v2", "build_a1_v2", "split_a1_v2"]


def config():
    text = (ROOT / "js" / "config.js").read_text(encoding="utf-8")
    get = lambda key: re.search(key + r':\s*"([^"]*)"', text).group(1)
    app = re.search(r"steamAppId:\s*(\d+)", text).group(1)
    return get("studio"), get("studioUrl"), get("email"), app


def factsheet(studio, url, email, app):
    short = (DESC / "short_description.txt").read_text(encoding="utf-8").strip()
    return f"""FLURRY FRAY - press fact sheet

{short}

Two teams. Two campfires. One field of fresh snow. Scoop snow, pack a snowball,
throw: every hit knocks warmth out of a kid or heat out of a campfire. Roll a
snowman with a teammate, thaw loot out of the ice, decorate your team's
Christmas tree. The snow is the battlefield, and it keeps falling: dig
trenches, pile up walls, plough through drifts.

Cozy, silly, physical - not a survival game. No hunger, no crafting, no grind.

Developer:   {studio}
Website:     https://flurryfray.davidmaytry.com/  ({url})
Steam:       https://store.steampowered.com/app/{app}/
Platform:    PC (Steam), Steam Deck
Engine:      Godot
Players:     2-4, made for 2v2
Modes:       local splitscreen, online (IP / LAN), solo against bots
Controls:    gamepad first, plays fully without a mouse
Release:     TBA
Contact:     {email}

Contents
  logo/        transparent logo, app icon
  capsules/    Steam capsule art
  key_art/     key art without text, 3840x1240
  screenshots/ 1920x1080 in-game screenshots

You may use these files to write about, stream or review Flurry Fray.
"""


def main():
    studio, url, email, app = config()
    out = ROOT / "presskit.zip"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("flurry_fray_presskit/fact_sheet.txt",
                   factsheet(studio, url, email, app).replace("\n", "\r\n"))
        for arc, src in FILES.items():
            z.write(src, "flurry_fray_presskit/" + arc)
        buf = io.BytesIO()
        Image.open(STEAM / "library_hero_3840x1240.png").convert("RGB").save(
            buf, "JPEG", quality=90, optimize=True)
        z.writestr("flurry_fray_presskit/key_art/flurry_fray_key_art_3840x1240.jpg", buf.getvalue())
        for i, name in enumerate(SHOTS, 1):
            z.write(DESC / "screenshots" / f"{name}.png",
                    f"flurry_fray_presskit/screenshots/flurry_fray_{i:02d}.png")
    mb = out.stat().st_size / 1e6
    # Keep the size on the download button honest.
    page = ROOT / "index.html"
    html = page.read_text(encoding="utf-8")
    html = re.sub(r"(<span data-zip-size>)[^<]*(</span>)", rf"\g<1>{mb:.0f} MB\g<2>", html)
    page.write_text(html, encoding="utf-8")
    print(out, round(mb, 1), "MB")


if __name__ == "__main__":
    main()

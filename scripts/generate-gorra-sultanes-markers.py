"""Marcadores MindAR para gorra Sultanes (solo modo gorra)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
MIND = ROOT / "public" / "assets" / "markers" / "mind"
SRC = MIND / "sultanes-monterrey.jpg"
SIZE = 640


def main() -> None:
    logo = Image.open(SRC).convert("RGB")
    # full
    logo.resize((SIZE, SIZE), Image.Resampling.LANCZOS).save(
        MIND / "gorra-sultanes-logo.jpg", quality=93
    )

    # tight zoom on monogram
    w, h = logo.size
    m = int(min(w, h) * 0.12)
    tight = logo.crop((m, m, w - m, h - m)).resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    tight.save(MIND / "gorra-sultanes-tight.jpg", quality=93)

    # mid crop
    m2 = int(min(w, h) * 0.06)
    mid = logo.crop((m2, m2, w - m2, h - m2)).resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    mid.save(MIND / "gorra-sultanes-mid.jpg", quality=93)

    # clean: logo with soft vignette (más contraste para MindAR)
    clean = ImageEnhance.Contrast(logo).enhance(1.25)
    clean = clean.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    clean.save(MIND / "gorra-sultanes-clean.jpg", quality=93)

    # panel tipo gorra: logo blanco sobre corona navy texturizada
    panel = Image.new("RGB", (SIZE, SIZE), (12, 28, 48))
    draw = ImageDraw.Draw(panel)
    # fake fabric grain
    noise = Image.effect_noise((SIZE, SIZE), 12).convert("L")
    panel = Image.blend(panel, Image.merge("RGB", (noise, noise, noise)), 0.08)
    draw = ImageDraw.Draw(panel)
    # brim hint
    draw.ellipse((-40, SIZE - 160, SIZE + 40, SIZE + 120), fill=(8, 18, 32))

    # extract white logo from navy bg via threshold
    gray = logo.convert("L")
    # white parts of logo
    mask = gray.point(lambda p: 255 if p > 160 else 0)
    white_logo = Image.new("RGBA", logo.size, (0, 0, 0, 0))
    white = Image.new("RGBA", logo.size, (245, 248, 255, 255))
    white_logo.paste(white, mask=mask)
    # scale logo onto panel
    max_side = int(SIZE * 0.62)
    white_logo.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    lx = (SIZE - white_logo.width) // 2
    ly = int(SIZE * 0.22)
    canvas = panel.convert("RGBA")
    canvas.alpha_composite(white_logo, (lx, ly))
    canvas.convert("RGB").save(MIND / "gorra-sultanes-cap.jpg", quality=93)

    # high-contrast invert-ish: ensure MT silhouette pops
    bold = ImageOps.autocontrast(logo)
    bold = ImageEnhance.Sharpness(bold).enhance(1.4)
    bold.resize((SIZE, SIZE), Image.Resampling.LANCZOS).save(
        MIND / "gorra-sultanes-bold.jpg", quality=93
    )

    print("OK gorra-sultanes: logo, tight, mid, clean, cap, bold")


if __name__ == "__main__":
    main()

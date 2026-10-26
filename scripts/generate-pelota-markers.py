"""Genera marcadores MindAR de pelotas (solo apartado pelota)."""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
MIND = ROOT / "public" / "assets" / "markers" / "mind"
OUT = MIND
SIZE = 512


def load_rgb(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def soft_ball_bg() -> Image.Image:
    """Fondo claro con viñeta suave (estilo foto de producto)."""
    img = Image.new("RGB", (SIZE, SIZE), (232, 234, 236))
    draw = ImageDraw.Draw(img)
    cx = cy = SIZE // 2
    for r in range(SIZE // 2, 0, -2):
        t = r / (SIZE / 2)
        g = int(220 + 18 * t)
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(g, g + 1, g + 2))
    return img


def draw_stitches(draw: ImageDraw.ImageDraw, cx: int, cy: int, radius: int) -> None:
    """Costuras tipo figura 8 (beige)."""
    color = (196, 160, 120)
    for sign in (-1, 1):
        pts = []
        for i in range(0, 101):
            a = math.pi * (i / 100.0) - math.pi / 2
            # elipse lateral inclinada
            x = cx + sign * int(radius * 0.55 * math.cos(a))
            y = cy + int(radius * 0.92 * math.sin(a))
            # curva hacia el ecuador
            x = int(x - sign * 28 * math.sin(a) ** 2)
            pts.append((x, y))
        if len(pts) > 1:
            draw.line(pts, fill=color, width=3)
            # puntos de costura
            for i in range(0, len(pts), 6):
                px, py = pts[i]
                draw.ellipse((px - 2, py - 2, px + 2, py + 2), fill=(170, 130, 90))


def paste_logo_on_ball(logo: Image.Image, logo_scale: float = 0.42) -> Image.Image:
    bg = soft_ball_bg()
    draw = ImageDraw.Draw(bg)
    cx = cy = SIZE // 2
    radius = 210
    # sombra
    shadow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.ellipse((cx - radius + 8, cy - radius + 18, cx + radius + 8, cy + radius + 22), fill=(0, 0, 0, 45))
    shadow = shadow.filter(ImageFilter.GaussianBlur(10))
    bg = Image.alpha_composite(bg.convert("RGBA"), shadow).convert("RGB")
    draw = ImageDraw.Draw(bg)

    # pelota blanca
    for i in range(radius, 0, -1):
        shade = 255 - int(18 * ((radius - i) / radius) ** 1.4)
        draw.ellipse((cx - i, cy - i, cx + i, cy + i), fill=(shade, shade, shade - 1 if shade > 1 else shade))
    # highlight
    draw.ellipse((cx - 90, cy - 130, cx + 40, cy - 40), fill=(255, 255, 255))

    draw_stitches(draw, cx, cy, radius)

    # logo centrado
    lw = int(SIZE * logo_scale)
    logo_r = logo.copy()
    logo_r.thumbnail((lw, lw), Image.Resampling.LANCZOS)
    # si es casi opaco sin alpha útil, forzar fondo transparente por umbral claro
    if logo_r.mode != "RGBA":
        logo_r = logo_r.convert("RGBA")
    # realce contraste ligero
    logo_r = ImageEnhance.Contrast(logo_r).enhance(1.15)
    lx = cx - logo_r.width // 2
    ly = cy - logo_r.height // 2
    canvas = bg.convert("RGBA")
    canvas.alpha_composite(logo_r, (lx, ly))
    return canvas.convert("RGB")


def crop_tight(src: Image.Image, zoom: float = 1.35) -> Image.Image:
    w, h = src.size
    nw, nh = int(w / zoom), int(h / zoom)
    left = (w - nw) // 2
    top = (h - nh) // 2 - int(h * 0.02)
    cropped = src.crop((left, max(0, top), left + nw, max(0, top) + nh))
    return cropped.resize((SIZE, SIZE), Image.Resampling.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    sultanes = load_rgb(MIND / "pelota-sultanes.jpg").convert("RGB")

    # Variantes Sultanes (mismo id en mind-targets): foto + tight + logo oficial en pelota
    crop_tight(sultanes, 1.45).save(OUT / "pelota-sultanes-tight.jpg", quality=92)
    crop_tight(sultanes, 1.2).save(OUT / "pelota-sultanes-mid.jpg", quality=92)
    logo_sult = load_rgb(MIND / "sultanes-monterrey.jpg")
    paste_logo_on_ball(logo_sult, 0.48).save(OUT / "pelota-sultanes-logo.jpg", quality=92)

    teams = [
        ("pelota-naranjeros", "naranjeros-hermosillo.png", 0.44),
        ("pelota-tomateros", "tomateros-culiacan.png", 0.46),
        ("pelota-charros", "charros-jalisco.jpg", 0.48),
        ("pelota-caneros", "caneros-mochis.png", 0.44),
        ("pelota-yaquis", "yaquis-obregon.png", 0.44),
        ("pelota-aguilas", "aguilas-mexicali.png", 0.46),
        ("pelota-venados", "venados-mazatlan.png", 0.40),
        ("pelota-guasave", "algodoneros-guasave.png", 0.42),
        ("pelota-jaguares", "jaguares-nayarit.png", 0.46),
    ]

    for out_name, logo_file, scale in teams:
        logo_path = MIND / logo_file
        if not logo_path.exists():
            print(f"SKIP {out_name}: falta {logo_file}")
            continue
        logo = load_rgb(logo_path)
        paste_logo_on_ball(logo, scale).save(OUT / f"{out_name}.jpg", quality=92)
        print(f"OK {out_name}.jpg")

    print("Listo: variantes Sultanes + pelotas LMP/LMB comunes")


if __name__ == "__main__":
    main()

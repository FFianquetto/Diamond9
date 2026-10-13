"""Regenera los clips de la galería con la foto completa (sin recorte ni texto)."""
from pathlib import Path

import imageio.v2 as imageio
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[1] / "public" / "assets"
out_dir = root / "videos"
out_dir.mkdir(parents=True, exist_ok=True)

clips = [
    {
        "file": "jonron-historia.mp4",
        "images": [
            "galeria/imagenes/jugadores/baberuth.jpg",
            "galeria/imagenes/jugadores/hankaaron.jpg",
            "galeria/imagenes/jugadores/williemays.jpg",
        ],
    },
    {
        "file": "leyendas-mexicanas.mp4",
        "images": [
            "galeria/imagenes/jugadores/fernandovalenzuela.jpg",
            "galeria/imagenes/jugadores/hectorespino.jpg",
            "galeria/imagenes/jugadores/betoavila.jpg",
        ],
    },
    {
        "file": "escudos-lnm.mp4",
        "images": [
            "galeria/imagenes/equipos/bucaneros-cabos.jpg",
            "galeria/imagenes/equipos/marineros-ensenada.png",
            "galeria/imagenes/equipos/tiburones-penasco.jpg",
        ],
    },
    {
        "file": "estrellas-mlb.mp4",
        "images": [
            "galeria/imagenes/jugadores/othani.jpg",
            "galeria/imagenes/jugadores/derekjeter.jpg",
            "galeria/imagenes/equipos/dodgers.jpg",
        ],
    },
]

W, H = 1280, 720
FPS = 12
# 3 fotos × (40 + 8) cuadros / 12 fps = 12 s
HOLD = 40
FADE = 8
BG = (8, 12, 18, 255)


def fit_contain(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    scale = min(W / img.width, H / img.height)
    nw = max(1, int(round(img.width * scale)))
    nh = max(1, int(round(img.height * scale)))
    img = img.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (W, H), BG)
    canvas.paste(img, ((W - nw) // 2, (H - nh) // 2), img)
    return canvas.convert("RGB")


for clip in clips:
    plates = []
    for rel in clip["images"]:
        path = root / rel
        if not path.exists():
            raise SystemExit(f"Falta la imagen {path}")
        plates.append(fit_contain(Image.open(path)))

    frames: list[np.ndarray] = []
    for index, plate in enumerate(plates):
        frames.extend(np.asarray(plate) for _ in range(HOLD))
        nxt = plates[(index + 1) % len(plates)]
        for step in range(1, FADE + 1):
            mixed = Image.blend(plate, nxt, step / (FADE + 1))
            frames.append(np.asarray(mixed))

    out = out_dir / clip["file"]
    imageio.mimsave(
        out,
        frames,
        fps=FPS,
        codec="libx264",
        quality=8,
        pixelformat="yuv420p",
        macro_block_size=1,
    )
    print("wrote", out.name, "frames", len(frames), "bytes", out.stat().st_size)

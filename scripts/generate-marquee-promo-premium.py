from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ICON = ROOT / "apps" / "extension" / "public" / "icons" / "icon_128.png"
GITHUB_SHOT = ROOT / "docs" / "screenshots" / "github.png"
OUTPUT = (
    Path(r"C:\Users\marco\.cursor\projects\d-Coding-Workspace-My-Workspace-CSSHub\assets")
    / "chrome-store-promo-exact"
    / "marquee-v2"
)

W, H = 1400, 560
BG_TOP = (4, 7, 12)
BG_BOTTOM = (10, 14, 22)
BLUE = (56, 168, 255)
BLUE_DEEP = (24, 112, 210)
GOLD = (255, 196, 72)
GOLD_DEEP = (214, 146, 32)
WHITE = (248, 250, 252)
MUTED = (156, 168, 188)
GREEN = (64, 210, 120)


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        ("C:/Windows/Fonts/segoeuib.ttf", bold),
        ("C:/Windows/Fonts/segoeui.ttf", not bold),
        ("C:/Windows/Fonts/arialbd.ttf", bold),
        ("C:/Windows/Fonts/arial.ttf", not bold),
    ]
    for path, is_bold in candidates:
        if is_bold == bold and Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def add_radial_glow(
    base: Image.Image,
    center: tuple[int, int],
    color: tuple[int, int, int],
    radius: int,
    alpha: int,
) -> None:
    glow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    x, y = center
    for step in range(radius, 0, -10):
        a = int(alpha * (step / radius) ** 2)
        draw.ellipse((x - step, y - step, x + step, y + step), fill=(*color, a))
    base.alpha_composite(glow.filter(ImageFilter.GaussianBlur(22)))


def add_linear_glow(base: Image.Image, y: int, height: int, alpha: int) -> None:
    strip = Image.new("RGBA", (W, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(strip)
    for row in range(height):
        t = 1 - abs(row - height / 2) / (height / 2)
        draw.line((0, row, W, row), fill=(120, 190, 255, int(alpha * t)))
    base.alpha_composite(strip, (0, y))


def draw_corner_brackets(canvas: Image.Image) -> None:
    draw = ImageDraw.Draw(canvas)
    color = (255, 255, 255, 34)
    inset = 28
    length = 72
    for x0, y0, dx, dy in [
        (inset, inset, 1, 1),
        (W - inset, inset, -1, 1),
        (inset, H - inset, 1, -1),
        (W - inset, H - inset, -1, -1),
    ]:
        draw.line((x0, y0, x0 + dx * length, y0), fill=color, width=2)
        draw.line((x0, y0, x0, y0 + dy * 34), fill=color, width=2)
        draw.line((x0, y0, x0 + dx * 34, y0 + dy * 18), fill=color, width=2)


def draw_horizon(canvas: Image.Image) -> None:
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    y = 430
    for offset in range(-18, 19):
        t = 1 - abs(offset) / 18
        draw.line((80, y + offset, W - 80, y + offset), fill=(255, 255, 255, int(18 * t)))
    for x in range(80, W - 80):
        t = (x - 80) / (W - 160)
        color = (
            lerp(BLUE[0], GOLD[0], t),
            lerp(BLUE[1], GOLD[1], t),
            lerp(BLUE[2], GOLD[2], t),
            120,
        )
        draw.line((x, y - 1, x, y + 1), fill=color)
    canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(1)))


def draw_diagonal_beam(canvas: Image.Image) -> None:
    beam = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(beam)
    for i in range(-200, W + 200, 8):
        draw.line((i, 0, i + 260, H), fill=(255, 255, 255, 6), width=2)
    beam = beam.rotate(-18, resample=Image.Resampling.BICUBIC)
    cropped = beam.crop((0, 0, W, H))
    canvas.alpha_composite(cropped)


def add_vignette(canvas: Image.Image) -> None:
    vignette = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(vignette)
    draw.rectangle((0, 0, W, H), fill=(0, 0, 0, 70))
    draw.rectangle((40, 24, W - 40, H - 24), fill=(0, 0, 0, 0))
    canvas.alpha_composite(vignette.filter(ImageFilter.GaussianBlur(18)))


def create_background() -> Image.Image:
    canvas = Image.new("RGBA", (W, H), BG_TOP)
    draw = ImageDraw.Draw(canvas)
    for y in range(H):
        t = y / H
        color = (
            lerp(BG_TOP[0], BG_BOTTOM[0], t),
            lerp(BG_TOP[1], BG_BOTTOM[1], t),
            lerp(BG_TOP[2], BG_BOTTOM[2], t),
            255,
        )
        draw.line((0, y, W, y), fill=color)

    add_radial_glow(canvas, (220, 250), BLUE, 360, 95)
    add_radial_glow(canvas, (1180, 280), GOLD, 380, 90)
    add_linear_glow(canvas, 250, 120, 28)
    draw_diagonal_beam(canvas)
    draw_horizon(canvas)
    draw_corner_brackets(canvas)
    add_vignette(canvas)
    return canvas


def draw_text_glow(canvas: Image.Image, xy: tuple[int, int], text: str, font: ImageFont.ImageFont, color: tuple[int, int, int]) -> None:
    glow_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_layer)
    x, y = xy
    glow_draw.text((x, y), text, font=font, fill=(*color, 180))
    canvas.alpha_composite(glow_layer.filter(ImageFilter.GaussianBlur(8)))
    ImageDraw.Draw(canvas).text((x, y), text, font=font, fill=color)


def draw_brand_lockup(canvas: Image.Image) -> None:
    icon = Image.open(ICON).convert("RGBA")
    icon_size = 176
    icon = icon.resize((icon_size, icon_size), Image.Resampling.LANCZOS)

    ring = Image.new("RGBA", (icon_size + 40, icon_size + 40), (0, 0, 0, 0))
    ring_draw = ImageDraw.Draw(ring)
    cx = cy = (icon_size + 40) // 2
    ring_draw.ellipse((8, 8, icon_size + 32, icon_size + 32), outline=(*BLUE, 180), width=3)
    ring_draw.arc((8, 8, icon_size + 32, icon_size + 32), 300, 120, fill=(*GOLD, 180), width=3)
    ring.alpha_composite(icon, (20, 20))
    ring = ring.filter(ImageFilter.GaussianBlur(0.3))
    canvas.alpha_composite(ring, (72, 168))

    wordmark_font = load_font(58, bold=True)
    draw_text_glow(canvas, (270, 198), "CSSHUB", wordmark_font, WHITE)
    draw = ImageDraw.Draw(canvas)
    draw.text((270, 272), "CSSBattle to GitHub", font=load_font(24, bold=False), fill=MUTED)


def draw_headline(canvas: Image.Image) -> None:
    draw = ImageDraw.Draw(canvas)
    headline_font = load_font(64, bold=True)
    sub_font = load_font(28, bold=False)

    draw.text((560, 118), "Save CSSBattle solutions", font=headline_font, fill=WHITE)
    x = 560
    y = 196
    for chunk, color in [("to ", WHITE), ("Git", BLUE), ("Hub", GOLD)]:
        draw.text((x, y), chunk, font=headline_font, fill=color)
        x += draw.textlength(chunk, font=headline_font)

    draw.text(
        (560, 286),
        "Battles and Daily Targets synced as commits",
        font=sub_font,
        fill=MUTED,
    )
    draw.text(
        (560, 322),
        "with preview images on GitHub.",
        font=sub_font,
        fill=MUTED,
    )


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0], size[1]), radius=radius, fill=255)
    return mask


def draw_framed_image(
    canvas: Image.Image,
    image: Image.Image,
    box: tuple[int, int, int, int],
    radius: int,
    border_color: tuple[int, int, int],
) -> None:
    width = box[2] - box[0]
    height = box[3] - box[1]
    fitted = image.copy().resize((width - 8, height - 8), Image.Resampling.LANCZOS)
    frame = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    frame_draw = ImageDraw.Draw(frame)
    frame_draw.rounded_rectangle((0, 0, width - 1, height - 1), radius=radius, fill=(14, 20, 32, 245), outline=border_color, width=3)
    mask = rounded_mask((width - 8, height - 8), radius - 4)
    frame.paste(fitted, (4, 4), mask)
    glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.rounded_rectangle(box, radius=radius, outline=(*border_color, 120), width=8)
    canvas.alpha_composite(glow.filter(ImageFilter.GaussianBlur(10)))
    canvas.alpha_composite(frame, (box[0], box[1]))


def draw_battle_card(canvas: Image.Image, box: tuple[int, int, int, int]) -> None:
    card = Image.new("RGBA", (box[2] - box[0], box[3] - box[1]), (0, 0, 0, 0))
    draw = ImageDraw.Draw(card)
    w, h = card.size
    draw.rounded_rectangle((0, 0, w - 1, h - 1), radius=18, fill=(14, 20, 32, 245), outline=BLUE, width=3)
    draw.rounded_rectangle((18, 48, w - 18, h - 18), radius=12, fill=(35, 24, 18, 255))
    draw.rounded_rectangle((34, 64, 118, 148), radius=4, fill=(123, 196, 127, 255))
    draw.text((18, 16), "CSSBattle", font=load_font(20, bold=True), fill=BLUE)
    draw.text((18, h - 42), "Simply Square · 100% match", font=load_font(16, bold=False), fill=MUTED)
    canvas.alpha_composite(card, (box[0], box[1]))


def draw_connector(canvas: Image.Image, start: tuple[int, int], end: tuple[int, int]) -> None:
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.line([start, end], fill=(*BLUE, 220), width=6)
    angle = math.atan2(end[1] - start[1], end[0] - start[0])
    tip = 18
    left = (end[0] - tip * math.cos(angle - math.pi / 6), end[1] - tip * math.sin(angle - math.pi / 6))
    right = (end[0] - tip * math.cos(angle + math.pi / 6), end[1] - tip * math.sin(angle + math.pi / 6))
    draw.polygon([end, left, right], fill=(*GOLD, 255))
    canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(0.5)))

    icon = Image.open(ICON).convert("RGBA").resize((72, 72), Image.Resampling.LANCZOS)
    mid = ((start[0] + end[0]) // 2 - 36, (start[1] + end[1]) // 2 - 36)
    halo = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    ImageDraw.Draw(halo).ellipse((4, 4, 92, 92), fill=(255, 255, 255, 28))
    canvas.alpha_composite(halo.filter(ImageFilter.GaussianBlur(8)), (mid[0] - 12, mid[1] - 12))
    canvas.alpha_composite(icon, mid)


def draw_success_badge(canvas: Image.Image, xy: tuple[int, int]) -> None:
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    x, y = xy
    draw.ellipse((x, y, x + 54, y + 54), fill=(16, 36, 24, 240), outline=GREEN, width=3)
    draw.line((x + 16, y + 28, x + 24, y + 36), fill=GREEN, width=4)
    draw.line((x + 24, y + 36, x + 38, y + 18), fill=GREEN, width=4)
    canvas.alpha_composite(layer)


def draw_visual_story(canvas: Image.Image) -> None:
    draw = ImageDraw.Draw(canvas)
    draw.text((560, 352), "Play on CSSBattle, land on GitHub.", font=load_font(22, bold=True), fill=WHITE)

    draw_battle_card(canvas, (560, 382, 790, 522))
    draw_connector(canvas, (790, 452), (920, 452))

    github = Image.open(GITHUB_SHOT).convert("RGB")
    crop = github.crop((0, 0, github.width, min(280, github.height)))
    draw_framed_image(canvas, crop, (920, 372, 1310, 522), 18, GOLD)
    draw_success_badge(canvas, (1270, 472))


def build_premium_marquee() -> Image.Image:
    canvas = create_background()
    draw_brand_lockup(canvas)
    draw_headline(canvas)
    draw_visual_story(canvas)
    assert canvas.size == (W, H)
    return canvas.convert("RGB")


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    image = build_premium_marquee()
    for name in (
        "csshub-marquee-promo-premium-1400x560.png",
        "csshub-marquee-promo-v2-option-1-1400x560.png",
    ):
        path = OUTPUT / name
        image.save(path, format="PNG", optimize=True)
        print(f"Saved {path} ({image.size[0]}x{image.size[1]})")


if __name__ == "__main__":
    main()

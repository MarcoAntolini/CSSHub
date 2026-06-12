from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ICON = ROOT / "apps" / "extension" / "public" / "icons" / "icon_128.png"
OUTPUT = (
    Path(r"C:\Users\marco\.cursor\projects\d-Coding-Workspace-My-Workspace-CSSHub\assets")
    / "chrome-store-promo-exact"
    / "marquee-v2"
)

W, H = 1400, 560
BG = (6, 10, 18)
BG_SOFT = (12, 18, 30)
BLUE = (59, 158, 255)
BLUE_SOFT = (93, 190, 255)
GOLD = (245, 185, 66)
GOLD_SOFT = (255, 210, 110)
WHITE = (245, 247, 250)
MUTED = (170, 180, 198)
GREEN = (72, 199, 116)


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


def rounded_rect(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    radius: int,
    fill: tuple[int, int, int] | tuple[int, int, int, int],
    outline: tuple[int, int, int] | None = None,
    width: int = 2,
) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def add_radial_glow(base: Image.Image, center: tuple[int, int], color: tuple[int, int, int], radius: int, alpha: int) -> None:
    glow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    x, y = center
    for step in range(radius, 0, -12):
        a = int(alpha * (step / radius) ** 2)
        draw.ellipse((x - step, y - step, x + step, y + step), fill=(*color, a))
    glow = glow.filter(ImageFilter.GaussianBlur(18))
    base.alpha_composite(glow)


def create_canvas() -> Image.Image:
    canvas = Image.new("RGBA", (W, H), BG)
    draw = ImageDraw.Draw(canvas)
    for y in range(H):
        t = y / H
        r = int(BG[0] + (BG_SOFT[0] - BG[0]) * t)
        g = int(BG[1] + (BG_SOFT[1] - BG[1]) * t)
        b = int(BG[2] + (BG_SOFT[2] - BG[2]) * t)
        draw.line((0, y, W, y), fill=(r, g, b, 255))

    grid = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    grid_draw = ImageDraw.Draw(grid)
    for x in range(0, W, 56):
        grid_draw.line((x, 0, x, H), fill=(255, 255, 255, 10))
    for y in range(0, H, 56):
        grid_draw.line((0, y, W, y), fill=(255, 255, 255, 10))
    canvas.alpha_composite(grid)

    add_radial_glow(canvas, (260, 280), BLUE, 320, 70)
    add_radial_glow(canvas, (1120, 300), GOLD, 340, 65)
    return canvas


def paste_icon(canvas: Image.Image, size: int, xy: tuple[int, int]) -> None:
    icon = Image.open(ICON).convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
    canvas.alpha_composite(icon, xy)


def draw_brand_wordmark(draw: ImageDraw.ImageDraw, xy: tuple[int, int], size: int = 54) -> None:
    x, y = xy
    font = load_font(size, bold=True)
    draw.text((x, y), "Css", font=font, fill=BLUE_SOFT)
    css_w = draw.textlength("Css", font=font)
    draw.text((x + css_w, y), "Hub", font=font, fill=GOLD_SOFT)


def draw_split_headline(
    draw: ImageDraw.ImageDraw,
    lines: list[tuple[str, tuple[int, int, int] | None]],
    xy: tuple[int, int],
    size: int,
    spacing: int = 12,
) -> None:
    x, y = xy
    font = load_font(size, bold=True)
    for text, color in lines:
        draw.text((x, y), text, font=font, fill=color or WHITE)
        bbox = draw.textbbox((x, y), text, font=font)
        y = bbox[3] + spacing


def draw_card(
    canvas: Image.Image,
    box: tuple[int, int, int, int],
    title: str,
    body_lines: list[str],
    accent: tuple[int, int, int],
) -> None:
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    rounded_rect(draw, box, 18, (16, 22, 34, 230), accent, 2)
    title_font = load_font(22, bold=True)
    body_font = load_font(18, bold=False)
    draw.text((box[0] + 22, box[1] + 18), title, font=title_font, fill=accent)
    y = box[1] + 58
    for line in body_lines:
        draw.text((box[0] + 22, y), line, font=body_font, fill=MUTED)
        y += 28
    canvas.alpha_composite(layer)


def draw_arrow(canvas: Image.Image, start: tuple[int, int], end: tuple[int, int], color: tuple[int, int, int]) -> None:
    draw = ImageDraw.Draw(canvas)
    draw.line([start, end], fill=color, width=5)
    angle = math.atan2(end[1] - start[1], end[0] - start[0])
    size = 16
    left = (
        end[0] - size * math.cos(angle - math.pi / 6),
        end[1] - size * math.sin(angle - math.pi / 6),
    )
    right = (
        end[0] - size * math.cos(angle + math.pi / 6),
        end[1] - size * math.sin(angle + math.pi / 6),
    )
    draw.polygon([end, left, right], fill=color)


def draw_feature_pills(canvas: Image.Image, labels: list[str], y: int) -> None:
    draw = ImageDraw.Draw(canvas)
    font = load_font(20, bold=True)
    x = 120
    for label in labels:
        text_w = draw.textlength(label, font=font)
        box = (x, y, x + text_w + 36, y + 42)
        rounded_rect(draw, box, 21, (18, 26, 40, 220), (70, 110, 150), 1)
        draw.text((x + 18, y + 10), label, font=font, fill=WHITE)
        x = box[2] + 18


def option_1() -> Image.Image:
    canvas = create_canvas()
    draw = ImageDraw.Draw(canvas)
    paste_icon(canvas, 150, (90, 205))
    draw_brand_wordmark(draw, (255, 248), 58)
    draw.text((255, 318), "CSSBattle to GitHub", font=load_font(24, bold=False), fill=MUTED)

    draw_split_headline(
        draw,
        [
            ("Save CSSBattle solutions", WHITE),
            ("to GitHub", BLUE_SOFT),
        ],
        (520, 150),
        62,
        10,
    )
    draw.text(
        (520, 300),
        "Battles and Daily Targets synced as commits with preview images.",
        font=load_font(28, bold=False),
        fill=MUTED,
    )
    draw_feature_pills(
        canvas,
        ["Automatic sync", "Preview commits", "Open source"],
        430,
    )
    draw.line((90, 500, 1310, 500), fill=(255, 255, 255, 28), width=2)
    return canvas.convert("RGB")


def option_2() -> Image.Image:
    canvas = create_canvas()
    draw = ImageDraw.Draw(canvas)
    paste_icon(canvas, 92, (72, 62))
    draw_brand_wordmark(draw, (182, 88), 46)
    draw_split_headline(
        draw,
        [
            ("CSSBattle, backed up", WHITE),
            ("to your GitHub repo", GOLD_SOFT),
        ],
        (72, 190),
        54,
        8,
    )
    draw.text(
        (72, 330),
        "Sync passing submissions as commits with preview images.",
        font=load_font(24, bold=False),
        fill=MUTED,
    )

    draw_card(
        canvas,
        (620, 110, 860, 250),
        "CSSBattle",
        ["Simply Square", "100% match", "693.95 score"],
        BLUE_SOFT,
    )
    draw_card(
        canvas,
        (980, 110, 1280, 250),
        "GitHub commit",
        ["Commit 3cb8272", "5 files changed", "+54 -2"],
        GOLD_SOFT,
    )
    draw_card(
        canvas,
        (760, 300, 1140, 470),
        "CssHub",
        ["Connected", "Synced to GitHub", "Submission committed"],
        GREEN,
    )
    draw_arrow(canvas, (860, 180), (980, 180), BLUE_SOFT)
    draw_arrow(canvas, (980, 385), (860, 250), GOLD_SOFT)
    return canvas.convert("RGB")


def option_3() -> Image.Image:
    canvas = create_canvas()
    watermark = Image.open(ICON).convert("RGBA").resize((420, 420), Image.Resampling.LANCZOS)
    watermark.putalpha(38)
    canvas.alpha_composite(watermark, (490, 70))
    draw = ImageDraw.Draw(canvas)
    headline_font = load_font(54, bold=True)

    draw.text((120, 118), "From battle pass to", font=headline_font, fill=WHITE)
    x = 120
    y = 188
    for text, color in [("Git", BLUE_SOFT), ("Hub", GOLD_SOFT), (" commit", WHITE)]:
        draw.text((x, y), text, font=headline_font, fill=color)
        x += draw.textlength(text, font=headline_font)

    draw.text(
        (120, 280),
        "Battles and Daily Targets saved as real commits with preview images.",
        font=load_font(28, bold=False),
        fill=MUTED,
    )

    rounded_rect(draw, (920, 130, 1080, 290), 16, (22, 30, 46, 220), BLUE_SOFT, 2)
    draw.text((955, 185), "{ css }", font=load_font(34, bold=True), fill=BLUE_SOFT)
    draw_arrow(canvas, (1080, 210), (1160, 210), GOLD_SOFT)
    rounded_rect(draw, (1160, 130, 1320, 290), 16, (22, 30, 46, 220), GOLD_SOFT, 2)
    draw.text((1190, 170), "GitHub", font=load_font(28, bold=True), fill=WHITE)
    draw.text((1190, 215), "commit", font=load_font(24, bold=False), fill=MUTED)
    draw.text((1190, 245), "preview image", font=load_font(20, bold=False), fill=GREEN)

    paste_icon(canvas, 88, (72, 410))
    draw_brand_wordmark(draw, (175, 430), 34)
    return canvas.convert("RGB")


def option_4() -> Image.Image:
    canvas = create_canvas()
    draw = ImageDraw.Draw(canvas)
    draw.text(
        (120, 72),
        "Turn CSSBattle progress into GitHub history",
        font=load_font(46, bold=True),
        fill=WHITE,
    )
    draw.text(
        (120, 132),
        "Play. Sync. Commit.",
        font=load_font(28, bold=False),
        fill=MUTED,
    )

    steps = [
        ("1", "Play", "Solve Battles and Daily Targets", BLUE_SOFT, 120),
        ("2", "Sync", "CssHub sends your solution", GOLD_SOFT, 520),
        ("3", "Commit", "Preview image on GitHub", GREEN, 920),
    ]
    for number, title, subtitle, accent, x in steps:
        rounded_rect(draw, (x, 220, x + 300, 470), 22, (16, 22, 34, 230), accent, 2)
        draw.text((x + 24, 248), number, font=load_font(22, bold=True), fill=accent)
        draw.text((x + 24, 290), title, font=load_font(34, bold=True), fill=WHITE)
        draw.text((x + 24, 350), subtitle, font=load_font(22, bold=False), fill=MUTED)
        if title == "Sync":
            paste_icon(canvas, 110, (x + 95, 360))

    draw.line([(420, 345), (520, 345)], fill=BLUE_SOFT, width=4)
    draw.line([(820, 345), (920, 345)], fill=GOLD_SOFT, width=4)
    paste_icon(canvas, 72, (1180, 72))
    draw_brand_wordmark(draw, (72, 470), 30)
    return canvas.convert("RGB")


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    options = [option_1, option_2, option_3, option_4]
    for index, builder in enumerate(options, start=1):
        image = builder()
        assert image.size == (W, H), f"Option {index} has wrong size: {image.size}"
        path = OUTPUT / f"csshub-marquee-promo-v2-option-{index}-1400x560.png"
        image.save(path, format="PNG", optimize=True)
        print(f"Saved {path} ({image.size[0]}x{image.size[1]})")


if __name__ == "__main__":
    main()

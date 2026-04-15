"""Cover image generator — 9 built-in templates using Pillow.

Template design corresponds to the 9 numbered templates from the original
KrLongAI.exe 预览图片/剪辑模板{1-9}.jpg. Each template takes:
  - an optional background image
  - a title (required)
  - an optional subtitle
  - a dominant color hue

Output size is 1080x1440 (portrait 3:4), matching typical Douyin cover specs.
"""
import base64
import io
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

COVER_W, COVER_H = 1080, 1440


@dataclass
class CoverTemplate:
    id: int
    name: str
    description: str
    dominant: tuple[int, int, int]
    accent: tuple[int, int, int]


TEMPLATES: list[CoverTemplate] = [
    CoverTemplate(1, "经典红黄", "红色背景+黄色大标题", (220, 38, 38), (250, 204, 21)),
    CoverTemplate(2, "商务蓝", "蓝色渐变+白字", (29, 78, 216), (248, 250, 252)),
    CoverTemplate(3, "活力橙", "橙色底+深紫标题", (234, 88, 12), (88, 28, 135)),
    CoverTemplate(4, "清新绿", "绿色底+白字", (21, 128, 61), (240, 253, 244)),
    CoverTemplate(5, "粉紫少女", "粉色底+深紫", (236, 72, 153), (76, 29, 149)),
    CoverTemplate(6, "暗夜金", "黑底+金字", (17, 24, 39), (251, 191, 36)),
    CoverTemplate(7, "炫彩渐变", "紫蓝渐变+白字", (124, 58, 237), (59, 130, 246)),
    CoverTemplate(8, "纯白极简", "白底+黑字", (250, 250, 250), (17, 24, 39)),
    CoverTemplate(9, "深红爆款", "深红+黄金", (127, 29, 29), (250, 204, 21)),
]


def list_templates() -> list[dict]:
    """Return template descriptors with base64 thumbnails."""
    out: list[dict] = []
    for tpl in TEMPLATES:
        thumb = _render(tpl, "预览", "副标题文字", None, thumbnail=True)
        buf = io.BytesIO()
        thumb.save(buf, format="PNG")
        out.append(
            {
                "id": tpl.id,
                "name": tpl.name,
                "description": tpl.description,
                "thumbnail_b64": base64.b64encode(buf.getvalue()).decode(),
            }
        )
    return out


def get_template(template_id: int) -> CoverTemplate:
    for tpl in TEMPLATES:
        if tpl.id == template_id:
            return tpl
    raise ValueError(f"Template id {template_id} not found")


def _load_font(size: int) -> ImageFont.FreeTypeFont:
    """Load a CJK-capable font. Prefer bundled STXINWEI.TTF, fall back to
    system DejaVu / PIL default."""
    assets_font = Path(__file__).resolve().parent.parent / "assets" / "fonts" / "STXINWEI.TTF"
    if assets_font.exists():
        return ImageFont.truetype(str(assets_font), size=size)

    system_candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
        "/System/Library/Fonts/PingFang.ttc",
        "C:\\Windows\\Fonts\\msyhbd.ttc",
    ]
    for p in system_candidates:
        if Path(p).exists():
            return ImageFont.truetype(p, size=size)

    return ImageFont.load_default()


def _text_size(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont) -> tuple[int, int]:
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def _wrap_title(text: str, max_chars: int) -> list[str]:
    # Simple wrap by character count (CJK-friendly)
    lines: list[str] = []
    cur = ""
    for ch in text:
        cur += ch
        if len(cur) >= max_chars and ch in "，。！？, !?.":
            lines.append(cur)
            cur = ""
        elif len(cur) >= max_chars + 3:
            lines.append(cur)
            cur = ""
    if cur:
        lines.append(cur)
    return lines or [text]


def _render(
    tpl: CoverTemplate,
    title: str,
    subtitle: str,
    background: Path | None,
    thumbnail: bool = False,
) -> Image.Image:
    w, h = (360, 480) if thumbnail else (COVER_W, COVER_H)
    img = Image.new("RGB", (w, h), tpl.dominant)

    # Gradient overlay for templates 2 / 7 (radial-like using composite)
    if tpl.id in (2, 7):
        grad = Image.new("RGB", (w, h), tpl.accent)
        mask = Image.new("L", (w, h))
        md = ImageDraw.Draw(mask)
        for i in range(h):
            md.line([(0, i), (w, i)], fill=int(255 * (i / h) * 0.7))
        img = Image.composite(grad, img, mask)

    # Paste a blurred background image if provided
    if background and background.exists():
        try:
            bg = Image.open(background).convert("RGB")
            bg = bg.resize((w, h), Image.LANCZOS)
            bg = bg.filter(ImageFilter.GaussianBlur(8))
            # Darken for legibility
            overlay = Image.new("RGB", (w, h), (0, 0, 0))
            bg = Image.blend(bg, overlay, 0.35)
            img = Image.blend(img, bg, 0.55)
        except Exception:  # noqa: BLE001
            pass

    draw = ImageDraw.Draw(img)

    # Title
    title_size = int(h * 0.11)
    title_font = _load_font(title_size)
    wrapped = _wrap_title(title, max_chars=8)
    title_y = int(h * 0.28)
    for line in wrapped:
        tw, th = _text_size(draw, line, title_font)
        tx = (w - tw) // 2
        # Drop shadow for contrast
        for dx, dy in [(3, 3), (-3, 3), (3, -3), (-3, -3)]:
            draw.text((tx + dx, title_y + dy), line, fill=(0, 0, 0, 180), font=title_font)
        draw.text((tx, title_y), line, fill=tpl.accent, font=title_font)
        title_y += th + 10

    # Subtitle
    if subtitle:
        sub_size = int(h * 0.045)
        sub_font = _load_font(sub_size)
        sw, sh = _text_size(draw, subtitle, sub_font)
        sx = (w - sw) // 2
        sy = title_y + int(h * 0.04)
        # Subtitle background bar
        pad = int(h * 0.015)
        draw.rectangle(
            [sx - pad * 2, sy - pad, sx + sw + pad * 2, sy + sh + pad],
            fill=tpl.accent,
        )
        draw.text((sx, sy), subtitle, fill=tpl.dominant, font=sub_font)

    return img


def generate_cover(
    template_id: int,
    title: str,
    subtitle: str = "",
    background_path: str | None = None,
    output_path: Path | None = None,
) -> Path:
    tpl = get_template(template_id)
    bg = Path(background_path) if background_path else None
    img = _render(tpl, title, subtitle, bg, thumbnail=False)

    if output_path is None:
        raise ValueError("output_path required")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(output_path, format="PNG", optimize=True)
    return output_path

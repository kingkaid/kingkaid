"""Compliance word detection — local word list + optional Claude fallback.

Words are categorized by severity level. The default list below is a safe
starter set and can be overridden by a `compliance_words.json` file in the
data root.
"""
import json
from dataclasses import dataclass
from pathlib import Path

from config import DATA_ROOT

COMPLIANCE_FILE = DATA_ROOT / "compliance_words.json"


# Default word lists — intentionally conservative. Real production use
# should load from a regularly updated curated file.
DEFAULT_WORDS: dict[str, list[str]] = {
    "medical": ["根治", "治愈", "特效", "包治"],
    "absolute": ["最好", "最佳", "第一", "顶级", "最强", "最低价"],
    "finance": ["保本", "稳赚", "无风险", "高回报"],
    "gambling": ["赌博", "博彩"],
    "sensitive": ["传销"],
}


@dataclass
class FlaggedWord:
    word: str
    category: str
    start: int
    end: int


def _load_words() -> dict[str, list[str]]:
    if COMPLIANCE_FILE.exists():
        try:
            return json.loads(COMPLIANCE_FILE.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            pass
    return DEFAULT_WORDS


def check_text(text: str) -> dict:
    """Scan text for flagged words. Returns risk_level + positions."""
    words = _load_words()
    flagged: list[FlaggedWord] = []

    for category, word_list in words.items():
        for word in word_list:
            idx = 0
            while idx < len(text):
                pos = text.find(word, idx)
                if pos == -1:
                    break
                flagged.append(
                    FlaggedWord(word=word, category=category, start=pos, end=pos + len(word))
                )
                idx = pos + len(word)

    # Severity: absolute/finance/gambling/sensitive → high, medical → warning
    has_high = any(
        f.category in {"absolute", "finance", "gambling", "sensitive"} for f in flagged
    )
    has_warn = any(f.category == "medical" for f in flagged)

    if has_high:
        level = "high"
    elif has_warn:
        level = "warning"
    else:
        level = "safe"

    suggestion = ""
    if level == "high":
        suggestion = "文案包含极限词/金融承诺/敏感词等高风险内容，建议修改后再发布。"
    elif level == "warning":
        suggestion = "文案涉及医疗相关词汇，请确保真实合规。"

    return {
        "risk_level": level,
        "flagged_words": [
            {"word": f.word, "category": f.category, "start": f.start, "end": f.end}
            for f in flagged
        ],
        "suggestion": suggestion,
        "total_categories": list({f.category for f in flagged}),
    }

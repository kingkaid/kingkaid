"""SenseVoice Small — lazy singleton wrapper.

Model weights are ~900MB and are downloaded on first call via ModelScope.
During development / tests without GPU, calling transcribe() raises if
the model cannot load; the health endpoint reports status as "not-loaded".
"""
from pathlib import Path
from typing import Any

from config import settings

_model: Any = None
_load_error: str | None = None


def is_loaded() -> bool:
    return _model is not None


def get_status() -> str:
    if _model is not None:
        return "loaded"
    if _load_error:
        return f"error: {_load_error[:80]}"
    return "not-loaded"


def load_model() -> Any:
    """Lazy-load SenseVoice. Imports funasr only on first call to avoid
    pulling torch into the import graph for quick health checks."""
    global _model, _load_error
    if _model is not None:
        return _model
    try:
        from funasr import AutoModel  # type: ignore

        _model = AutoModel(
            model=settings.sensevoice_model,
            vad_model="fsmn-vad",
            device=settings.sensevoice_device,
            disable_update=True,
        )
        _load_error = None
        return _model
    except Exception as e:  # noqa: BLE001
        _load_error = repr(e)
        raise


def transcribe(audio_path: Path | str) -> dict:
    """Transcribe a wav/mp3 file. Returns {text, emotion?, segments?}."""
    model = load_model()
    res = model.generate(
        input=str(audio_path),
        language="zh",
        use_itn=True,
        batch_size_s=60,
    )
    item = res[0] if isinstance(res, list) and res else {}
    return {
        "text": item.get("text", ""),
        "emotion": item.get("emotion"),
        "raw": item,
    }

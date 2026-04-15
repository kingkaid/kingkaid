# PyInstaller spec for KingKaid sidecar.
#
# Build:  uv run pyinstaller api.spec
# Output: dist/api (Linux) / dist/api.exe (Windows) / dist/api (macOS)
#
# This binary is bundled as `src-tauri/bin/api-<target>` by the build script
# and launched by the Tauri Rust shell via tauri-plugin-shell's externalBin.

import os
import sys
from pathlib import Path
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

block_cipher = None
ROOT = Path(os.getcwd())

# --- Hidden imports -------------------------------------------------------
# FunASR / SenseVoice lazy-load their models and pipelines via importlib,
# which PyInstaller's static analyzer cannot see. We collect everything.
hidden_imports: list[str] = []
hidden_imports += collect_submodules("funasr", filter=lambda name: "test" not in name)
hidden_imports += collect_submodules("modelscope", filter=lambda name: "test" not in name)
hidden_imports += collect_submodules("torch")
hidden_imports += collect_submodules("torchaudio")
hidden_imports += [
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "sqlalchemy.dialects.sqlite",
    "sqlalchemy.ext.asyncio",
    "aiosqlite",
    "email_validator",
    "apscheduler.schedulers.asyncio",
    "apscheduler.executors.default",
    "apscheduler.jobstores.memory",
    "apscheduler.triggers.interval",
    "httpx_sse",
    "PIL.ImageFont",
    "PIL.ImageFilter",
    "PIL.ImageDraw",
    "srt",
    "ffmpeg",  # ffmpeg-python
    "imageio_ffmpeg",
]

# --- Data files -----------------------------------------------------------
# Bundled fonts for the cover generator + imageio-ffmpeg's static binary
datas: list[tuple[str, str]] = []

# Bundled fonts (user should populate python-backend/assets/fonts/)
fonts_dir = ROOT / "assets" / "fonts"
if fonts_dir.exists():
    for f in fonts_dir.glob("*.ttf"):
        datas.append((str(f), "assets/fonts"))
    for f in fonts_dir.glob("*.ttc"):
        datas.append((str(f), "assets/fonts"))

# imageio-ffmpeg packages its static binary alongside its Python code
datas += collect_data_files("imageio_ffmpeg", include_py_files=False)
datas += collect_data_files("funasr", include_py_files=False)
datas += collect_data_files("modelscope", include_py_files=False)

# --- Analysis / build -----------------------------------------------------
a = Analysis(
    ["main.py"],
    pathex=[str(ROOT)],
    binaries=[],
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "tkinter",
        "matplotlib",
        "notebook",
        "jupyter",
        "IPython",
        "pytest",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="api",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="api",
)

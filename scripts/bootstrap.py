#!/usr/bin/env python3
"""KingKaid — 一键环境检测 + 部署脚本（跨平台）

自动化流程：
  Phase 1  系统工具检测（Python/Node/Rust/git/Docker/NVIDIA）
  Phase 2  系统工具自动安装（Windows winget / Linux apt / macOS brew）
  Phase 3  自动安装 uv + pnpm
  Phase 4  项目依赖同步（pnpm install + uv sync × 2）
  Phase 5  CUDA PyTorch 安装（检测到 NVIDIA GPU 时）
  Phase 6  .env 配置文件生成
  Phase 7  云端数据库初始化 + 生成测试许可证
  Phase 8  SenseVoice 模型预下载（可选，~900MB）
  Phase 9  HeyGem Docker 镜像拉取（可选，~15GB）
  Phase 10 打印启动步骤

用法:
    python scripts/bootstrap.py                # 默认：跳过重度下载（Phase 8-9）
    python scripts/bootstrap.py --full         # 完整安装，包含模型与 Docker 镜像
    python scripts/bootstrap.py --check        # 仅检测，不安装
    python scripts/bootstrap.py --download-models  # 只做模型下载
    python scripts/bootstrap.py --pull-heygem      # 只拉取 HeyGem 镜像
    python scripts/bootstrap.py --install-system  # 尝试自动安装系统工具
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Optional

# ─────────────────────────────────────────────────────────────────────────
IS_WIN = platform.system() == "Windows"
IS_MAC = platform.system() == "Darwin"
IS_LINUX = platform.system() == "Linux"

if IS_WIN:
    RESET = BOLD = GREEN = YELLOW = RED = CYAN = MAGENTA = ""
else:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    RED = "\033[31m"
    CYAN = "\033[36m"
    MAGENTA = "\033[35m"


def info(msg: str) -> None:
    print(f"{CYAN}→{RESET} {msg}")


def ok(msg: str) -> None:
    print(f"{GREEN}✓{RESET} {msg}")


def warn(msg: str) -> None:
    print(f"{YELLOW}⚠{RESET} {msg}")


def err(msg: str) -> None:
    print(f"{RED}✗{RESET} {msg}")


def section(title: str) -> None:
    bar = "─" * 64
    print(f"\n{BOLD}{bar}\n  {title}\n{bar}{RESET}")


# ─────────────────────────────────────────────────────────────────────────
def run(cmd, cwd: Optional[Path] = None, check: bool = True, env=None) -> subprocess.CompletedProcess:
    pretty = " ".join(cmd) if isinstance(cmd, list) else cmd
    print(f"  $ {pretty}")
    return subprocess.run(
        cmd,
        cwd=cwd,
        check=check,
        shell=isinstance(cmd, str) or IS_WIN,
        env=env,
    )


def capture(cmd) -> Optional[str]:
    try:
        out = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            shell=isinstance(cmd, str) or IS_WIN,
            timeout=15,
        )
        if out.returncode != 0:
            return None
        return (out.stdout or out.stderr).strip()
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None


def which(name: str) -> Optional[str]:
    return shutil.which(name)


def parse_version(text: Optional[str]) -> Optional[tuple[int, ...]]:
    if not text:
        return None
    m = re.search(r"(\d+)\.(\d+)(?:\.(\d+))?", text)
    if not m:
        return None
    return tuple(int(x) for x in m.groups() if x is not None)


# ─────────────────────────────────────────────────────────────────────────
# Phase 1 — 系统工具检测
# ─────────────────────────────────────────────────────────────────────────
def detect_environment() -> dict:
    """返回每个关键工具的检测结果。"""
    env = {}

    # Python
    v = sys.version_info
    env["python"] = {
        "found": True,
        "ok": v.major == 3 and v.minor >= 11,
        "version": f"{v.major}.{v.minor}.{v.micro}",
    }

    # Node
    node_path = which("node")
    node_ver = parse_version(capture(["node", "--version"])) if node_path else None
    env["node"] = {
        "found": bool(node_path),
        "ok": bool(node_ver and node_ver[0] >= 20),
        "version": ".".join(map(str, node_ver)) if node_ver else None,
    }

    # Rust
    cargo = which("cargo")
    cargo_ver = parse_version(capture(["cargo", "--version"])) if cargo else None
    env["rust"] = {
        "found": bool(cargo),
        "ok": bool(cargo_ver),
        "version": ".".join(map(str, cargo_ver)) if cargo_ver else None,
    }

    # Git
    env["git"] = {"found": bool(which("git")), "ok": bool(which("git"))}

    # uv
    uv_ver = capture(["uv", "--version"]) if which("uv") else None
    env["uv"] = {"found": bool(uv_ver), "ok": bool(uv_ver), "version": uv_ver}

    # pnpm
    pnpm_ver = capture(["pnpm", "--version"]) if which("pnpm") else None
    env["pnpm"] = {"found": bool(pnpm_ver), "ok": bool(pnpm_ver), "version": pnpm_ver}

    # GPU
    gpu_info = None
    if which("nvidia-smi"):
        gpu_info = capture(["nvidia-smi", "--query-gpu=name,driver_version", "--format=csv,noheader"])
    env["gpu"] = {"found": bool(gpu_info), "ok": bool(gpu_info), "info": gpu_info}

    # Docker
    env["docker"] = {
        "found": bool(which("docker")),
        "ok": bool(which("docker")),
        "version": capture(["docker", "--version"]),
    }

    # ffmpeg (非必须)
    env["ffmpeg"] = {"found": bool(which("ffmpeg")), "ok": True}

    return env


def print_env_report(env: dict) -> None:
    def status(key: str, required: bool = True) -> None:
        e = env[key]
        label = {
            "python": "Python >= 3.11",
            "node": "Node.js >= 20",
            "rust": "Rust (cargo)",
            "git": "Git",
            "uv": "uv",
            "pnpm": "pnpm",
            "gpu": "NVIDIA GPU",
            "docker": "Docker",
            "ffmpeg": "ffmpeg",
        }[key]
        version = e.get("version") or e.get("info") or ""
        if e["ok"]:
            ok(f"{label}  {version}")
        elif required:
            err(f"{label}  未安装或版本不符")
        else:
            warn(f"{label}  可选，未安装")

    status("python")
    status("node")
    status("rust")
    status("git")
    status("uv")
    status("pnpm")
    status("gpu", required=False)
    status("docker", required=False)
    status("ffmpeg", required=False)


# ─────────────────────────────────────────────────────────────────────────
# Phase 2 — 系统工具自动安装（通过包管理器）
# ─────────────────────────────────────────────────────────────────────────
WINGET_PACKAGES = {
    "python": "Python.Python.3.11",
    "node": "OpenJS.NodeJS.LTS",
    "rust": "Rustlang.Rustup",
    "git": "Git.Git",
}

APT_PACKAGES = {
    "python": "python3.11 python3.11-venv python3.11-dev",
    "node": None,  # Node 需要 nodesource 仓库，单独处理
    "rust": None,  # rustup
    "git": "git",
}

BREW_PACKAGES = {
    "python": "python@3.11",
    "node": "node@20",
    "rust": "rustup",
    "git": "git",
}


def try_install_system(env: dict) -> None:
    """尝试通过系统包管理器安装缺失的系统工具。"""
    missing = [k for k in ("python", "node", "rust", "git") if not env[k]["ok"]]
    if not missing:
        ok("所有系统工具已就绪")
        return

    if IS_WIN:
        if not which("winget"):
            err("winget 未找到，无法自动安装系统工具")
            print_manual_install_links(missing)
            return
        info(f"通过 winget 安装: {', '.join(missing)}")
        for tool in missing:
            pkg = WINGET_PACKAGES.get(tool)
            if pkg:
                try:
                    run(["winget", "install", "-e", "--id", pkg, "--accept-package-agreements", "--accept-source-agreements"])
                    ok(f"{tool} 安装完成")
                except subprocess.CalledProcessError:
                    err(f"{tool} 通过 winget 安装失败")
        warn("某些工具需要重启 CMD 或系统才能生效，请重新运行 bootstrap.bat")

    elif IS_LINUX:
        if not which("apt"):
            warn("非 Debian/Ubuntu 系，跳过自动安装")
            print_manual_install_links(missing)
            return
        info(f"通过 apt 安装: {', '.join(missing)}")
        for tool in missing:
            if tool == "node":
                info("Node.js 需要 nodesource 仓库，请参考 https://github.com/nodesource/distributions")
                continue
            if tool == "rust":
                info("通过 rustup 安装 Rust ...")
                try:
                    run("curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y")
                    ok("Rust 安装完成（需要 source ~/.cargo/env 或重启 shell）")
                except subprocess.CalledProcessError:
                    err("Rust 安装失败")
                continue
            pkg = APT_PACKAGES.get(tool)
            if pkg:
                try:
                    run(f"sudo apt update && sudo apt install -y {pkg}")
                    ok(f"{tool} 安装完成")
                except subprocess.CalledProcessError:
                    err(f"{tool} 安装失败")

    elif IS_MAC:
        if not which("brew"):
            err("Homebrew 未找到 → https://brew.sh/")
            print_manual_install_links(missing)
            return
        info(f"通过 brew 安装: {', '.join(missing)}")
        for tool in missing:
            pkg = BREW_PACKAGES.get(tool)
            if pkg:
                try:
                    run(["brew", "install", pkg])
                    ok(f"{tool} 安装完成")
                except subprocess.CalledProcessError:
                    err(f"{tool} 安装失败")


def print_manual_install_links(missing: list[str]) -> None:
    links = {
        "python": "Python 3.11: https://www.python.org/downloads/release/python-3118/",
        "node": "Node.js 20 LTS: https://nodejs.org/",
        "rust": "Rust: https://rustup.rs/",
        "git": "Git: https://git-scm.com/downloads",
    }
    for t in missing:
        print(f"  • {links.get(t, t)}")


# ─────────────────────────────────────────────────────────────────────────
# Phase 3 — 安装 uv + pnpm
# ─────────────────────────────────────────────────────────────────────────
def install_uv() -> bool:
    info("通过 pip 安装 uv ...")
    try:
        run([sys.executable, "-m", "pip", "install", "--user", "uv"])
        return bool(which("uv"))
    except subprocess.CalledProcessError:
        err("uv 安装失败，请手动: pip install --user uv")
        return False


def install_pnpm() -> bool:
    info("通过 corepack 启用 pnpm ...")
    try:
        run(["corepack", "enable", "pnpm"])
        if which("pnpm"):
            return True
    except subprocess.CalledProcessError:
        pass
    info("通过 npm 全局安装 pnpm ...")
    try:
        run(["npm", "install", "-g", "pnpm"])
        return bool(which("pnpm"))
    except subprocess.CalledProcessError:
        err("pnpm 安装失败，请手动: npm install -g pnpm")
        return False


# ─────────────────────────────────────────────────────────────────────────
# Phase 4 — 项目依赖
# ─────────────────────────────────────────────────────────────────────────
def install_project_deps(root: Path, skip_frontend: bool) -> None:
    if not skip_frontend:
        info("pnpm install")
        run(["pnpm", "install"], cwd=root)

    info("uv sync — python-backend")
    run(["uv", "sync"], cwd=root / "python-backend")

    info("uv sync — cloud-backend")
    run(["uv", "sync"], cwd=root / "cloud-backend")


# ─────────────────────────────────────────────────────────────────────────
# Phase 5 — CUDA PyTorch
# ─────────────────────────────────────────────────────────────────────────
def install_cuda_pytorch(root: Path) -> None:
    info("安装 CUDA 12.1 版 PyTorch")
    try:
        run(
            [
                "uv",
                "pip",
                "install",
                "torch",
                "torchaudio",
                "--index-url",
                "https://download.pytorch.org/whl/cu121",
            ],
            cwd=root / "python-backend",
        )
        ok("PyTorch CUDA 安装完成")
    except subprocess.CalledProcessError:
        warn("PyTorch CUDA 安装失败，SenseVoice 将退化到 CPU 模式")


# ─────────────────────────────────────────────────────────────────────────
# Phase 6 — .env 文件
# ─────────────────────────────────────────────────────────────────────────
def setup_env_files(root: Path) -> None:
    cloud_env = root / "cloud-backend" / ".env"
    cloud_example = root / "cloud-backend" / ".env.example"
    if not cloud_env.exists() and cloud_example.exists():
        cloud_env.write_text(cloud_example.read_text(encoding="utf-8"), encoding="utf-8")
        ok(f"已创建 {cloud_env}")
        warn("请编辑填入 MINIMAX_API_KEY")
    elif cloud_env.exists():
        ok(f"{cloud_env} 已存在")

    sidecar_env = root / "python-backend" / ".env"
    if not sidecar_env.exists():
        sidecar_env.write_text(
            "CLOUD_BASE_URL=http://127.0.0.1:8090\n"
            "DATABASE_URL=sqlite:///./.data/app.db\n",
            encoding="utf-8",
        )
        ok(f"已创建 {sidecar_env}")


# ─────────────────────────────────────────────────────────────────────────
# Phase 7 — 云端 DB 初始化 + 生成测试许可证
# ─────────────────────────────────────────────────────────────────────────
def init_cloud_db_and_license(root: Path) -> Optional[str]:
    cloud = root / "cloud-backend"
    info("初始化云端 SQLite + 生成测试许可证")
    try:
        result = subprocess.run(
            ["uv", "run", "python", "scripts/gen_license.py",
             "--max-devices", "3", "--monthly-limit", "1000", "--note", "bootstrap-test"],
            cwd=cloud,
            capture_output=True,
            text=True,
            shell=IS_WIN,
            check=True,
        )
        print(result.stdout)
        m = re.search(r"(SVTOOL(?:-[A-Z0-9]{4}){4})", result.stdout)
        if m:
            key = m.group(1)
            ok(f"测试许可证已生成: {key}")
            # 写到根目录的临时文件，方便用户复制
            (root / ".test-license.txt").write_text(key, encoding="utf-8")
            info(f"许可证保存到: {root}/.test-license.txt")
            return key
    except subprocess.CalledProcessError as e:
        err(f"许可证生成失败: {e.stderr or e.stdout}")
    return None


# ─────────────────────────────────────────────────────────────────────────
# Phase 8 — SenseVoice 模型预下载
# ─────────────────────────────────────────────────────────────────────────
def download_sensevoice_model(root: Path) -> None:
    info("预下载 SenseVoice Small 模型（~900MB，首次较慢）")
    code = (
        "from modelscope import snapshot_download; "
        "path = snapshot_download('iic/SenseVoiceSmall'); "
        "print(f'✓ SenseVoice 模型已下载到: {path}')"
    )
    try:
        run(
            ["uv", "run", "python", "-c", code],
            cwd=root / "python-backend",
        )
    except subprocess.CalledProcessError:
        warn("模型下载失败，应用首次启动时会自动重试")


# ─────────────────────────────────────────────────────────────────────────
# Phase 9 — HeyGem Docker 镜像拉取
# ─────────────────────────────────────────────────────────────────────────
def pull_heygem_images(root: Path) -> None:
    if not which("docker"):
        warn("Docker 未安装，跳过 HeyGem 镜像拉取")
        return
    info("拉取 HeyGem Docker 镜像（~15GB，非常慢）")
    compose = root / "src-tauri" / "resources" / "heygem-compose.yml"
    try:
        run(["docker", "compose", "-f", str(compose), "pull"])
        ok("HeyGem 镜像拉取完成")
    except subprocess.CalledProcessError:
        err("HeyGem 镜像拉取失败，可稍后手动执行")


# ─────────────────────────────────────────────────────────────────────────
# 主流程
# ─────────────────────────────────────────────────────────────────────────
def main() -> int:
    parser = argparse.ArgumentParser(
        description="KingKaid 一键环境部署",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--check", action="store_true", help="仅检测环境，不安装")
    parser.add_argument("--full", action="store_true", help="完整安装（含模型 + HeyGem 镜像）")
    parser.add_argument("--install-system", action="store_true", help="自动安装系统工具（需包管理器）")
    parser.add_argument("--skip-torch", action="store_true", help="跳过 CUDA PyTorch")
    parser.add_argument("--skip-frontend", action="store_true", help="跳过前端依赖")
    parser.add_argument("--download-models", action="store_true", help="预下载 SenseVoice 模型")
    parser.add_argument("--pull-heygem", action="store_true", help="拉取 HeyGem Docker 镜像")
    args = parser.parse_args()

    root = Path(__file__).resolve().parent.parent
    print(f"{BOLD}KingKaid Bootstrap{RESET}  —  {root}")
    print(f"Platform: {platform.system()} {platform.release()}  |  Python: {sys.version.split()[0]}")

    # ── Phase 1: 环境检测 ──
    section("Phase 1 — 环境检测")
    env = detect_environment()
    print_env_report(env)

    # ── Phase 2: 系统工具自动安装（可选） ──
    if args.install_system and not args.check:
        section("Phase 2 — 系统工具自动安装")
        try_install_system(env)
        # 重新检测
        env = detect_environment()
        print_env_report(env)

    # ── Phase 3: uv + pnpm 自动安装 ──
    if not args.check:
        if not env["uv"]["ok"]:
            section("Phase 3 — 安装 uv")
            if install_uv():
                env["uv"]["ok"] = True
        if not env["pnpm"]["ok"] and env["node"]["ok"]:
            section("Phase 3 — 安装 pnpm")
            if install_pnpm():
                env["pnpm"]["ok"] = True

    # ── 硬性依赖检查 ──
    hard_deps = {
        "Python >= 3.11": env["python"]["ok"],
        "Node.js >= 20": env["node"]["ok"],
        "Rust (cargo)": env["rust"]["ok"],
        "git": env["git"]["ok"],
        "uv": env["uv"]["ok"],
        "pnpm": env["pnpm"]["ok"],
    }
    missing = [n for n, o in hard_deps.items() if not o]
    if missing:
        err(f"\n缺失必要依赖: {', '.join(missing)}")
        if IS_WIN:
            warn("提示: 加 --install-system 参数尝试通过 winget 自动安装")
        err("安装后重新运行此脚本")
        return 1

    if args.check:
        section("Check-only 完成")
        ok("环境就绪，运行 python scripts/bootstrap.py 继续安装")
        return 0

    # ── Phase 4: 项目依赖 ──
    try:
        section("Phase 4 — 项目依赖")
        install_project_deps(root, args.skip_frontend)
    except subprocess.CalledProcessError as e:
        err(f"项目依赖安装失败: {e}")
        return 2

    # ── Phase 5: CUDA PyTorch ──
    if env["gpu"]["ok"] and not args.skip_torch:
        section("Phase 5 — CUDA PyTorch")
        install_cuda_pytorch(root)

    # ── Phase 6: .env 文件 ──
    section("Phase 6 — .env 配置文件")
    setup_env_files(root)

    # ── Phase 7: 云端 DB + 测试许可证 ──
    section("Phase 7 — 云端数据库 + 测试许可证")
    license_key = init_cloud_db_and_license(root)

    # ── Phase 8: SenseVoice 模型（可选） ──
    if args.full or args.download_models:
        section("Phase 8 — SenseVoice 模型预下载")
        download_sensevoice_model(root)
    else:
        info("跳过 SenseVoice 模型预下载（加 --full 或 --download-models 启用）")

    # ── Phase 9: HeyGem Docker 镜像（可选） ──
    if args.full or args.pull_heygem:
        section("Phase 9 — HeyGem Docker 镜像")
        pull_heygem_images(root)
    else:
        info("跳过 HeyGem 镜像拉取（~15GB，加 --full 或 --pull-heygem 启用）")

    # ── Phase 10: 打印后续步骤 ──
    section("部署完成")
    print(
        f"""
{GREEN}✓{RESET} KingKaid 环境已就绪

{BOLD}接下来的启动顺序（需要 3 个终端）：{RESET}

  {CYAN}[终端 1] 云端服务（许可证 + MiniMax 代理）{RESET}
      cd cloud-backend
      uv run python main.py --port 8090

  {CYAN}[终端 2] Python Sidecar（yt-dlp + SenseVoice + ffmpeg）{RESET}
      cd python-backend
      uv run python main.py --port 8000

  {CYAN}[终端 3] Tauri 桌面应用（React 前端 + Rust 外壳）{RESET}
      pnpm tauri dev

  {CYAN}[可选] HeyGem 数字人 Docker 服务（需 GPU）{RESET}
      docker compose -f src-tauri/resources/heygem-compose.yml up -d

{BOLD}首次启动必做：{RESET}
  1. 编辑 {MAGENTA}cloud-backend/.env{RESET} 填入 MINIMAX_API_KEY
  2. 在应用 Setup Wizard 里输入测试许可证:
"""
    )
    if license_key:
        print(f"     {BOLD}{MAGENTA}{license_key}{RESET}")
    else:
        print(f"     (重跑 scripts/gen_license.py 生成)")
    print()

    return 0


if __name__ == "__main__":
    sys.exit(main())

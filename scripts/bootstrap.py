#!/usr/bin/env python3
"""KingKaid — 一键环境检测 + 部署脚本

跨平台（Windows / Linux / macOS）自动化：
  1. 检测系统依赖（Python / Node / Rust / uv / pnpm / git / Docker / NVIDIA）
  2. 自动安装可以自动安装的工具（uv, pnpm）
  3. 安装项目依赖（pnpm install + uv sync × 2）
  4. 检测 GPU 并安装 CUDA 版 PyTorch
  5. 生成 .env 配置文件模板
  6. 打印后续启动步骤

用法:
    python scripts/bootstrap.py                  # 完整安装
    python scripts/bootstrap.py --check          # 仅检测，不安装
    python scripts/bootstrap.py --skip-torch     # 跳过 CUDA PyTorch 安装
    python scripts/bootstrap.py --skip-frontend  # 跳过前端依赖
"""
from __future__ import annotations

import argparse
import os
import platform
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Optional

# ─────────────────────────────────────────────────────────────────────────
# 输出辅助
# ─────────────────────────────────────────────────────────────────────────
IS_WIN = platform.system() == "Windows"
IS_MAC = platform.system() == "Darwin"
IS_LINUX = platform.system() == "Linux"

if IS_WIN:
    # Windows CMD 默认不支持 ANSI 色，关闭
    RESET = BOLD = GREEN = YELLOW = RED = CYAN = ""
else:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    RED = "\033[31m"
    CYAN = "\033[36m"


def info(msg: str) -> None:
    print(f"{CYAN}→{RESET} {msg}")


def ok(msg: str) -> None:
    print(f"{GREEN}✓{RESET} {msg}")


def warn(msg: str) -> None:
    print(f"{YELLOW}⚠{RESET} {msg}")


def err(msg: str) -> None:
    print(f"{RED}✗{RESET} {msg}")


def section(title: str) -> None:
    bar = "─" * 60
    print(f"\n{BOLD}{bar}\n  {title}\n{bar}{RESET}")


# ─────────────────────────────────────────────────────────────────────────
# 命令执行
# ─────────────────────────────────────────────────────────────────────────
def run(cmd: list[str] | str, cwd: Optional[Path] = None, check: bool = True) -> subprocess.CompletedProcess:
    """统一的子进程调用。Windows 下 shell=True 处理 pnpm/uv.cmd。"""
    if isinstance(cmd, list):
        pretty = " ".join(cmd)
    else:
        pretty = cmd
    print(f"  $ {pretty}")
    return subprocess.run(
        cmd,
        cwd=cwd,
        check=check,
        shell=isinstance(cmd, str) or IS_WIN,
    )


def capture(cmd: list[str] | str) -> Optional[str]:
    """获取命令输出，失败返回 None。"""
    try:
        out = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            shell=isinstance(cmd, str) or IS_WIN,
            timeout=10,
        )
        if out.returncode != 0:
            return None
        return (out.stdout or out.stderr).strip()
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None


def which(name: str) -> Optional[str]:
    """跨平台 which。"""
    # shutil.which 在 Windows 下会查 PATHEXT，支持 .cmd/.bat
    return shutil.which(name)


# ─────────────────────────────────────────────────────────────────────────
# 检测器
# ─────────────────────────────────────────────────────────────────────────
def parse_version(text: Optional[str]) -> Optional[tuple[int, ...]]:
    if not text:
        return None
    m = re.search(r"(\d+)\.(\d+)(?:\.(\d+))?", text)
    if not m:
        return None
    return tuple(int(x) for x in m.groups() if x is not None)


def check_python() -> bool:
    v = sys.version_info
    if v.major == 3 and v.minor >= 11:
        ok(f"Python {v.major}.{v.minor}.{v.micro}")
        return True
    err(f"Python {v.major}.{v.minor}.{v.micro}  (需要 >= 3.11)")
    return False


def check_node() -> bool:
    if not which("node"):
        err("Node.js 未安装  → https://nodejs.org/  (安装 20 LTS)")
        return False
    v = parse_version(capture(["node", "--version"]))
    if v and v[0] >= 20:
        ok(f"Node.js v{'.'.join(map(str, v))}")
        return True
    err(f"Node.js v{'.'.join(map(str, v or ()))}  (需要 >= 20)")
    return False


def check_rust() -> bool:
    if not which("cargo"):
        err("Rust / cargo 未安装  → https://rustup.rs/")
        return False
    v = parse_version(capture(["cargo", "--version"]))
    if v:
        ok(f"Rust cargo {'.'.join(map(str, v))}")
        return True
    warn("cargo 已安装，但无法解析版本")
    return True


def check_git() -> bool:
    if which("git"):
        ok(f"git  ({capture(['git', '--version'])})")
        return True
    err("git 未安装  → https://git-scm.com/")
    return False


def check_uv() -> bool:
    if which("uv"):
        ok(f"uv  ({capture(['uv', '--version'])})")
        return True
    return False


def check_pnpm() -> bool:
    if which("pnpm"):
        ok(f"pnpm  v{capture(['pnpm', '--version'])}")
        return True
    return False


def check_gpu() -> bool:
    if not which("nvidia-smi"):
        warn("nvidia-smi 未找到  (无 GPU 将退化到 CPU 模式，SenseVoice 会慢 10×)")
        return False
    out = capture(["nvidia-smi", "--query-gpu=name,driver_version", "--format=csv,noheader"])
    if out:
        ok(f"GPU: {out.splitlines()[0]}")
        return True
    warn("nvidia-smi 存在但无法查询 GPU 信息")
    return False


def check_docker() -> bool:
    if not which("docker"):
        warn("Docker 未安装  (HeyGem 数字人视频模块需要)")
        return False
    v = capture(["docker", "--version"])
    ok(f"Docker  ({v})")
    # 检测 NVIDIA Container Toolkit
    if IS_LINUX:
        nvidia_ct = capture(["docker", "info"])
        if nvidia_ct and "nvidia" not in nvidia_ct.lower():
            warn("Docker 未检测到 NVIDIA runtime  (HeyGem 需要)")
    return True


def check_ffmpeg() -> bool:
    # 系统 ffmpeg 可有可无，因为 imageio-ffmpeg 会 bundle 一个
    if which("ffmpeg"):
        ok(f"ffmpeg  ({(capture(['ffmpeg', '-version']) or '').splitlines()[0] if capture(['ffmpeg', '-version']) else ''})")
    else:
        warn("系统 ffmpeg 未安装 — 会使用 imageio-ffmpeg 内置的静态二进制")
    return True  # 非必须


# ─────────────────────────────────────────────────────────────────────────
# 自动安装
# ─────────────────────────────────────────────────────────────────────────
def install_uv() -> bool:
    info("尝试自动安装 uv ...")
    try:
        run([sys.executable, "-m", "pip", "install", "--user", "uv"])
        if which("uv"):
            ok("uv 安装成功")
            return True
    except subprocess.CalledProcessError:
        pass
    err("uv 自动安装失败，请手动安装: pip install --user uv")
    return False


def install_pnpm() -> bool:
    info("尝试通过 corepack 启用 pnpm ...")
    try:
        run(["corepack", "enable", "pnpm"])
        if which("pnpm"):
            ok("pnpm 已启用")
            return True
    except subprocess.CalledProcessError:
        pass
    info("尝试通过 npm 全局安装 pnpm ...")
    try:
        run(["npm", "install", "-g", "pnpm"])
        if which("pnpm"):
            ok("pnpm 安装成功")
            return True
    except subprocess.CalledProcessError:
        pass
    err("pnpm 自动安装失败，请手动: npm install -g pnpm")
    return False


# ─────────────────────────────────────────────────────────────────────────
# 项目依赖安装
# ─────────────────────────────────────────────────────────────────────────
def install_project_deps(root: Path, skip_frontend: bool, skip_torch: bool, has_gpu: bool) -> None:
    section("Step 2 — 安装项目依赖")

    if not skip_frontend:
        info("安装前端依赖 (pnpm install)")
        run(["pnpm", "install"], cwd=root)

    info("同步 python-backend (uv sync)")
    run(["uv", "sync"], cwd=root / "python-backend")

    info("同步 cloud-backend (uv sync)")
    run(["uv", "sync"], cwd=root / "cloud-backend")

    if has_gpu and not skip_torch:
        section("Step 3 — 安装 CUDA 版 PyTorch")
        info("替换 python-backend 的 torch / torchaudio 为 CUDA 12.1 版本")
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
            warn("PyTorch CUDA 安装失败，SenseVoice 将退化到 CPU 模式（仍可工作）")


# ─────────────────────────────────────────────────────────────────────────
# .env 文件生成
# ─────────────────────────────────────────────────────────────────────────
def setup_env_files(root: Path) -> None:
    section("Step 4 — 生成 .env 配置文件")

    cloud_env = root / "cloud-backend" / ".env"
    cloud_example = root / "cloud-backend" / ".env.example"
    if not cloud_env.exists() and cloud_example.exists():
        cloud_env.write_text(cloud_example.read_text(encoding="utf-8"), encoding="utf-8")
        ok(f"已创建 {cloud_env}")
        warn("请编辑填入你的 MINIMAX_API_KEY")
    elif cloud_env.exists():
        ok(f"{cloud_env} 已存在，跳过")

    sidecar_env = root / "python-backend" / ".env"
    if not sidecar_env.exists():
        sidecar_env.write_text(
            "# Python Sidecar 配置\n"
            "CLOUD_BASE_URL=http://127.0.0.1:8090\n"
            "DATABASE_URL=sqlite:///./.data/app.db\n",
            encoding="utf-8",
        )
        ok(f"已创建 {sidecar_env}")


# ─────────────────────────────────────────────────────────────────────────
# 主流程
# ─────────────────────────────────────────────────────────────────────────
def main() -> int:
    parser = argparse.ArgumentParser(
        description="KingKaid 一键环境部署",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--check", action="store_true", help="仅检测环境，不安装任何东西")
    parser.add_argument("--skip-torch", action="store_true", help="跳过 CUDA PyTorch 安装")
    parser.add_argument("--skip-frontend", action="store_true", help="跳过前端依赖")
    args = parser.parse_args()

    root = Path(__file__).resolve().parent.parent
    print(f"{BOLD}KingKaid Bootstrap{RESET}  —  {root}")
    print(f"Platform: {platform.system()} {platform.release()}  |  Python: {sys.version.split()[0]}")

    # ── Step 1 — 检测必要工具 ──
    section("Step 1 — 环境检测")

    py_ok = check_python()
    node_ok = check_node()
    rust_ok = check_rust()
    git_ok = check_git()
    has_gpu = check_gpu()
    check_docker()
    check_ffmpeg()

    # 检测 + 自动安装可以自动处理的工具
    uv_ok = check_uv()
    if not uv_ok and not args.check:
        uv_ok = install_uv()

    pnpm_ok = check_pnpm()
    if not pnpm_ok and not args.check and node_ok:
        pnpm_ok = install_pnpm()

    # 硬性依赖检查
    hard_deps = {
        "Python >= 3.11": py_ok,
        "Node.js >= 20": node_ok,
        "Rust (cargo)": rust_ok,
        "git": git_ok,
        "uv": uv_ok,
        "pnpm": pnpm_ok,
    }
    missing = [name for name, ok_ in hard_deps.items() if not ok_]
    if missing:
        err(f"\n缺失必要依赖: {', '.join(missing)}")
        err("请按上方提示安装后重新运行此脚本")
        return 1

    if args.check:
        section("Check-only 模式 — 检测完成")
        ok("所有必要依赖已就绪，可直接运行: python scripts/bootstrap.py")
        return 0

    # ── Step 2-4 — 安装项目依赖 + 配置文件 ──
    try:
        install_project_deps(root, args.skip_frontend, args.skip_torch, has_gpu)
        setup_env_files(root)
    except subprocess.CalledProcessError as e:
        err(f"安装过程出错: {e}")
        return 2

    # ── 完成 ──
    section("部署完成")
    print(
        f"""
{GREEN}✓{RESET} KingKaid 环境就绪

{BOLD}接下来启动开发环境（需要 3 个终端）：{RESET}

  {CYAN}[1] 云端服务（许可证 + MiniMax 代理）{RESET}
      cd cloud-backend
      uv run python main.py --port 8090

  {CYAN}[2] Python Sidecar（yt-dlp + SenseVoice + ffmpeg）{RESET}
      cd python-backend
      uv run python main.py --port 8000

  {CYAN}[3] Tauri 桌面应用（React UI）{RESET}
      pnpm tauri dev

  {CYAN}[可选] HeyGem 数字人 Docker 服务{RESET}
      docker compose -f src-tauri/resources/heygem-compose.yml up -d

{BOLD}首次使用请：{RESET}
  1. 编辑 cloud-backend/.env 填入 MINIMAX_API_KEY
  2. 生成测试许可证:  cd cloud-backend && uv run python scripts/gen_license.py
  3. 启动服务后在应用内走完 Setup Wizard
"""
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

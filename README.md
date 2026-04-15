# KingKaid — 短视频 AI 工具

基于 Tauri v2 + React 19 + FastAPI + HeyGem + SenseVoice 的桌面应用，包含
13 个短视频创作模块。

## 功能模块

1. **洗稿** — 抖音视频 → SenseVoice 转录 → Claude 改写
2. **数字人视频** — HeyGem TTS + 口型同步 4K 视频
3. **视频剪辑** — 时间轴裁剪 + 合并
4. **混剪视频** — 6 类别素材库 + 随机拼接
5. **画中画** — overlay 合成
6. **字幕生成** — SRT/ASS 导出
7. **封面制作** — 9 款 Pillow 模板
8. **背景音乐** — BGM 混音 + 淡入淡出
9. **声音克隆** — HeyGem TTS 复用
10. **标题话题** — SSE 流式 AI 生成
11. **违规词检测** — 本地词库 + 分类高亮
12. **账号系统** — 云端许可证 JWT
13. **竞品分析** — yt-dlp + ASR 一键提取

## 架构

```
Tauri v2 (Rust 外壳)
  ├── WebView: React 19 + Vite 6 + Tailwind v4 + TanStack Router
  ├── Python Sidecar (FastAPI, PyInstaller 打包)
  │     ├── yt-dlp / ffmpeg / SenseVoice / HeyGem / Cloud Proxy
  │     └── SQLite (Jobs + APScheduler)
  └── Docker: HeyGem (Duix.Avatar) — 本地 GPU

云端 VPS
  └── FastAPI + SQLite
        ├── /license/activate|validate
        └── /claude/rewrite|title (SSE 代理 Anthropic)
```

## 开发环境搭建

### 系统依赖

| 组件 | 版本 | 说明 |
|------|------|------|
| NVIDIA Driver | 530+ | GPU |
| CUDA | 12.1+ | SenseVoice + HeyGem |
| Docker + NVIDIA Container Toolkit | 最新 | HeyGem |
| Node.js | 20 LTS | 前端构建 |
| Rust | 1.77+ | Tauri |
| Python | 3.11 | Sidecar + 云端 |
| pnpm | 9 | 前端包管理 |
| uv | 0.4+ | Python 包管理 |
| ffmpeg | 系统或 imageio-ffmpeg | 自动捆绑 |

**Linux 额外依赖** (Ubuntu/Debian):
```bash
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
```

### 一键部署（推荐）

自动检测环境 + 安装所有依赖 + 生成配置文件：

**Windows（CMD）**：
```cmd
bootstrap.bat
```

**Linux / macOS**：
```bash
./bootstrap.sh
```

**或直接用 Python**（任何平台）：
```bash
python scripts/bootstrap.py            # 完整安装
python scripts/bootstrap.py --check    # 仅检测环境，不安装
```

脚本会：
1. 检测 Python / Node / Rust / git / uv / pnpm / Docker / NVIDIA GPU
2. 自动安装 uv 和 pnpm（如果缺失）
3. 执行 `pnpm install` + `uv sync`（python-backend + cloud-backend）
4. 检测到 GPU 时自动安装 CUDA 版 PyTorch
5. 从 `.env.example` 生成 `cloud-backend/.env` 模板
6. 打印后续启动步骤

### 旧式安装（仅限已配置好所有工具的环境）

```bash
make setup-dev
```

### 启动开发环境 (3 个终端)

```bash
# 终端 1: 云端服务
cd cloud-backend && uv run python main.py --port 8090

# 终端 2: Python sidecar
cd python-backend && uv run python main.py --port 8000

# 终端 3: Tauri 桌面应用 (热重载)
pnpm tauri dev

# 可选: HeyGem Docker
docker compose -f src-tauri/resources/heygem-compose.yml up
```

## 生产构建

### 1. 构建 Python Sidecar (PyInstaller)

```bash
cd python-backend
uv run pyinstaller --clean api.spec
# 产物: python-backend/dist/api/api
```

### 2. 放置到 Tauri bin 目录

```bash
# 二进制命名必须包含目标三元组
cp python-backend/dist/api/api \
   src-tauri/bin/api-x86_64-unknown-linux-gnu
```

### 3. 构建前端

```bash
pnpm build
```

### 4. 构建 Tauri 安装包

```bash
pnpm tauri build
```

产物：
- Linux: `src-tauri/target/release/bundle/appimage/*.AppImage`
- Linux: `src-tauri/target/release/bundle/deb/*.deb`
- Windows: `src-tauri/target/release/bundle/nsis/*-setup.exe`
- macOS: `src-tauri/target/release/bundle/dmg/*.dmg`

**或用一条命令**：

```bash
make build
```

## 代码签名与分发

- **Windows**: Authenticode 证书 (DigiCert / SSL.com, ~$200/年)
- **macOS**: Apple Developer 证书 ($99/年) + `xcrun notarytool submit`
- **Linux**: 可选 GPG 签名

签名后将产物上传至 CDN，用户通过应用内 Tauri updater 自动升级。

## 许可证

源代码采用 MIT。使用的第三方模型/工具遵循各自许可：

- HeyGem (Duix.Avatar) — MIT (年收入 <$10M 免授权)
- SenseVoice Small — MIT
- Tauri v2 — Apache 2.0 / MIT
- yt-dlp — Unlicense
- Anthropic Claude API — 商业 API (平台代付)

## 重要合规声明

⚠️ 本工具仅供用户处理自己发布的内容或已获授权的内容。
不得用于侵犯他人版权 / 肖像权 / 隐私权；
数字人视频严禁用于伪造、诈骗、名誉损害等不当用途。

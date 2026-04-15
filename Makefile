# KingKaid — unified dev / build / release automation
#
# Phases mirror the Stage breakdown in plan file:
#   setup-dev       → install all dependencies
#   dev             → prints instructions for running the 3 dev processes
#   test            → smoke-tests for the Python sidecar + cloud backend
#   build-sidecar   → PyInstaller → src-tauri/bin/api-<target>
#   build           → full production build → dist/
#   clean           → scrub all build artifacts
#
# Useful env vars:
#   RUST_TARGET     → cargo target triple (default: host triple)

RUST_TARGET ?= $(shell rustc -vV | sed -n 's|host: ||p')
SIDECAR_NAME = api-$(RUST_TARGET)

.PHONY: bootstrap check setup-dev dev test test-sidecar test-cloud build build-sidecar build-frontend build-tauri clean help

help:
	@echo "KingKaid — available make targets:"
	@echo "  bootstrap       Auto-detect + install all dependencies (recommended)"
	@echo "  check           Check environment only (no install)"
	@echo "  setup-dev       Install all dependencies (pnpm, uv, cargo)"
	@echo "  dev             Show commands for launching 3 dev terminals"
	@echo "  test            Run Python smoke tests (sidecar + cloud)"
	@echo "  build-sidecar   PyInstaller → src-tauri/bin/$(SIDECAR_NAME)"
	@echo "  build           Full production build → dist/"
	@echo "  clean           Remove all build artifacts"

bootstrap:
	python3 scripts/bootstrap.py

check:
	python3 scripts/bootstrap.py --check

setup-dev:
	corepack enable pnpm
	pnpm install
	cd python-backend && uv sync
	cd cloud-backend && uv sync
	@echo ""
	@echo "✓ Dependencies installed."
	@echo "  Next: install NVIDIA driver + Docker + NVIDIA Container Toolkit manually."

dev:
	@echo "KingKaid dev environment requires 3 terminals:"
	@echo ""
	@echo "  [1] Cloud backend:"
	@echo "      cd cloud-backend && uv run python main.py --port 8090"
	@echo ""
	@echo "  [2] Python sidecar:"
	@echo "      cd python-backend && uv run python main.py --port 8000"
	@echo ""
	@echo "  [3] Tauri desktop app (hot reload):"
	@echo "      pnpm tauri dev"
	@echo ""
	@echo "  [optional] HeyGem Docker:"
	@echo "      docker compose -f src-tauri/resources/heygem-compose.yml up"

test: test-sidecar test-cloud

test-sidecar:
	@echo "→ Sidecar smoke tests"
	cd python-backend && uv run python -c "from main import app; from db.session import init_db; init_db(); print('✓ sidecar imports + DB init OK')"

test-cloud:
	@echo "→ Cloud backend smoke tests"
	cd cloud-backend && uv run python -c "from main import app; from db.session import init_db; init_db(); print('✓ cloud imports + DB init OK')"

build-sidecar:
	@echo "→ Building Python sidecar (PyInstaller)"
	cd python-backend && uv run pyinstaller --clean api.spec
	mkdir -p src-tauri/bin
	cp python-backend/dist/api/api src-tauri/bin/$(SIDECAR_NAME)
	cp -r python-backend/dist/api/_internal src-tauri/bin/_internal || true
	@echo "✓ Sidecar → src-tauri/bin/$(SIDECAR_NAME)"

build-frontend:
	pnpm build

build-tauri:
	pnpm tauri build

build: build-frontend build-sidecar build-tauri
	@echo ""
	@echo "✓ Production bundle written to src-tauri/target/release/bundle/"

clean:
	rm -rf node_modules dist
	rm -rf python-backend/.venv python-backend/dist python-backend/build
	rm -rf cloud-backend/.venv cloud-backend/dist cloud-backend/build
	rm -rf src-tauri/target src-tauri/bin/api-*
	@echo "✓ All build artifacts removed"

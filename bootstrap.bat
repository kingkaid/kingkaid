@echo off
REM KingKaid Windows bootstrap wrapper
REM 检测 Python 是否存在，如果存在则转发给 scripts/bootstrap.py

setlocal

where python >nul 2>nul
if errorlevel 1 (
    echo.
    echo [ERROR] Python not found on PATH.
    echo.
    echo Please install Python 3.11 first:
    echo   1. Download from https://www.python.org/downloads/release/python-3118/
    echo   2. During install, CHECK "Add Python to PATH"
    echo   3. Re-open CMD and run bootstrap.bat again
    echo.
    pause
    exit /b 1
)

python scripts\bootstrap.py %*
exit /b %errorlevel%

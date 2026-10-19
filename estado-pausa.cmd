@echo off
cd /d "%~dp0"
node scripts/game-pause.mjs status
echo.
pause

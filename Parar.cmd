@echo off
cd /d "%~dp0"
node scripts/project.mjs stop
if errorlevel 1 pause

@echo off
cd /d "%~dp0"
node scripts/project.mjs restart --open
if errorlevel 1 pause

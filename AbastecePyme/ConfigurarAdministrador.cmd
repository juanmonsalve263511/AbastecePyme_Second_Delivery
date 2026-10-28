@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Ejecuta primero Instalar.cmd.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" SetupAdmin.py
pause


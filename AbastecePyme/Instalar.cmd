@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" py -3.14 -m venv .venv
if errorlevel 1 goto failed
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto failed
call npm ci --prefix frontend
if errorlevel 1 goto failed
call npm run build --prefix frontend
if errorlevel 1 goto failed
echo Instalacion lista. Ejecuta ConfigurarAdministrador.cmd y luego Iniciar.cmd.
pause
exit /b 0
:failed
echo La instalacion no termino. Revisa el mensaje anterior.
pause
exit /b 1


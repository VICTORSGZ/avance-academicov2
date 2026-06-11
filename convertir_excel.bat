@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo ===============================================
echo  Conversor de malla Excel a JavaScript
echo ===============================================
echo.
echo Archivo origen : data\malla_base.xlsx
echo Archivo salida : data\malla_base.js
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\convertir_excel.ps1"
echo.
pause

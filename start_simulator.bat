@echo off
cd /d "%~dp0"
title BionicHand 3D Studio - Taller y Simulador de Mano Protesica
echo ======================================================================
echo  Iniciando BionicHand 3D Studio - Taller y Simulador Didactico
echo  Basado en documentos de investigacion (DIN 33402, Buryanov, UPS, UNAB)
echo ======================================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    node server.js
) else (
    python servidor.py
)
pause

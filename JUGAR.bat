@echo off
title Car Rocket
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\servidor.ps1"
if errorlevel 1 pause

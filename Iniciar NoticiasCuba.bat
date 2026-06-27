@echo off
title NoticiasCuba
cd /d "%~dp0"
echo  Iniciando NoticiasCuba...
start "" http://localhost:5050
node server.js
pause

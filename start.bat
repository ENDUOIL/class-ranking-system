@echo off
cd /d "%~dp0"
title 25.1班操行排位赛
echo 正在启动服务器...
echo 按 Ctrl+C 可停止服务器
echo.
start http://localhost:3000
node server.cjs
pause

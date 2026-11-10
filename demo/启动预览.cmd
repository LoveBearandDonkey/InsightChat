@echo off
cd /d "%~dp0.."
echo.
echo Open http://127.0.0.1:2027/demo/ in your browser.
echo Keep this window open while using the demo. Press Ctrl+C to stop.
echo.
node demo/server.cjs
pause

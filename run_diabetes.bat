@echo off
title AI Diabetes Diagnostic Backend (.venv)
echo ========================================================
echo   KHOI DONG BACKEND HE CHUYEN GIA Y TE (DIABETES)
echo   Moi truong ao: E:\2026-2\PHAT-TRIEN-HE-THONG-THONG-MINH\asign2\.venv
echo ========================================================
echo.
echo [*] Dang kich hoat moi truong ao (.venv)...
call .venv\Scripts\activate.bat
echo [+] Da kich hoat .venv thanh cong!
echo [*] Dang mo trinh duyet Dashboard: http://localhost:8001 ...
start http://localhost:8001
echo.
echo [*] Dang khoi dong FastAPI Backend tren http://localhost:8001 ...
python diabetes\api\main.py
pause

@echo off
title AI Shopee Customer Experience & Sentiment Backend (.venv)
echo ========================================================
echo   KHOI DONG BACKEND PHAN TICH DANH GIA SHOPEE (CUSTOMER BEHAVIOR)
echo   Moi truong ao: E:\2026-2\PHAT-TRIEN-HE-THONG-THONG-MINH\asign2\.venv
echo ========================================================
echo.
echo [*] Dang kich hoat moi truong ao (.venv)...
call .venv\Scripts\activate.bat
echo [+] Da kich hoat .venv thanh cong!
echo [*] Dang mo trinh duyet Dashboard: http://localhost:8003 ...
start http://localhost:8003
echo.
echo [*] Dang khoi dong FastAPI Backend tren http://localhost:8003 ...
python customer_behavior\api\main.py
pause

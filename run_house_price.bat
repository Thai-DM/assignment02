@echo off
title AI Real Estate Valuation & Investment Backend (.venv)
echo ========================================================
echo   KHOI DONG BACKEND HE CHUYEN GIA DINH GIA BDS (HOUSE PRICE)
echo   Moi truong ao: E:\2026-2\PHAT-TRIEN-HE-THONG-THONG-MINH\asign2\.venv
echo ========================================================
echo.
echo [*] Dang kich hoat moi truong ao (.venv)...
call .venv\Scripts\activate.bat
echo [+] Da kich hoat .venv thanh cong!
echo [*] Dang mo trinh duyet Dashboard: http://localhost:8002 ...
start http://localhost:8002
echo.
echo [*] Dang khoi dong FastAPI Backend tren http://localhost:8002 ...
python house_price\api\main.py
pause

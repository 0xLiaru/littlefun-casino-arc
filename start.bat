@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo       ARC PLINKO V2 SETUP & START
echo ========================================
echo.

:: 1. Eski processleri kapat
echo [!] Eski node processleri kapatiliyor...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 5 /nobreak > nul

:: 2. Bagimliliklari kontrol et
if not exist "node_modules\" (
    echo [!] node_modules bulunamadi. Yukleniyor...
    call npm install
)

echo [1/5] Hardhat Yerel Agi (Node) baslatiliyor...
start "Hardhat Node" cmd /k "npx hardhat node"

echo.
echo [!] Agin hazirlanmasi icin bekleniyor (15 saniye)...
timeout /t 15 /nobreak > nul

echo [2/5] Kontratlar derleniyor...
call npx hardhat compile

echo [3/5] Kontratlar deploy ediliyor...
call npx hardhat run scripts/deploy.js --network localhost
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [HATA] Deploy sirasinda bir sorun olustu! 
    echo Lutfen Hardhat Node penceresindeki hatalari kontrol edin.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [4/5] Backend API sunucusu baslatiliyor (Port 3001)...
start "LITTLEFUN Backend" cmd /k "node backend/server.js"
timeout /t 3 /nobreak > nul

echo [5/5] Frontend sunucusu baslatiliyor...
start "Arc Plinko Frontend" cmd /k "npx http-server ./frontend -p 8080 -c-1 -o"

echo.
echo ========================================
echo  HER SEY HAZIR!
echo.
echo - Blok zinciri: http://127.0.0.1:8545
echo - Backend API : http://127.0.0.1:3001
echo - Oyun Paneli : http://127.0.0.1:8080
echo ========================================
echo.
echo Kapatmak icin bu pencereleri kapatabilirsiniz.
pause

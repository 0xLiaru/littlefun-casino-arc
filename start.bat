@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo       LITTLEFUN SETUP & START
echo ========================================
echo.

:: 1. Kill old processes
echo [!] Closing old node processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 5 /nobreak > nul

:: 2. Check dependencies
if not exist "node_modules\" (
    echo [!] node_modules not found. Installing...
    call npm install
)

echo [1/5] Starting Hardhat Local Network (Node)...
start "Hardhat Node" cmd /k "npx hardhat node"

echo.
echo [!] Waiting for network initialization (15 seconds)...
timeout /t 15 /nobreak > nul

echo [2/5] Compiling contracts...
call npx hardhat compile

echo [3/5] Deploying contracts...
call npx hardhat run scripts/deploy.js --network localhost
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Something went wrong during deployment! 
    echo Please check the errors in the Hardhat Node window.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [4/5] Starting Backend API server (Port 3001)...
start "LITTLEFUN Backend" cmd /k "node backend/server.js"
timeout /t 3 /nobreak > nul

echo [5/5] Starting Frontend server...
start "LITTLEFUN Frontend" cmd /k "npx http-server ./frontend -p 8080 -c-1 -o"

echo.
echo ========================================
echo  EVERYTHING IS READY!
echo.
echo - Blockchain  : http://127.0.0.1:8545
echo - Backend API : http://127.0.0.1:3001
echo - Game Panel  : http://127.0.0.1:8080
echo ========================================
echo.
echo You can close these windows to stop the servers.
pause

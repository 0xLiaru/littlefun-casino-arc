@echo off
echo ========================================
echo   🚀 LITTLEFUN GITHUB UPLOADER
echo ========================================

:: Set URL directly
set repo_url=https://github.com/0xLiaru/littlefun-casino-arc

echo.
echo [1/5] Git baslatiliyor...
git init

echo [2/5] Dosyalar ekleniyor...
git add .

echo [3/5] Commit yapiliyor...
git commit -m "feat: blackjack professional upgrade - split mechanics, interactive chip betting, table spots, and side bet win animations"

echo [4/5] Branch ayarlandiliyor...
git branch -M main

echo [5/5] Uzak sunucu ayarlandiliyor...
git remote remove origin >nul 2>&1
git remote add origin %repo_url%

echo [6/5] GitHub'a gonderiliyor...
git push -u origin main

echo.
echo ========================================
echo   ✅ ISLEM TAMAMLANDI!
echo ========================================
pause

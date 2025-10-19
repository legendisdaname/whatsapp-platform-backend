@echo off
echo ========================================
echo Push Backend to GitHub
echo ========================================
echo.

REM Check if git is installed
where git >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Git is not installed!
    echo.
    echo Download GitHub Desktop (easier): https://desktop.github.com
    echo Or install Git: https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)

echo ✅ Git is installed
echo.

REM Check if already a git repo
if not exist ".git" (
    echo Initializing Git repository...
    git init
    echo ✅ Git initialized
    echo.
)

echo Staging all backend files...
git add .
echo.

echo Files to commit:
git status --short
echo.

set /p COMMIT_MSG="Commit message (or press Enter for default): "
if "%COMMIT_MSG%"=="" set COMMIT_MSG=WhatsApp Platform Backend - Complete API

echo.
git commit -m "%COMMIT_MSG%"
echo.

REM Check if remote exists
git remote -v | findstr origin >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ========================================
    echo GitHub Repository Setup
    echo ========================================
    echo.
    echo 1. Go to: https://github.com/new
    echo 2. Repository name: whatsapp-platform-backend
    echo 3. Description: WhatsApp automation backend API
    echo 4. Click "Create repository"
    echo 5. Copy the repository URL
    echo.
    set /p REPO_URL="Paste repository URL here: "
    
    if "%REPO_URL%"=="" (
        echo ERROR: Repository URL required!
        pause
        exit /b 1
    )
    
    git remote add origin %REPO_URL%
    git branch -M main
)

echo.
echo ========================================
echo Pushing to GitHub...
echo ========================================
echo.

git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo ✅ SUCCESS!
    echo ========================================
    echo.
    echo Backend is now on GitHub!
    echo.
    echo Next steps:
    echo 1. Deploy to Render.com (see QUICK_DEPLOY_RENDER.md)
    echo 2. Push frontend separately
    echo.
) else (
    echo.
    echo ========================================
    echo PUSH FAILED!
    echo ========================================
    echo.
    echo If authentication failed:
    echo - Use Personal Access Token (not password)
    echo - Get token: https://github.com/settings/tokens
    echo.
)

pause


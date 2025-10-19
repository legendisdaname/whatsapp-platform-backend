@echo off
echo ========================================
echo Fix Backend Crash and Start Server
echo ========================================
echo.

echo Step 1: Installing ALL dependencies...
echo.
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ npm install failed!
    echo Try running: npm install --force
    pause
    exit /b 1
)

echo.
echo ✅ Dependencies installed successfully!
echo.

echo Step 2: Checking .env file...
if exist ".env" (
    echo ✅ .env file found
) else (
    echo ⚠️  .env file not found!
    echo.
    echo Creating .env from example...
    if exist ".env.example" (
        copy .env.example .env
        echo.
        echo ✅ .env created!
        echo ⚠️  IMPORTANT: Edit .env and add your Supabase credentials!
        echo.
        pause
    ) else (
        echo.
        echo ❌ .env.example not found!
        echo Please create .env manually with your Supabase credentials
        pause
        exit /b 1
    )
)

echo.
echo Step 3: Running diagnostic...
echo.
node diagnostic.js

echo.
echo Step 4: Starting server...
echo.
echo ========================================
echo Press Ctrl+C to stop the server
echo ========================================
echo.

npm run dev


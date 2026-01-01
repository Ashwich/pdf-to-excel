@echo off
echo Installing backend dependencies...
call npm install

echo.
echo Installing frontend dependencies...
cd client
call npm install
cd ..

echo.
echo Setup complete!
echo.
echo To start the application:
echo   1. Run: npm start (for backend)
echo   2. In another terminal, run: npm run client (for frontend)
echo.
pause


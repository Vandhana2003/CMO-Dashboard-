@echo off
echo ==========================================
echo  CMO Command Centre - Setup Script
echo ==========================================
echo.

echo [1/4] Installing server dependencies...
cd /d "%~dp0server"
call npm install
echo.

echo [2/4] Installing client dependencies...
cd /d "%~dp0client"
call npm install
echo.

echo [3/4] Setup complete!
echo.
echo ==========================================
echo  NEXT STEPS:
echo ==========================================
echo.
echo  1. Install PostgreSQL if not installed:
echo     https://www.postgresql.org/download/windows/
echo.
echo  2. Create database:
echo     Open pgAdmin or psql and run:
echo     CREATE DATABASE cmo_dashboard;
echo.
echo  3. Run the schema:
echo     psql -U postgres -d cmo_dashboard -f database\init.sql
echo.
echo  4. Update server\.env with your PostgreSQL password
echo.
echo  5. Start the backend:
echo     cd server ^&^& npm run dev
echo.
echo  6. Start the frontend (new terminal):
echo     cd client ^&^& npm run dev
echo.
echo  Default Login: admin@cmo.com / admin123
echo ==========================================
pause

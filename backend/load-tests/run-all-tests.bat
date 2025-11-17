@echo off
REM Batch script to run all load tests on Windows
REM Alternative to PowerShell script for environments where PS is restricted

setlocal EnableDelayedExpansion

set BASE_URL=http://localhost:3000
set TEST_SUITE=all

REM Parse command line arguments
:parse_args
if "%~1"=="" goto :start_tests
if /i "%~1"=="--base-url" (
    set BASE_URL=%~2
    shift
    shift
    goto :parse_args
)
if /i "%~1"=="--suite" (
    set TEST_SUITE=%~2
    shift
    shift
    goto :parse_args
)
shift
goto :parse_args

:start_tests
echo ============================================
echo University Admission Portal - Load Test Suite
echo ============================================
echo.
echo Base URL: %BASE_URL%
echo Test Suite: %TEST_SUITE%
echo.

REM Check if k6 is installed
where k6 >nul 2>nul
if errorlevel 1 (
    echo [ERROR] k6 is not installed
    echo Please install k6 from https://k6.io/docs/getting-started/installation/
    exit /b 1
)

echo [OK] k6 is installed
echo.

REM Check if server is running
echo Checking if server is running...
curl -s -o nul -w "%%{http_code}" %BASE_URL%/health > temp_status.txt
set /p STATUS_CODE=<temp_status.txt
del temp_status.txt

if not "%STATUS_CODE%"=="200" (
    echo [ERROR] Server is not responding at %BASE_URL%
    echo Please start the server first: cd backend ^&^& npm run start:dev
    exit /b 1
)

echo [OK] Server is running
echo.

REM Create results directory
if not exist "results\raw" mkdir results\raw

set TIMESTAMP=%date:~10,4%%date:~4,2%%date:~7,2%-%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%

REM Run tests based on suite
if /i "%TEST_SUITE%"=="all" goto :run_all
if /i "%TEST_SUITE%"=="spike" goto :run_spike
if /i "%TEST_SUITE%"=="sustained" goto :run_sustained
if /i "%TEST_SUITE%"=="pattern" goto :run_pattern
if /i "%TEST_SUITE%"=="quick" goto :run_quick

echo [ERROR] Unknown test suite: %TEST_SUITE%
echo Available suites: all, spike, sustained, pattern, quick
exit /b 1

:run_all
echo Running all tests...
call :run_test "k6-load-test.js" "Basic Load Test" "basic-load-%TIMESTAMP%.json"
call :run_test "spike-test.js" "Spike Test" "spike-%TIMESTAMP%.json"
call :run_test "sustained-load-test.js" "Sustained Load Test" "sustained-%TIMESTAMP%.json"
call :run_test "pattern-specific-test.js" "Pattern-Specific Test" "pattern-%TIMESTAMP%.json"
goto :finish

:run_spike
call :run_test "spike-test.js" "Spike Test" "spike-%TIMESTAMP%.json"
goto :finish

:run_sustained
call :run_test "sustained-load-test.js" "Sustained Load Test" "sustained-%TIMESTAMP%.json"
goto :finish

:run_pattern
call :run_test "pattern-specific-test.js" "Pattern-Specific Test" "pattern-%TIMESTAMP%.json"
goto :finish

:run_quick
call :run_test "k6-load-test.js" "Basic Load Test" "basic-load-%TIMESTAMP%.json"
goto :finish

:run_test
echo.
echo ========================================
echo Running: %~2
echo ========================================
echo.

set OUTPUT_FILE=results\raw\%~3
k6 run --env BASE_URL=%BASE_URL% --summary-export="%OUTPUT_FILE%" "%~1"

if errorlevel 1 (
    echo [FAILED] %~2
) else (
    echo [SUCCESS] %~2
    echo Results saved to: %OUTPUT_FILE%
)
goto :eof

:finish
echo.
echo ============================================
echo Load Testing Complete
echo ============================================
echo.
echo Results are available in: results\raw\
echo.

pause
exit /b 0

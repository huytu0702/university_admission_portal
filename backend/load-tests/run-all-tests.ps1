# Load Test Orchestration Script for PowerShell
# Runs all load tests, collects results, and generates reports

param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$TestSuite = "all",  # all, spike, sustained, pattern, quick
    [switch]$SkipReports = $false
)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "University Admission Portal - Load Test Suite" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ResultsDir = Join-Path $ScriptDir "results"
$RawResultsDir = Join-Path $ResultsDir "raw"

# Ensure results directories exist
if (-not (Test-Path $ResultsDir)) {
    New-Item -ItemType Directory -Path $ResultsDir | Out-Null
}
if (-not (Test-Path $RawResultsDir)) {
    New-Item -ItemType Directory -Path $RawResultsDir | Out-Null
}

# Track test results
$TestResults = @()
$StartTime = Get-Date

function Write-TestHeader {
    param([string]$TestName)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "Running: $TestName" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
}

function Write-TestResult {
    param(
        [string]$TestName,
        [string]$Status,
        [string]$ResultFile
    )
    
    $Result = @{
        TestName = $TestName
        Status = $Status
        ResultFile = $ResultFile
        Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    }
    
    $script:TestResults += $Result
    
    if ($Status -eq "SUCCESS") {
        Write-Host "✓ $TestName completed successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ $TestName failed" -ForegroundColor Red
    }
}

function Run-K6Test {
    param(
        [string]$TestFile,
        [string]$TestName,
        [string]$OutputFile
    )
    
    Write-TestHeader $TestName
    
    $FullOutputPath = Join-Path $RawResultsDir $OutputFile
    
    try {
        $k6Command = "k6 run --env BASE_URL=$BaseUrl --summary-export=`"$FullOutputPath`" `"$TestFile`""
        Write-Host "Command: $k6Command" -ForegroundColor Gray
        
        Invoke-Expression $k6Command
        
        if ($LASTEXITCODE -eq 0) {
            Write-TestResult -TestName $TestName -Status "SUCCESS" -ResultFile $FullOutputPath
        } else {
            Write-TestResult -TestName $TestName -Status "FAILED" -ResultFile $FullOutputPath
        }
    } catch {
        Write-Host "Error running test: $_" -ForegroundColor Red
        Write-TestResult -TestName $TestName -Status "FAILED" -ResultFile ""
    }
}

# Check if k6 is installed
Write-Host "Checking prerequisites..." -ForegroundColor Cyan
$k6Installed = Get-Command k6 -ErrorAction SilentlyContinue

if (-not $k6Installed) {
    Write-Host "✗ k6 is not installed. Please install k6 from https://k6.io/docs/getting-started/installation/" -ForegroundColor Red
    exit 1
}

Write-Host "✓ k6 is installed" -ForegroundColor Green
Write-Host ""

# Check if server is running
Write-Host "Checking if server is running at $BaseUrl..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/health" -Method Get -TimeoutSec 5 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ Server is running" -ForegroundColor Green
    } else {
        Write-Host "⚠ Server responded with status $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ Server is not responding. Please start the server first." -ForegroundColor Red
    Write-Host "  Run: cd backend && npm run start:dev" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Starting test suite: $TestSuite" -ForegroundColor Cyan
Write-Host ""

# Run tests based on test suite
switch ($TestSuite) {
    "all" {
        Run-K6Test -TestFile (Join-Path $ScriptDir "k6-load-test.js") -TestName "Basic Load Test" -OutputFile "basic-load-test-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
        Run-K6Test -TestFile (Join-Path $ScriptDir "spike-test.js") -TestName "Spike Test" -OutputFile "spike-test-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
        Run-K6Test -TestFile (Join-Path $ScriptDir "sustained-load-test.js") -TestName "Sustained Load Test" -OutputFile "sustained-load-test-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
        Run-K6Test -TestFile (Join-Path $ScriptDir "pattern-specific-test.js") -TestName "Pattern-Specific Test" -OutputFile "pattern-specific-test-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
        Run-K6Test -TestFile (Join-Path $ScriptDir "comprehensive-k6-test.js") -TestName "Comprehensive Test" -OutputFile "comprehensive-test-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
    }
    "spike" {
        Run-K6Test -TestFile (Join-Path $ScriptDir "spike-test.js") -TestName "Spike Test" -OutputFile "spike-test-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
    }
    "sustained" {
        Run-K6Test -TestFile (Join-Path $ScriptDir "sustained-load-test.js") -TestName "Sustained Load Test" -OutputFile "sustained-load-test-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
    }
    "pattern" {
        Run-K6Test -TestFile (Join-Path $ScriptDir "pattern-specific-test.js") -TestName "Pattern-Specific Test" -OutputFile "pattern-specific-test-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
    }
    "quick" {
        Run-K6Test -TestFile (Join-Path $ScriptDir "k6-load-test.js") -TestName "Basic Load Test" -OutputFile "basic-load-test-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
    }
    default {
        Write-Host "Unknown test suite: $TestSuite" -ForegroundColor Red
        Write-Host "Available suites: all, spike, sustained, pattern, quick" -ForegroundColor Yellow
        exit 1
    }
}

$EndTime = Get-Date
$Duration = $EndTime - $StartTime

# Print summary
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Test Suite Summary" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Total Duration: $($Duration.ToString('hh\:mm\:ss'))" -ForegroundColor White
Write-Host ""

$SuccessCount = ($TestResults | Where-Object { $_.Status -eq "SUCCESS" }).Count
$FailCount = ($TestResults | Where-Object { $_.Status -eq "FAILED" }).Count

Write-Host "Tests Run: $($TestResults.Count)" -ForegroundColor White
Write-Host "Passed: $SuccessCount" -ForegroundColor Green
Write-Host "Failed: $FailCount" -ForegroundColor $(if ($FailCount -gt 0) { "Red" } else { "Gray" })
Write-Host ""

# Display individual test results
Write-Host "Test Results:" -ForegroundColor Cyan
foreach ($result in $TestResults) {
    $statusColor = if ($result.Status -eq "SUCCESS") { "Green" } else { "Red" }
    $statusIcon = if ($result.Status -eq "SUCCESS") { "✓" } else { "✗" }
    
    Write-Host "  $statusIcon $($result.TestName)" -ForegroundColor $statusColor
    if ($result.ResultFile) {
        Write-Host "     Result: $($result.ResultFile)" -ForegroundColor Gray
    }
}

Write-Host ""

# Process results and generate reports (if not skipped)
if (-not $SkipReports -and $SuccessCount -gt 0) {
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "Processing Results and Generating Reports" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Check if Node.js is available
    $nodeInstalled = Get-Command node -ErrorAction SilentlyContinue
    
    if ($nodeInstalled) {
        # Process each successful test result
        foreach ($result in $TestResults | Where-Object { $_.Status -eq "SUCCESS" -and $_.ResultFile }) {
            Write-Host "Processing: $($result.TestName)..." -ForegroundColor Cyan
            
            try {
                # Parse and standardize results
                $collectorScript = Join-Path $ScriptDir "test-result-collector.js"
                $parseCommand = "node `"$collectorScript`" parse-k6 `"$($result.ResultFile)`""
                
                Write-Host "  Parsing results..." -ForegroundColor Gray
                Invoke-Expression $parseCommand
                
                Write-Host "  ✓ Results processed" -ForegroundColor Green
            } catch {
                Write-Host "  ✗ Error processing results: $_" -ForegroundColor Red
            }
        }
        
        Write-Host ""
        Write-Host "Report generation complete. Check the results/reports directory." -ForegroundColor Green
    } else {
        Write-Host "⚠ Node.js is not installed. Skipping report generation." -ForegroundColor Yellow
        Write-Host "  Install Node.js to enable automatic report generation." -ForegroundColor Gray
    }
} elseif ($SkipReports) {
    Write-Host "Report generation skipped (use -SkipReports:$false to enable)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Load Testing Complete" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Exit with appropriate code
if ($FailCount -gt 0) {
    exit 1
} else {
    exit 0
}

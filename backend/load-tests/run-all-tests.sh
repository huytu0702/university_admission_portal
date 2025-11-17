#!/bin/bash

# Load Test Orchestration Script for Bash
# Runs all load tests, collects results, and generates reports

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${1:-http://localhost:3000}"
TEST_SUITE="${2:-all}"  # all, spike, sustained, pattern, quick
SKIP_REPORTS="${SKIP_REPORTS:-false}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="$SCRIPT_DIR/results"
RAW_RESULTS_DIR="$RESULTS_DIR/raw"

# Ensure results directories exist
mkdir -p "$RESULTS_DIR"
mkdir -p "$RAW_RESULTS_DIR"

# Track test results
declare -a TEST_RESULTS=()
START_TIME=$(date +%s)

echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}University Admission Portal - Load Test Suite${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""

function write_test_header() {
    local test_name=$1
    echo ""
    echo -e "${YELLOW}========================================${NC}"
    echo -e "${YELLOW}Running: $test_name${NC}"
    echo -e "${YELLOW}========================================${NC}"
    echo ""
}

function write_test_result() {
    local test_name=$1
    local status=$2
    local result_file=$3
    
    TEST_RESULTS+=("$test_name|$status|$result_file")
    
    if [ "$status" == "SUCCESS" ]; then
        echo -e "${GREEN}✓ $test_name completed successfully${NC}"
    else
        echo -e "${RED}✗ $test_name failed${NC}"
    fi
}

function run_k6_test() {
    local test_file=$1
    local test_name=$2
    local output_file=$3
    
    write_test_header "$test_name"
    
    local full_output_path="$RAW_RESULTS_DIR/$output_file"
    
    if k6 run --env BASE_URL="$BASE_URL" --summary-export="$full_output_path" "$test_file"; then
        write_test_result "$test_name" "SUCCESS" "$full_output_path"
    else
        write_test_result "$test_name" "FAILED" "$full_output_path"
    fi
}

# Check prerequisites
echo -e "${CYAN}Checking prerequisites...${NC}"

if ! command -v k6 &> /dev/null; then
    echo -e "${RED}✗ k6 is not installed. Please install k6 from https://k6.io/docs/getting-started/installation/${NC}"
    exit 1
fi

echo -e "${GREEN}✓ k6 is installed${NC}"
echo ""

# Check if server is running
echo -e "${CYAN}Checking if server is running at $BASE_URL...${NC}"
if curl -s -f -o /dev/null "$BASE_URL/health"; then
    echo -e "${GREEN}✓ Server is running${NC}"
else
    echo -e "${RED}✗ Server is not responding. Please start the server first.${NC}"
    echo -e "${YELLOW}  Run: cd backend && npm run start:dev${NC}"
    exit 1
fi

echo ""
echo -e "${CYAN}Starting test suite: $TEST_SUITE${NC}"
echo ""

# Run tests based on test suite
case $TEST_SUITE in
    all)
        run_k6_test "$SCRIPT_DIR/k6-load-test.js" "Basic Load Test" "basic-load-test-$(date +%Y%m%d-%H%M%S).json"
        run_k6_test "$SCRIPT_DIR/spike-test.js" "Spike Test" "spike-test-$(date +%Y%m%d-%H%M%S).json"
        run_k6_test "$SCRIPT_DIR/sustained-load-test.js" "Sustained Load Test" "sustained-load-test-$(date +%Y%m%d-%H%M%S).json"
        run_k6_test "$SCRIPT_DIR/pattern-specific-test.js" "Pattern-Specific Test" "pattern-specific-test-$(date +%Y%m%d-%H%M%S).json"
        run_k6_test "$SCRIPT_DIR/comprehensive-k6-test.js" "Comprehensive Test" "comprehensive-test-$(date +%Y%m%d-%H%M%S).json"
        ;;
    spike)
        run_k6_test "$SCRIPT_DIR/spike-test.js" "Spike Test" "spike-test-$(date +%Y%m%d-%H%M%S).json"
        ;;
    sustained)
        run_k6_test "$SCRIPT_DIR/sustained-load-test.js" "Sustained Load Test" "sustained-load-test-$(date +%Y%m%d-%H%M%S).json"
        ;;
    pattern)
        run_k6_test "$SCRIPT_DIR/pattern-specific-test.js" "Pattern-Specific Test" "pattern-specific-test-$(date +%Y%m%d-%H%M%S).json"
        ;;
    quick)
        run_k6_test "$SCRIPT_DIR/k6-load-test.js" "Basic Load Test" "basic-load-test-$(date +%Y%m%d-%H%M%S).json"
        ;;
    *)
        echo -e "${RED}Unknown test suite: $TEST_SUITE${NC}"
        echo -e "${YELLOW}Available suites: all, spike, sustained, pattern, quick${NC}"
        exit 1
        ;;
esac

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Print summary
echo ""
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}Test Suite Summary${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""
echo "Total Duration: $(printf '%02d:%02d:%02d' $((DURATION/3600)) $((DURATION%3600/60)) $((DURATION%60)))"
echo ""

SUCCESS_COUNT=0
FAIL_COUNT=0

for result in "${TEST_RESULTS[@]}"; do
    IFS='|' read -r name status file <<< "$result"
    if [ "$status" == "SUCCESS" ]; then
        ((SUCCESS_COUNT++))
    else
        ((FAIL_COUNT++))
    fi
done

echo "Tests Run: ${#TEST_RESULTS[@]}"
echo -e "${GREEN}Passed: $SUCCESS_COUNT${NC}"
if [ $FAIL_COUNT -gt 0 ]; then
    echo -e "${RED}Failed: $FAIL_COUNT${NC}"
else
    echo "Failed: $FAIL_COUNT"
fi
echo ""

# Display individual test results
echo -e "${CYAN}Test Results:${NC}"
for result in "${TEST_RESULTS[@]}"; do
    IFS='|' read -r name status file <<< "$result"
    
    if [ "$status" == "SUCCESS" ]; then
        echo -e "  ${GREEN}✓ $name${NC}"
    else
        echo -e "  ${RED}✗ $name${NC}"
    fi
    
    if [ -n "$file" ]; then
        echo -e "     ${NC}Result: $file${NC}"
    fi
done

echo ""

# Process results and generate reports (if not skipped)
if [ "$SKIP_REPORTS" != "true" ] && [ $SUCCESS_COUNT -gt 0 ]; then
    echo -e "${CYAN}============================================${NC}"
    echo -e "${CYAN}Processing Results and Generating Reports${NC}"
    echo -e "${CYAN}============================================${NC}"
    echo ""
    
    # Check if Node.js is available
    if command -v node &> /dev/null; then
        # Process each successful test result
        for result in "${TEST_RESULTS[@]}"; do
            IFS='|' read -r name status file <<< "$result"
            
            if [ "$status" == "SUCCESS" ] && [ -n "$file" ]; then
                echo -e "${CYAN}Processing: $name...${NC}"
                
                if node "$SCRIPT_DIR/test-result-collector.js" parse-k6 "$file"; then
                    echo -e "${GREEN}  ✓ Results processed${NC}"
                else
                    echo -e "${RED}  ✗ Error processing results${NC}"
                fi
            fi
        done
        
        echo ""
        echo -e "${GREEN}Report generation complete. Check the results/reports directory.${NC}"
    else
        echo -e "${YELLOW}⚠ Node.js is not installed. Skipping report generation.${NC}"
        echo -e "  Install Node.js to enable automatic report generation."
    fi
elif [ "$SKIP_REPORTS" == "true" ]; then
    echo -e "${YELLOW}Report generation skipped (set SKIP_REPORTS=false to enable)${NC}"
fi

echo ""
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}Load Testing Complete${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""

# Exit with appropriate code
if [ $FAIL_COUNT -gt 0 ]; then
    exit 1
else
    exit 0
fi

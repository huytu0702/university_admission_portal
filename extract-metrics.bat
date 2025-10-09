#!/bin/bash
# Extract key performance metrics from test results

echo "=== BASELINE TEST RESULTS (Synchronous) ==="
echo ""
echo "Application submission duration (avg, min, med, max, p90, p95):"
cat baseline-results.json | findstr application_submission_duration
echo ""
echo "HTTP request duration (avg, min, med, max, p90, p95):"
cat baseline-results.json | findstr http_req_duration
echo ""
echo "Checks success rate:"
cat baseline-results.json | findstr checks
echo ""
echo "Errors rate:"
cat baseline-results.json | findstr errors
echo ""
echo "Total iterations:"
cat baseline-results.json | findstr iterations
echo ""
echo "Throughput (requests per second):"
cat baseline-results.json | findstr http_reqs

echo ""
echo "=== IMPROVED TEST RESULTS (Queue-Based) ==="
echo ""
echo "Application submission duration (avg, min, med, max, p90, p95):"
cat improved-results.json | findstr application_submission_duration
echo ""
echo "HTTP request duration (avg, min, med, max, p90, p95):"
cat improved-results.json | findstr http_req_duration
echo ""
echo "Checks success rate:"
cat improved-results.json | findstr checks
echo ""
echo "Errors rate:"
cat improved-results.json | findstr errors
echo ""
echo "Total iterations:"
cat improved-results.json | findstr iterations
echo ""
echo "Throughput (requests per second):"
cat improved-results.json | findstr http_reqs
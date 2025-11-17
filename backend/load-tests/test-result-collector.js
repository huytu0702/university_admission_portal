const fs = require('fs');
const path = require('path');

/**
 * Test Result Collector
 * Collects and standardizes test results from k6 and Locust
 */

class TestResultCollector {
  constructor() {
    this.resultsDir = path.join(__dirname, 'results');
    this.ensureResultsDir();
  }

  ensureResultsDir() {
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
    }
    
    // Create subdirectories
    const subdirs = ['raw', 'processed', 'reports', 'comparisons'];
    subdirs.forEach(dir => {
      const dirPath = path.join(this.resultsDir, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });
  }

  /**
   * Parse k6 JSON result file
   */
  parseK6Results(filePath) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    const metrics = data.metrics || {};
    
    return {
      test_type: this.detectTestType(filePath),
      timestamp: data.timestamp || new Date().toISOString(),
      framework: 'k6',
      duration_seconds: this.calculateDuration(data),
      metrics: {
        http_requests: {
          total: metrics.http_reqs?.values?.count || 0,
          rate: metrics.http_reqs?.values?.rate || 0,
        },
        response_time: {
          avg: metrics.http_req_duration?.values?.avg || 0,
          min: metrics.http_req_duration?.values?.min || 0,
          max: metrics.http_req_duration?.values?.max || 0,
          p50: metrics.http_req_duration?.values?.med || 0,
          p95: metrics.http_req_duration?.values?.['p(95)'] || 0,
          p99: metrics.http_req_duration?.values?.['p(99)'] || 0,
        },
        errors: {
          rate: metrics.errors?.values?.rate || 0,
          count: this.calculateErrorCount(metrics),
        },
        checks: {
          pass_rate: metrics.checks?.values?.rate || 0,
          passes: metrics.checks?.values?.passes || 0,
          fails: metrics.checks?.values?.fails || 0,
        },
        virtual_users: {
          max: metrics.vus_max?.values?.max || 0,
          avg: metrics.vus?.values?.value || 0,
        },
        data_transfer: {
          received_bytes: metrics.data_received?.values?.count || 0,
          sent_bytes: metrics.data_sent?.values?.count || 0,
        },
      },
      custom_metrics: this.extractCustomMetrics(metrics),
      thresholds: this.extractThresholds(data),
      raw_data: data,
    };
  }

  /**
   * Parse Locust CSV results
   */
  parseLocustResults(statsFile, failuresFile = null) {
    const stats = this.parseLocustStatsCSV(statsFile);
    const failures = failuresFile ? this.parseLocustFailuresCSV(failuresFile) : [];
    
    const totalRequests = stats.reduce((sum, stat) => sum + stat.num_requests, 0);
    const totalFailures = stats.reduce((sum, stat) => sum + stat.num_failures, 0);
    
    return {
      test_type: 'locust',
      timestamp: new Date().toISOString(),
      framework: 'locust',
      metrics: {
        http_requests: {
          total: totalRequests,
          failed: totalFailures,
        },
        response_time: {
          avg: this.calculateAverage(stats, 'avg_response_time'),
          min: Math.min(...stats.map(s => s.min_response_time)),
          max: Math.max(...stats.map(s => s.max_response_time)),
          p50: this.calculateAverage(stats, 'median_response_time'),
        },
        errors: {
          rate: totalRequests > 0 ? totalFailures / totalRequests : 0,
          count: totalFailures,
        },
        requests_per_second: this.calculateAverage(stats, 'requests_per_sec'),
      },
      endpoints: stats,
      failures: failures,
    };
  }

  parseLocustStatsCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',');
    const stats = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length < headers.length) continue;
      
      const stat = {
        method: values[0]?.trim(),
        name: values[1]?.trim(),
        num_requests: parseInt(values[2]) || 0,
        num_failures: parseInt(values[3]) || 0,
        median_response_time: parseFloat(values[4]) || 0,
        avg_response_time: parseFloat(values[5]) || 0,
        min_response_time: parseFloat(values[6]) || 0,
        max_response_time: parseFloat(values[7]) || 0,
        requests_per_sec: parseFloat(values[8]) || 0,
      };
      
      stats.push(stat);
    }
    
    return stats;
  }

  parseLocustFailuresCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) return [];
    
    const failures = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length < 4) continue;
      
      failures.push({
        method: values[0]?.trim(),
        name: values[1]?.trim(),
        error: values[2]?.trim(),
        occurrences: parseInt(values[3]) || 0,
      });
    }
    
    return failures;
  }

  /**
   * Standardize results format
   */
  standardizeResults(parsedResults) {
    return {
      test_id: this.generateTestId(),
      test_type: parsedResults.test_type,
      framework: parsedResults.framework,
      timestamp: parsedResults.timestamp,
      duration_seconds: parsedResults.duration_seconds,
      summary: {
        total_requests: parsedResults.metrics.http_requests.total,
        requests_per_second: parsedResults.metrics.http_requests.rate || parsedResults.metrics.requests_per_second,
        error_rate_percent: (parsedResults.metrics.errors.rate * 100).toFixed(2),
        avg_response_time_ms: parsedResults.metrics.response_time.avg.toFixed(2),
        p95_response_time_ms: parsedResults.metrics.response_time.p95?.toFixed(2) || 'N/A',
        p99_response_time_ms: parsedResults.metrics.response_time.p99?.toFixed(2) || 'N/A',
        check_pass_rate_percent: parsedResults.metrics.checks ? (parsedResults.metrics.checks.pass_rate * 100).toFixed(2) : 'N/A',
      },
      detailed_metrics: parsedResults.metrics,
      custom_metrics: parsedResults.custom_metrics || {},
      thresholds: parsedResults.thresholds || {},
    };
  }

  /**
   * Save processed results
   */
  saveProcessedResults(standardizedResults, filename = null) {
    const fileName = filename || `processed-${standardizedResults.test_id}.json`;
    const filePath = path.join(this.resultsDir, 'processed', fileName);
    
    fs.writeFileSync(filePath, JSON.stringify(standardizedResults, null, 2));
    console.log(`✓ Processed results saved: ${filePath}`);
    
    return filePath;
  }

  /**
   * Load all processed results
   */
  loadAllProcessedResults() {
    const processedDir = path.join(this.resultsDir, 'processed');
    const files = fs.readdirSync(processedDir).filter(f => f.endsWith('.json'));
    
    return files.map(file => {
      const filePath = path.join(processedDir, file);
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    });
  }

  /**
   * Compare results
   */
  compareResults(results1, results2) {
    const comparison = {
      test1: {
        id: results1.test_id,
        timestamp: results1.timestamp,
        type: results1.test_type,
      },
      test2: {
        id: results2.test_id,
        timestamp: results2.timestamp,
        type: results2.test_type,
      },
      improvements: {},
      degradations: {},
      summary: {},
    };

    // Compare metrics
    const metrics = [
      { key: 'avg_response_time_ms', label: 'Average Response Time', unit: 'ms', lowerIsBetter: true },
      { key: 'p95_response_time_ms', label: 'P95 Response Time', unit: 'ms', lowerIsBetter: true },
      { key: 'p99_response_time_ms', label: 'P99 Response Time', unit: 'ms', lowerIsBetter: true },
      { key: 'error_rate_percent', label: 'Error Rate', unit: '%', lowerIsBetter: true },
      { key: 'requests_per_second', label: 'Throughput', unit: 'req/s', lowerIsBetter: false },
    ];

    metrics.forEach(metric => {
      const val1 = parseFloat(results1.summary[metric.key]) || 0;
      const val2 = parseFloat(results2.summary[metric.key]) || 0;
      
      if (val1 === 0 && val2 === 0) return;
      
      const change = val2 - val1;
      const changePercent = val1 !== 0 ? (change / val1) * 100 : 0;
      
      const improved = metric.lowerIsBetter ? change < 0 : change > 0;
      
      const metricComparison = {
        before: val1,
        after: val2,
        change: change,
        change_percent: changePercent.toFixed(2),
        improved: improved,
      };
      
      if (improved) {
        comparison.improvements[metric.label] = metricComparison;
      } else if (changePercent !== 0) {
        comparison.degradations[metric.label] = metricComparison;
      }
      
      comparison.summary[metric.label] = metricComparison;
    });

    return comparison;
  }

  /**
   * Save comparison results
   */
  saveComparison(comparison, filename = null) {
    const fileName = filename || `comparison-${Date.now()}.json`;
    const filePath = path.join(this.resultsDir, 'comparisons', fileName);
    
    fs.writeFileSync(filePath, JSON.stringify(comparison, null, 2));
    console.log(`✓ Comparison saved: ${filePath}`);
    
    return filePath;
  }

  // Helper methods
  detectTestType(filePath) {
    const fileName = path.basename(filePath).toLowerCase();
    
    if (fileName.includes('spike')) return 'spike';
    if (fileName.includes('sustained') || fileName.includes('soak')) return 'sustained';
    if (fileName.includes('pattern')) return 'pattern-specific';
    if (fileName.includes('comprehensive')) return 'comprehensive';
    
    return 'load-test';
  }

  calculateDuration(data) {
    const metrics = data.metrics;
    
    if (metrics.iteration_duration?.values?.max) {
      return metrics.iteration_duration.values.max / 1000;
    }
    
    if (data.state?.testRunDurationMs) {
      return data.state.testRunDurationMs / 1000;
    }
    
    return 0;
  }

  calculateErrorCount(metrics) {
    if (metrics.http_req_failed?.values?.passes !== undefined) {
      return metrics.http_req_failed.values.passes;
    }
    
    const totalRequests = metrics.http_reqs?.values?.count || 0;
    const errorRate = metrics.errors?.values?.rate || 0;
    
    return Math.round(totalRequests * errorRate);
  }

  extractCustomMetrics(metrics) {
    const customMetrics = {};
    
    const standardMetrics = [
      'http_reqs', 'http_req_duration', 'http_req_blocked', 'http_req_connecting',
      'http_req_sending', 'http_req_receiving', 'http_req_waiting', 'http_req_failed',
      'iterations', 'iteration_duration', 'vus', 'vus_max', 'data_received', 'data_sent',
      'errors', 'checks',
    ];

    Object.keys(metrics).forEach(key => {
      if (!standardMetrics.includes(key)) {
        customMetrics[key] = metrics[key].values;
      }
    });

    return customMetrics;
  }

  extractThresholds(data) {
    const thresholds = {};
    
    if (data.thresholds) {
      Object.keys(data.thresholds).forEach(key => {
        thresholds[key] = data.thresholds[key];
      });
    }
    
    return thresholds;
  }

  calculateAverage(stats, field) {
    if (stats.length === 0) return 0;
    
    const sum = stats.reduce((total, stat) => total + (stat[field] || 0), 0);
    return sum / stats.length;
  }

  generateTestId() {
    return `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
}

// CLI usage
if (require.main === module) {
  const collector = new TestResultCollector();
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node test-result-collector.js parse-k6 <file.json>');
    console.log('  node test-result-collector.js parse-locust <stats.csv> [failures.csv]');
    console.log('  node test-result-collector.js compare <test-id-1> <test-id-2>');
    console.log('  node test-result-collector.js list');
    process.exit(0);
  }
  
  const command = args[0];
  
  switch (command) {
    case 'parse-k6':
      if (args.length < 2) {
        console.error('Error: Provide k6 result file path');
        process.exit(1);
      }
      
      const k6Results = collector.parseK6Results(args[1]);
      const k6Standardized = collector.standardizeResults(k6Results);
      collector.saveProcessedResults(k6Standardized);
      
      console.log('\nTest Summary:');
      console.log(JSON.stringify(k6Standardized.summary, null, 2));
      break;
    
    case 'parse-locust':
      if (args.length < 2) {
        console.error('Error: Provide Locust stats CSV file path');
        process.exit(1);
      }
      
      const locustResults = collector.parseLocustResults(args[1], args[2]);
      const locustStandardized = collector.standardizeResults(locustResults);
      collector.saveProcessedResults(locustStandardized);
      
      console.log('\nTest Summary:');
      console.log(JSON.stringify(locustStandardized.summary, null, 2));
      break;
    
    case 'list':
      const allResults = collector.loadAllProcessedResults();
      
      console.log(`\nFound ${allResults.length} processed test results:\n`);
      allResults.forEach(result => {
        console.log(`- ${result.test_id}`);
        console.log(`  Type: ${result.test_type} | Framework: ${result.framework}`);
        console.log(`  Timestamp: ${result.timestamp}`);
        console.log(`  Avg Response Time: ${result.summary.avg_response_time_ms}ms`);
        console.log(`  Error Rate: ${result.summary.error_rate_percent}%`);
        console.log('');
      });
      break;
    
    case 'compare':
      if (args.length < 3) {
        console.error('Error: Provide two test IDs to compare');
        process.exit(1);
      }
      
      const allTests = collector.loadAllProcessedResults();
      const test1 = allTests.find(t => t.test_id === args[1]);
      const test2 = allTests.find(t => t.test_id === args[2]);
      
      if (!test1 || !test2) {
        console.error('Error: One or both test IDs not found');
        process.exit(1);
      }
      
      const comparison = collector.compareResults(test1, test2);
      collector.saveComparison(comparison);
      
      console.log('\nComparison Summary:');
      console.log(JSON.stringify(comparison.summary, null, 2));
      break;
    
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

module.exports = TestResultCollector;

#!/usr/bin/env node

/**
 * Automated Test Runner and Orchestrator
 * Runs multiple test scenarios and generates comprehensive reports
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const TestResultCollector = require('./test-result-collector');
const TestReportGenerator = require('./test-report-generator');

class TestOrchestrator {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || process.env.BASE_URL || 'http://localhost:3000',
      outputDir: config.outputDir || path.join(__dirname, 'results'),
      testSuite: config.testSuite || 'all',
      parallel: config.parallel || false,
      skipReports: config.skipReports || false,
      ...config
    };

    this.collector = new TestResultCollector();
    this.reportGenerator = new TestReportGenerator();
    this.testResults = [];
    this.startTime = Date.now();
  }

  /**
   * Run all load tests
   */
  async runAll() {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 Automated Load Test Orchestrator');
    console.log('='.repeat(60));
    console.log(`Base URL: ${this.config.baseUrl}`);
    console.log(`Test Suite: ${this.config.testSuite}`);
    console.log(`Parallel Execution: ${this.config.parallel ? 'Yes' : 'No'}`);
    console.log('='.repeat(60) + '\n');

    try {
      // Check prerequisites
      await this.checkPrerequisites();

      // Get test list based on suite
      const tests = this.getTestList();
      console.log(`📋 Scheduled ${tests.length} test(s)\n`);

      // Run tests
      if (this.config.parallel) {
        await this.runTestsParallel(tests);
      } else {
        await this.runTestsSequential(tests);
      }

      // Process results
      if (!this.config.skipReports) {
        await this.processResults();
      }

      // Print summary
      this.printSummary();

      return this.testResults;
    } catch (error) {
      console.error('❌ Test orchestration failed:', error.message);
      throw error;
    }
  }

  /**
   * Check if prerequisites are installed
   */
  async checkPrerequisites() {
    console.log('🔍 Checking prerequisites...\n');

    // Check k6
    const k6Installed = await this.commandExists('k6');
    if (!k6Installed) {
      throw new Error('k6 is not installed. Please install from https://k6.io/');
    }
    console.log('✅ k6 is installed');

    // Check if server is running
    try {
      const response = await this.httpGet(`${this.config.baseUrl}/health`);
      if (response.statusCode === 200) {
        console.log('✅ Server is running');
      } else {
        console.warn(`⚠️  Server responded with status ${response.statusCode}`);
      }
    } catch (error) {
      throw new Error(`Server is not running at ${this.config.baseUrl}`);
    }

    console.log('');
  }

  /**
   * Get list of tests to run
   */
  getTestList() {
    const allTests = [
      {
        name: 'Basic Load Test',
        file: 'k6-load-test.js',
        duration: '3-5 min',
        type: 'load'
      },
      {
        name: 'Spike Test',
        file: 'spike-test.js',
        duration: '4-6 min',
        type: 'spike'
      },
      {
        name: 'Sustained Load Test',
        file: 'sustained-load-test.js',
        duration: '15-45 min',
        type: 'sustained'
      },
      {
        name: 'Pattern-Specific Test',
        file: 'pattern-specific-test.js',
        duration: '15-20 min',
        type: 'pattern'
      },
      {
        name: 'Comprehensive Test',
        file: 'comprehensive-k6-test.js',
        duration: '5-10 min',
        type: 'comprehensive'
      }
    ];

    switch (this.config.testSuite) {
      case 'all':
        return allTests;
      case 'quick':
        return allTests.filter(t => ['load', 'spike'].includes(t.type));
      case 'spike':
        return allTests.filter(t => t.type === 'spike');
      case 'sustained':
        return allTests.filter(t => t.type === 'sustained');
      case 'pattern':
        return allTests.filter(t => t.type === 'pattern');
      case 'comprehensive':
        return allTests.filter(t => t.type === 'comprehensive');
      default:
        return allTests;
    }
  }

  /**
   * Run tests sequentially
   */
  async runTestsSequential(tests) {
    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      console.log(`\n[${ i + 1}/${tests.length}] Running: ${test.name}`);
      console.log(`    Duration: ~${test.duration}`);
      console.log('─'.repeat(60));

      try {
        const result = await this.runK6Test(test);
        this.testResults.push(result);
        
        if (result.success) {
          console.log(`✅ ${test.name} completed successfully`);
        } else {
          console.log(`❌ ${test.name} failed`);
        }
      } catch (error) {
        console.error(`❌ ${test.name} error:`, error.message);
        this.testResults.push({
          test: test.name,
          success: false,
          error: error.message
        });
      }

      // Wait between tests
      if (i < tests.length - 1) {
        console.log('\n⏸️  Waiting 10 seconds before next test...\n');
        await this.sleep(10000);
      }
    }
  }

  /**
   * Run tests in parallel
   */
  async runTestsParallel(tests) {
    console.log('🔄 Running tests in parallel...\n');

    const promises = tests.map(test => {
      return this.runK6Test(test).catch(error => ({
        test: test.name,
        success: false,
        error: error.message
      }));
    });

    this.testResults = await Promise.all(promises);

    this.testResults.forEach(result => {
      if (result.success) {
        console.log(`✅ ${result.test} completed`);
      } else {
        console.log(`❌ ${result.test} failed`);
      }
    });
  }

  /**
   * Run a single k6 test
   */
  runK6Test(test) {
    return new Promise((resolve, reject) => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputFile = path.join(
        this.config.outputDir,
        'raw',
        `${test.type}-test-${timestamp}.json`
      );

      const testFile = path.join(__dirname, test.file);

      const args = [
        'run',
        '--env', `BASE_URL=${this.config.baseUrl}`,
        '--summary-export', outputFile,
        testFile
      ];

      const startTime = Date.now();
      const k6Process = spawn('k6', args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      k6Process.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        process.stdout.write(output);
      });

      k6Process.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        process.stderr.write(output);
      });

      k6Process.on('close', (code) => {
        const duration = Date.now() - startTime;

        if (code === 0) {
          resolve({
            test: test.name,
            type: test.type,
            success: true,
            duration: duration,
            outputFile: outputFile,
            exitCode: code
          });
        } else {
          reject(new Error(`Test failed with exit code ${code}`));
        }
      });

      k6Process.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Process test results and generate reports
   */
  async processResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 Processing Results and Generating Reports');
    console.log('='.repeat(60) + '\n');

    const successfulTests = this.testResults.filter(r => r.success);

    if (successfulTests.length === 0) {
      console.log('⚠️  No successful tests to process');
      return;
    }

    for (const result of successfulTests) {
      try {
        console.log(`Processing: ${result.test}...`);

        // Parse and standardize results
        const parsedResults = this.collector.parseK6Results(result.outputFile);
        const standardizedResults = this.collector.standardizeResults(parsedResults);
        const processedFile = this.collector.saveProcessedResults(standardizedResults);

        // Generate individual report
        const reportFile = this.reportGenerator.generateReport(standardizedResults);

        console.log(`  ✅ Results processed: ${path.basename(processedFile)}`);
        console.log(`  📄 Report generated: ${path.basename(reportFile)}`);
      } catch (error) {
        console.error(`  ❌ Error processing ${result.test}:`, error.message);
      }
    }

    // Generate comparison reports if multiple tests
    if (successfulTests.length >= 2) {
      console.log('\n📊 Generating comparison reports...');

      try {
        const allProcessed = this.collector.loadAllProcessedResults();
        const recent = allProcessed.slice(-2); // Compare last two tests

        if (recent.length === 2) {
          const comparison = this.collector.compareResults(recent[0], recent[1]);
          this.reportGenerator.generateComparisonReport(comparison);
          console.log('  ✅ Comparison report generated');
        }
      } catch (error) {
        console.error('  ❌ Error generating comparison:', error.message);
      }
    }
  }

  /**
   * Print test summary
   */
  printSummary() {
    const duration = Date.now() - this.startTime;
    const successCount = this.testResults.filter(r => r.success).length;
    const failCount = this.testResults.filter(r => !r.success).length;

    console.log('\n' + '='.repeat(60));
    console.log('📈 Test Execution Summary');
    console.log('='.repeat(60));
    console.log(`Total Duration: ${this.formatDuration(duration)}`);
    console.log(`Tests Run: ${this.testResults.length}`);
    console.log(`✅ Passed: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log('='.repeat(60) + '\n');

    if (successCount > 0) {
      console.log('📁 Results available in:');
      console.log(`   - Raw: ${path.join(this.config.outputDir, 'raw')}`);
      console.log(`   - Processed: ${path.join(this.config.outputDir, 'processed')}`);
      console.log(`   - Reports: ${path.join(this.config.outputDir, 'reports')}`);
      console.log('');
    }
  }

  // Helper methods
  commandExists(command) {
    return new Promise((resolve) => {
      const process = spawn(command, ['--version'], { stdio: 'ignore' });
      process.on('close', (code) => resolve(code === 0));
      process.on('error', () => resolve(false));
    });
  }

  httpGet(url) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? require('https') : require('http');
      protocol.get(url, (res) => {
        resolve({ statusCode: res.statusCode });
      }).on('error', reject);
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const config = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--base-url':
        config.baseUrl = args[++i];
        break;
      case '--suite':
        config.testSuite = args[++i];
        break;
      case '--parallel':
        config.parallel = true;
        break;
      case '--skip-reports':
        config.skipReports = true;
        break;
      case '--help':
        console.log(`
Automated Load Test Orchestrator

Usage:
  node automated-test-runner.js [options]

Options:
  --base-url <url>      Base URL of the API (default: http://localhost:3000)
  --suite <name>        Test suite to run: all, quick, spike, sustained, pattern, comprehensive
  --parallel            Run tests in parallel (not recommended)
  --skip-reports        Skip report generation
  --help                Show this help message

Examples:
  node automated-test-runner.js
  node automated-test-runner.js --suite quick
  node automated-test-runner.js --base-url http://api.example.com
  node automated-test-runner.js --suite pattern --skip-reports
        `);
        process.exit(0);
    }
  }

  const orchestrator = new TestOrchestrator(config);

  orchestrator.runAll()
    .then(() => {
      console.log('✅ All tests completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error.message);
      process.exit(1);
    });
}

module.exports = TestOrchestrator;

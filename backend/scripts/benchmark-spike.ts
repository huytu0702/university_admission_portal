/**
 * Spike Load Benchmark - Test High Concurrent Load Handling
 * 
 * This benchmark tests how the system handles sudden spike in traffic.
 * 
 * Expected Results:
 * - Patterns OFF: Database overload, high error rate, timeouts
 * - Patterns ON: Queue buffers requests, stable processing, low error rate
 * 
 * When patterns are ON, this script will:
 * 1. Send spike load and measure HTTP accept rate
 * 2. Wait for all queued jobs to be processed
 * 3. Report both HTTP metrics and actual processing metrics
 * 
 * Usage:
 *   npx ts-node scripts/benchmark-spike.ts
 *   npx ts-node scripts/benchmark-spike.ts --connections 1000
 */

import autocannon, { Result } from 'autocannon';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const API_URL = process.env.API_URL || 'http://localhost:3001';

interface SpikeTestConfig {
    connections: number;
    duration: number;
    waitForQueueDrain: boolean;
    queueDrainTimeout: number; // max seconds to wait for queue drain
}

interface QueueMetrics {
    queueName: string;
    waitingJobs: number;
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
    queueDepth: number;
}

interface ProcessingMetrics {
    totalProcessed: number;
    completedJobs: number;
    failedJobs: number;
    queueDrainTimeMs: number;
    totalProcessingTimeMs: number;
    avgJobsPerSecond: number;
}

interface SpikeTestResult {
    timestamp: string;
    config: SpikeTestConfig;
    httpResults: {
        totalRequests: number;
        successfulRequests: number;
        errors: number;
        timeouts: number;
        errorRate: number;
        successRate: number;
        avgLatency: number;
        maxLatency: number;
    };
    processingResults: ProcessingMetrics;
    patternsEnabled: {
        queueBasedLoadLeveling: boolean;
        bulkheadIsolation: boolean;
        circuitBreaker: boolean;
    };
    verdict: 'GOOD' | 'DEGRADED' | 'FAILED';
    message: string;
}

async function login(): Promise<string> {
    try {
        const response = await axios.post(`${API_URL}/auth/login`, {
            email: 'spike-test@test.com',
            password: 'SpikeTest@123',
        });
        return response.data.access_token;
    } catch {
        console.log('   User not found, registering...');
        await axios.post(`${API_URL}/auth/register`, {
            email: 'spike-test@test.com',
            password: 'SpikeTest@123',
            firstName: 'Spike',
            lastName: 'Test',
        });

        const response = await axios.post(`${API_URL}/auth/login`, {
            email: 'spike-test@test.com',
            password: 'SpikeTest@123',
        });
        return response.data.access_token;
    }
}

async function checkPatterns(): Promise<{
    queueBasedLoadLeveling: boolean;
    bulkheadIsolation: boolean;
    circuitBreaker: boolean;
}> {
    try {
        const response = await axios.get(`${API_URL}/admin/flags`);
        const flags = response.data;

        return {
            queueBasedLoadLeveling: flags.find((f: any) => f.name === 'queue-based-load-leveling')?.enabled || false,
            bulkheadIsolation: flags.find((f: any) => f.name === 'bulkhead-isolation')?.enabled || false,
            circuitBreaker: flags.find((f: any) => f.name === 'circuit-breaker-payment')?.enabled || false,
        };
    } catch {
        return {
            queueBasedLoadLeveling: false,
            bulkheadIsolation: false,
            circuitBreaker: false,
        };
    }
}

async function getQueueMetrics(token: string): Promise<QueueMetrics[]> {
    try {
        const response = await axios.get(`${API_URL}/admin/workers/scaling/metrics`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });
        return response.data.data || [];
    } catch {
        return [];
    }
}

async function waitForQueueDrain(
    token: string,
    timeoutMs: number,
    pollIntervalMs: number = 1000
): Promise<{ drainTimeMs: number; finalMetrics: QueueMetrics[] }> {
    const startTime = Date.now();
    let lastMetrics: QueueMetrics[] = [];
    let consecutiveEmptyChecks = 0;
    const requiredEmptyChecks = 3; // Require 3 consecutive empty checks to consider drained

    console.log('\n⏳ Waiting for queue processing to complete...');

    while (Date.now() - startTime < timeoutMs) {
        const metrics = await getQueueMetrics(token);
        lastMetrics = metrics;

        const totalWaiting = metrics.reduce((sum, m) => sum + m.waitingJobs, 0);
        const totalActive = metrics.reduce((sum, m) => sum + m.activeJobs, 0);
        const totalCompleted = metrics.reduce((sum, m) => sum + m.completedJobs, 0);
        const totalFailed = metrics.reduce((sum, m) => sum + m.failedJobs, 0);

        // Progress indicator
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        process.stdout.write(
            `\r   [${elapsed}s] Waiting: ${totalWaiting} | Active: ${totalActive} | Completed: ${totalCompleted} | Failed: ${totalFailed}`
        );

        if (totalWaiting === 0 && totalActive === 0) {
            consecutiveEmptyChecks++;
            if (consecutiveEmptyChecks >= requiredEmptyChecks) {
                console.log('\n   ✅ All queues drained!');
                return {
                    drainTimeMs: Date.now() - startTime,
                    finalMetrics: lastMetrics,
                };
            }
        } else {
            consecutiveEmptyChecks = 0;
        }

        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    console.log('\n   ⚠️  Queue drain timeout reached');
    return {
        drainTimeMs: timeoutMs,
        finalMetrics: lastMetrics,
    };
}

async function getInitialQueueCounts(token: string): Promise<{ completed: number; failed: number }> {
    const metrics = await getQueueMetrics(token);
    return {
        completed: metrics.reduce((sum, m) => sum + m.completedJobs, 0),
        failed: metrics.reduce((sum, m) => sum + m.failedJobs, 0),
    };
}

async function runSpikeTest(config: SpikeTestConfig): Promise<SpikeTestResult> {
    console.log('\n🔬 Spike Load Benchmark - High Concurrent Load Test\n');

    const token = await login();
    const patternsEnabled = await checkPatterns();

    console.log('📊 Resilience patterns:');
    console.log(`   Queue-Based Load Leveling: ${patternsEnabled.queueBasedLoadLeveling ? '✅' : '❌'}`);
    console.log(`   Bulkhead Isolation: ${patternsEnabled.bulkheadIsolation ? '✅' : '❌'}`);
    console.log(`   Circuit Breaker: ${patternsEnabled.circuitBreaker ? '✅' : '❌'}`);

    const hasResilience = patternsEnabled.queueBasedLoadLeveling ||
        patternsEnabled.bulkheadIsolation ||
        patternsEnabled.circuitBreaker;

    // Get initial queue counts to calculate delta
    const initialCounts = hasResilience ? await getInitialQueueCounts(token) : { completed: 0, failed: 0 };

    console.log(`\n🚀 Launching spike load:`);
    console.log(`   Connections: ${config.connections}`);
    console.log(`   Duration: ${config.duration}s`);
    if (hasResilience && config.waitForQueueDrain) {
        console.log(`   Queue Drain Timeout: ${config.queueDrainTimeout}s`);
    }

    const spikeStartTime = Date.now();

    const result = await new Promise<Result>((resolve, reject) => {
        const instance = autocannon({
            url: `${API_URL}/applications`,
            method: 'POST',
            duration: config.duration,
            connections: config.connections,
            pipelining: 1,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                personalStatement: `Spike test - ${Date.now()}`,
            }),
            setupClient: (client) => {
                client.setHeaders({
                    'idempotency-key': `spike-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                });
            },
        }, (err, result) => {
            if (err) reject(err);
            else resolve(result);
        });

        autocannon.track(instance, { renderProgressBar: true });
    });

    const httpEndTime = Date.now();
    const httpDuration = httpEndTime - spikeStartTime;

    // Calculate HTTP metrics
    const totalRequests = result.requests.sent;
    const successfulRequests = result.requests.sent - result.errors - result.timeouts;
    const errorRate = (result.errors / totalRequests) * 100;
    const successRate = (successfulRequests / totalRequests) * 100;

    // Processing metrics - wait for queue drain if patterns enabled
    let processingResults: ProcessingMetrics = {
        totalProcessed: 0,
        completedJobs: 0,
        failedJobs: 0,
        queueDrainTimeMs: 0,
        totalProcessingTimeMs: httpDuration,
        avgJobsPerSecond: 0,
    };

    if (hasResilience && config.waitForQueueDrain) {
        console.log('\n📦 Patterns enabled - waiting for async processing to complete...');

        const { drainTimeMs, finalMetrics } = await waitForQueueDrain(
            token,
            config.queueDrainTimeout * 1000
        );

        const finalCompleted = finalMetrics.reduce((sum, m) => sum + m.completedJobs, 0);
        const finalFailed = finalMetrics.reduce((sum, m) => sum + m.failedJobs, 0);

        // Calculate delta (jobs processed during this test)
        const completedDelta = finalCompleted - initialCounts.completed;
        const failedDelta = finalFailed - initialCounts.failed;
        const totalProcessed = completedDelta + failedDelta;

        const totalProcessingTimeMs = httpDuration + drainTimeMs;

        processingResults = {
            totalProcessed,
            completedJobs: completedDelta,
            failedJobs: failedDelta,
            queueDrainTimeMs: drainTimeMs,
            totalProcessingTimeMs,
            avgJobsPerSecond: totalProcessed > 0 ? (totalProcessed / (totalProcessingTimeMs / 1000)) : 0,
        };

        console.log(`\n📊 Processing Results:`);
        console.log(`   Jobs Processed: ${totalProcessed}`);
        console.log(`   Completed: ${completedDelta}`);
        console.log(`   Failed: ${failedDelta}`);
        console.log(`   Queue Drain Time: ${(drainTimeMs / 1000).toFixed(2)}s`);
        console.log(`   Total Processing Time: ${(totalProcessingTimeMs / 1000).toFixed(2)}s`);
    }

    // Determine verdict based on patterns and results
    let verdict: 'GOOD' | 'DEGRADED' | 'FAILED';
    let message: string;

    if (hasResilience) {
        // When patterns are ON, measure both HTTP acceptance rate and actual processing success
        const httpAcceptRate = successRate;
        const processingSuccessRate = processingResults.totalProcessed > 0
            ? (processingResults.completedJobs / processingResults.totalProcessed) * 100
            : 0;

        if (httpAcceptRate >= 95 && processingSuccessRate >= 90) {
            verdict = 'GOOD';
            message = `✅ System handled spike load well! HTTP Accept: ${httpAcceptRate.toFixed(1)}%, Processing Success: ${processingSuccessRate.toFixed(1)}%`;
        } else if (httpAcceptRate >= 80 && processingSuccessRate >= 70) {
            verdict = 'DEGRADED';
            message = `⚠️  System partially handled spike - HTTP Accept: ${httpAcceptRate.toFixed(1)}%, Processing Success: ${processingSuccessRate.toFixed(1)}%`;
        } else {
            verdict = 'FAILED';
            message = `❌ High failure rate - HTTP Accept: ${httpAcceptRate.toFixed(1)}%, Processing Success: ${processingSuccessRate.toFixed(1)}%`;
        }
    } else {
        // When patterns are OFF, measure direct HTTP success (synchronous processing)
        if (successRate >= 95) {
            verdict = 'GOOD';
            message = '✅ System handled spike without patterns (responses are synchronous)';
        } else if (successRate >= 50) {
            verdict = 'DEGRADED';
            message = '⚠️  Moderate failure rate without patterns - enable patterns for better resilience';
        } else {
            verdict = 'FAILED';
            message = '❌ High failure rate without patterns - system overloaded!';
        }
    }

    return {
        timestamp: new Date().toISOString(),
        config,
        httpResults: {
            totalRequests,
            successfulRequests,
            errors: result.errors,
            timeouts: result.timeouts,
            errorRate,
            successRate,
            avgLatency: result.latency.average,
            maxLatency: result.latency.max,
        },
        processingResults,
        patternsEnabled,
        verdict,
        message,
    };
}

function printResults(result: SpikeTestResult): void {
    const hasResilience = result.patternsEnabled.queueBasedLoadLeveling ||
        result.patternsEnabled.bulkheadIsolation ||
        result.patternsEnabled.circuitBreaker;

    console.log('\n' + '═'.repeat(70));
    console.log('📊 SPIKE LOAD TEST RESULTS');
    console.log('═'.repeat(70));

    console.log(`\n⚙️  Configuration:`);
    console.log(`   Connections: ${result.config.connections}`);
    console.log(`   Duration: ${result.config.duration}s`);

    console.log(`\n🛡️  Patterns:`);
    console.log(`   Queue Load Leveling: ${result.patternsEnabled.queueBasedLoadLeveling ? '✅' : '❌'}`);
    console.log(`   Bulkhead Isolation: ${result.patternsEnabled.bulkheadIsolation ? '✅' : '❌'}`);
    console.log(`   Circuit Breaker: ${result.patternsEnabled.circuitBreaker ? '✅' : '❌'}`);

    console.log(`\n📨 HTTP Results (Request Acceptance):`);
    console.log(`   Total Requests: ${result.httpResults.totalRequests}`);
    console.log(`   Successful: ${result.httpResults.successfulRequests} (${result.httpResults.successRate.toFixed(2)}%)`);
    console.log(`   Errors: ${result.httpResults.errors}`);
    console.log(`   Timeouts: ${result.httpResults.timeouts}`);
    console.log(`   Avg Latency: ${result.httpResults.avgLatency.toFixed(2)}ms`);
    console.log(`   Max Latency: ${result.httpResults.maxLatency.toFixed(2)}ms`);

    if (hasResilience && result.processingResults.totalProcessed > 0) {
        const successRate = (result.processingResults.completedJobs / result.processingResults.totalProcessed) * 100;
        console.log(`\n⚙️  Processing Results (Async Jobs):`);
        console.log(`   Total Processed: ${result.processingResults.totalProcessed}`);
        console.log(`   Completed: ${result.processingResults.completedJobs} (${successRate.toFixed(2)}%)`);
        console.log(`   Failed: ${result.processingResults.failedJobs}`);
        console.log(`   Queue Drain Time: ${(result.processingResults.queueDrainTimeMs / 1000).toFixed(2)}s`);
        console.log(`   Total Processing Time: ${(result.processingResults.totalProcessingTimeMs / 1000).toFixed(2)}s`);
        console.log(`   Throughput: ${result.processingResults.avgJobsPerSecond.toFixed(2)} jobs/sec`);
    }

    console.log(`\n🎯 Verdict: ${result.verdict}`);
    console.log(`   ${result.message}`);

    // Recommendations
    if (!hasResilience && result.httpResults.errorRate > 5) {
        console.log(`\n💡 Recommendation:`);
        console.log(`   Enable resilience patterns to handle spike loads:`);
        console.log(`   npm run patterns:on`);
    } else if (hasResilience && result.verdict === 'GOOD') {
        console.log(`\n✨ Resilience patterns are working effectively!`);
        console.log(`   The system accepted ${result.httpResults.successRate.toFixed(1)}% of requests immediately.`);
        if (result.processingResults.totalProcessed > 0) {
            const procSuccessRate = (result.processingResults.completedJobs / result.processingResults.totalProcessed) * 100;
            console.log(`   ${procSuccessRate.toFixed(1)}% of jobs were processed successfully in ${(result.processingResults.totalProcessingTimeMs / 1000).toFixed(1)}s total.`);
        }
    }

    console.log('\n' + '═'.repeat(70) + '\n');
}

function saveResults(result: SpikeTestResult): void {
    const resultsDir = path.join(__dirname, '..', 'benchmark-results');
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }

    const filename = `spike-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(resultsDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
    console.log(`💾 Results saved to: ${filepath}`);
}

function parseArgs(): SpikeTestConfig {
    const args = process.argv.slice(2);
    const config: SpikeTestConfig = {
        connections: 200,           // default
        duration: 15,               // default 15 seconds
        waitForQueueDrain: true,    // default: wait for queue to drain
        queueDrainTimeout: 120,     // default: 2 minutes timeout
    };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--connections' || args[i] === '-c') {
            config.connections = parseInt(args[++i], 10);
        } else if (args[i] === '--duration' || args[i] === '-d') {
            config.duration = parseInt(args[++i], 10);
        } else if (args[i] === '--no-wait') {
            config.waitForQueueDrain = false;
        } else if (args[i] === '--queue-timeout' || args[i] === '-t') {
            config.queueDrainTimeout = parseInt(args[++i], 10);
        } else if (args[i] === '--help' || args[i] === '-h') {
            console.log(`
Spike Load Benchmark

Usage:
  npx ts-node scripts/benchmark-spike.ts [options]

Options:
  -c, --connections    Number of concurrent connections (default: 200)
  -d, --duration       Test duration in seconds (default: 15)
  -t, --queue-timeout  Max time to wait for queue drain in seconds (default: 120)
  --no-wait            Don't wait for queue processing (only measure HTTP acceptance)
  -h, --help           Show this help message

Examples:
  npx ts-node scripts/benchmark-spike.ts
  npx ts-node scripts/benchmark-spike.ts --connections 500
  npx ts-node scripts/benchmark-spike.ts -c 1000 -d 30
  npx ts-node scripts/benchmark-spike.ts -c 100 --queue-timeout 180
`);
            process.exit(0);
        }
    }

    return config;
}

async function main() {
    const config = parseArgs();

    try {
        const result = await runSpikeTest(config);
        printResults(result);
        saveResults(result);

        // Exit with error code if test failed
        if (result.verdict === 'FAILED') {
            process.exit(1);
        }
    } catch (error: any) {
        console.error('\n❌ Test failed:', error.message);
        process.exit(1);
    }
}

main();

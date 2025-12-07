/**
 * Retry & Competing Consumers Benchmark - Test Worker Resilience
 * 
 * This benchmark tests the Retry with Exponential Backoff and 
 * Competing Consumers patterns by measuring:
 * - Worker throughput and job distribution
 * - Retry behavior when jobs fail
 * - DLQ (Dead Letter Queue) handling
 * 
 * Expected Results:
 * - Patterns OFF: Slower processing, no retry on failures
 * - Patterns ON: Parallel processing, automatic retries, better throughput
 * 
 * Usage:
 *   npx ts-node scripts/benchmark-workers.ts
 *   npx ts-node scripts/benchmark-workers.ts --jobs 100
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const API_URL = process.env.API_URL || 'http://localhost:3001';

interface WorkerTestConfig {
    totalJobs: number;
    waitTimeoutSeconds: number;
}

interface QueueMetrics {
    queueName: string;
    waitingJobs: number;
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
}

interface WorkerTestResult {
    timestamp: string;
    config: WorkerTestConfig;
    patternsEnabled: {
        queueBasedLoadLeveling: boolean;
        competingConsumers: boolean;
        retryExponentialBackoff: boolean;
    };
    results: {
        jobsSubmitted: number;
        jobsCompleted: number;
        jobsFailed: number;
        jobsRetried: number;
        dlqJobs: number;
        processingTimeMs: number;
        avgThroughput: number; // jobs per second
        queueMetrics: QueueMetrics[];
    };
    verdict: 'GOOD' | 'DEGRADED' | 'FAILED';
    message: string;
}

async function login(): Promise<string> {
    try {
        const response = await axios.post(`${API_URL}/auth/login`, {
            email: 'worker-test@test.com',
            password: 'WorkerTest@123',
        });
        return response.data.access_token;
    } catch {
        console.log('   User not found, registering...');
        await axios.post(`${API_URL}/auth/register`, {
            email: 'worker-test@test.com',
            password: 'WorkerTest@123',
            firstName: 'Worker',
            lastName: 'Test',
        });

        const response = await axios.post(`${API_URL}/auth/login`, {
            email: 'worker-test@test.com',
            password: 'WorkerTest@123',
        });
        return response.data.access_token;
    }
}

async function checkPatterns(): Promise<{
    queueBasedLoadLeveling: boolean;
    competingConsumers: boolean;
    retryExponentialBackoff: boolean;
}> {
    try {
        const response = await axios.get(`${API_URL}/admin/flags`);
        const flags = response.data;
        return {
            queueBasedLoadLeveling: flags.find((f: any) => f.name === 'queue-based-load-leveling')?.enabled || false,
            competingConsumers: flags.find((f: any) => f.name === 'competing-consumers')?.enabled || false,
            retryExponentialBackoff: flags.find((f: any) => f.name === 'retry-exponential-backoff')?.enabled || false,
        };
    } catch {
        return {
            queueBasedLoadLeveling: false,
            competingConsumers: false,
            retryExponentialBackoff: false,
        };
    }
}

async function getQueueMetrics(token: string): Promise<QueueMetrics[]> {
    try {
        const response = await axios.get(`${API_URL}/admin/workers/scaling/metrics`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        return response.data.data || [];
    } catch {
        return [];
    }
}

async function getDlqMetrics(token: string): Promise<{ [key: string]: number }> {
    try {
        const response = await axios.get(`${API_URL}/admin/dlq/metrics`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        return response.data || {};
    } catch {
        return {};
    }
}

async function createApplication(token: string, index: number): Promise<boolean> {
    try {
        await axios.post(
            `${API_URL}/applications`,
            { personalStatement: `Worker test ${index} - ${Date.now()}` },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Idempotency-Key': `worker-test-${Date.now()}-${index}-${Math.random().toString(36).substring(7)}`,
                },
                timeout: 30000,
            }
        );
        return true;
    } catch {
        return false;
    }
}

async function waitForQueueDrain(
    token: string,
    timeoutMs: number
): Promise<{ drainTimeMs: number; finalMetrics: QueueMetrics[] }> {
    const startTime = Date.now();
    let lastMetrics: QueueMetrics[] = [];
    let consecutiveEmptyChecks = 0;

    console.log('\n⏳ Waiting for queue processing...');

    while (Date.now() - startTime < timeoutMs) {
        const metrics = await getQueueMetrics(token);
        lastMetrics = metrics;

        const totalWaiting = metrics.reduce((sum, m) => sum + m.waitingJobs, 0);
        const totalActive = metrics.reduce((sum, m) => sum + m.activeJobs, 0);
        const totalCompleted = metrics.reduce((sum, m) => sum + m.completedJobs, 0);
        const totalFailed = metrics.reduce((sum, m) => sum + m.failedJobs, 0);

        const elapsed = Math.round((Date.now() - startTime) / 1000);
        process.stdout.write(
            `\r   [${elapsed}s] Waiting: ${totalWaiting} | Active: ${totalActive} | ✅ ${totalCompleted} | ❌ ${totalFailed}`
        );

        if (totalWaiting === 0 && totalActive === 0) {
            consecutiveEmptyChecks++;
            if (consecutiveEmptyChecks >= 3) {
                console.log('\n   ✅ All queues drained!');
                return { drainTimeMs: Date.now() - startTime, finalMetrics: lastMetrics };
            }
        } else {
            consecutiveEmptyChecks = 0;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n   ⚠️  Timeout waiting for queues');
    return { drainTimeMs: timeoutMs, finalMetrics: lastMetrics };
}

async function runWorkerTest(config: WorkerTestConfig): Promise<WorkerTestResult> {
    console.log('\n🔬 Worker Resilience Benchmark - Queue & Retry Test\n');

    const token = await login();
    const patternsEnabled = await checkPatterns();

    console.log('📊 Patterns enabled:');
    console.log(`   Queue-Based Load Leveling: ${patternsEnabled.queueBasedLoadLeveling ? '✅' : '❌'}`);
    console.log(`   Competing Consumers: ${patternsEnabled.competingConsumers ? '✅' : '❌'}`);
    console.log(`   Retry Exponential Backoff: ${patternsEnabled.retryExponentialBackoff ? '✅' : '❌'}`);

    // Get initial queue counts
    const initialMetrics = await getQueueMetrics(token);
    const initialCompleted = initialMetrics.reduce((sum, m) => sum + m.completedJobs, 0);
    const initialFailed = initialMetrics.reduce((sum, m) => sum + m.failedJobs, 0);

    console.log(`\n🚀 Submitting ${config.totalJobs} jobs...`);
    const startTime = Date.now();

    let successfulSubmissions = 0;
    for (let i = 0; i < config.totalJobs; i++) {
        const success = await createApplication(token, i);
        if (success) successfulSubmissions++;
        process.stdout.write(`\r   Submitted: ${i + 1}/${config.totalJobs}`);
    }

    const submissionTime = Date.now() - startTime;
    console.log(`\n   ✅ Submitted ${successfulSubmissions}/${config.totalJobs} jobs in ${(submissionTime / 1000).toFixed(1)}s`);

    // Wait for processing to complete
    const { drainTimeMs, finalMetrics } = await waitForQueueDrain(
        token,
        config.waitTimeoutSeconds * 1000
    );

    // Calculate results
    const finalCompleted = finalMetrics.reduce((sum, m) => sum + m.completedJobs, 0);
    const finalFailed = finalMetrics.reduce((sum, m) => sum + m.failedJobs, 0);
    const completedDelta = finalCompleted - initialCompleted;
    const failedDelta = finalFailed - initialFailed;

    // Get DLQ metrics
    const dlqMetrics = await getDlqMetrics(token);
    const totalDlq = Object.values(dlqMetrics).reduce((a, b) => a + b, 0);

    const totalProcessingTime = submissionTime + drainTimeMs;
    const totalProcessed = completedDelta + failedDelta;
    const avgThroughput = totalProcessed > 0 ? (totalProcessed / (totalProcessingTime / 1000)) : 0;

    // Estimate retried jobs (jobs that failed but succeeded after retry)
    // This is approximate - in reality need to track from worker logs
    const retriedJobs = 0; // Would need more instrumentation to track

    // Determine verdict
    let verdict: 'GOOD' | 'DEGRADED' | 'FAILED';
    let message: string;

    if (patternsEnabled.queueBasedLoadLeveling) {
        const successRate = totalProcessed > 0 ? (completedDelta / totalProcessed) * 100 : 0;

        if (successRate >= 90 && avgThroughput > 5) {
            verdict = 'GOOD';
            message = `✅ Queue processing efficient! ${successRate.toFixed(1)}% success, ${avgThroughput.toFixed(1)} jobs/sec`;
        } else if (successRate >= 70) {
            verdict = 'DEGRADED';
            message = `⚠️  Processing with some failures: ${successRate.toFixed(1)}% success`;
        } else {
            verdict = 'FAILED';
            message = `❌ High failure rate: ${successRate.toFixed(1)}% success`;
        }
    } else {
        if (successfulSubmissions === config.totalJobs) {
            verdict = 'GOOD';
            message = `✅ Synchronous processing completed`;
        } else {
            verdict = 'DEGRADED';
            message = `⚠️  Some jobs failed - enable queue patterns for better reliability`;
        }
    }

    return {
        timestamp: new Date().toISOString(),
        config,
        patternsEnabled,
        results: {
            jobsSubmitted: successfulSubmissions,
            jobsCompleted: completedDelta,
            jobsFailed: failedDelta,
            jobsRetried: retriedJobs,
            dlqJobs: totalDlq,
            processingTimeMs: totalProcessingTime,
            avgThroughput,
            queueMetrics: finalMetrics,
        },
        verdict,
        message,
    };
}

function printResults(result: WorkerTestResult): void {
    console.log('\n' + '═'.repeat(70));
    console.log('📊 WORKER RESILIENCE BENCHMARK RESULTS');
    console.log('═'.repeat(70));

    console.log(`\n⚙️  Configuration:`);
    console.log(`   Total Jobs: ${result.config.totalJobs}`);
    console.log(`   Wait Timeout: ${result.config.waitTimeoutSeconds}s`);

    console.log(`\n🛡️  Patterns:`);
    console.log(`   Queue-Based Load Leveling: ${result.patternsEnabled.queueBasedLoadLeveling ? '✅' : '❌'}`);
    console.log(`   Competing Consumers: ${result.patternsEnabled.competingConsumers ? '✅' : '❌'}`);
    console.log(`   Retry Exponential Backoff: ${result.patternsEnabled.retryExponentialBackoff ? '✅' : '❌'}`);

    console.log(`\n📈 Job Results:`);
    console.log(`   Submitted: ${result.results.jobsSubmitted}`);
    console.log(`   Completed: ${result.results.jobsCompleted}`);
    console.log(`   Failed: ${result.results.jobsFailed}`);
    if (result.results.jobsRetried > 0) {
        console.log(`   Retried: ${result.results.jobsRetried}`);
    }
    if (result.results.dlqJobs > 0) {
        console.log(`   In DLQ: ${result.results.dlqJobs}`);
    }

    console.log(`\n⏱️  Performance:`);
    console.log(`   Processing Time: ${(result.results.processingTimeMs / 1000).toFixed(2)}s`);
    console.log(`   Throughput: ${result.results.avgThroughput.toFixed(2)} jobs/sec`);

    if (result.results.queueMetrics.length > 0) {
        console.log(`\n📦 Queue Metrics:`);
        result.results.queueMetrics.forEach(q => {
            console.log(`   ${q.queueName}: ✅ ${q.completedJobs} | ❌ ${q.failedJobs}`);
        });
    }

    console.log(`\n🎯 Verdict: ${result.verdict}`);
    console.log(`   ${result.message}`);

    if (!result.patternsEnabled.queueBasedLoadLeveling && result.results.jobsFailed > 0) {
        console.log(`\n💡 Recommendation:`);
        console.log(`   Enable queue patterns for better reliability:`);
        console.log(`   npm run patterns:on`);
    }

    console.log('\n' + '═'.repeat(70) + '\n');
}

function saveResults(result: WorkerTestResult): void {
    const resultsDir = path.join(__dirname, '..', 'benchmark-results');
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }

    const filename = `workers-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(resultsDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
    console.log(`💾 Results saved to: ${filepath}`);
}

function parseArgs(): WorkerTestConfig {
    const args = process.argv.slice(2);
    const config: WorkerTestConfig = {
        totalJobs: 20,
        waitTimeoutSeconds: 120,
    };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--jobs' || args[i] === '-j') {
            config.totalJobs = parseInt(args[++i], 10);
        } else if (args[i] === '--timeout' || args[i] === '-t') {
            config.waitTimeoutSeconds = parseInt(args[++i], 10);
        } else if (args[i] === '--help' || args[i] === '-h') {
            console.log(`
Worker Resilience Benchmark

Usage:
  npx ts-node scripts/benchmark-workers.ts [options]

Options:
  -j, --jobs     Total number of jobs to submit (default: 20)
  -t, --timeout  Timeout in seconds for queue drain (default: 120)
  -h, --help     Show this help message

Examples:
  npx ts-node scripts/benchmark-workers.ts
  npx ts-node scripts/benchmark-workers.ts --jobs 50
  npx ts-node scripts/benchmark-workers.ts -j 100 -t 180
`);
            process.exit(0);
        }
    }

    return config;
}

async function main() {
    const config = parseArgs();

    try {
        const result = await runWorkerTest(config);
        printResults(result);
        saveResults(result);

        if (result.verdict === 'FAILED') {
            process.exit(1);
        }
    } catch (error: any) {
        console.error('\n❌ Test failed:', error.message);
        process.exit(1);
    }
}

main();

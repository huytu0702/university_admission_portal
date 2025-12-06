/**
 * Spike Load Benchmark - Test High Concurrent Load Handling
 * 
 * This benchmark tests how the system handles sudden spike in traffic.
 * 
 * Expected Results:
 * - Patterns OFF: Database overload, high error rate, timeouts
 * - Patterns ON: Queue buffers requests, stable processing, low error rate
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
}

interface SpikeTestResult {
    timestamp: string;
    config: SpikeTestConfig;
    results: {
        totalRequests: number;
        successfulRequests: number;
        errors: number;
        timeouts: number;
        errorRate: number;
        successRate: number;
        avgLatency: number;
        maxLatency: number;
    };
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

async function runSpikeTest(config: SpikeTestConfig): Promise<SpikeTestResult> {
    console.log('\n🔬 Spike Load Benchmark - High Concurrent Load Test\n');

    const token = await login();
    const patternsEnabled = await checkPatterns();

    console.log('📊 Resilience patterns:');
    console.log(`   Queue-Based Load Leveling: ${patternsEnabled.queueBasedLoadLeveling ? '✅' : '❌'}`);
    console.log(`   Bulkhead Isolation: ${patternsEnabled.bulkheadIsolation ? '✅' : '❌'}`);
    console.log(`   Circuit Breaker: ${patternsEnabled.circuitBreaker ? '✅' : '❌'}`);

    console.log(`\n🚀 Launching spike load:`);
    console.log(`   Connections: ${config.connections}`);
    console.log(`   Duration: ${config.duration}s\n`);

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

    // Calculate metrics
    const totalRequests = result.requests.sent;
    const successfulRequests = result.requests.sent - result.errors - result.timeouts;
    const errorRate = (result.errors / totalRequests) * 100;
    const successRate = (successfulRequests / totalRequests) * 100;

    // Determine verdict based on patterns and results
    let verdict: 'GOOD' | 'DEGRADED' | 'FAILED';
    let message: string;

    const hasResilience = patternsEnabled.queueBasedLoadLeveling ||
        patternsEnabled.bulkheadIsolation ||
        patternsEnabled.circuitBreaker;

    if (hasResilience) {
        if (successRate >= 95) {
            verdict = 'GOOD';
            message = '✅ System handled spike load well with patterns enabled!';
        } else if (successRate >= 80) {
            verdict = 'DEGRADED';
            message = '⚠️  System partially handled spike - some requests failed';
        } else {
            verdict = 'FAILED';
            message = '❌ High failure rate even with patterns - need optimization';
        }
    } else {
        if (successRate >= 95) {
            verdict = 'GOOD';
            message = '✅ System handled spike without patterns (lucky or low load)';
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
        results: {
            totalRequests,
            successfulRequests,
            errors: result.errors,
            timeouts: result.timeouts,
            errorRate,
            successRate,
            avgLatency: result.latency.average,
            maxLatency: result.latency.max,
        },
        patternsEnabled,
        verdict,
        message,
    };
}

function printResults(result: SpikeTestResult): void {
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

    console.log(`\n📈 Results:`);
    console.log(`   Total Requests: ${result.results.totalRequests}`);
    console.log(`   Successful: ${result.results.successfulRequests} (${result.results.successRate.toFixed(2)}%)`);
    console.log(`   Errors: ${result.results.errors}`);
    console.log(`   Timeouts: ${result.results.timeouts}`);
    console.log(`   Error Rate: ${result.results.errorRate.toFixed(2)}%`);

    console.log(`\n⏱️  Latency:`);
    console.log(`   Average: ${result.results.avgLatency.toFixed(2)}ms`);
    console.log(`   Max: ${result.results.maxLatency.toFixed(2)}ms`);

    console.log(`\n🎯 Verdict: ${result.verdict}`);
    console.log(`   ${result.message}`);

    // Recommendations
    const hasResilience = result.patternsEnabled.queueBasedLoadLeveling ||
        result.patternsEnabled.bulkheadIsolation ||
        result.patternsEnabled.circuitBreaker;

    if (!hasResilience && result.results.errorRate > 5) {
        console.log(`\n💡 Recommendation:`);
        console.log(`   Enable resilience patterns to handle spike loads:`);
        console.log(`   npm run patterns:on`);
    } else if (hasResilience && result.verdict === 'GOOD') {
        console.log(`\n✨ Resilience patterns are working effectively!`);
        console.log(`   The system maintained ${result.results.successRate.toFixed(1)}% success rate under spike load.`);
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
        connections: 200,  // default
        duration: 15,      // default 15 seconds
    };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--connections' || args[i] === '-c') {
            config.connections = parseInt(args[++i], 10);
        } else if (args[i] === '--duration' || args[i] === '-d') {
            config.duration = parseInt(args[++i], 10);
        } else if (args[i] === '--help' || args[i] === '-h') {
            console.log(`
Spike Load Benchmark

Usage:
  npx ts-node scripts/benchmark-spike.ts [options]

Options:
  -c, --connections  Number of concurrent connections (default: 200)
  -d, --duration     Test duration in seconds (default: 15)
  -h, --help         Show this help message

Examples:
  npx ts-node scripts/benchmark-spike.ts
  npx ts-node scripts/benchmark-spike.ts --connections 500
  npx ts-node scripts/benchmark-spike.ts -c 1000 -d 30
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

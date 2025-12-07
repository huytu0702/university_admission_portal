/**
 * Circuit Breaker Benchmark - Test Failure Isolation
 * 
 * This benchmark tests the Circuit Breaker pattern for payment service.
 * It simulates failure scenarios and measures how the system responds.
 * 
 * Expected Results:
 * - Circuit Breaker OFF: Cascading failures, slow recovery
 * - Circuit Breaker ON: Fast fail when circuit opens, gradual recovery
 * 
 * Usage:
 *   npx ts-node scripts/benchmark-circuit-breaker.ts
 *   npx ts-node scripts/benchmark-circuit-breaker.ts --requests 50
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const API_URL = process.env.API_URL || 'http://localhost:3001';

interface CircuitBreakerTestConfig {
    totalRequests: number;
    burstSize: number;
    requestDelayMs: number;
}

interface CircuitBreakerState {
    state: string;
    failureCount: number;
}

interface CircuitBreakerTestResult {
    timestamp: string;
    config: CircuitBreakerTestConfig;
    patternsEnabled: {
        circuitBreaker: boolean;
        bulkheadIsolation: boolean;
    };
    results: {
        totalRequests: number;
        successfulRequests: number;
        failedRequests: number;
        circuitOpenRejects: number;
        avgLatency: number;
        maxLatency: number;
        circuitStateChanges: string[];
        finalCircuitState: CircuitBreakerState | null;
    };
    verdict: 'GOOD' | 'DEGRADED' | 'FAILED';
    message: string;
}

async function login(): Promise<string> {
    try {
        const response = await axios.post(`${API_URL}/auth/login`, {
            email: 'circuit-test@test.com',
            password: 'CircuitTest@123',
        });
        return response.data.access_token;
    } catch {
        console.log('   User not found, registering...');
        await axios.post(`${API_URL}/auth/register`, {
            email: 'circuit-test@test.com',
            password: 'CircuitTest@123',
            firstName: 'Circuit',
            lastName: 'Test',
        });

        const response = await axios.post(`${API_URL}/auth/login`, {
            email: 'circuit-test@test.com',
            password: 'CircuitTest@123',
        });
        return response.data.access_token;
    }
}

async function checkPatterns(): Promise<{
    circuitBreaker: boolean;
    bulkheadIsolation: boolean;
}> {
    try {
        const response = await axios.get(`${API_URL}/admin/flags`);
        const flags = response.data;
        return {
            circuitBreaker: flags.find((f: any) => f.name === 'circuit-breaker-payment')?.enabled || false,
            bulkheadIsolation: flags.find((f: any) => f.name === 'bulkhead-isolation')?.enabled || false,
        };
    } catch {
        return { circuitBreaker: false, bulkheadIsolation: false };
    }
}

async function getCircuitState(token: string): Promise<CircuitBreakerState | null> {
    try {
        // Try to get circuit breaker state from admin API if available
        const response = await axios.get(`${API_URL}/admin/circuit-breaker/payment-service`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        return response.data;
    } catch {
        return null;
    }
}

async function createApplication(token: string, index: number): Promise<{
    success: boolean;
    latencyMs: number;
    error?: string;
}> {
    const start = Date.now();
    try {
        await axios.post(
            `${API_URL}/applications`,
            { personalStatement: `Circuit breaker test ${index} - ${Date.now()}` },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Idempotency-Key': `circuit-test-${Date.now()}-${index}`,
                },
                timeout: 30000,
            }
        );
        return { success: true, latencyMs: Date.now() - start };
    } catch (error: any) {
        const errorMessage = error.response?.data?.message || error.message;
        const isCircuitOpen = errorMessage.includes('Circuit breaker') ||
            errorMessage.includes('OPEN') ||
            error.response?.status === 503;
        return {
            success: false,
            latencyMs: Date.now() - start,
            error: isCircuitOpen ? 'CIRCUIT_OPEN' : errorMessage,
        };
    }
}

async function runCircuitBreakerTest(config: CircuitBreakerTestConfig): Promise<CircuitBreakerTestResult> {
    console.log('\n🔬 Circuit Breaker Benchmark - Failure Isolation Test\n');

    const token = await login();
    const patternsEnabled = await checkPatterns();

    console.log('📊 Patterns enabled:');
    console.log(`   Circuit Breaker: ${patternsEnabled.circuitBreaker ? '✅' : '❌'}`);
    console.log(`   Bulkhead Isolation: ${patternsEnabled.bulkheadIsolation ? '✅' : '❌'}`);

    console.log(`\n🚀 Test configuration:`);
    console.log(`   Total Requests: ${config.totalRequests}`);
    console.log(`   Burst Size: ${config.burstSize}`);
    console.log(`   Request Delay: ${config.requestDelayMs}ms`);

    const results: { success: boolean; latencyMs: number; error?: string }[] = [];
    const circuitStateChanges: string[] = [];
    let lastCircuitState: CircuitBreakerState | null = null;

    console.log('\n⚡ Sending requests...\n');

    // Send requests in bursts to potentially trigger circuit breaker
    for (let i = 0; i < config.totalRequests; i++) {
        const result = await createApplication(token, i);
        results.push(result);

        // Check circuit state periodically
        if (i % config.burstSize === 0) {
            const currentState = await getCircuitState(token);
            if (currentState && (!lastCircuitState || currentState.state !== lastCircuitState.state)) {
                circuitStateChanges.push(`Request ${i}: Circuit ${currentState.state}`);
                console.log(`   📊 Circuit state change at request ${i}: ${currentState.state}`);
            }
            lastCircuitState = currentState;
        }

        // Progress indicator
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;
        const circuitOpenCount = results.filter(r => r.error === 'CIRCUIT_OPEN').length;

        process.stdout.write(
            `\r   [${i + 1}/${config.totalRequests}] ✅ ${successCount} | ❌ ${failCount} | 🔒 ${circuitOpenCount}`
        );

        // Delay between requests
        if (config.requestDelayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, config.requestDelayMs));
        }
    }

    console.log('\n');

    // Calculate metrics
    const successfulRequests = results.filter(r => r.success).length;
    const failedRequests = results.filter(r => !r.success).length;
    const circuitOpenRejects = results.filter(r => r.error === 'CIRCUIT_OPEN').length;
    const latencies = results.map(r => r.latencyMs);
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const maxLatency = Math.max(...latencies);

    // Get final circuit state
    const finalCircuitState = await getCircuitState(token);

    // Determine verdict
    let verdict: 'GOOD' | 'DEGRADED' | 'FAILED';
    let message: string;

    if (patternsEnabled.circuitBreaker) {
        if (successfulRequests > 0) {
            verdict = 'GOOD';
            message = `✅ Circuit breaker protecting system - ${successfulRequests}/${config.totalRequests} requests processed`;
        } else if (circuitOpenRejects > 0) {
            verdict = 'DEGRADED';
            message = `⚠️  Circuit breaker active - ${circuitOpenRejects} requests rejected (fast-fail working)`;
        } else {
            verdict = 'FAILED';
            message = `❌ All requests failed - system may be overloaded`;
        }
    } else {
        if (successfulRequests === config.totalRequests) {
            verdict = 'GOOD';
            message = `✅ All requests succeeded without circuit breaker`;
        } else if (successfulRequests > config.totalRequests * 0.5) {
            verdict = 'DEGRADED';
            message = `⚠️  ${failedRequests} failures without circuit breaker protection`;
        } else {
            verdict = 'FAILED';
            message = `❌ High failure rate - enable circuit breaker for protection`;
        }
    }

    return {
        timestamp: new Date().toISOString(),
        config,
        patternsEnabled,
        results: {
            totalRequests: config.totalRequests,
            successfulRequests,
            failedRequests,
            circuitOpenRejects,
            avgLatency,
            maxLatency,
            circuitStateChanges,
            finalCircuitState,
        },
        verdict,
        message,
    };
}

function printResults(result: CircuitBreakerTestResult): void {
    console.log('\n' + '═'.repeat(70));
    console.log('📊 CIRCUIT BREAKER BENCHMARK RESULTS');
    console.log('═'.repeat(70));

    console.log(`\n⚙️  Configuration:`);
    console.log(`   Total Requests: ${result.config.totalRequests}`);
    console.log(`   Burst Size: ${result.config.burstSize}`);

    console.log(`\n🛡️  Patterns:`);
    console.log(`   Circuit Breaker: ${result.patternsEnabled.circuitBreaker ? '✅' : '❌'}`);
    console.log(`   Bulkhead Isolation: ${result.patternsEnabled.bulkheadIsolation ? '✅' : '❌'}`);

    console.log(`\n📈 Results:`);
    console.log(`   Successful: ${result.results.successfulRequests}`);
    console.log(`   Failed: ${result.results.failedRequests}`);
    console.log(`   Circuit Open Rejects: ${result.results.circuitOpenRejects}`);
    console.log(`   Average Latency: ${result.results.avgLatency.toFixed(2)}ms`);
    console.log(`   Max Latency: ${result.results.maxLatency.toFixed(2)}ms`);

    if (result.results.circuitStateChanges.length > 0) {
        console.log(`\n🔄 Circuit State Changes:`);
        result.results.circuitStateChanges.forEach(change => console.log(`   ${change}`));
    }

    if (result.results.finalCircuitState) {
        console.log(`\n🔌 Final Circuit State:`);
        console.log(`   State: ${result.results.finalCircuitState.state}`);
        console.log(`   Failure Count: ${result.results.finalCircuitState.failureCount}`);
    }

    console.log(`\n🎯 Verdict: ${result.verdict}`);
    console.log(`   ${result.message}`);

    if (!result.patternsEnabled.circuitBreaker && result.results.failedRequests > 0) {
        console.log(`\n💡 Recommendation:`);
        console.log(`   Enable circuit breaker for better failure isolation:`);
        console.log(`   npm run patterns:on`);
    }

    console.log('\n' + '═'.repeat(70) + '\n');
}

function saveResults(result: CircuitBreakerTestResult): void {
    const resultsDir = path.join(__dirname, '..', 'benchmark-results');
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }

    const filename = `circuit-breaker-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(resultsDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
    console.log(`💾 Results saved to: ${filepath}`);
}

function parseArgs(): CircuitBreakerTestConfig {
    const args = process.argv.slice(2);
    const config: CircuitBreakerTestConfig = {
        totalRequests: 30,
        burstSize: 10,
        requestDelayMs: 100,
    };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--requests' || args[i] === '-r') {
            config.totalRequests = parseInt(args[++i], 10);
        } else if (args[i] === '--burst' || args[i] === '-b') {
            config.burstSize = parseInt(args[++i], 10);
        } else if (args[i] === '--delay' || args[i] === '-d') {
            config.requestDelayMs = parseInt(args[++i], 10);
        } else if (args[i] === '--help' || args[i] === '-h') {
            console.log(`
Circuit Breaker Benchmark

Usage:
  npx ts-node scripts/benchmark-circuit-breaker.ts [options]

Options:
  -r, --requests  Total number of requests (default: 30)
  -b, --burst     Burst size for checking circuit state (default: 10)
  -d, --delay     Delay between requests in ms (default: 100)
  -h, --help      Show this help message

Examples:
  npx ts-node scripts/benchmark-circuit-breaker.ts
  npx ts-node scripts/benchmark-circuit-breaker.ts --requests 50
  npx ts-node scripts/benchmark-circuit-breaker.ts -r 100 -b 20 -d 50
`);
            process.exit(0);
        }
    }

    return config;
}

async function main() {
    const config = parseArgs();

    try {
        const result = await runCircuitBreakerTest(config);
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

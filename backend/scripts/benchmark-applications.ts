/**
 * Benchmark script for POST /applications endpoint
 * Uses autocannon to generate load and measure performance
 * 
 * Usage:
 *   npx ts-node scripts/benchmark-applications.ts
 *   npx ts-node scripts/benchmark-applications.ts --duration 30 --connections 10
 */

import autocannon, { Result } from 'autocannon';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const API_URL = process.env.API_URL || 'http://localhost:3001';

interface BenchmarkConfig {
    duration: number;      // seconds
    connections: number;   // concurrent connections
    pipelining: number;    // requests per connection
}

interface BenchmarkResult {
    timestamp: string;
    config: BenchmarkConfig;
    results: {
        latency: {
            avg: number;
            p50: number;
            p95: number;
            p99: number;
            max: number;
        };
        throughput: {
            avg: number;
            total: number;
        };
        requests: {
            total: number;
            average: number;
            sent: number;
        };
        errors: number;
        timeouts: number;
        duration: number;
    };
    patternsEnabled?: Record<string, boolean>;
}

async function login(): Promise<string> {
    console.log('🔐 Logging in to get JWT token...');

    // Try to login, if fails, register first
    try {
        const response = await axios.post(`${API_URL}/auth/login`, {
            email: 'benchmark@test.com',
            password: 'Benchmark@123',
        });
        return response.data.access_token;
    } catch {
        console.log('   User not found, registering...');
        await axios.post(`${API_URL}/auth/register`, {
            email: 'benchmark@test.com',
            password: 'Benchmark@123',
            firstName: 'Benchmark',
            lastName: 'User',
        });

        const response = await axios.post(`${API_URL}/auth/login`, {
            email: 'benchmark@test.com',
            password: 'Benchmark@123',
        });
        return response.data.access_token;
    }
}

async function getPatternStates(token: string): Promise<Record<string, boolean>> {
    try {
        const response = await axios.get(`${API_URL}/admin/feature-flags`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const patterns: Record<string, boolean> = {};
        for (const flag of response.data) {
            patterns[flag.name] = flag.enabled;
        }
        return patterns;
    } catch {
        return {};
    }
}

async function runBenchmark(config: BenchmarkConfig): Promise<BenchmarkResult> {
    const token = await login();
    const patterns = await getPatternStates(token);

    console.log('\n📊 Current pattern states:');
    for (const [name, enabled] of Object.entries(patterns)) {
        console.log(`   ${enabled ? '✅' : '❌'} ${name}`);
    }

    console.log(`\n🚀 Starting benchmark...`);
    console.log(`   Duration: ${config.duration}s`);
    console.log(`   Connections: ${config.connections}`);
    console.log(`   Pipelining: ${config.pipelining}\n`);

    const result = await new Promise<Result>((resolve, reject) => {
        const instance = autocannon({
            url: `${API_URL}/applications`,
            method: 'POST',
            duration: config.duration,
            connections: config.connections,
            pipelining: config.pipelining,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                personalStatement: 'Benchmark test application - ' + Date.now(),
            }),
            setupClient: (client) => {
                // Generate unique idempotency key for each request
                client.setHeaders({
                    'idempotency-key': `benchmark-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                });
            },
        }, (err, result) => {
            if (err) reject(err);
            else resolve(result);
        });

        // Show progress
        autocannon.track(instance, { renderProgressBar: true });
    });

    const benchmarkResult: BenchmarkResult = {
        timestamp: new Date().toISOString(),
        config,
        results: {
            latency: {
                avg: result.latency.average,
                p50: (result.latency as any).p50 || result.latency.average,
                p95: (result.latency as any).p95 || result.latency.average,
                p99: (result.latency as any).p99 || result.latency.average,
                max: result.latency.max,
            },
            throughput: {
                avg: result.throughput.average,
                total: result.throughput.total,
            },
            requests: {
                total: result.requests.total,
                average: result.requests.average,
                sent: result.requests.sent,
            },
            errors: result.errors,
            timeouts: result.timeouts,
            duration: result.duration,
        },
        patternsEnabled: patterns,
    };

    return benchmarkResult;
}

function printResults(result: BenchmarkResult): void {
    console.log('\n' + '='.repeat(60));
    console.log('📈 BENCHMARK RESULTS');
    console.log('='.repeat(60));

    console.log('\n⏱️  Latency (ms):');
    console.log(`   Average: ${result.results.latency.avg.toFixed(2)}`);
    console.log(`   P50:     ${result.results.latency.p50.toFixed(2)}`);
    console.log(`   P95:     ${result.results.latency.p95.toFixed(2)}`);
    console.log(`   P99:     ${result.results.latency.p99.toFixed(2)}`);
    console.log(`   Max:     ${result.results.latency.max.toFixed(2)}`);

    console.log('\n📊 Throughput:');
    console.log(`   Avg:   ${(result.results.throughput.avg / 1024).toFixed(2)} KB/s`);
    console.log(`   Total: ${(result.results.throughput.total / 1024 / 1024).toFixed(2)} MB`);

    console.log('\n📨 Requests:');
    console.log(`   Total:   ${result.results.requests.total}`);
    console.log(`   Avg/sec: ${result.results.requests.average.toFixed(2)}`);

    console.log('\n❌ Errors:');
    console.log(`   Errors:   ${result.results.errors}`);
    console.log(`   Timeouts: ${result.results.timeouts}`);

    console.log('\n' + '='.repeat(60) + '\n');
}

function saveResults(result: BenchmarkResult): string {
    const resultsDir = path.join(__dirname, '..', 'benchmark-results');
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }

    const filename = `benchmark-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(resultsDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
    console.log(`💾 Results saved to: ${filepath}`);

    return filepath;
}

// Parse command line args
function parseArgs(): BenchmarkConfig {
    const args = process.argv.slice(2);
    const config: BenchmarkConfig = {
        duration: 10,      // default 10 seconds
        connections: 10,   // default 10 connections
        pipelining: 1,     // default 1 request per connection
    };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--duration' || args[i] === '-d') {
            config.duration = parseInt(args[++i], 10);
        } else if (args[i] === '--connections' || args[i] === '-c') {
            config.connections = parseInt(args[++i], 10);
        } else if (args[i] === '--pipelining' || args[i] === '-p') {
            config.pipelining = parseInt(args[++i], 10);
        } else if (args[i] === '--help' || args[i] === '-h') {
            console.log(`
Benchmark POST /applications endpoint

Usage:
  npx ts-node scripts/benchmark-applications.ts [options]

Options:
  -d, --duration     Test duration in seconds (default: 10)
  -c, --connections  Number of concurrent connections (default: 10)
  -p, --pipelining   Number of pipelined requests (default: 1)
  -h, --help         Show this help message

Examples:
  npx ts-node scripts/benchmark-applications.ts
  npx ts-node scripts/benchmark-applications.ts -d 30 -c 20
  npx ts-node scripts/benchmark-applications.ts --duration 60 --connections 50
`);
            process.exit(0);
        }
    }

    return config;
}

async function main() {
    console.log('\n🔬 University Admission Portal - Application Submission Benchmark\n');

    const config = parseArgs();

    try {
        const result = await runBenchmark(config);
        printResults(result);
        saveResults(result);

        console.log('\n💡 Tips:');
        console.log('   1. Run with patterns enabled:  npx ts-node scripts/toggle-patterns.ts --enable');
        console.log('   2. Run benchmark again');
        console.log('   3. Run with patterns disabled: npx ts-node scripts/toggle-patterns.ts --disable');
        console.log('   4. Run benchmark again');
        console.log('   5. Compare results in benchmark-results/ folder\n');

    } catch (error: any) {
        console.error('\n❌ Benchmark failed:', error.message);
        process.exit(1);
    }
}

main();

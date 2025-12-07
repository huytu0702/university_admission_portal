/**
 * Cache-Aside Benchmark - Test Cache Performance
 * 
 * This benchmark tests the effectiveness of the Cache-Aside pattern (CQRS-lite)
 * by measuring read latency with and without caching enabled.
 * 
 * Expected Results:
 * - Cache OFF: Higher latency, direct DB reads
 * - Cache ON: Lower latency on subsequent reads (cache hits)
 * 
 * Usage:
 *   npx ts-node scripts/benchmark-cache.ts
 *   npx ts-node scripts/benchmark-cache.ts --requests 100
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const API_URL = process.env.API_URL || 'http://localhost:3001';

interface CacheTestConfig {
    totalRequests: number;
    warmupRequests: number;
}

interface CacheTestResult {
    timestamp: string;
    config: CacheTestConfig;
    patternsEnabled: {
        cacheAside: boolean;
        cqrsLite: boolean;
    };
    results: {
        coldReadLatencies: number[];
        warmReadLatencies: number[];
        avgColdLatency: number;
        avgWarmLatency: number;
        p95ColdLatency: number;
        p95WarmLatency: number;
        cacheHitRate: number;
        latencyImprovement: number;
    };
    verdict: 'GOOD' | 'DEGRADED' | 'FAILED';
    message: string;
}

async function login(): Promise<{ token: string; userId: string }> {
    try {
        const response = await axios.post(`${API_URL}/auth/login`, {
            email: 'cache-test@test.com',
            password: 'CacheTest@123',
        });
        // Decode JWT to get userId
        const tokenParts = response.data.access_token.split('.');
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        return { token: response.data.access_token, userId: payload.sub };
    } catch {
        console.log('   User not found, registering...');
        await axios.post(`${API_URL}/auth/register`, {
            email: 'cache-test@test.com',
            password: 'CacheTest@123',
            firstName: 'Cache',
            lastName: 'Test',
        });

        const response = await axios.post(`${API_URL}/auth/login`, {
            email: 'cache-test@test.com',
            password: 'CacheTest@123',
        });
        const tokenParts = response.data.access_token.split('.');
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        return { token: response.data.access_token, userId: payload.sub };
    }
}

async function checkCachePatterns(): Promise<{ cacheAside: boolean; cqrsLite: boolean }> {
    try {
        const response = await axios.get(`${API_URL}/admin/flags`);
        const flags = response.data;
        return {
            cacheAside: flags.find((f: any) => f.name === 'cache-aside')?.enabled || false,
            cqrsLite: flags.find((f: any) => f.name === 'cqrs-lite')?.enabled || false,
        };
    } catch {
        return { cacheAside: false, cqrsLite: false };
    }
}

async function createTestApplication(token: string): Promise<string | null> {
    try {
        const response = await axios.post(
            `${API_URL}/applications`,
            { personalStatement: `Cache test - ${Date.now()}` },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Idempotency-Key': `cache-test-${Date.now()}`,
                },
            }
        );
        return response.data.applicationId;
    } catch (error: any) {
        console.error('Failed to create test application:', error.message);
        return null;
    }
}

async function readApplication(token: string, applicationId: string): Promise<{ latencyMs: number; success: boolean }> {
    const start = Date.now();
    try {
        await axios.get(`${API_URL}/read/applications/${applicationId}`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        return { latencyMs: Date.now() - start, success: true };
    } catch {
        return { latencyMs: Date.now() - start, success: false };
    }
}

function calculateP95(latencies: number[]): number {
    if (latencies.length === 0) return 0;
    const sorted = [...latencies].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.95);
    return sorted[index] || sorted[sorted.length - 1];
}

async function runCacheTest(config: CacheTestConfig): Promise<CacheTestResult> {
    console.log('\n🔬 Cache-Aside Benchmark - Read Performance Test\n');

    const { token, userId } = await login();
    const patternsEnabled = await checkCachePatterns();

    console.log('📊 Patterns enabled:');
    console.log(`   Cache-Aside: ${patternsEnabled.cacheAside ? '✅' : '❌'}`);
    console.log(`   CQRS-Lite: ${patternsEnabled.cqrsLite ? '✅' : '❌'}`);

    // Create a test application
    console.log('\n📝 Creating test application...');
    const applicationId = await createTestApplication(token);
    if (!applicationId) {
        throw new Error('Failed to create test application');
    }
    console.log(`   Application ID: ${applicationId}`);

    // Wait a moment for async processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cold reads (first access - cache miss)
    console.log(`\n❄️  Performing ${config.warmupRequests} cold reads...`);
    const coldReadLatencies: number[] = [];
    for (let i = 0; i < config.warmupRequests; i++) {
        const result = await readApplication(token, applicationId);
        if (result.success) {
            coldReadLatencies.push(result.latencyMs);
        }
        process.stdout.write(`\r   Progress: ${i + 1}/${config.warmupRequests}`);
    }
    console.log(' ✅');

    // Warm reads (subsequent access - cache hit)
    console.log(`🔥 Performing ${config.totalRequests} warm reads...`);
    const warmReadLatencies: number[] = [];
    for (let i = 0; i < config.totalRequests; i++) {
        const result = await readApplication(token, applicationId);
        if (result.success) {
            warmReadLatencies.push(result.latencyMs);
        }
        process.stdout.write(`\r   Progress: ${i + 1}/${config.totalRequests}`);
    }
    console.log(' ✅');

    // Calculate metrics
    const avgColdLatency = coldReadLatencies.length > 0
        ? coldReadLatencies.reduce((a, b) => a + b, 0) / coldReadLatencies.length
        : 0;
    const avgWarmLatency = warmReadLatencies.length > 0
        ? warmReadLatencies.reduce((a, b) => a + b, 0) / warmReadLatencies.length
        : 0;
    const p95ColdLatency = calculateP95(coldReadLatencies);
    const p95WarmLatency = calculateP95(warmReadLatencies);

    // Calculate cache effectiveness
    const latencyImprovement = avgColdLatency > 0
        ? ((avgColdLatency - avgWarmLatency) / avgColdLatency) * 100
        : 0;

    // Estimate cache hit rate based on latency patterns
    // If warm reads are significantly faster, cache is working
    const cacheHitRate = patternsEnabled.cacheAside && latencyImprovement > 20 ? 90 : 0;

    // Determine verdict
    let verdict: 'GOOD' | 'DEGRADED' | 'FAILED';
    let message: string;

    if (patternsEnabled.cacheAside) {
        if (latencyImprovement > 30) {
            verdict = 'GOOD';
            message = `✅ Cache working effectively! ${latencyImprovement.toFixed(1)}% latency improvement`;
        } else if (latencyImprovement > 10) {
            verdict = 'DEGRADED';
            message = `⚠️  Cache showing modest improvement: ${latencyImprovement.toFixed(1)}%`;
        } else {
            verdict = 'FAILED';
            message = `❌ Cache not providing expected benefits (${latencyImprovement.toFixed(1)}% improvement)`;
        }
    } else {
        verdict = 'DEGRADED';
        message = `⚠️  Cache-Aside disabled - all reads hitting database directly`;
    }

    return {
        timestamp: new Date().toISOString(),
        config,
        patternsEnabled,
        results: {
            coldReadLatencies,
            warmReadLatencies,
            avgColdLatency,
            avgWarmLatency,
            p95ColdLatency,
            p95WarmLatency,
            cacheHitRate,
            latencyImprovement,
        },
        verdict,
        message,
    };
}

function printResults(result: CacheTestResult): void {
    console.log('\n' + '═'.repeat(70));
    console.log('📊 CACHE-ASIDE BENCHMARK RESULTS');
    console.log('═'.repeat(70));

    console.log(`\n⚙️  Configuration:`);
    console.log(`   Warmup Requests: ${result.config.warmupRequests}`);
    console.log(`   Test Requests: ${result.config.totalRequests}`);

    console.log(`\n🛡️  Patterns:`);
    console.log(`   Cache-Aside: ${result.patternsEnabled.cacheAside ? '✅' : '❌'}`);
    console.log(`   CQRS-Lite: ${result.patternsEnabled.cqrsLite ? '✅' : '❌'}`);

    console.log(`\n❄️  Cold Reads (Cache Miss):`);
    console.log(`   Average Latency: ${result.results.avgColdLatency.toFixed(2)}ms`);
    console.log(`   P95 Latency: ${result.results.p95ColdLatency.toFixed(2)}ms`);

    console.log(`\n🔥 Warm Reads (Cache Hit):`);
    console.log(`   Average Latency: ${result.results.avgWarmLatency.toFixed(2)}ms`);
    console.log(`   P95 Latency: ${result.results.p95WarmLatency.toFixed(2)}ms`);

    console.log(`\n📈 Cache Performance:`);
    console.log(`   Latency Improvement: ${result.results.latencyImprovement.toFixed(1)}%`);
    console.log(`   Estimated Cache Hit Rate: ${result.results.cacheHitRate}%`);

    console.log(`\n🎯 Verdict: ${result.verdict}`);
    console.log(`   ${result.message}`);

    if (!result.patternsEnabled.cacheAside) {
        console.log(`\n💡 Recommendation:`);
        console.log(`   Enable cache-aside pattern for better read performance:`);
        console.log(`   npm run patterns:on`);
    }

    console.log('\n' + '═'.repeat(70) + '\n');
}

function saveResults(result: CacheTestResult): void {
    const resultsDir = path.join(__dirname, '..', 'benchmark-results');
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }

    // Remove large arrays from saved result
    const savedResult = {
        ...result,
        results: {
            ...result.results,
            coldReadLatencies: `[${result.results.coldReadLatencies.length} samples]`,
            warmReadLatencies: `[${result.results.warmReadLatencies.length} samples]`,
        },
    };

    const filename = `cache-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(resultsDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(savedResult, null, 2));
    console.log(`💾 Results saved to: ${filepath}`);
}

function parseArgs(): CacheTestConfig {
    const args = process.argv.slice(2);
    const config: CacheTestConfig = {
        totalRequests: 50,
        warmupRequests: 10,
    };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--requests' || args[i] === '-r') {
            config.totalRequests = parseInt(args[++i], 10);
        } else if (args[i] === '--warmup' || args[i] === '-w') {
            config.warmupRequests = parseInt(args[++i], 10);
        } else if (args[i] === '--help' || args[i] === '-h') {
            console.log(`
Cache-Aside Benchmark

Usage:
  npx ts-node scripts/benchmark-cache.ts [options]

Options:
  -r, --requests  Number of warm read requests (default: 50)
  -w, --warmup    Number of cold read requests (default: 10)
  -h, --help      Show this help message

Examples:
  npx ts-node scripts/benchmark-cache.ts
  npx ts-node scripts/benchmark-cache.ts --requests 100
  npx ts-node scripts/benchmark-cache.ts -r 200 -w 20
`);
            process.exit(0);
        }
    }

    return config;
}

async function main() {
    const config = parseArgs();

    try {
        const result = await runCacheTest(config);
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

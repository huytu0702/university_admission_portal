/**
 * Compare benchmark results from JSON files
 * Usage:
 *   npx ts-node scripts/compare-benchmarks.ts <before.json> <after.json>
 *   npx ts-node scripts/compare-benchmarks.ts --latest
 */

import * as fs from 'fs';
import * as path from 'path';

interface BenchmarkResult {
    timestamp: string;
    config: {
        duration: number;
        connections: number;
        pipelining: number;
    };
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

function loadResult(filepath: string): BenchmarkResult {
    const content = fs.readFileSync(filepath, 'utf-8');
    return JSON.parse(content);
}

function getLatestFiles(): string[] {
    const resultsDir = path.join(__dirname, '..', 'benchmark-results');

    if (!fs.existsSync(resultsDir)) {
        throw new Error('No benchmark-results directory found. Run benchmarks first.');
    }

    const files = fs.readdirSync(resultsDir)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse();

    if (files.length < 2) {
        throw new Error('Need at least 2 benchmark results to compare. Run more benchmarks.');
    }

    return [
        path.join(resultsDir, files[1]), // older
        path.join(resultsDir, files[0]), // newer
    ];
}

function percentChange(before: number, after: number): string {
    if (before === 0) return after === 0 ? '0.00%' : '+∞%';
    const change = ((after - before) / before) * 100;
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
}

function formatDelta(before: number, after: number, lowerIsBetter: boolean): string {
    const delta = after - before;
    const pct = percentChange(before, after);

    let icon = '➡️';
    if (delta < 0) {
        icon = lowerIsBetter ? '✅' : '❌';
    } else if (delta > 0) {
        icon = lowerIsBetter ? '❌' : '✅';
    }

    return `${icon} ${pct}`;
}

function compareResults(before: BenchmarkResult, after: BenchmarkResult): void {
    console.log('\n' + '═'.repeat(70));
    console.log('📊 BENCHMARK COMPARISON REPORT');
    console.log('═'.repeat(70));

    console.log(`\n📅 Before: ${before.timestamp}`);
    console.log(`📅 After:  ${after.timestamp}`);

    // Pattern states
    console.log('\n🔧 Pattern States:');
    console.log('─'.repeat(50));
    console.log('Pattern                        Before    After');
    console.log('─'.repeat(50));

    const allPatterns = Array.from(new Set([
        ...Object.keys(before.patternsEnabled || {}),
        ...Object.keys(after.patternsEnabled || {}),
    ]));

    for (const pattern of allPatterns) {
        const beforeState = before.patternsEnabled?.[pattern] ? 'ON ' : 'OFF';
        const afterState = after.patternsEnabled?.[pattern] ? 'ON ' : 'OFF';
        const changed = beforeState !== afterState ? ' ⚡' : '';
        console.log(`${pattern.padEnd(30)} ${beforeState.padEnd(10)} ${afterState}${changed}`);
    }

    // Latency comparison
    console.log('\n⏱️  Latency (ms) - Lower is better:');
    console.log('─'.repeat(55));
    console.log('Metric      Before        After         Change');
    console.log('─'.repeat(55));

    const latencies = [
        ['Average', before.results.latency.avg, after.results.latency.avg],
        ['P50', before.results.latency.p50, after.results.latency.p50],
        ['P95', before.results.latency.p95, after.results.latency.p95],
        ['P99', before.results.latency.p99, after.results.latency.p99],
        ['Max', before.results.latency.max, after.results.latency.max],
    ] as const;

    for (const [name, beforeVal, afterVal] of latencies) {
        console.log(
            `${name.padEnd(12)} ${beforeVal.toFixed(2).padStart(10)} ${afterVal.toFixed(2).padStart(12)}   ${formatDelta(beforeVal, afterVal, true)}`
        );
    }

    // Throughput comparison
    console.log('\n📈 Throughput - Higher is better:');
    console.log('─'.repeat(55));
    console.log('Metric      Before        After         Change');
    console.log('─'.repeat(55));

    console.log(
        `Req/sec     ${before.results.requests.average.toFixed(2).padStart(10)} ${after.results.requests.average.toFixed(2).padStart(12)}   ${formatDelta(before.results.requests.average, after.results.requests.average, false)}`
    );
    console.log(
        `Total Reqs  ${before.results.requests.total.toString().padStart(10)} ${after.results.requests.total.toString().padStart(12)}   ${formatDelta(before.results.requests.total, after.results.requests.total, false)}`
    );

    // Errors
    console.log('\n❌ Errors - Lower is better:');
    console.log('─'.repeat(55));
    console.log('Metric      Before        After         Change');
    console.log('─'.repeat(55));

    console.log(
        `Errors      ${before.results.errors.toString().padStart(10)} ${after.results.errors.toString().padStart(12)}   ${formatDelta(before.results.errors, after.results.errors, true)}`
    );
    console.log(
        `Timeouts    ${before.results.timeouts.toString().padStart(10)} ${after.results.timeouts.toString().padStart(12)}   ${formatDelta(before.results.timeouts, after.results.timeouts, true)}`
    );

    // Summary
    console.log('\n' + '═'.repeat(70));
    console.log('📋 SUMMARY');
    console.log('═'.repeat(70));

    const latencyImproved = after.results.latency.avg < before.results.latency.avg;
    const throughputImproved = after.results.requests.average > before.results.requests.average;
    const errorsReduced = after.results.errors <= before.results.errors;

    const score = (latencyImproved ? 1 : 0) + (throughputImproved ? 1 : 0) + (errorsReduced ? 1 : 0);

    if (score === 3) {
        console.log('\n🎉 Overall: IMPROVED - All metrics are better!');
    } else if (score >= 2) {
        console.log('\n✅ Overall: MOSTLY IMPROVED - Most metrics are better.');
    } else if (score === 1) {
        console.log('\n⚠️  Overall: MIXED RESULTS - Some metrics improved, some degraded.');
    } else {
        console.log('\n❌ Overall: DEGRADED - Most metrics are worse.');
    }

    console.log(`\n   Latency:    ${latencyImproved ? '✅ Improved' : '❌ Degraded'} (${percentChange(before.results.latency.avg, after.results.latency.avg)})`);
    console.log(`   Throughput: ${throughputImproved ? '✅ Improved' : '❌ Degraded'} (${percentChange(before.results.requests.average, after.results.requests.average)})`);
    console.log(`   Errors:     ${errorsReduced ? '✅ Same/Better' : '❌ More errors'}`);

    console.log('\n' + '═'.repeat(70) + '\n');
}

function main(): void {
    const args = process.argv.slice(2);

    let beforeFile: string;
    let afterFile: string;

    if (args.includes('--latest') || args.includes('-l') || args.length === 0) {
        console.log('📁 Finding latest benchmark results...');
        [beforeFile, afterFile] = getLatestFiles();
    } else if (args.length === 2) {
        beforeFile = args[0];
        afterFile = args[1];
    } else {
        console.log(`
Compare Benchmark Results

Usage:
  npx ts-node scripts/compare-benchmarks.ts [options] [before.json] [after.json]

Options:
  -l, --latest   Compare the two most recent benchmark results
  -h, --help     Show this help message

Examples:
  npx ts-node scripts/compare-benchmarks.ts --latest
  npx ts-node scripts/compare-benchmarks.ts before.json after.json
`);
        process.exit(1);
    }

    console.log(`📄 Before: ${path.basename(beforeFile)}`);
    console.log(`📄 After:  ${path.basename(afterFile)}`);

    try {
        const before = loadResult(beforeFile);
        const after = loadResult(afterFile);
        compareResults(before, after);
    } catch (error: any) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

main();

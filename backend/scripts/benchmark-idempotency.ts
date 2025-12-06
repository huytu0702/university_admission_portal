/**
 * Idempotency Benchmark - Test Duplicate Request Protection
 * 
 * This benchmark tests the effectiveness of the Idempotency pattern
 * by sending the SAME request multiple times with the same Idempotency-Key.
 * 
 * Expected Results:
 * - Patterns OFF: Creates N duplicate applications (BAD)
 * - Patterns ON: Creates only 1 application, rejects duplicates (GOOD)
 * 
 * Usage:
 *   npx ts-node scripts/benchmark-idempotency.ts
 *   npx ts-node scripts/benchmark-idempotency.ts --requests 100
 */

import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3001';

interface IdempotencyTestResult {
    timestamp: string;
    config: {
        totalRequests: number;
        idempotencyKey: string;
    };
    results: {
        totalRequests: number;
        successfulRequests: number;
        duplicateRejected: number;
        erroredRequests: number;
        applicationsCreated: number;
    };
    patternsEnabled: boolean;
    verdict: 'PASSED' | 'FAILED';
    message: string;
}

async function login(): Promise<string> {
    try {
        const response = await axios.post(`${API_URL}/auth/login`, {
            email: 'idempotency-test@test.com',
            password: 'Idempotency@123',
        });
        return response.data.access_token;
    } catch {
        console.log('   User not found, registering...');
        await axios.post(`${API_URL}/auth/register`, {
            email: 'idempotency-test@test.com',
            password: 'Idempotency@123',
            firstName: 'Idempotency',
            lastName: 'Test',
        });

        const response = await axios.post(`${API_URL}/auth/login`, {
            email: 'idempotency-test@test.com',
            password: 'Idempotency@123',
        });
        return response.data.access_token;
    }
}

async function checkIdempotencyPattern(): Promise<boolean> {
    try {
        const response = await axios.get(`${API_URL}/admin/flags`);
        const idempotencyFlag = response.data.find((f: any) => f.name === 'idempotency-key');
        return idempotencyFlag?.enabled || false;
    } catch {
        return false;
    }
}

async function countApplications(token: string, userId: string): Promise<number> {
    try {
        const response = await axios.get(`${API_URL}/applications`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return Array.isArray(response.data) ? response.data.length : 0;
    } catch {
        return 0;
    }
}

async function runIdempotencyTest(totalRequests: number): Promise<IdempotencyTestResult> {
    console.log('\n🔬 Idempotency Benchmark - Duplicate Request Protection\n');

    const token = await login();
    const patternsEnabled = await checkIdempotencyPattern();

    console.log(`📊 Idempotency pattern: ${patternsEnabled ? '✅ ENABLED' : '❌ DISABLED'}`);
    console.log(`📨 Sending ${totalRequests} requests with SAME idempotency key...\n`);

    // Generate a unique idempotency key for this test
    const idempotencyKey = `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Count applications before test (GET /applications already filters by user via token)
    const applicationsBefore = await countApplications(token, '');

    // Send multiple requests with SAME idempotency key
    const results = {
        totalRequests,
        successfulRequests: 0,
        duplicateRejected: 0,
        erroredRequests: 0,
    };

    const requestPayload = {
        personalStatement: `Idempotency test - ${idempotencyKey}`,
    };

    console.log('Progress:');
    for (let i = 0; i < totalRequests; i++) {
        try {
            const response = await axios.post(
                `${API_URL}/applications`,
                requestPayload,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'idempotency-key': idempotencyKey,
                    },
                }
            );

            if (response.status === 201 || response.status === 202) {
                results.successfulRequests++;
                process.stdout.write('✅');
            } else {
                // Log unexpected status code
                console.log(`\nUnexpected status: ${response.status}`);
                results.erroredRequests++;
                process.stdout.write('⚠️ ');
            }
        } catch (error: any) {
            if (error.response?.status === 409) {
                // Duplicate detected by idempotency
                results.duplicateRejected++;
                process.stdout.write('🔄');
            } else {
                // Log error details for debugging
                const status = error.response?.status || 'no response';
                const msg = error.response?.data?.message || error.message;
                console.log(`\n❌ Error [${status}]: ${msg}`);
                results.erroredRequests++;
                process.stdout.write('❌');
            }
        }

        // Progress indicator
        if ((i + 1) % 20 === 0) {
            process.stdout.write(` ${i + 1}\n`);
        }
    }

    console.log('\n');

    // Wait a bit for async processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Count applications after test
    const applicationsAfter = await countApplications(token, '');
    const applicationsCreated = applicationsAfter - applicationsBefore;

    // Determine verdict
    let verdict: 'PASSED' | 'FAILED' = 'FAILED';
    let message = '';

    if (patternsEnabled) {
        // Idempotency works by returning cached result (still 201/202), not by rejecting with 409
        // So we only check if exactly 1 application was created
        if (applicationsCreated === 1) {
            verdict = 'PASSED';
            message = '✅ Idempotency pattern working correctly - only 1 application created!';
        } else {
            message = `❌ Idempotency pattern FAILED - created ${applicationsCreated} applications instead of 1`;
        }
    } else {
        if (applicationsCreated === totalRequests || applicationsCreated > 1) {
            verdict = 'PASSED';
            message = `⚠️  No idempotency - created ${applicationsCreated} duplicate applications (expected behavior)`;
        } else {
            message = `⚠️  Unexpected: created ${applicationsCreated} applications without idempotency`;
        }
    }

    return {
        timestamp: new Date().toISOString(),
        config: {
            totalRequests,
            idempotencyKey,
        },
        results: {
            ...results,
            applicationsCreated,
        },
        patternsEnabled,
        verdict,
        message,
    };
}

function printResults(result: IdempotencyTestResult): void {
    console.log('\n' + '═'.repeat(70));
    console.log('📊 IDEMPOTENCY TEST RESULTS');
    console.log('═'.repeat(70));

    console.log(`\n⚙️  Configuration:`);
    console.log(`   Total Requests: ${result.config.totalRequests}`);
    console.log(`   Idempotency Key: ${result.config.idempotencyKey}`);
    console.log(`   Patterns Enabled: ${result.patternsEnabled ? '✅ YES' : '❌ NO'}`);

    console.log(`\n📈 Results:`);
    console.log(`   Successful (202): ${result.results.successfulRequests}`);
    console.log(`   Duplicate Rejected (409): ${result.results.duplicateRejected}`);
    console.log(`   Errors: ${result.results.erroredRequests}`);
    console.log(`   Applications Created: ${result.results.applicationsCreated}`);

    console.log(`\n🎯 Verdict: ${result.verdict}`);
    console.log(`   ${result.message}`);

    if (result.patternsEnabled) {
        if (result.verdict === 'PASSED') {
            console.log(`\n✨ SUCCESS: Idempotency pattern prevented ${result.config.totalRequests - 1} duplicates!`);
        } else {
            console.log(`\n⚠️  WARNING: Idempotency pattern did not work as expected`);
        }
    } else {
        console.log(`\n💡 Enable idempotency pattern to prevent duplicates:`);
        console.log(`   npm run patterns:on`);
    }

    console.log('\n' + '═'.repeat(70) + '\n');
}

function parseArgs(): { requests: number } {
    const args = process.argv.slice(2);
    let requests = 50; // default

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--requests' || args[i] === '-r') {
            requests = parseInt(args[++i], 10);
        } else if (args[i] === '--help' || args[i] === '-h') {
            console.log(`
Idempotency Benchmark

Usage:
  npx ts-node scripts/benchmark-idempotency.ts [options]

Options:
  -r, --requests    Number of duplicate requests to send (default: 50)
  -h, --help        Show this help message

Examples:
  npx ts-node scripts/benchmark-idempotency.ts
  npx ts-node scripts/benchmark-idempotency.ts --requests 100
`);
            process.exit(0);
        }
    }

    return { requests };
}

async function main() {
    const { requests } = parseArgs();

    try {
        const result = await runIdempotencyTest(requests);
        printResults(result);

        // Exit with error code if test failed with patterns enabled
        if (result.patternsEnabled && result.verdict === 'FAILED') {
            process.exit(1);
        }
    } catch (error: any) {
        console.error('\n❌ Test failed:', error.message);
        process.exit(1);
    }
}

main();

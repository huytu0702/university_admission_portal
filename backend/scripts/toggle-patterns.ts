/**
 * Toggle all design patterns on/off
 * Usage:
 *   npx ts-node scripts/toggle-patterns.ts --enable
 *   npx ts-node scripts/toggle-patterns.ts --disable
 */

import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3001';

const DESIGN_PATTERNS = [
    'queue-based-load-leveling',
    'idempotency-key',
    'outbox-pattern',
    'cqrs-lite',
    'circuit-breaker-payment',
    'bulkhead-isolation',
    'competing-consumers',
    'retry-exponential-backoff',
    'cache-aside',
];

async function login(): Promise<string> {
    // Try to login first
    try {
        const response = await axios.post(`${API_URL}/auth/login`, {
            email: 'admin@test.com',
            password: 'Password@123',
        });
        return response.data.access_token;
    } catch {
        // If login fails, try to register
        console.log('   User not found, registering admin@test.com...');
        await axios.post(`${API_URL}/auth/register`, {
            email: 'admin@test.com',
            password: 'Password@123',
            firstName: 'Admin',
            lastName: 'Test',
        });

        // Login after registration
        const response = await axios.post(`${API_URL}/auth/login`, {
            email: 'admin@test.com',
            password: 'Password@123',
        });
        return response.data.access_token;
    }
}

async function togglePatterns(enable: boolean): Promise<void> {
    console.log(`\n🔧 ${enable ? 'Enabling' : 'Disabling'} all design patterns...\n`);

    let token: string;
    try {
        token = await login();
    } catch (error) {
        console.error('❌ Failed to login. Make sure admin user exists.');
        console.error('   Create admin: POST /auth/register with email: admin@test.com');
        process.exit(1);
    }

    const headers = { Authorization: `Bearer ${token}` };

    for (const pattern of DESIGN_PATTERNS) {
        try {
            await axios.patch(
                `${API_URL}/admin/flags/${pattern}`,
                { enabled: enable },
                { headers }
            );
            console.log(`  ✅ ${pattern}: ${enable ? 'ON' : 'OFF'}`);
        } catch (error: any) {
            if (error.response?.status === 404) {
                console.log(`  ⚠️  ${pattern}: not found (skipped)`);
            } else {
                console.error(`  ❌ ${pattern}: failed - ${error.message}`);
            }
        }
    }

    // Record toggle event for metrics correlation
    try {
        await axios.post(
            `${API_URL}/metrics/comparison/record-toggle`,
            {
                patternName: 'all_patterns',
                enabled: enable,
                userId: 'benchmark-script'
            },
            { headers }
        );
        console.log(`\n📊 Toggle event recorded for metrics correlation`);
    } catch {
        console.log(`\n⚠️  Could not record toggle event (metrics endpoint may be unavailable)`);
    }

    console.log(`\n✅ Done! Timestamp: ${new Date().toISOString()}`);
    console.log(`   Save this timestamp for metrics comparison.\n`);
}

// Parse command line args
const args = process.argv.slice(2);
const enable = args.includes('--enable') || args.includes('-e');
const disable = args.includes('--disable') || args.includes('-d');

if (!enable && !disable) {
    console.log('Usage:');
    console.log('  npx ts-node scripts/toggle-patterns.ts --enable');
    console.log('  npx ts-node scripts/toggle-patterns.ts --disable');
    process.exit(1);
}

togglePatterns(enable).catch(console.error);

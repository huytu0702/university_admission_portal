'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { RefreshCw, Activity, TrendingUp, Clock } from 'lucide-react';
import LatencyHistogram from './LatencyHistogram';
import ErrorRateTrends from './ErrorRateTrends';
import QueueDepthMonitor from './QueueDepthMonitor';
import ThroughputGraph from './ThroughputGraph';

interface DashboardData {
  latencyHistogram: {
    buckets: Array<{ range: string; count: number; percentage: number }>;
    p50: number;
    p95: number;
    p99: number;
    mean: number;
    total: number;
  };
  errorRateTrends: Array<{
    timestamp: Date;
    errorRate: number;
    totalErrors: number;
    totalRequests: number;
  }>;
  queueDepth: {
    data: Array<{
      timestamp: Date;
      depth: number;
      queueName: string;
    }>;
    stats: Array<{
      queueName: string;
      currentDepth: number;
      avgDepth: number;
      maxDepth: number;
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    }>;
  };
  throughput: Array<{
    timestamp: Date;
    value: number;
    endpoint?: string;
  }>;
  summary: {
    totalRequests: number;
    avgLatency: number;
    errorRate: number;
    activeWorkers: number;
  };
}

export default function RealTimeMetricsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5 seconds
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get token from localStorage
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {};
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/metrics/dashboard?timeRange=1h', {
        headers,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Dashboard API error:', response.status, errorText);
        throw new Error(`Failed to fetch dashboard data: ${response.status}`);
      }

      const result = await response.json();
      
      // Transform data for components
      const transformedData: DashboardData = {
        latencyHistogram: result.data.latencyHistogram || generateMockLatencyHistogram(),
        errorRateTrends: result.data.errorRateTrends || generateMockErrorRates(),
        queueDepth: result.data.queueDepth || generateMockQueueDepth(),
        throughput: result.data.throughput || generateMockThroughput(),
        summary: result.data.summary || {
          totalRequests: 0,
          avgLatency: 0,
          errorRate: 0,
          activeWorkers: 0,
        },
      };

      setData(transformedData);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    fetchDashboardData();

    if (autoRefresh) {
      const interval = setInterval(fetchDashboardData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchDashboardData]);

  const handleManualRefresh = () => {
    fetchDashboardData();
  };

  const handleRefreshIntervalChange = (interval: number) => {
    setRefreshInterval(interval);
  };

  if (loading && !data) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-gray-600">Loading metrics...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={handleManualRefresh}>Retry</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Real-Time Performance Metrics
              </CardTitle>
              <CardDescription>
                Live system metrics with automatic updates
                {lastUpdated && (
                  <span className="ml-2 text-xs">
                    (Last updated: {lastUpdated.toLocaleTimeString()})
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Auto-refresh:</span>
                <Switch
                  checked={autoRefresh}
                  onCheckedChange={setAutoRefresh}
                />
              </div>
              <select
                value={refreshInterval}
                onChange={(e) => handleRefreshIntervalChange(Number(e.target.value))}
                className="text-sm border rounded px-2 py-1"
                disabled={!autoRefresh}
              >
                <option value={3000}>3s</option>
                <option value={5000}>5s</option>
                <option value={10000}>10s</option>
                <option value={30000}>30s</option>
                <option value={60000}>1m</option>
              </select>
              <Button
                onClick={handleManualRefresh}
                disabled={loading}
                size="sm"
                variant="outline"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Requests</p>
                  <p className="text-2xl font-bold">{data.summary.totalRequests.toLocaleString()}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg Latency</p>
                  <p className="text-2xl font-bold">{data.summary.avgLatency.toFixed(0)}ms</p>
                </div>
                <Clock className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Error Rate</p>
                  <p className="text-2xl font-bold">{data.summary.errorRate.toFixed(2)}%</p>
                </div>
                <Badge variant={data.summary.errorRate > 5 ? 'destructive' : 'default'}>
                  {data.summary.errorRate > 5 ? 'High' : 'Normal'}
                </Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Workers</p>
                  <p className="text-2xl font-bold">{data.summary.activeWorkers}</p>
                </div>
                <Activity className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts Grid */}
      {data && (
        <div className="space-y-6">
          {/* Latency Histogram */}
          <LatencyHistogram data={data.latencyHistogram} />

          {/* Error Rate Trends */}
          <ErrorRateTrends data={data.errorRateTrends} />

          {/* Throughput Graph */}
          <ThroughputGraph data={data.throughput} />

          {/* Queue Depth Monitor */}
          <QueueDepthMonitor
            data={data.queueDepth.data}
            queueStats={data.queueDepth.stats}
          />
        </div>
      )}
    </div>
  );
}

// Mock data generators (for when backend doesn't provide data yet)
function generateMockLatencyHistogram() {
  return {
    buckets: [
      { range: '0-50', count: 450, percentage: 45 },
      { range: '50-100', count: 300, percentage: 30 },
      { range: '100-200', count: 150, percentage: 15 },
      { range: '200-500', count: 70, percentage: 7 },
      { range: '500-1000', count: 20, percentage: 2 },
      { range: '1000+', count: 10, percentage: 1 },
    ],
    p50: 75,
    p95: 350,
    p99: 750,
    mean: 120,
    total: 1000,
  };
}

function generateMockErrorRates() {
  const now = Date.now();
  return Array.from({ length: 20 }, (_, i) => ({
    timestamp: new Date(now - (20 - i) * 3 * 60 * 1000),
    errorRate: Math.random() * 3 + 1,
    totalErrors: Math.floor(Math.random() * 50),
    totalRequests: Math.floor(Math.random() * 1000) + 500,
  }));
}

function generateMockQueueDepth() {
  const now = Date.now();
  const queues = ['verify_document', 'create_payment', 'send_email'];
  
  return {
    data: queues.flatMap(queue =>
      Array.from({ length: 20 }, (_, i) => ({
        timestamp: new Date(now - (20 - i) * 3 * 60 * 1000),
        depth: Math.floor(Math.random() * 100),
        queueName: queue,
      }))
    ),
    stats: queues.map(queue => ({
      queueName: queue,
      currentDepth: Math.floor(Math.random() * 50),
      avgDepth: Math.floor(Math.random() * 30),
      maxDepth: Math.floor(Math.random() * 100) + 50,
      waiting: Math.floor(Math.random() * 30),
      active: Math.floor(Math.random() * 10),
      completed: Math.floor(Math.random() * 1000) + 500,
      failed: Math.floor(Math.random() * 50),
    })),
  };
}

function generateMockThroughput() {
  const now = Date.now();
  return Array.from({ length: 20 }, (_, i) => ({
    timestamp: new Date(now - (20 - i) * 3 * 60 * 1000),
    value: Math.floor(Math.random() * 200) + 50,
  }));
}

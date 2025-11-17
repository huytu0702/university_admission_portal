'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, RefreshCw } from 'lucide-react';
import TimeRangeSelector, { TimeRange } from './TimeRangeSelector';
import ComparisonChart from './ComparisonChart';
import PatternImpactChart from './PatternImpactChart';

interface ComparisonResult {
  period1: {
    label: string;
    timeRange: { start: Date; end: Date };
    metrics: any;
    patternState: Record<string, boolean>;
  };
  period2: {
    label: string;
    timeRange: { start: Date; end: Date };
    metrics: any;
    patternState: Record<string, boolean>;
  };
  deltas: {
    http: {
      avgLatencyPercentChange: number;
      p95LatencyPercentChange: number;
      requestsPercentChange: number;
      errorsPercentChange: number;
      errorRatePercentChange: number;
    };
    applications: {
      submissionsPercentChange: number;
      processingTimePercentChange: number;
    };
  };
  patternChanges: {
    enabled: string[];
    disabled: string[];
    unchanged: string[];
  };
  improvement: {
    overall: 'improved' | 'degraded' | 'neutral';
    score: number;
    factors: {
      latency: number;
      throughput: number;
      errorRate: number;
      reliability: number;
    };
  };
}

export default function BeforeAfterComparison() {
  const [loading, setLoading] = useState(false);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [period1, setPeriod1] = useState<TimeRange | null>(null);
  const [period2, setPeriod2] = useState<TimeRange | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<{
    latency1: any[];
    latency2: any[];
    throughput1: any[];
    throughput2: any[];
  } | null>(null);

  const fetchComparison = async () => {
    if (!period1 || !period2) {
      alert('Please select both time periods');
      return;
    }

    setLoading(true);
    try {
      // Fetch comparison data
      const response = await fetch(
        `/api/metrics/comparison/detailed?` +
          `period1Start=${period1.start.toISOString()}&` +
          `period1End=${period1.end.toISOString()}&` +
          `period2Start=${period2.start.toISOString()}&` +
          `period2End=${period2.end.toISOString()}&` +
          `period1Label=${encodeURIComponent(period1.label)}&` +
          `period2Label=${encodeURIComponent(period2.label)}`,
      );
      const data = await response.json();
      setComparison(data.data);

      // Fetch time series data
      const [latency1Res, latency2Res, throughput1Res, throughput2Res] =
        await Promise.all([
          fetch(
            `/api/metrics/timeseries?metricPath=http.avgLatency&startTime=${period1.start.toISOString()}&endTime=${period1.end.toISOString()}`,
          ),
          fetch(
            `/api/metrics/timeseries?metricPath=http.avgLatency&startTime=${period2.start.toISOString()}&endTime=${period2.end.toISOString()}`,
          ),
          fetch(
            `/api/metrics/timeseries?metricPath=http.totalRequests&startTime=${period1.start.toISOString()}&endTime=${period1.end.toISOString()}`,
          ),
          fetch(
            `/api/metrics/timeseries?metricPath=http.totalRequests&startTime=${period2.start.toISOString()}&endTime=${period2.end.toISOString()}`,
          ),
        ]);

      const [latency1, latency2, throughput1, throughput2] = await Promise.all([
        latency1Res.json(),
        latency2Res.json(),
        throughput1Res.json(),
        throughput2Res.json(),
      ]);

      setTimeSeriesData({
        latency1: latency1.data,
        latency2: latency2.data,
        throughput1: throughput1.data,
        throughput2: throughput2.data,
      });
    } catch (error) {
      console.error('Failed to fetch comparison:', error);
      alert('Failed to fetch comparison data');
    } finally {
      setLoading(false);
    }
  };

  const handleExportJSON = async () => {
    if (!period1 || !period2) return;

    const url =
      `/api/metrics/comparison/export/json?` +
      `period1Start=${period1.start.toISOString()}&` +
      `period1End=${period1.end.toISOString()}&` +
      `period2Start=${period2.start.toISOString()}&` +
      `period2End=${period2.end.toISOString()}`;

    window.open(url, '_blank');
  };

  const handleExportCSV = async () => {
    if (!period1 || !period2) return;

    const url =
      `/api/metrics/comparison/export/csv?` +
      `period1Start=${period1.start.toISOString()}&` +
      `period1End=${period1.end.toISOString()}&` +
      `period2Start=${period2.start.toISOString()}&` +
      `period2End=${period2.end.toISOString()}`;

    window.open(url, '_blank');
  };

  const getImprovementBadge = () => {
    if (!comparison) return null;

    const { overall, score } = comparison.improvement;
    const variant =
      overall === 'improved'
        ? 'default'
        : overall === 'degraded'
          ? 'destructive'
          : 'outline';

    return (
      <Badge variant={variant} className="text-lg px-4 py-2">
        {overall.toUpperCase()} ({score > 0 ? '+' : ''}
        {score.toFixed(1)})
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            Before/After Performance Comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Period 1 (Before)</h3>
              <TimeRangeSelector
                onRangeChange={setPeriod1}
                defaultPreset="24h"
              />
            </div>
            <div>
              <h3 className="font-semibold mb-2">Period 2 (After)</h3>
              <TimeRangeSelector
                onRangeChange={setPeriod2}
                defaultPreset="24h"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={fetchComparison}
              disabled={loading || !period1 || !period2}
              className="flex-1"
            >
              {loading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                'Compare Periods'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleExportJSON}
              disabled={!comparison}
            >
              <Download className="mr-2 h-4 w-4" />
              JSON
            </Button>
            <Button
              variant="outline"
              onClick={handleExportCSV}
              disabled={!comparison}
            >
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {comparison && (
        <>
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Overall Performance Impact</CardTitle>
                {getImprovementBadge()}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-sm text-gray-500">Latency Score</div>
                  <div
                    className={`text-2xl font-bold ${comparison.improvement.factors.latency > 0 ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {comparison.improvement.factors.latency > 0 ? '+' : ''}
                    {comparison.improvement.factors.latency.toFixed(1)}
                  </div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-sm text-gray-500">Throughput Score</div>
                  <div
                    className={`text-2xl font-bold ${comparison.improvement.factors.throughput > 0 ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {comparison.improvement.factors.throughput > 0 ? '+' : ''}
                    {comparison.improvement.factors.throughput.toFixed(1)}
                  </div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-sm text-gray-500">Error Rate Score</div>
                  <div
                    className={`text-2xl font-bold ${comparison.improvement.factors.errorRate > 0 ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {comparison.improvement.factors.errorRate > 0 ? '+' : ''}
                    {comparison.improvement.factors.errorRate.toFixed(1)}
                  </div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-sm text-gray-500">Reliability Score</div>
                  <div
                    className={`text-2xl font-bold ${comparison.improvement.factors.reliability > 0 ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {comparison.improvement.factors.reliability > 0 ? '+' : ''}
                    {comparison.improvement.factors.reliability.toFixed(1)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pattern State Changes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {comparison.patternChanges.enabled.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold text-green-600 mb-2">
                      Enabled Patterns:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {comparison.patternChanges.enabled.map((pattern) => (
                        <Badge key={pattern} variant="default">
                          {pattern}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {comparison.patternChanges.disabled.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold text-red-600 mb-2">
                      Disabled Patterns:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {comparison.patternChanges.disabled.map((pattern) => (
                        <Badge key={pattern} variant="destructive">
                          {pattern}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {timeSeriesData && (
            <div className="grid grid-cols-1 gap-6">
              <ComparisonChart
                title="Average Latency Comparison"
                data1={timeSeriesData.latency1}
                data2={timeSeriesData.latency2}
                label1={period1?.label || 'Period 1'}
                label2={period2?.label || 'Period 2'}
                yAxisLabel="Latency (ms)"
                color1="#ef4444"
                color2="#22c55e"
              />
              <ComparisonChart
                title="Throughput Comparison"
                data1={timeSeriesData.throughput1}
                data2={timeSeriesData.throughput2}
                label1={period1?.label || 'Period 1'}
                label2={period2?.label || 'Period 2'}
                yAxisLabel="Requests"
                color1="#3b82f6"
                color2="#8b5cf6"
              />
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Detailed Metrics Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-2">Metric</th>
                      <th className="text-right py-2">{comparison.period1.label}</th>
                      <th className="text-right py-2">{comparison.period2.label}</th>
                      <th className="text-right py-2">Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr>
                      <td className="py-2">Avg Latency</td>
                      <td className="text-right">
                        {comparison.period1.metrics.http.avgLatency}ms
                      </td>
                      <td className="text-right">
                        {comparison.period2.metrics.http.avgLatency}ms
                      </td>
                      <td
                        className={`text-right font-semibold ${comparison.deltas.http.avgLatencyPercentChange < 0 ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {comparison.deltas.http.avgLatencyPercentChange > 0
                          ? '+'
                          : ''}
                        {comparison.deltas.http.avgLatencyPercentChange.toFixed(
                          1,
                        )}
                        %
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2">P95 Latency</td>
                      <td className="text-right">
                        {comparison.period1.metrics.http.p95Latency}ms
                      </td>
                      <td className="text-right">
                        {comparison.period2.metrics.http.p95Latency}ms
                      </td>
                      <td
                        className={`text-right font-semibold ${comparison.deltas.http.p95LatencyPercentChange < 0 ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {comparison.deltas.http.p95LatencyPercentChange > 0
                          ? '+'
                          : ''}
                        {comparison.deltas.http.p95LatencyPercentChange.toFixed(
                          1,
                        )}
                        %
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2">Total Requests</td>
                      <td className="text-right">
                        {comparison.period1.metrics.http.totalRequests}
                      </td>
                      <td className="text-right">
                        {comparison.period2.metrics.http.totalRequests}
                      </td>
                      <td
                        className={`text-right font-semibold ${comparison.deltas.http.requestsPercentChange > 0 ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {comparison.deltas.http.requestsPercentChange > 0
                          ? '+'
                          : ''}
                        {comparison.deltas.http.requestsPercentChange.toFixed(
                          1,
                        )}
                        %
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2">Error Rate</td>
                      <td className="text-right">
                        {comparison.period1.metrics.http.errorRate}%
                      </td>
                      <td className="text-right">
                        {comparison.period2.metrics.http.errorRate}%
                      </td>
                      <td
                        className={`text-right font-semibold ${comparison.deltas.http.errorRatePercentChange < 0 ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {comparison.deltas.http.errorRatePercentChange > 0
                          ? '+'
                          : ''}
                        {comparison.deltas.http.errorRatePercentChange.toFixed(
                          1,
                        )}
                        %
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

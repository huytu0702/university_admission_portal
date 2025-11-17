'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface PatternImpact {
  patternName: string;
  enabled: boolean;
  impact: {
    latencyChange: number;
    throughputChange: number;
    errorRateChange: number;
    reliabilityScore: number;
  };
}

interface PatternImpactChartProps {
  data: PatternImpact[];
}

export default function PatternImpactChart({
  data,
}: PatternImpactChartProps) {
  const chartData = data.map((item) => ({
    name: item.patternName.replace('pattern_', '').replace(/_/g, ' '),
    latency: item.impact.latencyChange,
    throughput: item.impact.throughputChange,
    errorRate: item.impact.errorRateChange,
    enabled: item.enabled,
  }));

  const getImpactColor = (value: number, metric: string) => {
    // For latency and error rate, negative is good
    // For throughput, positive is good
    const isGood =
      metric === 'throughput'
        ? value > 0
        : value < 0;

    if (Math.abs(value) < 5) return '#94a3b8'; // neutral
    return isGood ? '#22c55e' : '#ef4444';
  };

  const getImpactIcon = (value: number, metric: string) => {
    const isGood =
      metric === 'throughput'
        ? value > 0
        : value < 0;

    if (Math.abs(value) < 5) {
      return <Minus className="h-4 w-4" />;
    }
    return isGood ? (
      <ArrowUp className="h-4 w-4 text-green-600" />
    ) : (
      <ArrowDown className="h-4 w-4 text-red-600" />
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pattern Impact: Latency Change</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis label={{ value: 'Change (%)', angle: -90, position: 'insideLeft' }} />
              <Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
              <Bar dataKey="latency" name="Latency Change">
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={getImpactColor(entry.latency, 'latency')}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pattern Impact: Throughput Change</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis label={{ value: 'Change (%)', angle: -90, position: 'insideLeft' }} />
              <Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
              <Bar dataKey="throughput" name="Throughput Change">
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={getImpactColor(entry.throughput, 'throughput')}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pattern Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.map((pattern) => (
              <div
                key={pattern.patternName}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {pattern.patternName
                        .replace('pattern_', '')
                        .replace(/_/g, ' ')}
                    </span>
                    <Badge variant={pattern.enabled ? 'default' : 'outline'}>
                      {pattern.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    {getImpactIcon(pattern.impact.latencyChange, 'latency')}
                    <span>Latency: {pattern.impact.latencyChange.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {getImpactIcon(
                      pattern.impact.throughputChange,
                      'throughput',
                    )}
                    <span>
                      Throughput: {pattern.impact.throughputChange.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {getImpactIcon(pattern.impact.errorRateChange, 'errorRate')}
                    <span>
                      Errors: {pattern.impact.errorRateChange.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

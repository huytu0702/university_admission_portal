'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface LatencyBucket {
  range: string;
  count: number;
  percentage: number;
}

interface LatencyHistogramData {
  buckets: LatencyBucket[];
  p50: number;
  p95: number;
  p99: number;
  mean: number;
  total: number;
}

interface LatencyHistogramProps {
  data: LatencyHistogramData;
  title?: string;
  description?: string;
}

export default function LatencyHistogram({
  data,
  title = 'Latency Distribution',
  description = 'Response time histogram with percentile markers',
}: LatencyHistogramProps) {
  const chartData = data.buckets.map((bucket) => ({
    range: bucket.range,
    count: bucket.count,
    percentage: bucket.percentage,
  }));

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { range: string; count: number; percentage: number } }> }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-semibold">{payload[0].payload.range}</p>
          <p className="text-sm text-gray-600">
            Count: <span className="font-medium">{payload[0].payload.count}</span>
          </p>
          <p className="text-sm text-gray-600">
            Percentage: <span className="font-medium">{payload[0].payload.percentage.toFixed(2)}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Percentile Summary */}
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-sm text-gray-600">Mean</div>
              <div className="text-xl font-bold text-blue-600">{data.mean.toFixed(0)}ms</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-sm text-gray-600">P50 (Median)</div>
              <div className="text-xl font-bold text-green-600">{data.p50.toFixed(0)}ms</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-sm text-gray-600">P95</div>
              <div className="text-xl font-bold text-yellow-600">{data.p95.toFixed(0)}ms</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-sm text-gray-600">P99</div>
              <div className="text-xl font-bold text-red-600">{data.p99.toFixed(0)}ms</div>
            </div>
          </div>

          {/* Histogram Chart */}
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="range" 
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                label={{ value: 'Request Count', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar 
                dataKey="count" 
                fill="#3b82f6" 
                name="Requests"
                radius={[4, 4, 0, 0]}
              />
              <ReferenceLine 
                y={data.total * 0.5} 
                stroke="#22c55e" 
                strokeDasharray="5 5"
                label="P50"
              />
              <ReferenceLine 
                y={data.total * 0.95} 
                stroke="#eab308" 
                strokeDasharray="5 5"
                label="P95"
              />
            </BarChart>
          </ResponsiveContainer>

          {/* Statistics */}
          <div className="pt-2 border-t">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Total Requests</span>
              <span className="font-semibold">{data.total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600 mt-1">
              <span>Requests &lt; 100ms</span>
              <span className="font-semibold text-green-600">
                {data.buckets
                  .filter(b => parseInt(b.range.split('-')[0]) < 100)
                  .reduce((sum, b) => sum + b.count, 0)
                  .toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm text-gray-600 mt-1">
              <span>Requests &gt; 500ms</span>
              <span className="font-semibold text-red-600">
                {data.buckets
                  .filter(b => parseInt(b.range.split('-')[0]) >= 500)
                  .reduce((sum, b) => sum + b.count, 0)
                  .toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

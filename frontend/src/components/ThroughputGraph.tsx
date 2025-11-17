'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from 'recharts';
import { TrendingUp } from 'lucide-react';

interface ThroughputDataPoint {
  timestamp: Date;
  value: number;
  endpoint?: string;
}

interface ThroughputGraphProps {
  data: ThroughputDataPoint[];
  title?: string;
  description?: string;
}

export default function ThroughputGraph({
  data,
  title = 'Throughput',
  description = 'Requests per minute over time',
}: ThroughputGraphProps) {
  const chartData = data.map((point) => ({
    timestamp: new Date(point.timestamp).getTime(),
    throughput: point.value,
  }));

  // Calculate statistics
  const currentThroughput = data.length > 0 ? data[data.length - 1].value : 0;
  const avgThroughput = data.reduce((sum, d) => sum + d.value, 0) / (data.length || 1);
  const maxThroughput = Math.max(...data.map(d => d.value));
  const minThroughput = Math.min(...data.map(d => d.value));

  const formatXAxis = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{
      value: number;
      color: string;
      name: string;
    }>;
    label?: number;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-semibold text-sm mb-2">
            {label && formatXAxis(label)}
          </p>
          <p className="text-sm">
            Throughput: <span className="font-bold text-blue-600">{payload[0].value.toFixed(0)} req/min</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Summary Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-sm text-gray-600">Current</div>
              <div className="text-2xl font-bold text-blue-600">
                {currentThroughput.toFixed(0)}
              </div>
              <div className="text-xs text-gray-500">req/min</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-sm text-gray-600">Average</div>
              <div className="text-2xl font-bold text-green-600">
                {avgThroughput.toFixed(0)}
              </div>
              <div className="text-xs text-gray-500">req/min</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-sm text-gray-600">Peak</div>
              <div className="text-2xl font-bold text-orange-600">
                {maxThroughput.toFixed(0)}
              </div>
              <div className="text-xs text-gray-500">req/min</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">Minimum</div>
              <div className="text-2xl font-bold text-gray-600">
                {minThroughput.toFixed(0)}
              </div>
              <div className="text-xs text-gray-500">req/min</div>
            </div>
          </div>

          {/* Throughput Chart */}
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData}>
              <defs>
                <linearGradient id="throughputGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatXAxis}
                type="number"
                domain={['dataMin', 'dataMax']}
                scale="time"
              />
              <YAxis 
                label={{ value: 'Requests per Minute', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="throughput"
                fill="url(#throughputGradient)"
                stroke="none"
              />
              <Line
                type="monotone"
                dataKey="throughput"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name="Throughput"
              />
            </ComposedChart>
          </ResponsiveContainer>

          {/* Additional Info */}
          <div className="pt-2 border-t text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Variation:</span>
              <span className="font-semibold">
                {((maxThroughput - minThroughput) / avgThroughput * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

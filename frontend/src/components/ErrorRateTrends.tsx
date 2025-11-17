'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';
import { format } from 'date-fns';
import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';

interface ErrorRateDataPoint {
  timestamp: Date;
  errorRate: number;
  totalErrors: number;
  totalRequests: number;
}

interface ErrorRateTrendsProps {
  data: ErrorRateDataPoint[];
  title?: string;
  description?: string;
  warningThreshold?: number;
  criticalThreshold?: number;
}

export default function ErrorRateTrends({
  data,
  title = 'Error Rate Trends',
  description = 'Error rate over time with threshold indicators',
  warningThreshold = 5, // 5% warning
  criticalThreshold = 10, // 10% critical
}: ErrorRateTrendsProps) {
  const chartData = data.map((point) => ({
    timestamp: new Date(point.timestamp).getTime(),
    errorRate: point.errorRate,
    totalErrors: point.totalErrors,
    totalRequests: point.totalRequests,
  }));

  // Calculate statistics
  const currentErrorRate = data.length > 0 ? data[data.length - 1].errorRate : 0;
  const avgErrorRate = data.reduce((sum, d) => sum + d.errorRate, 0) / (data.length || 1);
  const maxErrorRate = Math.max(...data.map(d => d.errorRate));
  const totalErrors = data.reduce((sum, d) => sum + d.totalErrors, 0);

  // Determine status
  const getStatus = (rate: number) => {
    if (rate >= criticalThreshold) return { label: 'Critical', color: 'destructive', icon: AlertTriangle };
    if (rate >= warningThreshold) return { label: 'Warning', color: 'secondary', icon: AlertTriangle };
    return { label: 'Healthy', color: 'default', icon: TrendingDown };
  };

  const status = getStatus(currentErrorRate);
  const StatusIcon = status.icon;

  // Calculate trend (comparing last 10% of data to first 10%)
  const segmentSize = Math.max(1, Math.floor(data.length * 0.1));
  const recentAvg = data.slice(-segmentSize).reduce((sum, d) => sum + d.errorRate, 0) / segmentSize;
  const pastAvg = data.slice(0, segmentSize).reduce((sum, d) => sum + d.errorRate, 0) / segmentSize;
  const trend = recentAvg - pastAvg;
  const isTrendingUp = trend > 0.5;
  const isTrendingDown = trend < -0.5;

  const formatXAxis = (timestamp: number) => {
    return format(new Date(timestamp), 'HH:mm');
  };

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { timestamp: number; errorRate: number; totalErrors: number; totalRequests: number } }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-semibold text-sm mb-2">
            {format(new Date(data.timestamp), 'PPpp')}
          </p>
          <div className="space-y-1">
            <p className="text-sm">
              Error Rate: <span className="font-bold text-red-600">{data.errorRate.toFixed(2)}%</span>
            </p>
            <p className="text-sm text-gray-600">
              Errors: {data.totalErrors}
            </p>
            <p className="text-sm text-gray-600">
              Requests: {data.totalRequests}
            </p>
          </div>
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
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Badge variant={status.color as 'default' | 'destructive' | 'secondary'} className="flex items-center gap-1">
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Summary Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">Current Rate</div>
              <div className={`text-2xl font-bold ${currentErrorRate >= criticalThreshold ? 'text-red-600' : currentErrorRate >= warningThreshold ? 'text-yellow-600' : 'text-green-600'}`}>
                {currentErrorRate.toFixed(2)}%
              </div>
              <div className="flex items-center justify-center mt-1">
                {isTrendingUp && (
                  <div className="flex items-center text-xs text-red-600">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +{Math.abs(trend).toFixed(2)}%
                  </div>
                )}
                {isTrendingDown && (
                  <div className="flex items-center text-xs text-green-600">
                    <TrendingDown className="h-3 w-3 mr-1" />
                    -{Math.abs(trend).toFixed(2)}%
                  </div>
                )}
                {!isTrendingUp && !isTrendingDown && (
                  <div className="text-xs text-gray-500">Stable</div>
                )}
              </div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-sm text-gray-600">Average</div>
              <div className="text-2xl font-bold text-blue-600">
                {avgErrorRate.toFixed(2)}%
              </div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-sm text-gray-600">Peak</div>
              <div className="text-2xl font-bold text-orange-600">
                {maxErrorRate.toFixed(2)}%
              </div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-sm text-gray-600">Total Errors</div>
              <div className="text-2xl font-bold text-red-600">
                {totalErrors.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Trend Chart */}
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData}>
              <defs>
                <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
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
                label={{ value: 'Error Rate (%)', angle: -90, position: 'insideLeft' }}
                domain={[0, 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              
              {/* Warning threshold */}
              <ReferenceLine
                y={warningThreshold}
                stroke="#eab308"
                strokeDasharray="5 5"
                label={`Warning (${warningThreshold}%)`}
              />
              
              {/* Critical threshold */}
              <ReferenceLine
                y={criticalThreshold}
                stroke="#ef4444"
                strokeDasharray="5 5"
                label={`Critical (${criticalThreshold}%)`}
              />
              
              <Area
                type="monotone"
                dataKey="errorRate"
                fill="url(#errorGradient)"
                stroke="none"
              />
              <Line
                type="monotone"
                dataKey="errorRate"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                name="Error Rate"
              />
            </ComposedChart>
          </ResponsiveContainer>

          {/* Threshold Legend */}
          <div className="flex flex-wrap gap-4 text-xs text-gray-600 pt-2 border-t">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Healthy (&lt; {warningThreshold}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span>Warning ({warningThreshold}% - {criticalThreshold}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span>Critical (&gt; {criticalThreshold}%)</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

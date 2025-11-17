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
  ComposedChart,
} from 'recharts';
import { Activity, AlertCircle } from 'lucide-react';

interface QueueDepthDataPoint {
  timestamp: Date;
  depth: number;
  queueName: string;
}

interface QueueStats {
  queueName: string;
  currentDepth: number;
  avgDepth: number;
  maxDepth: number;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

interface QueueDepthMonitorProps {
  data: QueueDepthDataPoint[];
  queueStats: QueueStats[];
  title?: string;
  description?: string;
  warningThreshold?: number;
  criticalThreshold?: number;
}

export default function QueueDepthMonitor({
  data,
  queueStats,
  title = 'Queue Depth Monitoring',
  description = 'Real-time queue depth across all worker pools',
  warningThreshold = 100,
  criticalThreshold = 500,
}: QueueDepthMonitorProps) {
  // Group data by queue
  const queueGroups = data.reduce((acc, point) => {
    if (!acc[point.queueName]) {
      acc[point.queueName] = [];
    }
    acc[point.queueName].push({
      timestamp: new Date(point.timestamp).getTime(),
      depth: point.depth,
    });
    return acc;
  }, {} as Record<string, Array<{ timestamp: number; depth: number }>>);

  // Get unique queue names
  const queueNames = Object.keys(queueGroups);

  // Colors for different queues
  const queueColors: Record<string, string> = {
    verify_document: '#3b82f6',
    create_payment: '#10b981',
    send_email: '#f59e0b',
  };

  // Prepare chart data with all queues
  const chartDataMap = new Map<number, Record<string, number | string>>();
  
  Object.entries(queueGroups).forEach(([queueName, points]) => {
    points.forEach(point => {
      if (!chartDataMap.has(point.timestamp)) {
        chartDataMap.set(point.timestamp, { timestamp: point.timestamp });
      }
      chartDataMap.get(point.timestamp)![queueName] = point.depth;
    });
  });

  const chartData = Array.from(chartDataMap.values()).sort((a, b) => 
    (a.timestamp as number) - (b.timestamp as number)
  );

  const formatXAxis = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const getHealthStatus = (depth: number) => {
    if (depth >= criticalThreshold) return { label: 'Critical', variant: 'destructive' as const };
    if (depth >= warningThreshold) return { label: 'Warning', variant: 'secondary' as const };
    return { label: 'Healthy', variant: 'default' as const };
  };

  const CustomTooltip = ({ active, payload, label }: { 
    active?: boolean; 
    payload?: Array<{ 
      dataKey: string; 
      value: number; 
      color: string; 
      name: string 
    }>; 
    label?: number 
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-semibold text-sm mb-2">
            {label && formatXAxis(label)}
          </p>
          <div className="space-y-1">
            {payload.map((entry, index) => (
              <div key={index} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: entry.color }}
                  ></div>
                  <span className="text-sm">{entry.name}:</span>
                </div>
                <span className="font-semibold text-sm">{entry.value}</span>
              </div>
            ))}
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
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Queue Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {queueStats.map((stats) => {
              const status = getHealthStatus(stats.currentDepth);
              return (
                <div key={stats.queueName} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: queueColors[stats.queueName] || '#6b7280' }}
                      ></div>
                      <h4 className="font-semibold text-sm">
                        {stats.queueName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </h4>
                    </div>
                    <Badge variant={status.variant} className="text-xs">
                      {status.label}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Current Depth:</span>
                      <span className="font-bold">{stats.currentDepth}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Waiting:</span>
                      <span className="font-medium text-yellow-600">{stats.waiting}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Active:</span>
                      <span className="font-medium text-blue-600">{stats.active}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Completed:</span>
                      <span className="font-medium text-green-600">{stats.completed}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Failed:</span>
                      <span className="font-medium text-red-600">{stats.failed}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t text-xs text-gray-500">
                    <div className="flex justify-between">
                      <span>Avg: {stats.avgDepth.toFixed(0)}</span>
                      <span>Max: {stats.maxDepth}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Depth Trend Chart */}
          <div>
            <h4 className="font-semibold mb-3">Queue Depth Trends</h4>
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={chartData}>
                <defs>
                  {queueNames.map((queueName) => (
                    <linearGradient key={queueName} id={`gradient_${queueName}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={queueColors[queueName] || '#6b7280'} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={queueColors[queueName] || '#6b7280'} stopOpacity={0}/>
                    </linearGradient>
                  ))}
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
                  label={{ value: 'Queue Depth', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                
                {queueNames.map((queueName) => (
                  <Line
                    key={queueName}
                    type="monotone"
                    dataKey={queueName}
                    stroke={queueColors[queueName] || '#6b7280'}
                    strokeWidth={2}
                    dot={false}
                    name={queueName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Threshold Indicators */}
          <div className="flex items-center gap-4 text-xs text-gray-600 pt-2 border-t">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-green-500" />
              <span>Healthy: &lt; {warningThreshold}</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <span>Warning: {warningThreshold} - {criticalThreshold}</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span>Critical: &gt; {criticalThreshold}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

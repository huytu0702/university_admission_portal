'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface MetricsComparison {
  id: string;
  name: string;
  description: string;
  beforeValue: number;
  afterValue: number;
  unit: string;
  status: 'improved' | 'degraded' | 'neutral';
}

export default function MetricsComparisonDashboard() {
  const [metrics, setMetrics] = useState<MetricsComparison[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulated data - in a real implementation, this would come from an API
    const mockMetrics: MetricsComparison[] = [
      {
        id: 'latency-p95',
        name: 'P95 Latency',
        description: '95th percentile response time',
        beforeValue: 1250,
        afterValue: 150,
        unit: 'ms',
        status: 'improved'
      },
      {
        id: 'throughput',
        name: 'Throughput',
        description: 'Requests per second',
        beforeValue: 50,
        afterValue: 200,
        unit: 'RPS',
        status: 'improved'
      },
      {
        id: 'error-rate',
        name: 'Error Rate',
        description: 'Percentage of failed requests',
        beforeValue: 8.5,
        afterValue: 1.2,
        unit: '%',
        status: 'improved'
      },
      {
        id: 'queue-depth',
        name: 'Queue Depth',
        description: 'Average items waiting in queue',
        beforeValue: 1500,
        afterValue: 25,
        unit: 'items',
        status: 'improved'
      },
      {
        id: 'cache-hit',
        name: 'Cache Hit Rate',
        description: 'Percentage of cache hits',
        beforeValue: 10,
        afterValue: 95,
        unit: '%',
        status: 'improved'
      }
    ];

    setTimeout(() => {
      setMetrics(mockMetrics);
      setLoading(false);
    }, 500);
  }, []);

  const calculateChange = (before: number, after: number) => {
    if (before === 0) return after > 0 ? '+∞%' : '0%';
    const change = ((after - before) / before) * 100;
    return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-gray-600">Loading metrics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold">Performance Impact Dashboard</h2>
        <p className="text-gray-600 mt-2">
          Before vs After metrics comparison when design patterns are enabled
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {metrics.map((metric) => {
          const change = calculateChange(metric.beforeValue, metric.afterValue);
          const isImprovement = 
            (metric.id.includes('error') || metric.id.includes('latency') || metric.id.includes('queue')) 
              ? metric.afterValue < metric.beforeValue 
              : metric.afterValue > metric.beforeValue;
          
          return (
            <Card key={metric.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{metric.name}</CardTitle>
                  <Badge 
                    variant={isImprovement ? "default" : "destructive"} 
                    className="h-6"
                  >
                    {isImprovement ? "Improved" : "Degraded"}
                  </Badge>
                </div>
                <CardDescription>{metric.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Before</p>
                      <p className="text-xl font-semibold">{metric.beforeValue}{metric.unit}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-500">After</p>
                      <p className="text-xl font-semibold">{metric.afterValue}{metric.unit}</p>
                    </div>
                  </div>
                  
                  <div className="pt-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Change</span>
                      <span className={isImprovement ? "text-green-600" : "text-red-600"}>
                        {change}
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(100, Math.abs((metric.afterValue - metric.beforeValue) / metric.beforeValue * 100) || 0)} 
                      className="h-2"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Performance Score</CardTitle>
          <CardDescription>Overall improvement rating with design patterns enabled</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <span>System Performance</span>
            <span className="font-semibold text-green-600">+78% improvement</span>
          </div>
          <Progress value={78} className="h-3" />
          <p className="text-sm text-gray-500 mt-2">
            Calculated based on latency, throughput, and error rate improvements
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
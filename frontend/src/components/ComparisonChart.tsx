'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';

interface TimeSeriesDataPoint {
  timestamp: Date;
  value: number;
}

interface ComparisonChartProps {
  title: string;
  data1: TimeSeriesDataPoint[];
  data2: TimeSeriesDataPoint[];
  label1?: string;
  label2?: string;
  yAxisLabel?: string;
  color1?: string;
  color2?: string;
}

export default function ComparisonChart({
  title,
  data1,
  data2,
  label1 = 'Before',
  label2 = 'After',
  yAxisLabel = 'Value',
  color1 = '#ef4444',
  color2 = '#22c55e',
}: ComparisonChartProps) {
  // Combine data for chart
  const combinedData = [
    ...data1.map((d) => ({
      timestamp: new Date(d.timestamp).getTime(),
      [label1]: d.value,
      period: label1,
    })),
    ...data2.map((d) => ({
      timestamp: new Date(d.timestamp).getTime(),
      [label2]: d.value,
      period: label2,
    })),
  ].sort((a, b) => a.timestamp - b.timestamp);

  // Group by timestamp
  const groupedData: Record<
    number,
    { timestamp: number; [key: string]: number | string }
  > = {};

  combinedData.forEach((item) => {
    if (!groupedData[item.timestamp]) {
      groupedData[item.timestamp] = { timestamp: item.timestamp };
    }
    if (item.period === label1 && label1 in item) {
      groupedData[item.timestamp][label1] = item[label1] as number;
    }
    if (item.period === label2 && label2 in item) {
      groupedData[item.timestamp][label2] = item[label2] as number;
    }
  });

  const chartData = Object.values(groupedData);

  const formatXAxis = (timestamp: number) => {
    return format(new Date(timestamp), 'HH:mm');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatXAxis}
              type="number"
              domain={['dataMin', 'dataMax']}
              scale="time"
            />
            <YAxis label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }} />
            <Tooltip
              labelFormatter={(value) =>
                format(new Date(Number(value)), 'PPpp')
              }
              formatter={(value) => [
                Number(value).toFixed(2),
                yAxisLabel,
              ]}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey={label1}
              stroke={color1}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey={label2}
              stroke={color2}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

export type TimeRangePreset = '1h' | '6h' | '24h' | '7d' | 'custom';

export interface TimeRange {
  start: Date;
  end: Date;
  label: string;
}

interface TimeRangeSelectorProps {
  onRangeChange: (range: TimeRange) => void;
  defaultPreset?: TimeRangePreset;
}

export default function TimeRangeSelector({
  onRangeChange,
  defaultPreset = '24h',
}: TimeRangeSelectorProps) {
  const [selectedPreset, setSelectedPreset] =
    useState<TimeRangePreset>(defaultPreset);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const presets: { value: TimeRangePreset; label: string; duration: number }[] =
    [
      { value: '1h', label: 'Last 1 Hour', duration: 60 * 60 * 1000 },
      { value: '6h', label: 'Last 6 Hours', duration: 6 * 60 * 60 * 1000 },
      { value: '24h', label: 'Last 24 Hours', duration: 24 * 60 * 60 * 1000 },
      { value: '7d', label: 'Last 7 Days', duration: 7 * 24 * 60 * 60 * 1000 },
      { value: 'custom', label: 'Custom Range', duration: 0 },
    ];

  const handlePresetClick = (preset: TimeRangePreset, duration: number) => {
    setSelectedPreset(preset);

    if (preset !== 'custom') {
      const end = new Date();
      const start = new Date(end.getTime() - duration);

      onRangeChange({
        start,
        end,
        label: presets.find((p) => p.value === preset)?.label || '',
      });
    }
  };

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      const start = new Date(customStart);
      const end = new Date(customEnd);

      if (start < end) {
        onRangeChange({
          start,
          end,
          label: 'Custom Range',
        });
      } else {
        alert('Start date must be before end date');
      }
    } else {
      alert('Please select both start and end dates');
    }
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-semibold mb-2 block">
            Time Range
          </Label>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <Button
                key={preset.value}
                size="sm"
                variant={
                  selectedPreset === preset.value ? 'default' : 'outline'
                }
                onClick={() =>
                  handlePresetClick(preset.value, preset.duration)
                }
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>

        {selectedPreset === 'custom' && (
          <div className="space-y-3 pt-2 border-t">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="custom-start" className="text-sm">
                  Start Date & Time
                </Label>
                <input
                  id="custom-start"
                  type="datetime-local"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <Label htmlFor="custom-end" className="text-sm">
                  End Date & Time
                </Label>
                <input
                  id="custom-end"
                  type="datetime-local"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <Button onClick={handleCustomApply} size="sm" className="w-full">
              Apply Custom Range
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

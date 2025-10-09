'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import MetricsComparisonDashboard from '@/components/MetricsComparisonDashboard';

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  updatedAt: Date;
}

export default function AdminPage() {
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'flags' | 'metrics'>('flags');

  useEffect(() => {
    if (activeTab === 'flags') {
      fetchFeatureFlags();
    }
  }, [activeTab]);

  const fetchFeatureFlags = async () => {
    try {
      const response = await fetch('/api/admin/flags');

      if (!response.ok) {
        throw new Error('Failed to fetch feature flags');
      }

      const data = await response.json();
      // Convert updatedAt strings to Date objects
      const flagsWithDates = data.map((flag: any) => ({
        ...flag,
        updatedAt: new Date(flag.updatedAt)
      }));
      setFeatureFlags(flagsWithDates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const toggleFeatureFlag = async (flagId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/admin/flags/${flagId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: !enabled }),
      });

      if (!response.ok) {
        throw new Error('Failed to update feature flag');
      }

      // Update local state
      setFeatureFlags(prev => 
        prev.map(flag => 
          flag.id === flagId ? { ...flag, enabled: !enabled } : flag
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-500">{error}</p>
            <Button onClick={fetchFeatureFlags} className="mt-4">Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <div className="text-gray-700">
          No authentication required
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b mb-6">
        <Button
          variant={activeTab === 'flags' ? 'default' : 'ghost'}
          className="mr-2"
          onClick={() => setActiveTab('flags')}
        >
          Feature Flags
        </Button>
        <Button
          variant={activeTab === 'metrics' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('metrics')}
        >
          Performance Metrics
        </Button>
      </div>

      {activeTab === 'flags' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featureFlags.map((flag) => (
            <Card key={flag.id} className="w-full">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{flag.name}</CardTitle>
                  <Badge variant={flag.enabled ? "default" : "secondary"}>
                    {flag.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <CardDescription>
                  {flag.description}
                </CardDescription>
                <CardDescription className="text-xs mt-1">
                  Updated: {flag.updatedAt.toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Toggle Status</span>
                  <Switch
                    checked={flag.enabled}
                    onCheckedChange={(checked) => toggleFeatureFlag(flag.id, flag.enabled)}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <MetricsComparisonDashboard />
      )}

      {activeTab === 'flags' && featureFlags.length === 0 && !loading && (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900">No feature flags found</h3>
          <p className="text-gray-500 mt-1">Feature flags will appear here once they are defined in the system.</p>
        </div>
      )}
    </div>
  );
}
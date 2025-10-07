'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getAllApplications } from '@/lib/api';

export default function MyApplicationsPage() {
    const router = useRouter();
    const [applications, setApplications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchApplications();
    }, []);

    const fetchApplications = async () => {
        try {
            setLoading(true);
            setError('');

            // Check if user is logged in
            const token = localStorage.getItem('token');
            if (!token) {
                router.push('/login');
                return;
            }

            const response = await getAllApplications();

            if (response.ok) {
                const data = await response.json();
                setApplications(data);
            } else if (response.status === 401) {
                setError('Please login to view your applications');
                router.push('/login');
            } else {
                setError('Failed to fetch applications');
            }
        } catch (error) {
            console.error('Error fetching applications:', error);
            setError('An error occurred while loading your applications');
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'paid':
            case 'completed':
                return 'bg-green-100 text-green-800';
            case 'verified':
                return 'bg-blue-100 text-blue-800';
            case 'processing_payment':
                return 'bg-yellow-100 text-yellow-800';
            case 'submitted':
                return 'bg-gray-100 text-gray-800';
            case 'rejected':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusText = (status: string) => {
        return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="text-lg">Loading your applications...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Error</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-red-600">{error}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">My Applications</h1>
                        <p className="mt-2 text-gray-600">View and track all your applications</p>
                    </div>
                    <Button onClick={() => router.push('/apply')}>
                        New Application
                    </Button>
                </div>

                {applications.length === 0 ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>No Applications Found</CardTitle>
                            <CardDescription>You haven't submitted any applications yet.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button onClick={() => router.push('/apply')}>
                                Submit Your First Application
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-6">
                        {applications.map((application) => (
                            <Card key={application.id} className="hover:shadow-lg transition-shadow">
                                <CardContent className="p-6">
                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                                        <div className="flex-1 mb-4 md:mb-0">
                                            <div className="flex items-center space-x-3 mb-2">
                                                <h3 className="text-lg font-semibold text-gray-900">
                                                    Application #{application.id.slice(0, 8)}...
                                                </h3>
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(application.status)}`}>
                                                    {getStatusText(application.status)}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                                <div>
                                                    <p className="text-sm text-gray-500">Submitted</p>
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {new Date(application.createdAt).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-500">Last Updated</p>
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {new Date(application.updatedAt).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-500">Documents</p>
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {application.applicationFiles?.length || 0} file(s)
                                                    </p>
                                                </div>
                                            </div>

                                            {application.personalStatement && (
                                                <div className="mt-4">
                                                    <p className="text-sm text-gray-500">Personal Statement Preview</p>
                                                    <p className="text-sm text-gray-700 line-clamp-2 break-words">
                                                        {application.personalStatement}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col space-y-2 md:ml-6">
                                            <Button
                                                variant="outline"
                                                onClick={() => router.push(`/status/${application.id}`)}
                                            >
                                                View Details
                                            </Button>
                                            {application.status === 'processing_payment' && (
                                                <Button
                                                    onClick={() => router.push(`/payment/${application.id}`)}
                                                >
                                                    Complete Payment
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}


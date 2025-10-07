'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getApplication, getApplicationProgress, fetchDocumentUrl } from '@/lib/api';

export default function StatusPage() {
    const params = useParams();
    const id = params.id as string;
    const [application, setApplication] = useState<any>(null);
    const [progress, setProgress] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedDocument, setSelectedDocument] = useState<{ file: any; url: string } | null>(null);
    const [documentLoading, setDocumentLoading] = useState(false);

    useEffect(() => {
        if (id) {
            fetchApplicationStatus();
        }
    }, [id]);

    const fetchApplicationStatus = async () => {
        try {
            setLoading(true);
            setError('');

            // Fetch application details
            const response = await getApplication(id);

            if (response.ok) {
                const appData = await response.json();
                setApplication(appData);

                // Fetch progress details
                const progressResponse = await getApplicationProgress(id);

                if (progressResponse.ok) {
                    const progressData = await progressResponse.json();
                    setProgress(progressData.progress || 0);
                }
            } else if (response.status === 401) {
                setError('Please login to view your application status');
            } else {
                setError('Failed to fetch application status');
            }
        } catch (error) {
            console.error('Error fetching application status:', error);
            setError('An error occurred while loading your application');
        } finally {
            setLoading(false);
        }
    };

    const handleDocumentClick = async (file: any) => {
        setDocumentLoading(true);
        const url = await fetchDocumentUrl(id, file.id);
        if (url) {
            setSelectedDocument({ file, url });
        }
        setDocumentLoading(false);
    };

    const closeModal = () => {
        if (selectedDocument?.url) {
            // Revoke the blob URL to free up memory
            URL.revokeObjectURL(selectedDocument.url);
        }
        setSelectedDocument(null);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="text-lg">Loading application status...</div>
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

    if (!application) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Application Not Found</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-gray-600">The application you are looking for does not exist.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 py-12">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Application Status</CardTitle>
                        <CardDescription>Track your application progress</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-8">
                            <div className="flex justify-between mb-2">
                                <span className="text-sm font-medium">Overall Progress</span>
                                <span className="text-sm font-medium">{progress}%</span>
                            </div>
                            <Progress value={progress} className="w-full" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h3 className="font-medium text-gray-900">Application ID</h3>
                                <p className="text-gray-600 text-sm break-all">{application.id}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h3 className="font-medium text-gray-900">Status</h3>
                                <p className="text-gray-600 capitalize">{application.status}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h3 className="font-medium text-gray-900">Submitted</h3>
                                <p className="text-gray-600">
                                    {new Date(application.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h3 className="font-medium text-gray-900">Last Updated</h3>
                                <p className="text-gray-600">
                                    {new Date(application.updatedAt).toLocaleDateString()}
                                </p>
                            </div>
                        </div>

                        <div className="mb-8">
                            <h3 className="text-lg font-medium mb-4">Application Steps</h3>
                            <div className="space-y-4">
                                <div className="flex items-center">
                                    <div className={`h-6 w-6 rounded-full flex items-center justify-center mr-3 ${application.status !== 'submitted' ? 'bg-green-500 text-white' : 'bg-gray-300'
                                        }`}>
                                        {application.status !== 'submitted' ? '✓' : '1'}
                                    </div>
                                    <div>
                                        <p className={`font-medium ${application.status !== 'submitted' ? 'text-green-600' : 'text-gray-600'
                                            }`}>
                                            Application Submitted
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            {application.status !== 'submitted'
                                                ? `Completed on ${new Date(application.createdAt).toLocaleDateString()}`
                                                : 'Pending'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center">
                                    <div className={`h-6 w-6 rounded-full flex items-center justify-center mr-3 ${application.applicationFiles?.some((file: any) => file.verified)
                                        ? 'bg-green-500 text-white'
                                        : 'bg-gray-300'
                                        }`}>
                                        {application.applicationFiles?.some((file: any) => file.verified) ? '✓' : '2'}
                                    </div>
                                    <div>
                                        <p className={`font-medium ${application.applicationFiles?.some((file: any) => file.verified)
                                            ? 'text-green-600'
                                            : 'text-gray-600'
                                            }`}>
                                            Document Verification
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            {application.applicationFiles?.some((file: any) => file.verified)
                                                ? 'Completed'
                                                : 'Pending'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center">
                                    <div className={`h-6 w-6 rounded-full flex items-center justify-center mr-3 ${application.payment?.status === 'succeeded'
                                        ? 'bg-green-500 text-white'
                                        : 'bg-gray-300'
                                        }`}>
                                        {application.payment?.status === 'succeeded' ? '✓' : '3'}
                                    </div>
                                    <div>
                                        <p className={`font-medium ${application.payment?.status === 'succeeded'
                                            ? 'text-green-600'
                                            : 'text-gray-600'
                                            }`}>
                                            Payment Processing
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            {application.payment?.status === 'succeeded'
                                                ? `Completed on ${new Date(application.payment.updatedAt).toLocaleDateString()}`
                                                : 'Pending'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Personal Statement Section */}
                        {application.personalStatement && (
                            <div className="mb-8">
                                <h3 className="text-lg font-medium mb-4">Personal Statement</h3>
                                <div className="bg-gray-50 p-6 rounded-lg">
                                    <p className="text-gray-700 whitespace-pre-wrap break-words overflow-wrap-anywhere">
                                        {application.personalStatement}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Uploaded Documents Section */}
                        {application.applicationFiles && application.applicationFiles.length > 0 && (
                            <div className="mb-8">
                                <h3 className="text-lg font-medium mb-4">Uploaded Documents</h3>
                                <div className="space-y-3">
                                    {application.applicationFiles.map((file: any, index: number) => (
                                        <div 
                                            key={file.id || index} 
                                            className="bg-gray-50 p-4 rounded-lg flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
                                            onClick={() => handleDocumentClick(file)}
                                        >
                                            <div className="flex items-center space-x-3">
                                                <div className="bg-blue-100 p-2 rounded">
                                                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900">{file.fileName}</p>
                                                    <p className="text-sm text-gray-500">
                                                        {(file.fileSize / 1024).toFixed(2)} KB • {file.fileType}
                                                    </p>
                                                </div>
                                            </div>
                                            <div>
                                                {file.verified ? (
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                                                        ✓ Verified
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                                                        Pending
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Payment Information */}
                        {application.payment && (
                            <div className="mb-8">
                                <h3 className="text-lg font-medium mb-4">Payment Information</h3>
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm text-gray-500">Amount</p>
                                            <p className="font-medium text-gray-900">
                                                ${(application.payment.amount / 100).toFixed(2)} {application.payment.currency?.toUpperCase()}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Status</p>
                                            <p className="font-medium capitalize text-gray-900">
                                                {application.payment.status}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Payment Provider</p>
                                            <p className="font-medium capitalize text-gray-900">
                                                {application.payment.provider || 'N/A'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Payment Date</p>
                                            <p className="font-medium text-gray-900">
                                                {new Date(application.payment.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h4 className="font-medium text-blue-800 mb-2">Next Steps</h4>
                            <p className="text-blue-700">
                                {application.status === 'submitted' || application.status === 'verified'
                                    ? 'Wait for document verification and payment processing. You will receive updates via email.'
                                    : application.status === 'processing_payment'
                                        ? 'Complete your payment to finalize your application.'
                                        : application.status === 'paid'
                                            ? 'Your application is under review. You will receive updates via email.'
                                            : 'Your application status has been updated. Please check back for more information.'}
                            </p>
                        </div>

                        {/* Document Preview Modal */}
                        <Dialog open={!!selectedDocument} onOpenChange={closeModal}>
                            <DialogContent className="max-w-4xl max-h-[90vh] w-full">
                                <DialogHeader>
                                    <DialogTitle>{selectedDocument?.file.fileName}</DialogTitle>
                                </DialogHeader>
                                <div className="max-h-[70vh] overflow-auto">
                                    {documentLoading ? (
                                        <div className="flex items-center justify-center h-[60vh]">
                                            <div className="text-center">
                                                <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                                                <p className="text-gray-600">Loading document...</p>
                                            </div>
                                        </div>
                                    ) : selectedDocument ? (
                                        <>
                                            {selectedDocument.file.fileType.startsWith('image/') ? (
                                                <img 
                                                    src={selectedDocument.url} 
                                                    alt={selectedDocument.file.fileName} 
                                                    className="max-w-full max-h-[60vh] object-contain mx-auto"
                                                />
                                            ) : selectedDocument.file.fileType === 'application/pdf' ? (
                                                <iframe 
                                                    src={selectedDocument.url} 
                                                    className="w-full h-[60vh] border-0"
                                                    title={selectedDocument.file.fileName}
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center p-8 text-center">
                                                    <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    <p className="text-lg font-medium text-gray-900 mb-2">Document Preview Not Available</p>
                                                    <p className="text-gray-600">The document format ({selectedDocument.file.fileType}) cannot be previewed in the browser.</p>
                                                    <a 
                                                        href={selectedDocument.url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                                    >
                                                        Download Document
                                                    </a>
                                                </div>
                                            )}
                                        </>
                                    ) : null}
                                </div>
                            </DialogContent>
                        </Dialog>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}


'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { createPaymentIntent, confirmPayment } from '@/lib/api';

export default function PaymentPage() {
  const params = useParams();
  const id = params.id as string; // This is the application ID
  const router = useRouter();
  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchPaymentInfo();
    }
  }, [id]);

  const fetchPaymentInfo = async () => {
    try {
      setLoading(true);

      // Get the auth token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please login to continue');
        router.push('/login');
        return;
      }

      // Use the application ID from URL params
      setPaymentInfo({
        applicationId: id, // Use the actual application ID from URL
        amount: 5000, // Amount in cents (e.g., $50.00)
        currency: 'usd', // Must be lowercase to match backend validation
      });
    } catch (err) {
      console.error('Error fetching payment info:', err);
      setError('Failed to load payment information');
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async () => {
    try {
      setLoading(true);

      // Create a payment intent with the backend
      const response = await createPaymentIntent({
        applicationId: id, // Use the application ID from URL
        amount: paymentInfo?.amount || 5000, // Amount in cents
        currency: paymentInfo?.currency || 'usd',
      });

      if (response.ok) {
        const paymentData = await response.json();

        // Verify that paymentData and paymentIntentId exist before proceeding
        if (!paymentData || !paymentData.paymentIntentId) {
          setError('Failed to create payment intent: missing paymentIntentId');
          return;
        }

        // Since this is a mock payment, automatically confirm the payment
        const confirmResponse = await confirmPayment(paymentData.paymentIntentId);

        if (confirmResponse.ok) {
          // Payment confirmed successfully
          alert('Payment successful! Redirecting to application status page.');
          router.push(`/status/${id}`);
        } else {
          const confirmError = await confirmResponse.json();
          setError(confirmError.message || 'Failed to confirm payment');
        }
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to initiate payment');
      }
    } catch (err) {
      console.error('Error processing payment:', err);
      setError('An error occurred during payment processing');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-lg">Loading payment information...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-lg text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Complete Your Payment</CardTitle>
          <CardDescription>
            Pay the application fee to complete your submission
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span>Application Fee:</span>
              <span className="font-medium">
                ${(paymentInfo?.amount / 100).toFixed(2)} {paymentInfo?.currency?.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Application ID:</span>
              <span className="font-medium">{paymentInfo?.applicationId}</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col">
          <Button
            onClick={handlePay}
            className="w-full"
          >
            Pay Now
          </Button>
          <p className="mt-4 text-sm text-gray-500 text-center">
            Your payment will be processed securely through our payment partner
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
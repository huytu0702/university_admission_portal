'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { registerUser } from '@/lib/api';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGeneralError('');
    setIsLoading(true);

    try {
      const response = await registerUser({
        email,
        password,
        firstName,
        lastName
      });

      if (response.ok) {
        // Registration successful, redirect to login
        router.push('/login?registered=true');
      } else {
        const errorData = await response.json();

        // Handle validation errors
        if (errorData.message && Array.isArray(errorData.message)) {
          // NestJS validation errors
          const validationErrors: Record<string, string[]> = {};
          errorData.message.forEach((msg: string) => {
            // Try to extract field name from error message
            if (msg.toLowerCase().includes('email')) {
              validationErrors.email = validationErrors.email || [];
              validationErrors.email.push(msg);
            } else if (msg.toLowerCase().includes('password')) {
              validationErrors.password = validationErrors.password || [];
              validationErrors.password.push(msg);
            } else if (msg.toLowerCase().includes('first name')) {
              validationErrors.firstName = validationErrors.firstName || [];
              validationErrors.firstName.push(msg);
            } else if (msg.toLowerCase().includes('last name')) {
              validationErrors.lastName = validationErrors.lastName || [];
              validationErrors.lastName.push(msg);
            } else {
              setGeneralError(msg);
            }
          });
          setErrors(validationErrors);
        } else if (typeof errorData.message === 'string') {
          setGeneralError(errorData.message);
        } else {
          setGeneralError('Registration failed. Please try again.');
        }
      }
    } catch (err) {
      setGeneralError('An error occurred during registration. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Register</CardTitle>
          <CardDescription>Create your account to apply for admission</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {generalError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {generalError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={errors.firstName ? 'border-red-500' : ''}
                  required
                />
                {errors.firstName && (
                  <div className="text-red-500 text-sm space-y-1">
                    {errors.firstName.map((err, idx) => (
                      <p key={idx}>{err}</p>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={errors.lastName ? 'border-red-500' : ''}
                  required
                />
                {errors.lastName && (
                  <div className="text-red-500 text-sm space-y-1">
                    {errors.lastName.map((err, idx) => (
                      <p key={idx}>{err}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={errors.email ? 'border-red-500' : ''}
                required
              />
              {errors.email && (
                <div className="text-red-500 text-sm space-y-1">
                  {errors.email.map((err, idx) => (
                    <p key={idx}>{err}</p>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Min 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={errors.password ? 'border-red-500' : ''}
                required
              />
              <p className="text-xs text-gray-500">
                Must be at least 8 characters with uppercase, lowercase, and a number
              </p>
              {errors.password && (
                <div className="text-red-500 text-sm space-y-1">
                  {errors.password.map((err, idx) => (
                    <p key={idx}>{err}</p>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Registering...' : 'Register'}
            </Button>
            <p className="mt-4 text-sm text-gray-500">
              Already have an account?{' '}
              <a href="/login" className="text-blue-500 hover:underline">
                Login here
              </a>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
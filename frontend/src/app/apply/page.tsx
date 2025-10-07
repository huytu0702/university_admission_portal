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
import { submitApplication as submitApplicationApi } from '@/lib/api';

export default function ApplicationForm() {
  const [step, setStep] = useState(1);
  const [applicationData, setApplicationData] = useState({
    personalStatement: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    address: '',
    programId: '',
  });
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const totalSteps = 3;

  const validateStep = (currentStep: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (currentStep === 1) {
      if (!applicationData.firstName.trim()) {
        newErrors.firstName = 'First name is required';
      }
      if (!applicationData.lastName.trim()) {
        newErrors.lastName = 'Last name is required';
      }
      if (!applicationData.email.trim()) {
        newErrors.email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicationData.email)) {
        newErrors.email = 'Please enter a valid email';
      }
      if (!applicationData.phone.trim()) {
        newErrors.phone = 'Phone number is required';
      }
      if (!applicationData.dateOfBirth) {
        newErrors.dateOfBirth = 'Date of birth is required';
      } else {
        const birthDate = new Date(applicationData.dateOfBirth);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        if (age < 16 || age > 60) {
          newErrors.dateOfBirth = 'Applicant age must be between 16 and 60 years';
        }
      }
    } else if (currentStep === 2) {
      if (!applicationData.personalStatement.trim()) {
        newErrors.personalStatement = 'Personal statement is required';
      } else if (applicationData.personalStatement.trim().length < 100) {
        newErrors.personalStatement = 'Personal statement must be at least 100 characters';
      }
      if (!applicationData.address.trim()) {
        newErrors.address = 'Address is required';
      }
      if (!applicationData.programId) {
        newErrors.programId = 'Please select a program';
      }
    } else if (currentStep === 3) {
      if (files.length === 0) {
        newErrors.files = 'At least one document is required';
      } else {
        // Check file sizes and types
        const maxSize = 5 * 1024 * 1024; // 5MB
        const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

        for (const file of files) {
          if (file.size > maxSize) {
            newErrors.files = `File ${file.name} exceeds 5MB limit`;
            break;
          }
          if (!validTypes.includes(file.type)) {
            newErrors.files = `File ${file.name} is not a valid type`;
            break;
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setApplicationData({
      ...applicationData,
      [name]: value,
    });

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setApplicationData({
      ...applicationData,
      [name]: value,
    });

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setApplicationData({
      ...applicationData,
      [name]: value,
    });

    // Clear error when user selects an option
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);

      // Check number of files
      if (selectedFiles.length > 5) {
        setErrors({ files: 'You can upload a maximum of 5 files' });
        return;
      }

      setFiles(selectedFiles);

      // Clear file error if we have valid files
      if (errors.files) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.files;
          return newErrors;
        });
      }
    }
  };

  const nextStep = () => {
    if (validateStep(step)) {
      if (step < totalSteps) {
        setStep(step + 1);
      }
    }
  };

  const prevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const submitApplication = async () => {
    if (validateStep(step)) {
      setIsSubmitting(true);

      try {
        // Check if user is logged in
        const token = localStorage.getItem('token');
        if (!token) {
          alert('Please login first to submit your application');
          router.push('/login');
          return;
        }

        // Create form data to send the application and files
        const formData = new FormData();
        formData.append('personalStatement', applicationData.personalStatement);

        // Add files to the form data
        files.forEach((file) => {
          formData.append('files', file);
        });

        // Submit the application to the backend
        const response = await submitApplicationApi(formData);

        if (response.ok) {
          const result = await response.json();

          // Redirect to the payment page after successful submission
          alert('Application submitted successfully! Please proceed with payment.');
          router.push(`/payment/${result.id}`);
        } else {
          const errorData = await response.json();

          // Handle specific error cases
          if (response.status === 401) {
            alert('Your session has expired. Please login again.');
            localStorage.removeItem('token');
            router.push('/login');
          } else if (response.status === 422) {
            alert(`Validation error: ${errorData.message || 'Invalid file format or size'}`);
          } else {
            alert(errorData.message || 'Failed to submit application');
          }
        }
      } catch (error) {
        console.error('Error submitting application:', error);
        alert('An error occurred while submitting your application. Please check your internet connection and try again.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Personal Information</h3>
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                name="firstName"
                value={applicationData.firstName}
                onChange={handleInputChange}
                required
              />
              {errors.firstName && <p className="text-red-500 text-sm">{errors.firstName}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                name="lastName"
                value={applicationData.lastName}
                onChange={handleInputChange}
                required
              />
              {errors.lastName && <p className="text-red-500 text-sm">{errors.lastName}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={applicationData.email}
                onChange={handleInputChange}
                required
              />
              {errors.email && <p className="text-red-500 text-sm">{errors.email}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                value={applicationData.phone}
                onChange={handleInputChange}
                required
              />
              {errors.phone && <p className="text-red-500 text-sm">{errors.phone}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <Input
                id="dateOfBirth"
                name="dateOfBirth"
                type="date"
                value={applicationData.dateOfBirth}
                onChange={handleInputChange}
                required
              />
              {errors.dateOfBirth && <p className="text-red-500 text-sm">{errors.dateOfBirth}</p>}
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Personal Statement</h3>
            <div className="space-y-2">
              <Label htmlFor="personalStatement">Personal Statement</Label>
              <textarea
                id="personalStatement"
                name="personalStatement"
                value={applicationData.personalStatement}
                onChange={handleTextareaChange}
                className="w-full p-2 border border-gray-300 rounded-md min-h-[150px]"
                placeholder="Write your personal statement here..."
                required
              />
              {errors.personalStatement && <p className="text-red-500 text-sm">{errors.personalStatement}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <textarea
                id="address"
                name="address"
                value={applicationData.address}
                onChange={handleTextareaChange}
                className="w-full p-2 border border-gray-300 rounded-md min-h-[100px]"
                placeholder="Your full address..."
                required
              />
              {errors.address && <p className="text-red-500 text-sm">{errors.address}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="programId">Program of Interest</Label>
              <select
                id="programId"
                name="programId"
                value={applicationData.programId}
                onChange={handleSelectChange}
                className="w-full p-2 border border-gray-300 rounded-md"
                required
              >
                <option value="">Select a program</option>
                <option value="computer-science">Computer Science</option>
                <option value="business-admin">Business Administration</option>
                <option value="psychology">Psychology</option>
                <option value="biology">Biology</option>
                <option value="engineering">Engineering</option>
              </select>
              {errors.programId && <p className="text-red-500 text-sm">{errors.programId}</p>}
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Upload Documents</h3>
            <p className="text-sm text-gray-500">
              Please upload the following documents in PDF, JPEG, or PNG format (max 5MB each):
            </p>
            <ul className="text-sm text-gray-500 list-disc pl-5 space-y-1">
              <li>Transcripts</li>
              <li>Identification</li>
              <li>Personal statement (if not included above)</li>
              <li>Any additional supporting documents</li>
            </ul>
            <div className="space-y-2">
              <Label htmlFor="files">Select Files</Label>
              <Input
                id="files"
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
              />
              {errors.files && <p className="text-red-500 text-sm">{errors.files}</p>}
            </div>
            {files.length > 0 && (
              <div className="mt-4">
                <p className="font-medium">Selected Files:</p>
                <ul className="list-disc pl-5 text-sm">
                  {files.map((file, index) => (
                    <li key={index}>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-sm text-gray-500 mt-4">
              By submitting this application, you confirm that all information provided is accurate and complete.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 py-12">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>University Application</CardTitle>
          <CardDescription>
            Step {step} of {totalSteps}
          </CardDescription>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            ></div>
          </div>
        </CardHeader>
        <CardContent>
          {renderStep()}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={step === 1}
          >
            Previous
          </Button>
          {step < totalSteps ? (
            <Button onClick={nextStep}>
              Next
            </Button>
          ) : (
            <Button
              onClick={submitApplication}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Application'}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
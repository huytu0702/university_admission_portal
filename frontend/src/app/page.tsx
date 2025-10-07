import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl">
            University Admission Portal
          </h1>
          <p className="mt-6 max-w-lg mx-auto text-xl text-gray-500">
            Apply for university admission with our streamlined, secure process
          </p>
        </div>

        <div className="mt-16">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900">1. Create Account</h3>
              <p className="mt-2 text-gray-500">
                Register for an account to begin your application process. Your information is securely stored and protected.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900">2. Submit Application</h3>
              <p className="mt-2 text-gray-500">
                Complete your application form, upload required documents, and submit for review.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900">3. Pay & Track</h3>
              <p className="mt-2 text-gray-500">
                Complete payment securely and track your application status in real-time.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

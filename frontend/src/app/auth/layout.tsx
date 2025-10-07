import { ReactNode } from 'react';
import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold text-blue-600">
            University Admission Portal
          </Link>
          <nav>
            <ul className="flex space-x-4">
              <li>
                <Link href="/" className="text-gray-600 hover:text-blue-600">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-gray-600 hover:text-blue-600">
                  Login
                </Link>
              </li>
              <li>
                <Link href="/register" className="text-gray-600 hover:text-blue-600">
                  Register
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </header>
      <main>
        {children}
      </main>
    </div>
  );
}
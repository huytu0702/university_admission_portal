'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Header() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const router = useRouter();

    useEffect(() => {
        // Check if user is logged in by checking for token
        const checkAuthStatus = () => {
            const token = localStorage.getItem('token');
            setIsLoggedIn(!!token);
        };

        // Check on mount
        checkAuthStatus();

        // Listen for storage changes (in case user logs in/out in another tab)
        window.addEventListener('storage', checkAuthStatus);

        // Custom event for login/logout within same tab
        window.addEventListener('authChange', checkAuthStatus);

        return () => {
            window.removeEventListener('storage', checkAuthStatus);
            window.removeEventListener('authChange', checkAuthStatus);
        };
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token');
        setIsLoggedIn(false);
        // Dispatch custom event for other components
        window.dispatchEvent(new Event('authChange'));
        router.push('/');
    };

    return (
        <header className="bg-white shadow">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                <a href="/" className="text-xl font-bold text-blue-600">
                    University Admission Portal
                </a>
                <nav>
                    <ul className="flex space-x-6">
                        <li>
                            <a href="/" className="text-gray-600 hover:text-blue-600">
                                Home
                            </a>
                        </li>
                        {isLoggedIn ? (
                            <>
                                <li>
                                    <a href="/apply" className="text-gray-600 hover:text-blue-600">
                                        Apply
                                    </a>
                                </li>
                                <li>
                                    <a href="/my-applications" className="text-gray-600 hover:text-blue-600">
                                        My Applications
                                    </a>
                                </li>
                                <li>
                                    <button
                                        onClick={handleLogout}
                                        className="text-gray-600 hover:text-blue-600 cursor-pointer"
                                    >
                                        Logout
                                    </button>
                                </li>
                            </>
                        ) : (
                            <>
                                <li>
                                    <a href="/login" className="text-gray-600 hover:text-blue-600">
                                        Login
                                    </a>
                                </li>
                                <li>
                                    <a href="/register" className="text-gray-600 hover:text-blue-600">
                                        Register
                                    </a>
                                </li>
                            </>
                        )}
                    </ul>
                </nav>
            </div>
        </header>
    );
}


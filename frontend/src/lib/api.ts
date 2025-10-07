// API utility functions for the frontend

// Get the API URL from environment variable or default to backend service
const getApiUrl = (): string => {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
};

// Generic API request function
export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {},
  includeToken: boolean = true
): Promise<Response> => {
  const apiUrl = getApiUrl();

  // Prepare headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add authorization token if needed
  if (includeToken) {
    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  // Make the API request
  const response = await fetch(`${apiUrl}${endpoint}`, {
    ...options,
    headers,
  });

  return response;
};

// Specific API call functions
export const registerUser = async (userData: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}) => {
  const response = await apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData),
  }, false); // Don't include token for registration

  return response;
};

export const loginUser = async (credentials: {
  email: string;
  password: string;
}) => {
  const response = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  }, false); // Don't include token for login

  return response;
};

export const submitApplication = async (applicationData: FormData) => {
  // For form data, don't set Content-Type header as it will be set automatically
  const headers: HeadersInit = {};
  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const apiUrl = getApiUrl();
  const response = await fetch(`${apiUrl}/applications`, {
    method: 'POST',
    headers,
    body: applicationData,
  });

  return response;
};

export const getApplication = async (applicationId: string) => {
  const response = await apiRequest(`/applications/${applicationId}`);

  return response;
};

export const getApplicationProgress = async (applicationId: string) => {
  const response = await apiRequest(`/applications/${applicationId}/progress`);

  return response;
};

export const createPaymentIntent = async (paymentData: {
  applicationId: string;
  amount: number;
  currency: string;
}) => {
  const response = await apiRequest('/payments/checkout', {
    method: 'POST',
    body: JSON.stringify(paymentData),
  });

  return response;
};

export const confirmPayment = async (paymentIntentId: string) => {
  const response = await apiRequest(`/payments/confirm/${paymentIntentId}`, {
    method: 'GET',
  }, false); // Don't need auth for payment confirmation

  return response;
};

export const getAllApplications = async () => {
  const response = await apiRequest('/applications');

  return response;
};
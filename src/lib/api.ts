/**
 * Utility for making API requests to the Express backend.
 */

import { AuthService } from './auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

/**
 * Helper to handle API responses.
 * Throws an error on non-ok responses and intercepts 401s.
 */
async function handleResponse(response: Response) {
  if (response.status === 401) {
    AuthService.clearToken();
    // Dispatch a custom event to notify the application of a 401
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    let errorMessage = `API Error: ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch (e) {
      // Ignored if json parsing fails
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Gets standard headers, injecting the Auth token if it exists.
 */
function getHeaders(isFormData = false, customHeaders?: HeadersInit): HeadersInit {
  const headers: HeadersInit = { ...customHeaders };
  
  if (!isFormData) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json';
  }
  
  const token = AuthService.getToken();
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

export const apiClient = {
  /**
   * Performs a GET request to the backend.
   */
  async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: getHeaders(false, options?.headers),
    });
    return handleResponse(response);
  },

  /**
   * Performs a POST request to the backend.
   */
  async post<T>(endpoint: string, data: any, options?: RequestInit): Promise<T> {
    const isFormData = data instanceof FormData;
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      ...options,
      headers: getHeaders(isFormData, options?.headers),
      body: isFormData ? data : JSON.stringify(data),
    });
    return handleResponse(response);
  },
};

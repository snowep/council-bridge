import axios, { type AxiosInstance, type InternalAxiosRequestConfig, AxiosError } from 'axios';
import type { SessionTokenResponse, AuthStatusResponse, FounderPublicKeyResponse, ActivityResponse } from '../types/api';
import { LOCAL_SINGLE_USER_MODE } from '../../app/constants';

// Extract error message from API error response
export function getErrorMessage(err: any, fallback: string = 'An error occurred'): string {
  const errorData = err?.response?.data?.error;
  if (typeof errorData === 'string') return errorData;
  if (errorData?.message) return errorData.message;
  return err?.message || fallback;
}

// Use relative URL when frontend and backend share origin (production with Vite proxy)
// Fall back to explicit URL for development or separate deployments
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

class ApiClient {
  private client: AxiosInstance;
  private sessionToken: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
      withCredentials: true,
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        if (this.sessionToken) {
          config.headers.Authorization = `Bearer ${this.sessionToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          this.clearSession();
          localStorage.removeItem('session_token');
          if (window.location.pathname !== '/login' && !LOCAL_SINGLE_USER_MODE) {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  setSessionToken(token: string | null) {
    this.sessionToken = token;
    if (token) {
      localStorage.setItem('session_token', token);
    } else {
      localStorage.removeItem('session_token');
    }
  }

  getSessionToken(): string | null {
    if (!this.sessionToken) {
      this.sessionToken = localStorage.getItem('session_token');
    }
    return this.sessionToken;
  }

  clearSession() {
    this.sessionToken = null;
    localStorage.removeItem('session_token');
  }

  isAuthenticated(): boolean {
    return !!this.getSessionToken();
  }

  // Auth endpoints
  async createSession(ownerType: string, ownerId: string, runtime: 'claude' | 'hermes', founderSignature?: any): Promise<SessionTokenResponse> {
    const response = await this.client.post('/api/auth/session', {
      owner_type: ownerType,
      owner_id: ownerId,
      runtime,
      ...founderSignature,
    });
    return response.data;
  }

  async deleteSession(): Promise<{ revoked: boolean; session_id: string }> {
    const response = await this.client.delete('/api/auth/session');
    return response.data;
  }

  async getAuthStatus(): Promise<AuthStatusResponse> {
    const response = await this.client.get('/api/auth/status');
    return response.data;
  }

  async getFounderPublicKey(): Promise<FounderPublicKeyResponse> {
    const response = await this.client.get('/api/auth/founder/public-key');
    return response.data;
  }

  // Health check
  async healthCheck(): Promise<{ status: string }> {
    const response = await this.client.get('/health');
    return response.data;
  }

  // Activity
  async getActivity(params: { limit?: number; offset?: number }): Promise<ActivityResponse> {
    const response = await this.client.get<ActivityResponse>('/api/activity', { params });
    return response.data;
  }

  // Generic API methods
  async get<T>(url: string, params?: any): Promise<T> {
    const response = await this.client.get(url, { params });
    return response.data;
  }

  async post<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.post(url, data);
    return response.data;
  }

  async put<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.put(url, data);
    return response.data;
  }

  async patch<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.patch(url, data);
    return response.data;
  }

  async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete(url);
    return response.data;
  }
}

export const apiClient = new ApiClient();
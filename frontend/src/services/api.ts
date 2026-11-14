import axios, { type AxiosInstance, type InternalAxiosRequestConfig, AxiosError } from 'axios';
import type { SessionTokenResponse, AuthStatusResponse, FounderPublicKeyResponse } from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3334';

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
          window.location.href = '/login';
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
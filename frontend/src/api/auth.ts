import { axiosClient } from './client';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  id: string;
  username: string;
  role: 'admin' | 'user';
}

export const authApi = {
  /**
   * Login with username and password
   */
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const { data } = await axiosClient.post<AuthResponse>('/auth/login', credentials);
    return data;
  },

  /**
   * Get current authenticated user
   */
  async me(): Promise<AuthResponse | null> {
    try {
      const { data } = await axiosClient.get<AuthResponse>('/auth/me');
      return data;
    } catch {
      return null;
    }
  },

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    await axiosClient.post('/auth/logout');
  },
};

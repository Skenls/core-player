import { axiosClient } from './client';

export interface LoginRequest {
  navidrome_url: string;
  username: string;
  password: string;
}

export interface AuthResponse {
  username: string;
  navidrome_url: string;
}

export const authApi = {
  /**
   * Login with Navidrome credentials
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
    } catch (error) {
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

import { axiosClient } from './client';

export interface AdminUser {
  id: string;
  username: string;
  role: 'admin' | 'user';
  created_at: string;
}

export interface CreateUserData {
  username: string;
  password: string;
  role: 'admin' | 'user';
}

export interface UpdateUserData {
  role?: 'admin' | 'user';
  password?: string;
}

export const adminApi = {
  /**
   * List all users
   */
  async getUsers(): Promise<AdminUser[]> {
    const { data } = await axiosClient.get<AdminUser[]>('/admin/users');
    return data;
  },

  /**
   * Create a new user
   */
  async createUser(userData: CreateUserData): Promise<AdminUser> {
    const { data } = await axiosClient.post<AdminUser>('/admin/users', userData);
    return data;
  },

  /**
   * Delete a user
   */
  async deleteUser(userId: string): Promise<void> {
    await axiosClient.delete(`/admin/users/${userId}`);
  },

  /**
   * Update a user role or password
   */
  async updateUser(userId: string, updateData: UpdateUserData): Promise<AdminUser> {
    const { data } = await axiosClient.patch<AdminUser>(`/admin/users/${userId}`, updateData);
    return data;
  },
};

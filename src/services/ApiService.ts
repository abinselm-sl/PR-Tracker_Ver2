import axios, {AxiosInstance} from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {PurchaseRequisition, PRItem, UserRole} from '../types';

class ApiService {
  private api: AxiosInstance;
  private baseURL = 'https://your-server-url.com/api'; // Replace with your actual server URL

  constructor() {
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      async (config) => {
        const user = await AsyncStorage.getItem('currentUser');
        if (user) {
          const userData = JSON.parse(user);
          config.headers.Authorization = `Bearer ${userData.sessionId}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized access
          AsyncStorage.removeItem('currentUser');
        }
        return Promise.reject(error);
      }
    );
  }

  // Authentication
  async login(credentials: {
    username: string;
    password: string;
    deviceId: string;
    deviceName: string;
  }) {
    const response = await this.api.post('/auth/login', credentials);
    return response.data;
  }

  async logout(sessionId: string) {
    await this.api.post('/auth/logout', {sessionId});
  }

  async validateSession(sessionId: string): Promise<boolean> {
    try {
      const response = await this.api.post('/auth/validate', {sessionId});
      return response.data.valid;
    } catch {
      return false;
    }
  }

  async updateHeartbeat(sessionId: string) {
    await this.api.post('/auth/heartbeat', {sessionId});
  }

  // Purchase Requisitions
  async getAllPRs(): Promise<PurchaseRequisition[]> {
    const response = await this.api.get('/prs');
    return response.data;
  }

  async getPR(prId: string): Promise<PurchaseRequisition> {
    const response = await this.api.get(`/prs/${prId}`);
    return response.data;
  }

  async createPR(pr: PurchaseRequisition): Promise<PurchaseRequisition> {
    const response = await this.api.post('/prs', pr);
    return response.data;
  }

  async updatePR(prId: string, updates: Partial<PurchaseRequisition>): Promise<PurchaseRequisition> {
    const response = await this.api.put(`/prs/${prId}`, updates);
    return response.data;
  }

  async deletePR(prId: string): Promise<void> {
    await this.api.delete(`/prs/${prId}`);
  }

  // PR Items
  async updatePRItem(prId: string, itemId: string, updates: Partial<PRItem>, userName: string): Promise<PRItem> {
    const response = await this.api.put(`/prs/${prId}/items/${itemId}`, {
      ...updates,
      lastModifiedBy: {
        userName,
        timestamp: Date.now(),
      },
    });
    return response.data;
  }

  // Sync operations
  async syncChanges(changes: any[]) {
    const response = await this.api.post('/sync', {changes});
    return response.data;
  }

  async getChangesSince(timestamp: number) {
    const response = await this.api.get(`/sync/changes?since=${timestamp}`);
    return response.data;
  }

  // Active users
  async getActiveUsers() {
    const response = await this.api.get('/users/active');
    return response.data;
  }

  // File upload
  async uploadFile(file: any): Promise<PurchaseRequisition> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await this.api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }
}

export default new ApiService();
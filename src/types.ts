export enum PRStatus {
  InProgress = 'In Progress',
  Completed = 'Completed',
}

export interface LastModifiedInfo {
  userName: string;
  timestamp: number;
}

export interface PRItem {
  id: string;
  description: string;
  originalQuantity: number;
  receivedQuantity: number;
  comment: string;
  isComplete: boolean;
  lastModifiedBy?: LastModifiedInfo;
}

export interface PurchaseRequisition {
  id: string;
  name: string;
  issueDate: string;
  status: PRStatus;
  items: PRItem[];
  requisitionBy: string;
  approvedBy: string;
  lastModifiedBy?: LastModifiedInfo;
}

export enum UserRole {
  Admin = 'Admin',
  Viewer = 'Viewer',
}

export interface UserProfile {
  password?: string;
  phoneNumber?: string;
}

export interface UserSession {
  sessionId: string;
  userName: string;
  role: UserRole;
  lastSeen: number;
  deviceId?: string;
  deviceName?: string;
}

export enum SuggestionStatus {
  Pending = 'Pending',
  Reviewed = 'Reviewed',
  Done = 'Done',
}

export interface SuggestionLogEntry {
  id: string;
  userName: string;
  note: string;
  timestamp: number;
  status: SuggestionStatus;
  adminComments: string;
}

// API Response Types
export interface LoginResponse {
  success: boolean;
  sessionId: string;
  role: UserRole;
  message?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
// Shared types that match the backend API responses
// These types should be kept in sync with the server/routers.ts definitions

// User types
export interface User {
  id: number;
  openId: string;
  name: string;
  email: string;
  avatar?: string | null;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 
  | 'coordinator' 
  | 'manager' 
  | 'trainer' 
  | 'client' 
  | 'shopper' 
  | 'pending_trainer';

// Bundle types
export interface Bundle {
  id: number;
  trainerId: number;
  title: string;
  description?: string | null;
  price: string;
  imageUrl?: string | null;
  status: BundleStatus;
  createdAt: Date;
  updatedAt: Date;
  products?: BundleProduct[];
  trainer?: {
    id: number;
    name: string;
    avatar?: string | null;
  };
}

export type BundleStatus = 'draft' | 'pending' | 'published' | 'rejected';

export interface BundleProduct {
  id: number;
  bundleId: number;
  productId: number;
  quantity: number;
  name: string;
}

// Product types (from Shopify sync)
export interface Product {
  id: number;
  shopifyId: string;
  title: string;
  description?: string | null;
  price: string;
  imageUrl?: string | null;
  inventoryQuantity: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

// Session types
export interface Session {
  id: number;
  trainerId: number;
  clientId: number;
  bundleId?: number | null;
  scheduledAt: Date;
  duration: number; // in minutes
  status: SessionStatus;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  trainer?: {
    id: number;
    name: string;
    avatar?: string | null;
  };
  client?: {
    id: number;
    name: string;
    avatar?: string | null;
  };
}

export type SessionStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';

// Purchase types
export interface Purchase {
  id: number;
  userId: number;
  bundleId: number;
  amount: string;
  status: PurchaseStatus;
  createdAt: Date;
  updatedAt: Date;
  bundle?: Bundle;
  user?: User;
}

export type PurchaseStatus = 'pending' | 'completed' | 'refunded' | 'failed';

// Analytics types
export interface TrainerStats {
  activeClients: number;
  activeBundles: number;
  monthlyRevenue: number;
  rating: number;
  clientsChange: number;
  revenueChange: number;
}

export interface ManagerStats {
  totalUsers: number;
  totalTrainers: number;
  totalClients: number;
  totalBundles: number;
  pendingApprovals: number;
  monthlyRevenue: number;
}

// API Response types
export interface ApiError {
  code: string;
  message: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Auth types
export interface AuthUser {
  id: number;
  openId: string;
  name: string;
  email: string;
  avatar?: string | null;
  role: UserRole;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
}

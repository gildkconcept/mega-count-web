export interface User {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  is_active: boolean;
  roles: string[];
  permissions: string[];
  created_at: string;
  last_login: string;
}

export interface Assembly {
  id: string;
  code: string;
  name: string;
  address?: string;
  zone?: string;
  city?: string;
  country?: string;
  status: 'active' | 'inactive' | 'archived';
  created_at: string;
}

export interface Entrance {
  id: string;
  assembly_id: string;
  name: string;
  code: string;
  description?: string;
  type: 'main' | 'north' | 'south' | 'east' | 'west' | 'children' | 'vip' | 'secondary';
  is_active: boolean;
  capacity?: number;
  created_at: string;
}

export interface WorshipService {
  id: string;
  assembly_id: string;
  service_type_id: string;
  title: string;
  date: string;
  start_time: string;
  end_time?: string;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  created_at: string;
}

export interface CountingSession {
  id: string;
  session_identifier: string;
  user_id: string;
  assembly_id: string;
  worship_service_id: string;
  entrance_id: string;
  status: string;
  start_time: string;
  end_time?: string;
  total_count: number;
  method: 'auto' | 'manual' | 'mixed';
  created_at: string;
}

export interface DashboardStats {
  today: {
    count: number;
    sessions: number;
  };
  active_assemblies: number;
  active_counters: number;
  pending_validations: number;
  total: {
    assemblies: number;
    users: number;
    sessions: number;
    count: number;
  };
}
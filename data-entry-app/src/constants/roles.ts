import { UserRole } from '../lib/supabase';

// Role definitions
export const ROLES = {
  ADMIN: 'admin' as UserRole,
  EDITOR: 'editor' as UserRole,
  VIEWER: 'viewer' as UserRole,
} as const;

// Permission definitions
export const PERMISSIONS = {
  // Data entry permissions
  'data:read': 'data:read',
  'data:write': 'data:write',
  'data:delete': 'data:delete',
  
  // Inventory permissions
  'inventory:read': 'inventory:read',
  'inventory:write': 'inventory:write',
  'inventory:delete': 'inventory:delete',
  
  // Reports permissions
  'reports:read': 'reports:read',
  'reports:write': 'reports:write',
  
  // User management permissions
  'users:read': 'users:read',
  'users:write': 'users:write',
  'users:delete': 'users:delete',
  
  // Settings permissions
  'settings:read': 'settings:read',
  'settings:write': 'settings:write',
} as const;

// Role-based permission mappings
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: [
    // Admin has all permissions
    PERMISSIONS['data:read'],
    PERMISSIONS['data:write'],
    PERMISSIONS['data:delete'],
    PERMISSIONS['inventory:read'],
    PERMISSIONS['inventory:write'],
    PERMISSIONS['inventory:delete'],
    PERMISSIONS['reports:read'],
    PERMISSIONS['reports:write'],
    PERMISSIONS['users:read'],
    PERMISSIONS['users:write'],
    PERMISSIONS['users:delete'],
    PERMISSIONS['settings:read'],
    PERMISSIONS['settings:write'],
  ],
  editor: [
    // Editor can read and write but has restrictions on deleting critical resources
    PERMISSIONS['data:read'],
    PERMISSIONS['data:write'],
    // No data:delete for editor
    PERMISSIONS['inventory:read'],
    PERMISSIONS['inventory:write'],
    // No inventory:delete for editor
    PERMISSIONS['reports:read'],
    PERMISSIONS['reports:write'],
    PERMISSIONS['users:read'],
    // No users:write or users:delete for editor
    PERMISSIONS['settings:read'],
    // No settings:write for editor
  ],
  viewer: [
    // Viewer is read-only
    PERMISSIONS['data:read'],
    PERMISSIONS['inventory:read'],
    PERMISSIONS['reports:read'],
    PERMISSIONS['users:read'],
    PERMISSIONS['settings:read'],
  ],
};

// Helper function to check if a role has a permission
export const hasPermission = (role: UserRole, permission: string): boolean => {
  return ROLE_PERMISSIONS[role]?.includes(permission) || false;
};

// Helper function to check if a role can delete
export const canDelete = (role: UserRole): boolean => {
  return role === ROLES.ADMIN;
};

// Helper function to check if a role can write
export const canWrite = (role: UserRole): boolean => {
  return role === ROLES.ADMIN || role === ROLES.EDITOR;
};

// Helper function to check if a role is read-only
export const isReadOnly = (role: UserRole): boolean => {
  return role === ROLES.VIEWER;
};

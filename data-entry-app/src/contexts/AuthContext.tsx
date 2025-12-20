import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser, supabase } from '../lib/supabase';
import { fetchUserById } from '../services/userService';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isRestoringSession: boolean;
  login: (userData: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<AuthUser>) => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  // Fetch user profile from database
  const fetchUserProfile = useCallback(async (userId: string): Promise<AuthUser | null> => {
    try {
      const userProfile = await fetchUserById(userId);
      if (!userProfile || userProfile.status !== 'active') {
        return null;
      }

      return {
        id: userProfile.id,
        email: userProfile.email,
        name: userProfile.name || userProfile.email,
        first_name: userProfile.first_name || '',
        last_name: userProfile.last_name || '',
        role: userProfile.role,
        permissions: [],
        roles: [],
        created_at: userProfile.created_at,
      };
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        // Check Supabase session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (session && !error && session.user) {
          const userProfile = await fetchUserProfile(session.user.id);
          
          if (userProfile) {
            setUser(userProfile);
            setIsAuthenticated(true);
            localStorage.setItem('app-user', JSON.stringify(userProfile));
            localStorage.setItem('app-authenticated', 'true');
          } else {
            // User not found or inactive, sign out
            await supabase.auth.signOut();
            localStorage.removeItem('app-user');
            localStorage.removeItem('app-authenticated');
          }
        } else {
          // Check localStorage as fallback
          const savedUser = localStorage.getItem('app-user');
          const savedAuth = localStorage.getItem('app-authenticated');
          
          if (savedUser && savedAuth === 'true') {
            try {
              const userData = JSON.parse(savedUser);
              if (userData && userData.id && userData.email) {
                // Verify user still exists
                const userProfile = await fetchUserProfile(userData.id);
                if (userProfile) {
                  setUser(userProfile);
                  setIsAuthenticated(true);
                } else {
                  localStorage.removeItem('app-user');
                  localStorage.removeItem('app-authenticated');
                }
              }
            } catch (parseError) {
              console.error('Error parsing saved user data:', parseError);
              localStorage.removeItem('app-user');
              localStorage.removeItem('app-authenticated');
            }
          }
        }
      } catch (error) {
        console.error('Error checking existing session:', error);
      } finally {
        setIsRestoringSession(false);
      }
    };

    checkExistingSession();
  }, [fetchUserProfile]);

  // Listen for Supabase auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session && session.user) {
        const userProfile = await fetchUserProfile(session.user.id);
        
        if (userProfile) {
          setUser(userProfile);
          setIsAuthenticated(true);
          localStorage.setItem('app-user', JSON.stringify(userProfile));
          localStorage.setItem('app-authenticated', 'true');
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem('app-user');
        localStorage.removeItem('app-authenticated');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  const login = useCallback(async (userData: AuthUser) => {
    setUser(userData);
    setIsAuthenticated(true);
    localStorage.setItem('app-user', JSON.stringify(userData));
    localStorage.setItem('app-authenticated', 'true');
  }, []);

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out from Supabase:', error);
    }
    
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('app-user');
    localStorage.removeItem('app-authenticated');
  };

  const updateUser = (userData: Partial<AuthUser>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      localStorage.setItem('app-user', JSON.stringify(updatedUser));
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    // This will be enhanced by RBACContext
    return user.permissions?.includes(permission) || false;
  };

  const value = {
    user,
    isAuthenticated,
    isRestoringSession,
    login,
    logout,
    updateUser,
    hasPermission,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

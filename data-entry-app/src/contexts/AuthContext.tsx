import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { AuthUser } from '../lib/supabase';
import { fetchUserById } from '../services/userService';
import { logAction } from '../services/auditLogService';

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
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const checkExistingSession = async () => {
      try {
        // Set timeout to prevent infinite loading (10 seconds max)
        const timeoutPromise = new Promise<void>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('Session restoration timeout'));
          }, 10000);
        });

        // Race between session check and timeout
        const sessionCheck = async () => {
          try {
            // Check Supabase session with timeout
            const { data: { session }, error } = await supabase.auth.getSession();
            
            if (session && !error && session.user) {
              const userProfile = await fetchUserProfile(session.user.id);
              
              if (userProfile && isMounted) {
                setUser(userProfile);
                setIsAuthenticated(true);
                localStorage.setItem('app-user', JSON.stringify(userProfile));
                localStorage.setItem('app-authenticated', 'true');
              } else if (isMounted) {
                // User not found or inactive, sign out
                try {
                  await supabase.auth.signOut();
                } catch (signOutError) {
                  console.error('Error signing out:', signOutError);
                }
                localStorage.removeItem('app-user');
                localStorage.removeItem('app-authenticated');
              }
            } else {
              // Check localStorage as fallback
              const savedUser = localStorage.getItem('app-user');
              const savedAuth = localStorage.getItem('app-authenticated');
              
              if (savedUser && savedAuth === 'true' && isMounted) {
                try {
                  const userData = JSON.parse(savedUser);
                  if (userData && userData.id && userData.email) {
                    // Verify user still exists
                    const userProfile = await fetchUserProfile(userData.id);
                    if (userProfile && isMounted) {
                      setUser(userProfile);
                      setIsAuthenticated(true);
                    } else if (isMounted) {
                      // Clear stale session data
                      localStorage.removeItem('app-user');
                      localStorage.removeItem('app-authenticated');
                    }
                  } else if (isMounted) {
                    // Invalid user data, clear it
                    localStorage.removeItem('app-user');
                    localStorage.removeItem('app-authenticated');
                  }
                } catch (parseError) {
                  console.error('Error parsing saved user data:', parseError);
                  if (isMounted) {
                    localStorage.removeItem('app-user');
                    localStorage.removeItem('app-authenticated');
                  }
                }
              }
            }
          } catch (sessionError) {
            console.error('Error during session check:', sessionError);
            // Clear potentially stale session data on persistent errors
            if (isMounted) {
              try {
                await supabase.auth.signOut();
              } catch (signOutError) {
                // Ignore sign out errors during cleanup
              }
              localStorage.removeItem('app-user');
              localStorage.removeItem('app-authenticated');
            }
          }
        };

        await Promise.race([sessionCheck(), timeoutPromise]);
      } catch (error) {
        console.error('Error checking existing session:', error);
        // Clear stale session data on timeout or persistent errors
        if (isMounted) {
          try {
            await supabase.auth.signOut();
          } catch (signOutError) {
            // Ignore sign out errors during cleanup
          }
          localStorage.removeItem('app-user');
          localStorage.removeItem('app-authenticated');
        }
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (isMounted) {
          setIsRestoringSession(false);
        }
      }
    };

    checkExistingSession();

    // Cleanup function
    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
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

  // Handle visibility change (tab switching) to refresh session and check connection
  useEffect(() => {
    let isMounted = true;
    let refreshTimeoutId: NodeJS.Timeout | null = null;

    const handleVisibilityChange = async () => {
      // Only process when tab becomes visible
      if (document.visibilityState === 'visible' && isMounted) {
        try {
          // Clear any pending refresh
          if (refreshTimeoutId) {
            clearTimeout(refreshTimeoutId);
          }

          // Small delay to avoid rapid refreshes
          refreshTimeoutId = setTimeout(async () => {
            if (!isMounted) return;

            try {
              // Health check: Verify Supabase connection with timeout
              const sessionPromise = supabase.auth.getSession();
              const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Connection timeout')), 5000);
              });

              const result = await Promise.race([sessionPromise, timeoutPromise]);
              const { data: { session }, error } = result;

              if (error) {
                console.warn('Connection health check failed:', error);
                // Don't clear session on transient errors, just log
                return;
              }

              // If we have a session but no user in state, restore it
              if (session?.user && !user) {
                const userProfile = await fetchUserProfile(session.user.id);
                if (userProfile && isMounted) {
                  setUser(userProfile);
                  setIsAuthenticated(true);
                  localStorage.setItem('app-user', JSON.stringify(userProfile));
                  localStorage.setItem('app-authenticated', 'true');
                }
              }
              // If we have user in state but no session, verify it's still valid
              else if (user && !session?.user) {
                // Session expired, clear local state
                if (isMounted) {
                  setUser(null);
                  setIsAuthenticated(false);
                  localStorage.removeItem('app-user');
                  localStorage.removeItem('app-authenticated');
                }
              }
            } catch (healthCheckError) {
              // Connection timeout or error - don't clear session, just log
              console.warn('Connection health check timeout:', healthCheckError);
            }
          }, 500); // 500ms delay to debounce rapid visibility changes
        } catch (error) {
          console.error('Error in visibility change handler:', error);
        }
      }
    };

    // Add event listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (refreshTimeoutId) {
        clearTimeout(refreshTimeoutId);
      }
    };
  }, [user, fetchUserProfile]);

  const login = useCallback(async (userData: AuthUser) => {
    setUser(userData);
    setIsAuthenticated(true);
    localStorage.setItem('app-user', JSON.stringify(userData));
    localStorage.setItem('app-authenticated', 'true');
  }, []);

  const logout = async () => {
    try {
      // Log logout action before signing out
      if (user) {
        await logAction(user.id, 'LOGOUT', 'system', null, {
          email: user.email,
          role: user.role,
        });
      }

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

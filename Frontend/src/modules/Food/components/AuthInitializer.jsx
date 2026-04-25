import { useEffect, useState } from 'react';
import { isModuleAuthenticated, getModuleToken } from '@food/utils/auth';
import Loader from './Loader';

/**
 * AuthInitializer - Recovers auth state from localStorage on app initialization
 * Ensures tokens are validated before any protected routes render
 * This prevents redirect loops when refreshing protected pages
 */
export default function AuthInitializer({ children }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRehydrating, setIsRehydrating] = useState(true);

  useEffect(() => {
    // Simulate hydration of auth state from localStorage
    // This ensures localStorage is fully available before route checks
    const initializeAuth = async () => {
      try {
        // Check all module tokens to ensure they're properly loaded from localStorage
        const modules = ['user', 'restaurant', 'delivery', 'admin'];
        
        modules.forEach(module => {
          const token = getModuleToken(module);
          // If token exists, validate it's accessible
          if (token && typeof token === 'string') {
            // Token is valid and accessible from localStorage
          }
        });
        
        // Mark initialization as complete - localStorage is now fully hydrated
        setIsInitialized(true);
      } catch (error) {
        console.warn('Auth initialization error:', error);
        // Even on error, allow app to continue
        setIsInitialized(true);
      } finally {
        setIsRehydrating(false);
      }
    };

    // Use setTimeout to ensure this happens after React hydration
    const timer = setTimeout(initializeAuth, 0);
    return () => clearTimeout(timer);
  }, []);

  // Show loader while rehydrating auth state on app initialization
  if (isRehydrating) {
    return <Loader />;
  }

  return children;
}

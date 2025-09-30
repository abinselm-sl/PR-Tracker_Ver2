import React, {createContext, useContext, useState, useEffect, ReactNode} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import {UserSession, UserRole} from '../types';
import ApiService from '../services/ApiService';

interface AuthContextType {
  user: UserSession | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateLastSeen: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({children}) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredUser();
    setupHeartbeat();
  }, []);

  const loadStoredUser = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('currentUser');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        // Validate session with server
        const isValid = await ApiService.validateSession(userData.sessionId);
        if (isValid) {
          setUser(userData);
        } else {
          await AsyncStorage.removeItem('currentUser');
        }
      }
    } catch (error) {
      console.error('Error loading stored user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setupHeartbeat = () => {
    setInterval(async () => {
      const storedUser = await AsyncStorage.getItem('currentUser');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        await ApiService.updateHeartbeat(userData.sessionId);
      }
    }, 30000); // 30 seconds
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const deviceId = await DeviceInfo.getUniqueId();
      const deviceName = await DeviceInfo.getDeviceName();
      
      const response = await ApiService.login({
        username,
        password,
        deviceId,
        deviceName,
      });

      if (response.success) {
        const newUser: UserSession = {
          sessionId: response.sessionId,
          userName: username,
          role: response.role,
          lastSeen: Date.now(),
          deviceId,
          deviceName,
        };

        setUser(newUser);
        await AsyncStorage.setItem('currentUser', JSON.stringify(newUser));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      if (user) {
        await ApiService.logout(user.sessionId);
      }
      setUser(null);
      await AsyncStorage.removeItem('currentUser');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const updateLastSeen = async () => {
    if (user) {
      const updatedUser = {...user, lastSeen: Date.now()};
      setUser(updatedUser);
      await AsyncStorage.setItem('currentUser', JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        updateLastSeen,
      }}>
      {children}
    </AuthContext.Provider>
  );
};
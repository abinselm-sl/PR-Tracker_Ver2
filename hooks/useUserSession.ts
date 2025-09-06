import { useState, useEffect, useCallback, useMemo } from 'react';
import { UserSession, UserProfile, UserRole } from '../types';

const SESSIONS_KEY = 'logistics-app-active-sessions';
const PROFILES_KEY = 'logistics-app-user-profiles';
const HEARTBEAT_INTERVAL = 5000; // 5 seconds
const SESSION_TIMEOUT = 15000; // 15 seconds

// User configuration
export const USER_CONFIG: { [key: string]: { role: UserRole, phone?: string, email?: string } } = {
  'abinselm': { role: UserRole.Admin, phone: '1234567890', email: 'abinselm.admin@example.com' }, // Replace with real email
  'Shahid':   { role: UserRole.Admin, phone: '0987654321', email: 'shahid.admin@example.com' }, // Replace with real email
  'Pilot':    { role: UserRole.Viewer },
  'Master':   { role: UserRole.Viewer },
  'Engineer': { role: UserRole.Viewer },
};

// Helper to safely interact with localStorage
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  },
  setItem: (key: string, value: string) => {
    try { window.localStorage.setItem(key, value); } catch (e) { console.error(e); }
  },
  removeItem: (key: string) => {
    try { window.localStorage.removeItem(key); } catch (e) { console.error(e); }
  }
};

type SessionMap = { [sessionId: string]: UserSession };
type ProfileMap = { [userName: string]: UserProfile };

type UseUserSessionOutput = [
  UserSession | null,
  UserSession[],
  (name: string, password?: string) => 'success' | 'password_required' | 'invalid_credentials' | 'access_denied',
  () => void,
  boolean,
  (password: string, phoneNumber: string) => void,
  (userName: string, phoneNumber: string) => void,
  (note: string) => void
];

export function useUserSession(): UseUserSessionOutput {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [activeSessions, setActiveSessions] = useState<SessionMap>({});
  const [passwordSetupRequired, setPasswordSetupRequired] = useState(false);

  const sessionId = useMemo(() => currentUser?.sessionId, [currentUser]);

  const getProfiles = (): ProfileMap => {
    try {
      return JSON.parse(safeLocalStorage.getItem(PROFILES_KEY) || '{}');
    } catch {
      return {};
    }
  };

  const saveProfiles = (profiles: ProfileMap) => {
    safeLocalStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  };
  
  const updateSessions = useCallback((updater: (currentSessions: SessionMap) => SessionMap) => {
    try {
      const rawData = safeLocalStorage.getItem(SESSIONS_KEY) || '{}';
      const currentSessions = JSON.parse(rawData);
      const newSessions = updater(currentSessions);
      const newRawData = JSON.stringify(newSessions);
      safeLocalStorage.setItem(SESSIONS_KEY, newRawData);
      window.dispatchEvent(new StorageEvent('storage', { key: SESSIONS_KEY, newValue: newRawData }));
    } catch (e) {
      console.error('Failed to update sessions in localStorage', e);
    }
  }, []);

  const logout = useCallback(() => {
    if (sessionId) {
        updateSessions(sessions => {
            const newSessions = { ...sessions };
            delete newSessions[sessionId];
            return newSessions;
        });
    }
    setCurrentUser(null);
    setPasswordSetupRequired(false);
  }, [sessionId, updateSessions]);


  const login = useCallback((name: string, password?: string): 'success' | 'password_required' | 'invalid_credentials' | 'access_denied' => {
    const userConfig = USER_CONFIG[name];
    if (!userConfig) {
      return 'access_denied';
    }

    if (userConfig.role === UserRole.Admin) {
      const profiles = getProfiles();
      const userProfile = profiles[name];

      if (!userProfile?.password) {
        setPasswordSetupRequired(true);
      } else if (userProfile.password !== password) {
        return 'invalid_credentials';
      }
    }
    
    const newSessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const user: UserSession = {
      sessionId: newSessionId,
      userName: name,
      role: userConfig.role,
      lastSeen: Date.now(),
    };
    setCurrentUser(user);
    return 'success';
  }, []);

  const setPassword = useCallback((password: string, phoneNumber: string) => {
    if (currentUser?.role === UserRole.Admin) {
        const profiles = getProfiles();
        profiles[currentUser.userName] = {
            ...profiles[currentUser.userName],
            password,
            phoneNumber,
        };
        saveProfiles(profiles);
        setPasswordSetupRequired(false);
    }
  }, [currentUser]);

  const recoverPassword = useCallback((userName: string, phoneNumber: string) => {
    const profiles = getProfiles();
    const profile = profiles[userName];
    if (profile && profile.phoneNumber === phoneNumber && profile.password) {
        const text = encodeURIComponent(`Your password for the Logistics Tracker is: ${profile.password}`);
        window.open(`https://wa.me/${phoneNumber}?text=${text}`, '_blank');
    } else {
        alert('Username or phone number is incorrect. Cannot recover password.');
    }
  }, []);

  const sendSuggestion = useCallback((note: string) => {
      const adminEmails = Object.values(USER_CONFIG)
        .filter(u => u.role === UserRole.Admin && u.email)
        .map(u => u.email);

      if (adminEmails.length > 0) {
        const subject = encodeURIComponent('Suggestion for Logistics PR Tracker');
        const body = encodeURIComponent(note);
        // Using the first admin email for the 'to' field. Can also join them with commas.
        const mailtoLink = `mailto:${adminEmails[0]}?subject=${subject}&body=${body}`;
        window.open(mailtoLink, '_blank');
      } else {
        alert('No admin emails are configured.');
      }
  }, []);

  // Effect for heartbeat and session cleanup
  useEffect(() => {
    if (!sessionId || !currentUser) return;
    const intervalId = setInterval(() => {
      const now = Date.now();
      updateSessions(currentSessions => {
        const newSessions = { ...currentSessions };
        newSessions[sessionId] = { ...currentUser, lastSeen: now };
        Object.keys(newSessions).forEach(key => {
          if (now - newSessions[key].lastSeen > SESSION_TIMEOUT) {
            delete newSessions[key];
          }
        });
        return newSessions;
      });
    }, HEARTBEAT_INTERVAL);
    return () => clearInterval(intervalId);
  }, [sessionId, currentUser, updateSessions]);

  // Effect for graceful exit
  useEffect(() => {
    if (!sessionId) return;
    const handleBeforeUnload = () => {
      updateSessions(sessions => {
        const newSessions = { ...sessions };
        delete newSessions[sessionId];
        return newSessions;
      });
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [sessionId, updateSessions]);

  // Effect for storage event listener (syncing across tabs)
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === SESSIONS_KEY) {
        try {
          setActiveSessions(event.newValue ? JSON.parse(event.newValue) : {});
        } catch (e) {
          setActiveSessions({});
        }
      }
    };
    handleStorageChange({ key: SESSIONS_KEY, newValue: safeLocalStorage.getItem(SESSIONS_KEY) } as StorageEvent);
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const sessionsArray = useMemo(() => Object.values(activeSessions), [activeSessions]);

  return [currentUser, sessionsArray, login, logout, passwordSetupRequired, setPassword, recoverPassword, sendSuggestion];
}
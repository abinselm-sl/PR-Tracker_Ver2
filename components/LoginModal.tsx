import React, { useState, useMemo } from 'react';
import { USER_CONFIG } from '../hooks/useUserSession';
import { UserRole } from '../types';

interface LoginModalProps {
  onLogin: (name: string, password?: string) => 'success' | 'password_required' | 'invalid_credentials' | 'access_denied';
  onForgotPassword: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ onLogin, onForgotPassword }) => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isAdminUser = useMemo(() => {
    const trimmedName = name.trim();
    return !!trimmedName && USER_CONFIG[trimmedName]?.role === UserRole.Admin;
  }, [name]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName) {
      const result = onLogin(trimmedName, password);
      if (result === 'invalid_credentials') {
        setError('Invalid password. Please try again.');
      } else if (result === 'access_denied') {
        setError('Access denied. Please enter a valid user name.');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 z-50 flex justify-center items-center font-sans">
      <div className="bg-white rounded-lg shadow-2xl p-8 m-4 max-w-sm w-full">
        <h2 className="text-2xl font-bold mb-4 text-gray-900">Welcome to the Tracker</h2>
        <p className="text-gray-600 mb-6">Please enter your name to start your session. This will be visible to others using the app.</p>
        <form onSubmit={handleSubmit}>
            <label htmlFor="userName" className="sr-only">Your Name</label>
            <input
                id="userName"
                type="text"
                value={name}
                onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError(null);
                }}
                placeholder="Your Name"
                className={`w-full px-4 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 mb-4 ${
                    error 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                autoFocus
                aria-invalid={!!error}
                aria-describedby={error ? 'user-name-error' : undefined}
            />
          
            {isAdminUser && (
                <div className="mb-4">
                    <label htmlFor="password" className="sr-only">Password</label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            if (error) setError(null);
                        }}
                        placeholder="Password"
                        className={`w-full px-4 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 ${
                            error 
                            ? 'border-red-500 focus:ring-red-500' 
                            : 'border-gray-300 focus:ring-blue-500'
                        }`}
                        aria-invalid={!!error}
                    />
                </div>
            )}

            {error && (
              <p id="user-name-error" className="text-red-600 text-sm mb-4 -mt-2" role="alert">
                  {error}
              </p>
            )}

            <button
                type="submit"
                disabled={!name.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
                Start Session
            </button>
            {isAdminUser && (
                <div className="text-center mt-4">
                    <button type="button" onClick={onForgotPassword} className="text-sm text-blue-600 hover:underline">
                        Forgot Password?
                    </button>
                </div>
            )}
        </form>
      </div>
    </div>
  );
};

export default LoginModal;

import React, { useState } from 'react';

interface SetPasswordModalProps {
  userName: string;
  onSetPassword: (password: string, phoneNumber: string) => void;
  onCancel: () => void;
}

const SetPasswordModal: React.FC<SetPasswordModalProps> = ({ userName, onSetPassword, onCancel }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    onSetPassword(password, phoneNumber.trim());
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 z-50 flex justify-center items-center font-sans">
      <div className="bg-white rounded-lg shadow-2xl p-8 m-4 max-w-md w-full">
        <h2 className="text-2xl font-bold mb-2 text-gray-900">Admin Account Setup</h2>
        <p className="text-gray-600 mb-6">Welcome, {userName}. To secure your admin account, please create a password. Adding a phone number is optional but required for password recovery.</p>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="password-set" className="block text-sm font-medium text-gray-700">New Password</label>
              <input
                id="password-set"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="password-confirm" className="block text-sm font-medium text-gray-700">Confirm Password</label>
              <input
                id="password-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label htmlFor="phone-number" className="block text-sm font-medium text-gray-700">Phone Number (for recovery)</label>
              <input
                id="phone-number"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1234567890"
                className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          {error && <p className="text-red-600 text-sm mt-4">{error}</p>}
          <div className="flex justify-end space-x-4 mt-6">
            <button
                type="button"
                onClick={onCancel}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg transition-colors"
            >
                Logout
            </button>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow"
            >
              Set Password & Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SetPasswordModal;

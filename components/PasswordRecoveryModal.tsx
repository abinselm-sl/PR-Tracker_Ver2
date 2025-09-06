import React, { useState } from 'react';

interface PasswordRecoveryModalProps {
  onRecover: (userName: string, phoneNumber: string) => void;
  onClose: () => void;
}

const PasswordRecoveryModal: React.FC<PasswordRecoveryModalProps> = ({ onRecover, onClose }) => {
  const [userName, setUserName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [step, setStep] = useState(1);

  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userName.trim()) {
      setStep(2);
    }
  };

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneNumber.trim()) {
        onRecover(userName.trim(), phoneNumber.trim());
    }
  };
  
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 z-50 flex justify-center items-center font-sans">
      <div className="bg-white rounded-lg shadow-2xl p-8 m-4 max-w-sm w-full">
        <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Password Recovery</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl leading-none">&times;</button>
        </div>
        
        {step === 1 && (
            <form onSubmit={handleUserSubmit}>
                <p className="text-gray-600 mb-6">Enter your admin username to begin.</p>
                <label htmlFor="recovery-username" className="sr-only">Admin Username</label>
                <input
                    id="recovery-username"
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Your admin username"
                    className="w-full px-4 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                    autoFocus
                />
                <button
                    type="submit"
                    disabled={!userName.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow disabled:bg-blue-300"
                >
                    Next
                </button>
            </form>
        )}

        {step === 2 && (
            <form onSubmit={handlePhoneSubmit}>
                <p className="text-gray-600 mb-6">Enter the phone number associated with the account <span className="font-bold">{userName}</span> to receive your password via WhatsApp.</p>
                 <label htmlFor="recovery-phone" className="sr-only">Phone Number</label>
                <input
                    id="recovery-phone"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Your phone number"
                    className="w-full px-4 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                    autoFocus
                />
                <button
                    type="submit"
                    disabled={!phoneNumber.trim()}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow disabled:bg-green-300"
                >
                    Send Password
                </button>
            </form>
        )}
      </div>
    </div>
  );
};

export default PasswordRecoveryModal;

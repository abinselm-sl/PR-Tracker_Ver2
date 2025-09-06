import React, { useState } from 'react';

interface SuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (note: string) => void;
}

const SuggestionModal: React.FC<SuggestionModalProps> = ({ isOpen, onClose, onSend }) => {
  const [note, setNote] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (note.trim()) {
        onSend(note.trim());
        setNote('');
        // onClose is called by the parent after successful send
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" aria-modal="true" role="dialog">
      <div className="bg-white rounded-lg shadow-2xl p-6 m-4 max-w-lg w-full">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Suggest a Change</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl leading-none">&times;</button>
        </div>
        <p className="text-gray-600 mb-4">Your suggestion will open in your default email client to be sent to the administrators for review. It will also be logged in the system. Please be as detailed as possible.</p>
        <form onSubmit={handleSubmit}>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={6}
            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Describe the change needed, e.g., 'For PR-123, item XYZ, please update received quantity to 50.'"
            autoFocus
          />
          <div className="flex justify-end mt-4">
            <button
              type="submit"
              disabled={!note.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow disabled:bg-blue-300"
            >
              Send Suggestion
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SuggestionModal;
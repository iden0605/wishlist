import React, { useState } from 'react';

interface PasswordGateProps {
  onLogin: () => void;
}

const PasswordGate: React.FC<PasswordGateProps> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === import.meta.env.VITE_APP_PASSWORD) {
      onLogin();
    } else {
      setError('Incorrect password. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-xl max-w-sm w-full border-4 border-stone-200 transform scale-95 animate-pop-in">
        <h2 className="text-2xl sm:text-3xl font-semibold text-center text-blue-700 mb-3 sm:mb-4 text-shadow-md">Hello, Beloved Jocelyn! 💕</h2>
        <p className="text-stone-700 text-center mb-4 sm:mb-6 text-base sm:text-lg">Uncover the magic with your secret word!</p>
        <form onSubmit={handleSubmit}>
          <div className="mb-4 sm:mb-6">
            <label htmlFor="password" className="block text-stone-700 text-sm sm:text-md font-medium mb-1 sm:mb-2 text-shadow-sm">
              Secret Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="p-3 sm:p-4 rounded-xl border-2 border-stone-300 w-full focus:outline-none focus:ring-4 focus:ring-blue-300 shadow-md text-stone-700 placeholder-stone-400 text-base sm:text-lg"
              placeholder="Shhh... it's a secret!"
            />
          </div>
          {error && <p className="text-red-700 font-semibold text-center mb-3 sm:mb-4 bg-red-200 p-2 sm:p-3 rounded-lg border-2 border-red-500 animate-bounce animate-wiggle text-shadow-sm text-sm">{error}</p>}
          <div className="flex items-center justify-center">
            <button
              type="submit"
              className="bg-blue-300 hover:bg-blue-400 text-white font-semibold py-2 sm:py-3 px-6 sm:px-8 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300 text-base sm:text-lg text-shadow-sm"
            >
              Unlock Wishes! 🔑
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PasswordGate;
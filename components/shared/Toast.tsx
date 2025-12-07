import React from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
}

export const Toast: React.FC<ToastProps> = ({ message, type }) => {
  const baseClasses = "fixed top-5 right-5 z-[100] px-6 py-3 rounded-lg shadow-lg text-white animate-toast-fade-in-out";
  const typeClasses = type === 'success' ? 'bg-green-600' : 'bg-red-600';

  return (
    <div className={`${baseClasses} ${typeClasses}`}>
      <span className="font-semibold">{message}</span>
    </div>
  );
};
import { useContext } from 'react';
import { AppAuthContext } from './auth-context-type';

export const useAppAuth = () => {
  const context = useContext(AppAuthContext);
  if (!context) {
    throw new Error('useAppAuth must be used within AppAuthProvider');
  }
  return context;
};
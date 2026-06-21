import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setToken } from '../services/api';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (token) {
      setToken(token);
    }
    navigate('/', { replace: true });
  }, [navigate]);

  return null;
}

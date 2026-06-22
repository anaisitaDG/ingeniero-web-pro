import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setToken } from '../services/api';

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch { return null; }
}

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (token) {
      setToken(token);
      const payload = parseJwt(token);
      if (payload?.role === 'trainer') {
        navigate('/trainer', { replace: true });
        return;
      }
    }
    navigate('/', { replace: true });
  }, [navigate]);

  return null;
}

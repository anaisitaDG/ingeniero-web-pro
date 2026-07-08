import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

const VAPID_KEY = 'BMyXu344UMSX0IoqheXZQnVnk9LC5bSMUVYza66Ht5jrY_LpeSe3y5b3npONMOM33uI-Rsg7z5XJBza4CHbwD6s';
const APP_KEY  = urlBase64ToUint8Array(VAPID_KEY);

export function usePushNotifications() {
  const [permission, setPermission] = useState(() => {
    try { return Notification.permission; } catch { return 'default'; }
  });
  const [subscribed, setSubscribed]  = useState(false);
  const [loading, setLoading]        = useState(false);
  const swReg = useRef(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    navigator.serviceWorker.ready.then(reg => {
      swReg.current = reg;
      reg.pushManager.getSubscription().then(sub => setSubscribed(!!sub));
    });
  }, []);

  async function subscribe() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Abre la app desde el ícono en tu pantalla de inicio para activar notificaciones.');
      return;
    }
    setLoading(true);
    try {
      // iOS: requestPermission debe ser la primera operación async desde el gesto
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        alert('Permiso denegado. Ve a Ajustes > Notificaciones > Lovic y actívalas.');
        return;
      }

      const reg = swReg.current || await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: APP_KEY,
      });
      await api.push.subscribe(sub.toJSON());
      setSubscribed(true);
    } catch (e) {
      console.error('[push] error', e);
      alert('Error: ' + (e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe() {
    setLoading(true);
    try {
      const reg = swReg.current || await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.push.unsubscribe(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setLoading(false);
    }
  }

  const supported = typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  return { supported, permission, subscribed, loading, subscribe, unsubscribe };
}

import { useState, useEffect } from 'react';
import { api } from '../services/api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// VAPID key hardcoded to avoid async delay before requestPermission (iOS requirement)
const VAPID_PUBLIC_KEY = 'BMyXu344UMSX0IoqheXZQnVnk9LC5bSMUVYza66Ht5jrY_LpeSe3y5b3npONMOM33uI-Rsg7z5XJBza4CHbwD6s';

export function usePushNotifications() {
  const [permission, setPermission] = useState(Notification.permission);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const swRef = useState(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    navigator.serviceWorker.ready.then(reg => {
      swRef[1](reg);
      reg.pushManager.getSubscription().then(sub => setSubscribed(!!sub));
    });
  }, []); // eslint-disable-line

  async function subscribe() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Abre la app desde el ícono en tu pantalla de inicio para activar notificaciones.');
      return;
    }
    setLoading(true);
    try {
      // On iOS, requestPermission must be called synchronously from user gesture
      // and the entire chain must complete without slow async gaps
      const reg = swRef[0] || await navigator.serviceWorker.ready;
      const appKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        alert('Permiso denegado. Ve a Ajustes > Notificaciones > Lovic y actívalas.');
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appKey,
      });
      await api.push.subscribe(sub.toJSON());
      setSubscribed(true);
    } catch (e) {
      console.error('[push] subscribe error', e);
      alert('Error activando notificaciones: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe() {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
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

  const supported = 'serviceWorker' in navigator && 'PushManager' in window;
  return { supported, permission, subscribed, loading, subscribe, unsubscribe };
}

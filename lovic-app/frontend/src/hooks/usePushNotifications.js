import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// Marca en el dispositivo con qué llave VAPID se suscribió, para detectar cuando
// el servidor rota la llave y renovar la suscripción automáticamente.
const KEY_MARK = 'push_vapid_key';

export function usePushNotifications() {
  const [permission, setPermission] = useState(() => {
    try { return Notification.permission; } catch { return 'default'; }
  });
  const [subscribed, setSubscribed]  = useState(false);
  const [loading, setLoading]        = useState(false);
  const swReg = useRef(null);
  const keyRef = useRef(null);

  async function getKey() {
    if (keyRef.current) return keyRef.current;
    const { publicKey } = await api.push.vapidKey();
    keyRef.current = publicKey;
    return publicKey;
  }

  async function doSubscribe(reg, key) {
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
    await api.push.subscribe(sub.toJSON());
    localStorage.setItem(KEY_MARK, key);
    return sub;
  }

  // Al abrir la app: si la suscripción está vieja (o el servidor cambió la llave),
  // se renueva sola en silencio. La usuaria no tiene que hacer nada.
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        swReg.current = reg;
        const sub = await reg.pushManager.getSubscription();

        // Solo auto-renovar si la usuaria ya había dado permiso antes
        if (Notification.permission !== 'granted') { setSubscribed(!!sub); return; }

        const key = await getKey();
        const savedKey = localStorage.getItem(KEY_MARK);
        const stale = !sub || savedKey !== key;

        if (stale) {
          if (sub) { try { await sub.unsubscribe(); } catch { /* ignore */ } }
          await doSubscribe(reg, key);
          setSubscribed(true);
        } else {
          setSubscribed(true);
          api.push.subscribe(sub.toJSON()).catch(() => {}); // re-sincroniza por si acaso
        }
      } catch { /* silencioso: no molestar a la usuaria */ }
    })();
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
      const key = await getKey();
      // Limpia cualquier suscripción previa (posiblemente con llave vieja) antes de crear la nueva
      const old = await reg.pushManager.getSubscription();
      if (old) { try { await old.unsubscribe(); } catch { /* ignore */ } }
      await doSubscribe(reg, key);
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
      localStorage.removeItem(KEY_MARK);
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

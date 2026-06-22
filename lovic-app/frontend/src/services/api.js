const BASE = process.env.REACT_APP_API_URL || '';

function getToken() {
  return localStorage.getItem('lovic_token');
}

export function setToken(token) {
  localStorage.setItem('lovic_token', token);
}

export function clearToken() {
  localStorage.removeItem('lovic_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    return;
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error del servidor');
  return data;
}

// Auth
export const api = {
  auth: {
    me:        ()     => request('/auth/me'),
    magicLink: (email)=> request('/auth/magic-link', { method: 'POST', body: JSON.stringify({ email }) }),
  },
  dashboard: {
    get:         ()      => request('/dashboard'),
    postTracking:(body)  => request('/dashboard/tracking', { method: 'POST', body: JSON.stringify(body) }),
  },
  food: {
    log:    (input_text, meal_type) => request('/food/log', { method: 'POST', body: JSON.stringify({ input_text, meal_type, date: new Date().toLocaleDateString('en-CA') }) }),
    today:  ()           => request(`/food/today?date=${new Date().toLocaleDateString('en-CA')}`),
    history:(days = 7)   => request(`/food/history?days=${days}`),
    remove: (id)         => request(`/food/log/${id}`, { method: 'DELETE' }),
  },
  measurements: {
    list: (limit = 10) => request(`/measurements?limit=${limit}`),
    add:  (body)       => request('/measurements', { method: 'POST', body: JSON.stringify(body) }),
  },
  bioimpedance: {
    list:   (userId)  => request(`/bioimpedance${userId ? `?user_id=${userId}` : ''}`),
    upload: (formData, userId) => {
      const token = getToken();
      return fetch(`${BASE}/bioimpedance/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      }).then(r => r.json());
    },
  },
  questionnaire: {
    save: (data) => request('/questionnaire', { method: 'POST', body: JSON.stringify(data) }),
  },
  profile: {
    update: (data) => request('/profile', { method: 'PUT', body: JSON.stringify(data) }),
  },
  progressPhotos: {
    list:   ()         => request('/progress-photos'),
    remove: (id)       => request(`/progress-photos/${id}`, { method: 'DELETE' }),
    upload: (formData) => {
      const token = getToken();
      return fetch(`${BASE}/progress-photos/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      }).then(r => r.json());
    },
  },
  trainer: {
    clients:       ()     => request('/trainer/clients'),
    client:        (id)   => request(`/trainer/clients/${id}`),
    genRoutine:    (id, override_prompt) => request(`/trainer/clients/${id}/routine`, { method: 'POST', body: JSON.stringify({ override_prompt }) }),
    genNutrition:  (id, override_prompt) => request(`/trainer/clients/${id}/nutrition`, { method: 'POST', body: JSON.stringify({ override_prompt }) }),
    invite:        (id)   => request(`/trainer/clients/${id}/invite`, { method: 'POST' }),
    setTargets:    (id, body) => request(`/trainer/clients/${id}/targets`, { method: 'PUT', body: JSON.stringify(body) }),
  },
};

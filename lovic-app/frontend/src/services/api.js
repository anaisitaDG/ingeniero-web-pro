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
    cache: 'no-store',
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

  let data;
  try { data = await res.json(); } catch { throw new Error(`Error del servidor (${res.status})`); }
  if (!res.ok) throw new Error(data.error || 'Error del servidor');
  return data;
}

// Auth
export const api = {
  auth: {
    me:          ()                   => request('/auth/me'),
    magicLink:   (email)              => request('/auth/magic-link', { method: 'POST', body: JSON.stringify({ email }) }),
    login:       (email, password)    => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    setPassword: (password)           => request('/auth/set-password', { method: 'POST', body: JSON.stringify({ password }) }),
  },
  dashboard: {
    get:         ()      => request(`/dashboard?date=${new Date().toLocaleDateString('en-CA')}`),
    postTracking:(body)  => request('/dashboard/tracking', { method: 'POST', body: JSON.stringify({ ...body, date: new Date().toLocaleDateString('en-CA') }) }),
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
    delete: (bioId) => request(`/bioimpedance/${bioId}`, { method: 'DELETE' }),
  },
  questionnaire: {
    save: (data) => request('/questionnaire', { method: 'POST', body: JSON.stringify(data) }),
  },
  profile: {
    update: (data) => request('/profile', { method: 'PUT', body: JSON.stringify(data) }),
  },
  progressPhotos: {
    list:           ()         => request('/progress-photos'),
    removeRegister: (id)       => request(`/progress-photos/register/${id}`, { method: 'DELETE' }),
    uploadRegister: (formData) => {
      const token = getToken();
      return fetch(`${BASE}/progress-photos/register`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      }).then(r => r.json());
    },
    uploadRegisterForClient: (formData) => {
      const token = getToken();
      return fetch(`${BASE}/progress-photos/register`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      }).then(r => r.json());
    },
    // legacy
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
  workout: {
    plan:      ()                    => request('/workout/plan'),
    log:       (exercise_id, logged_date, sets) => request('/workout/log', { method: 'POST', body: JSON.stringify({ exercise_id, logged_date, sets }) }),
    history:   (exerciseId)         => request(`/workout/history/${exerciseId}`),
    complete:       ()              => request('/workout/complete', { method: 'POST', body: JSON.stringify({ date: new Date().toLocaleDateString('en-CA') }) }),
    todayDone:      ()              => request(`/workout/today-done?date=${new Date().toLocaleDateString('en-CA')}`),
    completedDays:  ()              => request(`/workout/completed-days`),
    completeDay:    (day_id, done, date)  => request('/workout/complete-day', { method: 'POST', body: JSON.stringify({ day_id, done, date: date || new Date().toLocaleDateString('en-CA') }) }),
    saveActivity:   (day_id, type, activity_name, duration_mins) => request('/workout/activity', { method: 'POST', body: JSON.stringify({ day_id, type, activity_name, duration_mins, date: new Date().toLocaleDateString('en-CA') }) }),
    getActivity:    (dayId) => request(`/workout/activity/${dayId}`),
    saveFree:       (exercises, note, date) => request('/workout/free', { method: 'POST', body: JSON.stringify({ exercises, note, date }) }),
    getFree:        () => request('/workout/free'),
  },
  push: {
    vapidKey:      ()                       => request('/push/vapid-public-key'),
    subscribe:     (s)                      => request('/profile/push-subscribe',  { method: 'POST',   body: JSON.stringify({ subscription: s }) }),
    unsubscribe:   (e)                      => request('/profile/push-subscribe',  { method: 'DELETE', body: JSON.stringify({ endpoint: e }) }),
    sendToClient:  (user_id, title, body)   => request('/trainer/push-reminder', { method: 'POST', body: JSON.stringify({ user_id, title, body }) }),
  },
  mealPlan: {
    today:    ()                       => request('/meal-plan'),
    week:     ()                       => request('/meal-plan/week'),
    complete: (meal_type, date, done)  => request('/meal-plan/complete', { method: 'POST', body: JSON.stringify({ meal_type, date, done }) }),
  },
  trainer: {
    clients:       ()     => request('/trainer/clients'),
    client:        (id)   => request(`/trainer/clients/${id}`),
    genRoutine:    (id, override_prompt) => request(`/trainer/clients/${id}/routine`, { method: 'POST', body: JSON.stringify({ override_prompt }) }),
    genNutrition:  (id, override_prompt) => request(`/trainer/clients/${id}/nutrition`, { method: 'POST', body: JSON.stringify({ override_prompt }) }),
    saveRoutine:   (id, content) => request(`/trainer/clients/${id}/routine`, { method: 'PUT', body: JSON.stringify({ content }) }),
    saveNutrition: (id, content) => request(`/trainer/clients/${id}/nutrition`, { method: 'PUT', body: JSON.stringify({ content }) }),
    getWorkout:      (id)        => request(`/trainer/clients/${id}/workout`),
    saveWorkout:     (id, days, duration_days, start_date, plan_id)  => request(`/trainer/clients/${id}/workout`, { method: 'PUT', body: JSON.stringify({ days, duration_days, start_date, plan_id }) }),
    getBilling:      ()           => request('/trainer/billing'),
    saveBilling:     (clientId, body) => request(`/trainer/billing/${clientId}`, { method: 'PUT', body: JSON.stringify(body) }),
    suggestDayName:  (exercises) => request('/trainer/suggest-day-name', { method: 'POST', body: JSON.stringify({ exercises }) }),
    invite:        (id)   => request(`/trainer/clients/${id}/invite`, { method: 'POST' }),
    inviteNew:     (email, name) => request('/trainer/invite-new', { method: 'POST', body: JSON.stringify({ email, name }) }),
    setTargets:    (id, body) => request(`/trainer/clients/${id}/targets`, { method: 'PUT', body: JSON.stringify(body) }),
    getProgress:   (id) => request(`/trainer/clients/${id}/progress`),
    getAdherence:  (id) => request(`/trainer/clients/${id}/adherence-detail`),
    getWorkoutLogs:(id) => request(`/trainer/clients/${id}/workout-logs`),
    getNotes:      (id) => request(`/trainer/clients/${id}/notes`),
    saveNotes:     (id, notes) => request(`/trainer/clients/${id}/notes`, { method: 'PUT', body: JSON.stringify({ notes }) }),
    deleteClient:  (id)         => request(`/trainer/clients/${id}`, { method: 'DELETE' }),
    weeklySummary: ()           => request('/trainer/weekly-summary', { method: 'POST' }),
    getMealPlan:   (id)         => request(`/trainer/clients/${id}/meal-plan`),
    saveMealPlan:  (id, days)   => request(`/trainer/clients/${id}/meal-plan`, { method: 'PUT', body: JSON.stringify({ days }) }),
    getLibrary:    ()           => request('/trainer/library'),
    addLibrary:    (body)       => request('/trainer/library', { method: 'POST', body: JSON.stringify(body) }),
    updateLibrary: (id, body)   => request(`/trainer/library/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteLibrary: (id)         => request(`/trainer/library/${id}`, { method: 'DELETE' }),
    addVariation:  (exId, body) => request(`/trainer/library/${exId}/variations`, { method: 'POST', body: JSON.stringify(body) }),
    deleteVariation:(varId)     => request(`/trainer/library/variations/${varId}`, { method: 'DELETE' }),
  },
};

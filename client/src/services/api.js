const API_BASE = '/api';

function getToken() {
  return sessionStorage.getItem('cmo_token') || localStorage.getItem('cmo_token');
}

function getHeaders() {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = { headers: getHeaders(), ...options };
  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }
  if (config.body instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  const res = await fetch(url, config);
  if (res.status === 401) {
    sessionStorage.removeItem('cmo_token');
    sessionStorage.removeItem('cmo_user');
    localStorage.removeItem('cmo_token');
    localStorage.removeItem('cmo_user');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) return res.json();
  return res.blob();
}

export const api = {
  // Auth
  login: (data) => request('/auth/login', { method: 'POST', body: data }),
  register: (data) => request('/auth/register', { method: 'POST', body: data }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  getProfile: () => request('/auth/profile'),
  updateProfile: (data) => request('/auth/profile', { method: 'PUT', body: data }),

  // Dashboard
  getDashboard: () => request('/dashboard'),

  // B2B
  getB2B: () => request('/b2b'),

  // B2C
  getB2C: () => request('/b2c'),

  // Users
  getUsers: () => request('/users'),
  createUser: (data) => request('/users', { method: 'POST', body: data }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),

  // Reports
  getReport: (type) => request(`/reports?type=${type}`),
  downloadReport: (type) => request(`/reports/download?type=${type}`),

  // Settings
  getSystemParams: () => request('/settings/parameters'),
  getDatasets: () => request('/settings/datasets'),
  uploadExcel: (formData) => request('/settings/upload', { method: 'POST', body: formData }),
  appendToDataset: (datasetId, formData) => request(`/settings/datasets/${datasetId}/append`, { method: 'POST', body: formData }),
  getMappings: (id) => request(`/settings/mappings/${id}`),
  updateMapping: (id, data) => request(`/settings/mappings/${id}`, { method: 'PUT', body: data }),
  validateDataset: (id) => request(`/settings/validate/${id}`, { method: 'POST' }),
  downloadMapped: (id) => request(`/settings/download-mapped/${id}`),
  saveAndProceed: (id) => request(`/settings/save-proceed/${id}`, { method: 'POST' }),
  deleteDataset: (id) => request(`/settings/datasets/${id}`, { method: 'DELETE' }),
  saveApiIntegration: (data) => request('/settings/api-integration', { method: 'POST', body: data }),
  getApiIntegrations: () => request('/settings/api-integrations'),
  fetchApiIntegration: (id) => request(`/settings/api-integrations/${id}/fetch`, { method: 'POST' }),
};
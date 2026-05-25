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
const fetchExternalData = async () => {

  const url = 'https://pgapi.plumb5.in/cmo/GetTotalLeadsCount';

  const headers = {
    'Content-Type': 'application/json',
    'P5APIKEY': '056d9b3cb5e4b39b5e4512b5eb331b5e6371c81031b8',
    'P5AccountId': 4,
  };

  const body = JSON.stringify({
    startDate: '2000-05-20T12:57:53.766Z',
    endDate: '2026-05-20T12:57:53.766Z',
    userId: 1
  });

  let response;

  try {

    response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });

  } catch (fetchErr) {

    const code = fetchErr?.cause?.code || fetchErr.code || '';

    if (code === 'ECONNREFUSED') {
      throw new Error(
        `Cannot connect to external API at ${url}`
      );
    }

    throw new Error(
      `Network error reaching external API: ${fetchErr.message}`
    );
  }

  if (!response.ok) {

    const errorText = await response.text().catch(() => '');

    throw new Error(
      `External API returned HTTP ${response.status}: ${response.statusText}. ${errorText}`
    );
  }

  const resData = await response.json();

  // console.log('API RESPONSE:', resData);

  return resData;
};
const fetchExternalData1 = async () => {

  const url = 'https://pgapi.plumb5.in/cmo/GetAllCampaignDetailsCount';

  const headers = {
    'Content-Type': 'application/json',
    'P5APIKEY': '056d9b3cb5e4b39b5e4512b5eb331b5e6371c81031b8',
    'P5AccountId': 4,
  };

  const body = JSON.stringify({
    fromDateTime: '2020-01-01T12:57:53.766Z',
    toDateTime: '2026-05-20T12:57:53.766Z',
    mail: true,
    sms: true,
    whatsapp: true,
    rcs: true,
    contactFields: []
  });

  let response;

  try {

    response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });

  } catch (fetchErr) {

    const code = fetchErr?.cause?.code || fetchErr.code || '';

    if (code === 'ECONNREFUSED') {
      throw new Error(
        `Cannot connect to external API at ${url}`
      );
    }

    throw new Error(
      `Network error reaching external API: ${fetchErr.message}`
    );
  }

  if (!response.ok) {

    const errorText = await response.text().catch(() => '');

    throw new Error(
      `External API returned HTTP ${response.status}: ${response.statusText}. ${errorText}`
    );
  }

  const resData = await response.json();

  // console.log('API RESPONSE:', resData);

  return resData;
};
const fetchExternalData2 = async () => {

  const url = 'https://pgapi.plumb5.in/cmo/GetDashboardSummary';

  const headers = {
    'Content-Type': 'application/json',
    'P5APIKEY': '056d9b3cb5e4b39b5e4512b5eb331b5e6371c81031b8',
    'P5AccountId': 4,
  };

  const body = JSON.stringify({
    startDate: '2000-05-21T10:09:27.035Z',
    endDate: '2027-05-21T10:09:27.035Z',
    expStartDate: '2000-05-21T10:09:27.035Z',
    expEndDate: '2027-05-21T10:09:27.035Z',
    accountType: 0
  });

  let response;

  try {

    response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });

  } catch (fetchErr) {

    const code = fetchErr?.cause?.code || fetchErr.code || '';

    if (code === 'ECONNREFUSED') {
      throw new Error(
        `Cannot connect to external API at ${url}`
      );
    }

    throw new Error(
      `Network error reaching external API: ${fetchErr.message}`
    );
  }

  if (!response.ok) {

    const errorText = await response.text().catch(() => '');

    throw new Error(
      `External API returned HTTP ${response.status}: ${response.statusText}. ${errorText}`
    );
  }

  const resData = await response.json();

  // console.log('API RESPONSE:', resData);

  return resData;
};


// module.exports = { fetchExternalData };

export const api = {
  // Auth
  login: (data) => request('/auth/login', { method: 'POST', body: data }),
  register: (data) => request('/auth/register', { method: 'POST', body: data }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  getProfile: () => request('/auth/profile'),
  updateProfile: (data) => request('/auth/profile', { method: 'PUT', body: data }),

  // Dashboard (unified — returns dashboard + b2b/b2c combined)
  getDashboard: (channel, timePeriod) => {
    const params = new URLSearchParams();
    if (channel && channel !== 'all') params.set('channel', channel);
    if (timePeriod && timePeriod !== 'all') params.set('time_period', timePeriod);
    const qs = params.toString();
    return request(`/dashboard${qs ? '?' + qs : ''}`);
  },

  // B2B (kept for backward compat)
  getB2B: () => request('/b2b'),

  // B2C (kept for backward compat)
  getB2C: () => request('/b2c'),

  // Users
  getUsers: () => request('/users'),
  createUser: (data) => request('/users', { method: 'POST', body: data }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),

  // Reports
  getReport: (type, channel, timePeriod) => {
    const p = new URLSearchParams({ type });
    if (channel && channel !== 'all') p.set('channel', channel);
    if (timePeriod && timePeriod !== 'all') p.set('time_period', timePeriod);
    return request(`/reports?${p.toString()}`);
  },
  downloadReport: (type, channel, timePeriod, filename) => {
    const p = new URLSearchParams({ type });
    if (channel && channel !== 'all') p.set('channel', channel);
    if (timePeriod && timePeriod !== 'all') p.set('time_period', timePeriod);
    if (filename) p.set('filename', filename);
    return request(`/reports/download?${p.toString()}`);
  },

  // Settings
  getSystemParams: (dataType) => request(`/settings/parameters${dataType ? `?data_type=${dataType}` : ''}`),
  getDatasets: () => request('/settings/datasets'),
  uploadExcel: (formData) => request('/settings/upload', { method: 'POST', body: formData }),
  appendToDataset: (datasetId, formData) => request(`/settings/datasets/${datasetId}/append`, { method: 'POST', body: formData }),
  getMappings: (id) => request(`/settings/mappings/${id}`),
  updateMapping: (id, data) => request(`/settings/mappings/${id}`, { method: 'PUT', body: data }),
  updateDatasetType: (datasetId, dataType) => request(`/settings/datasets/${datasetId}/type`, { method: 'PUT', body: { data_type: dataType } }),
  validateDataset: (id) => request(`/settings/validate/${id}`, { method: 'POST' }),
  downloadMapped: (id) => request(`/settings/download-mapped/${id}`),
  saveAndProceed: (id) => request(`/settings/save-proceed/${id}`, { method: 'POST' }),
  deleteDataset: (id) => request(`/settings/datasets/${id}`, { method: 'DELETE' }),
  saveApiIntegration: (data) => request('/settings/api-integration', { method: 'POST', body: data }),
  getApiIntegrations: () => request('/settings/api-integrations'),
  fetchApiIntegration: (id, dataType) => request(`/settings/api-integrations/${id}/fetch`, { method: 'POST', body: { data_type: dataType } }),
  deleteApiIntegration: (id) => request(`/settings/api-integrations/${id}`, { method: 'DELETE' }),
  calculateCustomParam: (formula) => request('/settings/custom-param/calculate', { method: 'POST', body: { formula } }),
  saveCustomParam: (name, formula, result) => request('/settings/custom-param/save', { method: 'POST', body: { name, formula, result } }),

  // External API Integration — triggers backend to call external API and populate dashboard
  integrateApi: () => fetchExternalData(),
  integrateApi1: () => fetchExternalData1(),
  integrateApi2: () => fetchExternalData2(),
};

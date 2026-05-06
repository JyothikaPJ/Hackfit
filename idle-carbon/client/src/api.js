import axios from 'axios';

const API_BASE = 'http://localhost:4000/api/v1';

const api = axios.create({ baseURL: API_BASE });

// Attach token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auth
export const login = (email, password) => api.post('/auth/login', { email, password });
export const getMe = () => api.get('/auth/me');

// Dashboard
export const getEmployeeDashboard = () => api.get('/dashboard/employee');
export const getAdminDashboard = () => api.get('/dashboard/admin');

// Leaderboard
export const getLeaderboard = () => api.get('/leaderboard');

// Actions
export const getActions = (status) => api.get('/actions', { params: { status } });
export const approveAction = (id) => api.post(`/actions/approve/${id}`);
export const dismissAction = (id) => api.post(`/actions/dismiss/${id}`);

// Metrics
export const getIdleMetrics = (type, teamId) => api.get('/metrics/idle', { params: { type, teamId } });

// Baselines
export const updateBaseline = (teamId, baselineUsage) => api.put(`/baselines/${teamId}`, { baselineUsage });

// ─── Reports ─────────────────────────────────────────────────────────────────
// Manager: fetch aggregated optimization data to build a report
export const getOptimizationData = (period = 'today') =>
  api.get('/reports/optimizations', { params: { period } });

// Manager: submit a generated report to admin
export const submitReport = ({ period, managerComments, aiSummary, reportData }) =>
  api.post('/reports', { period, managerComments, aiSummary, reportData });

// Admin: list all submitted reports (optional filters: from, to, managerId)
export const getAdminReports = (filters = {}) =>
  api.get('/reports/admin', { params: filters });

// Admin: mark a report as reviewed
export const markReportReviewed = (reportId) =>
  api.patch(`/reports/${reportId}/status`, { status: 'reviewed' });

export default api;

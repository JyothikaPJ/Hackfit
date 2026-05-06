import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { createInitialRoomData, detectAllIdleRooms } from './idleDetector';
import { getIdleMetrics, getActions } from './api';
import LoginPage from './pages/LoginPage';
import ManagerDashboard from './pages/ManagerDashboard';
import LeaderboardPage from './pages/LeaderboardPage';
import AdminDashboard from './pages/AdminDashboard';
import OccupancyHeatmap from './pages/OccupancyHeatmap';
import ZombieMonitor from './pages/ZombieMonitor';
import OptimizationReport from './pages/OptimizationReport';
import AdminReports from './pages/AdminReports';
import ResourceManager from './pages/ResourceManager';
import AdminOptimizations from './pages/AdminOptimizations';
import AIChatPanel from './pages/AIChatPanel';
import EnergyTicker from './components/EnergyTicker';
import './index.css';

function AppContent() {
  const { user, logout, loading } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatRooms] = useState(() => detectAllIdleRooms(createInitialRoomData()));

  // ── Live metrics for the manager energy ticker ──────────────────────────
  const [tickerMetrics, setTickerMetrics]       = useState([]);
  const [tickerPendingCount, setTickerPending]  = useState(0);

  useEffect(() => {
    if (!user || user.role !== 'manager') return;
    const load = async () => {
      try {
        const [mRes, aRes] = await Promise.all([getIdleMetrics(), getActions()]);
        setTickerMetrics(mRes.data.data || []);
        setTickerPending((aRes.data.data || []).filter(a => a.status === 'pending').length);
      } catch (_) {}
    };
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [user]);

  if (loading) return <div className="loading-screen"><div className="spinner"></div><p>Loading...</p></div>;
  if (!user) return <LoginPage />;

  const navItems = [
    { to: '/manager',          label: '👔 Manager',        roles: ['manager']                       },
    { to: '/resources',        label: '🛡 Resources',       roles: ['manager']                       },
    { to: '/reports',          label: '📊 Opt. Reports',   roles: ['manager']                       },
    { to: '/leaderboard',      label: '⚡ Energy Progress', roles: ['employee', 'manager', 'admin']  },
    { to: '/heatmap',          label: '🏢 Heatmap',        roles: ['employee', 'manager', 'admin']  },
    { to: '/zombies',          label: '🧟 Zombies',         roles: ['employee', 'manager']          },
    { to: '/admin',            label: '⚙️ Admin',           roles: ['admin']                        },
    { to: '/admin/reports',    label: '📑 Reports',         roles: ['admin']                        },
    { to: '/admin/opt-control',label: '🔐 Opt. Control',   roles: ['admin']                        },
  ];

  const getDefaultRoute = () => {
    if (user.role === 'admin') return '/admin';
    if (user.role === 'manager') return '/manager';
    return '/heatmap';
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">🌿</span>
          <div>
            <h1>Idle Carbon</h1>
            <span className="brand-sub">Carbon Budget Monitor</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems
            .filter(item => item.roles.includes(user.role))
            .map(item => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                {item.label}
              </NavLink>
            ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{user.name.charAt(0)}</div>
            <div>
              <div className="user-name">{user.name}</div>
              <div className="user-role">{user.role} · {user.departmentName}</div>
            </div>
          </div>
          <button className="btn-logout" onClick={logout}>Sign Out</button>
        </div>
      </aside>

      {user.role === 'manager' && (
        <EnergyTicker metrics={tickerMetrics} pendingCount={tickerPendingCount} />
      )}
      <main className={`main-content${user.role === 'manager' ? ' has-ticker' : ''}`}>
        <Routes>
            <Route path="/manager"           element={user.role === 'manager' ? <ManagerDashboard />    : <Navigate to="/heatmap" />} />
            <Route path="/resources"          element={user.role === 'manager' ? <ResourceManager />     : <Navigate to="/heatmap" />} />
            <Route path="/reports"            element={user.role === 'manager' ? <OptimizationReport />  : <Navigate to="/heatmap" />} />
            <Route path="/leaderboard"        element={<LeaderboardPage />} />
            <Route path="/heatmap"            element={<OccupancyHeatmap />} />
            <Route path="/zombies"            element={user.role === 'admin' ? <Navigate to="/admin" /> : <ZombieMonitor />} />
            <Route path="/admin"              element={user.role === 'admin' ? <AdminDashboard />       : <Navigate to="/heatmap" />} />
            <Route path="/admin/reports"      element={user.role === 'admin' ? <AdminReports />         : <Navigate to="/heatmap" />} />
            <Route path="/admin/opt-control"  element={user.role === 'admin' ? <AdminOptimizations />  : <Navigate to="/heatmap" />} />
            <Route path="*" element={<Navigate to={getDefaultRoute()} />} />
          </Routes>
      </main>

      {/* Global AI Chatbot — visible on every page */}
      <AIChatPanel rooms={chatRooms} isOpen={chatOpen} onClose={() => setChatOpen(false)} />
      {!chatOpen && (
        <button className="chat-fab" onClick={() => setChatOpen(true)}>
          🤖
        </button>
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import InfoCenter from './InfoCenter';

const NAV_MAIN = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/b2b', label: 'B2B', icon: '🏢' },
  { path: '/b2c', label: 'B2C', icon: '🛒' },
];
const NAV_MGMT = [
  { path: '/users', label: 'Users', icon: '👥', restricted: true },
  { path: '/report', label: 'Report', icon: '📄', restricted: true },
  { path: '/account', label: 'Account', icon: '🔐', restricted: true },
  { path: '/settings', label: 'Settings', icon: '⚙️', restricted: true },
  { path: '/info', label: 'Info', icon: 'ℹ️' },
];

export default function Layout() {
  const { user, logout, hasAccess } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

  return (
    <div className="app-layout">
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">C</div>
          <span className="sidebar-title">CMO Centre</span>
        </div>
        <button className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)}>{collapsed ? '→' : '←'}</button>
        <nav className="nav-section">
          <div className="nav-section-title">Main</div>
          <ul className="nav-items">
            {NAV_MAIN.map(item => (
              <NavLink key={item.path} to={item.path} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </NavLink>
            ))}
          </ul>
        </nav>
        <nav className="nav-section">
          <div className="nav-section-title">Management</div>
          <ul className="nav-items">
            {NAV_MGMT.map(item => (
              <NavLink key={item.path} to={item.path}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${item.restricted && !hasAccess(item.path.slice(1)) ? 'disabled' : ''}`}
                onClick={(e) => { if (item.restricted && !hasAccess(item.path.slice(1))) { e.preventDefault(); } else { setMobileOpen(false); } }}>
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </NavLink>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button className="theme-toggle" onClick={() => setMobileOpen(!mobileOpen)} style={{ display: 'none' }} id="mobile-menu">☰</button>
            <h1 className="topbar-title">Command Centre</h1>
          </div>
          <div className="topbar-right">
            <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <div style={{ position: 'relative' }}>
              <button className="profile-btn" onClick={() => setProfileOpen(!profileOpen)}>
                <div className="profile-avatar">{initials}</div>
                <span className="profile-name">{user?.name}</span>
                <span style={{ fontSize: '10px' }}>▼</span>
              </button>
              {profileOpen && (
                <div className="profile-dropdown">
                  <div className="profile-dropdown-header">
                    <div className="profile-dropdown-name">{user?.name}</div>
                    <div className="profile-dropdown-email">{user?.email}</div>
                  </div>
                  <button className="profile-dropdown-item" onClick={() => { navigate('/profile'); setProfileOpen(false); }}>
                    👤 Profile
                  </button>
                  <button className="profile-dropdown-item danger" onClick={handleLogout}>
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main><Outlet /></main>
      </div>
      {showInfo && <InfoCenter onClose={() => setShowInfo(false)} />}
    </div>
  );
}

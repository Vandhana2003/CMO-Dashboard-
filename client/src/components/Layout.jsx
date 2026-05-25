import React, { useState } from 'react';   
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; 
import { useTheme } from '../context/ThemeContext';
import InfoCenter from './InfoCenter';
import 'bootstrap-icons/font/bootstrap-icons.css';   
 
const NAV_MAIN = [
  { path: '/dashboard', label: 'Dashboard', icon: <i className="bi bi-grid-1x2-fill"></i> },
];  
const NAV_MGMT = [
  { path: '/users', label: 'Users', icon: <i className="bi bi-people-fill"></i>, restricted: true },
  { path: '/report', label: 'Report', icon: <i className="bi bi-file-earmark-text-fill"></i>, restricted: true },
  // { path: '/account', label: 'Account', icon: <i className="bi bi-person-badge-fill"></i>, restricted: true },
  { path: '/settings', label: 'Settings', icon: <i className="bi bi-gear-fill"></i>, restricted: true },
  { path: '/info', label: 'Info', icon: <i className="bi bi-info-circle-fill"></i> }, 
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
        {/* <div className="sidebar-header">
          <div className="sidebar-logo">C</div>
          <span className="sidebar-title">CMO</span>
        </div> */}

        <div className="sidebar-header">

          <div className="sidebar-brand">

            {/* Full Logo */}
            <img
              src="https://plumb5.com/assets/img/logo.png"
              alt="Plumb5 Logo"
              className="sidebar-logo-img full-logo"
            />

            {/* Small Logo for Collapse */}
            <div className="sidebar-mini-logo">
              P
            </div>

          </div>

        </div>
        <button
          className="sidebar-toggle"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? '›' : '‹'}
        </button>        <nav className="nav-section">
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
            {/* <h1 className="topbar-title">Command Centre</h1> */}
          </div>
          <div className="topbar-right">
            <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
              {theme === 'dark' ? <i className="bi bi-sun-fill"></i> : <i className="bi bi-moon-stars-fill"></i>}
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
                    <i className="bi bi-person-circle"></i> Profile
                  </button>
                  <button className="profile-dropdown-item danger" onClick={handleLogout}>
                    <i className="bi bi-box-arrow-right"></i> Logout
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

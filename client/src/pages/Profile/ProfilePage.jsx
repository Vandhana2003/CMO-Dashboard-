import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.updateProfile({ name });
      updateUser(res.user);
      setToast('Profile updated!');
      setTimeout(() => setToast(''), 3000);
    } catch (e) { setToast('Failed to update.'); }
    setSaving(false);
  };

  return (
    <div className="page">
      <div className="page-header"><h1 className="page-title">Profile</h1><p className="page-subtitle">Your account details</p></div>
      <div className="chart-card" style={{ maxWidth: 500 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
          <div className="profile-avatar" style={{ width: 72, height: 72, fontSize: 28 }}>
            {user?.profile_pic ? <img src={user.profile_pic} alt="" /> : user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{user?.name}</div>
            <span className={`badge badge-${user?.role === 'super_admin' ? 'super' : user?.role === 'admin' ? 'admin' : 'user'}`}>
              {user?.role?.replace('_', ' ').toUpperCase()}
            </span>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Name (editable)</label>
          <input className="form-input" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" value={user?.email || ''} disabled style={{ opacity: 0.6 }} />
        </div>
        <div className="form-group">
          <label className="form-label">Phone</label>
          <input className="form-input" value={user?.phone || 'Not set'} disabled style={{ opacity: 0.6 }} />
        </div>
        <div className="form-group">
          <label className="form-label">Password</label>
          <div className="password-wrapper">
            <input className="form-input" type={showPassword ? 'text' : 'password'} value="••••••••" disabled style={{ opacity: 0.6 }} />
            <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>{showPassword ? '🙈' : '👁️'}</button>
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : '💾 Save Changes'}</button>
      </div>
      {toast && <div className="toast toast-success">{toast}</div>}
    </div>
  );
}

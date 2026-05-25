import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetched = useRef(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'user' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    api.getUsers().then(res => { setUsers(res.users); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const validate = () => {
    if (!form.name.trim()) return 'Name is required.';
    if (!form.email.trim() || !form.email.includes('@')) return 'Valid email is required.';
    if (form.password.length < 6) return 'Password must be at least 6 characters.';
    if (!form.phone.trim()) return 'Phone number is required.';
    return null;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    try {
      await api.createUser(form);
      setSuccess('User created successfully!');
      setForm({ name: '', email: '', password: '', phone: '', role: 'user' });
      api.getUsers().then(res => setUsers(res.users));
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.message || 'Failed to create user.');
    }
    setSaving(false);
  };

  const roleBadge = (role) => {
    const map = { super_admin: { cls: 'badge-super', text: 'Super Admin' }, admin: { cls: 'badge-admin', text: 'Admin' }, user: { cls: 'badge-user', text: 'User' } };
    const r = map[role] || map.user;
    return <span className={`badge ${r.cls}`}>{r.text}</span>;
  };

  if (loading) return <div className="page"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header header-flex">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">All registered users</p>
        </div>
        <button className="btn-add-user" onClick={() => setShowForm(!showForm)}>
          {showForm ? <><i className="bi bi-x-lg"></i> Cancel</> : <><i className="bi bi-plus-lg"></i> Add User</>}
        </button>
      </div>

      {showForm && <div className="drawer-overlay" onClick={() => setShowForm(false)}></div>}

      <div className={`side-drawer ${showForm ? 'open' : ''}`}>
        <div className="drawer-header">
          <h2 className="drawer-title">New User</h2>
          <button className="drawer-close" onClick={() => setShowForm(false)}><i className="bi bi-x-lg"></i></button>
        </div>

        <div className="drawer-body">
          {error && <div className="login-error">{error}</div>}
          {success && <div style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--success)', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{success}</div>}

          <form onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input className="form-input" placeholder="Full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" placeholder="user@company.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" placeholder="Minimum 6 characters" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input className="form-input" type="tel" placeholder="+1 234 567 890" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="super_admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-primary" type="submit" disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
                {saving ? 'Saving...' : <><i className="bi bi-check-lg"></i> Save User</>}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setShowForm(false)} style={{ flex: 1, justifyContent: 'center' }}>
                <i className="bi bi-x-lg"></i> Cancel
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Joined</th><th>Action</th></tr></thead>

          <tbody>
            {users.map((u) => (
              <tr key={u.id}>

                {/* NAME */}
                <td>
                  <div className="user-info">

                    <div className="user-avatar">
                      {u.name?.charAt(0).toUpperCase()}
                    </div>

                    <div className="user-details">

                      <div className="user-name">
                        {u.name}
                      </div>

                      <div className="user-role-text">
                        {u.role.replace('_', ' ')}
                      </div>

                    </div>

                  </div>
                </td>

                {/* EMAIL */}
                <td>
                  <span className="user-email">
                    {u.email}
                  </span>
                </td>

                {/* PHONE */}
                <td>
                  <span className="user-phone">
                    {u.phone || '—'}
                  </span>
                </td>

                {/* ROLE */}
                <td>
                  {roleBadge(u.role)}
                </td>

                {/* JOINED DATE */}
                <td style={{ color: 'var(--text-muted)' }}>
                  {new Date(u.created_at).toLocaleDateString()}
                </td>

                {/* ACTIONS */}
                <td>
                  <div className="table-actions">

                    {/* EDIT */}
                    <button
                      className="action-btn edit-btn"
                      title="Edit User"
                    >
                      <i className="bi bi-pencil-square"></i>
                    </button>

                    {/* DELETE */}
                    <button
                      className="action-btn delete-btn"
                      title="Delete User"
                    >
                      <i className="bi bi-trash-fill"></i>
                    </button>

                  </div>
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

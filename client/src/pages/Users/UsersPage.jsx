import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    api.getUsers().then(res => { setUsers(res.users); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const roleBadge = (role) => {
    const map = { super_admin: { cls: 'badge-super', text: 'Super Admin' }, admin: { cls: 'badge-admin', text: 'Admin' }, user: { cls: 'badge-user', text: 'User' } };
    const r = map[role] || map.user;
    return <span className={`badge ${r.cls}`}>{r.text}</span>;
  };

  if (loading) return <div className="page"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header"><h1 className="page-title">Users</h1><p className="page-subtitle">All registered users</p></div>
      <div className="table-container">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Joined</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: 500 }}>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.phone || '—'}</td>
                <td>{roleBadge(u.role)}</td>
                <td style={{ color: 'var(--text-muted)' }}>{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

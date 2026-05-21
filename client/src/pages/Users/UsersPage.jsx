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
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </button>

                    {/* DELETE */}
                    <button
                      className="action-btn delete-btn"
                      title="Delete User"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18" />
                        <path d="M8 6V4h8v2" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                      </svg>
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

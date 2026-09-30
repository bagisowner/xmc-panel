// Component: AdminUsers
import React, { useState } from 'react';
import { Plus, Search, Edit2, Trash2, Mail, Shield, User, KeyRound, Check, X, AlertCircle } from 'lucide-react';

interface AdminUsersProps {
  usersList: any[];
  setShowCreateUserModal?: (val: boolean) => void;
  token?: string | null;
  currentUser?: any;
  onRefreshUsers?: () => void;
  showToast?: (type: 'success' | 'error' | 'info' | 'warn', message: string) => void;
}

export const AdminUsers: React.FC<AdminUsersProps> = ({
  usersList,
  setShowCreateUserModal,
  token,
  currentUser,
  onRefreshUsers,
  showToast
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Create Form State
  const [createForm, setCreateForm] = useState({
    username: '',
    email: '',
    displayName: '',
    password: '',
    role: 'User',
    disabled: false
  });

  // Edit Form State
  const [editForm, setEditForm] = useState({
    username: '',
    email: '',
    displayName: '',
    password: '',
    role: 'User',
    disabled: false,
    emailVerified: true
  });

  const handleOpenEdit = (user: any) => {
    setEditingUser(user);
    setEditForm({
      username: user.username || '',
      email: user.email || '',
      displayName: user.displayName || user.username || '',
      password: '',
      role: user.role || 'User',
      disabled: !!user.disabled,
      emailVerified: user.emailVerified !== false
    });
    setFormError('');
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!createForm.username.trim() || !createForm.email.trim() || !createForm.password.trim()) {
      setFormError('Username, email address, and password are all required.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(createForm.email.trim())) {
      setFormError('Please enter a valid email address (e.g. user@domain.com).');
      return;
    }

    if (createForm.password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify(createForm)
      });

      const data = await res.json();
      if (res.ok) {
        setIsCreateOpen(false);
        setCreateForm({
          username: '',
          email: '',
          displayName: '',
          password: '',
          role: 'User',
          disabled: false
        });
        if (showToast) showToast('success', `User account "${data.username}" (${data.email}) created successfully.`);
        if (onRefreshUsers) onRefreshUsers();
      } else {
        setFormError(data.error || 'Failed to create user account.');
      }
    } catch {
      setFormError('Connection error while creating user account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setFormError('');

    if (!editForm.username.trim() || !editForm.email.trim()) {
      setFormError('Username and email address are required.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editForm.email.trim())) {
      setFormError('Please enter a valid email address.');
      return;
    }

    if (editForm.password && editForm.password.length < 6) {
      setFormError('New password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        username: editForm.username.trim(),
        email: editForm.email.trim(),
        displayName: editForm.displayName.trim() || editForm.username.trim(),
        role: editForm.role,
        disabled: editForm.disabled,
        emailVerified: editForm.emailVerified
      };
      if (editForm.password && editForm.password.trim().length > 0) {
        payload.password = editForm.password.trim();
      }

      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        setEditingUser(null);
        if (showToast) showToast('success', `User "${data.username}" updated successfully.`);
        if (onRefreshUsers) onRefreshUsers();
      } else {
        setFormError(data.error || 'Failed to update user account.');
      }
    } catch {
      setFormError('Connection error while updating user account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (user: any) => {
    if (currentUser?.id === user.id) {
      if (showToast) showToast('error', 'You cannot delete your own active administrator account.');
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently delete user account "${user.username}" (${user.email || 'No email'})?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        credentials: 'include'
      });
      if (res.ok) {
        if (showToast) showToast('info', `User account "${user.username}" was deleted.`);
        if (onRefreshUsers) onRefreshUsers();
      } else {
        const data = await res.json();
        if (showToast) showToast('error', data.error || 'Failed to delete user.');
      }
    } catch {
      if (showToast) showToast('error', 'Connection error while deleting user.');
    }
  };

  const filteredUsers = usersList.filter(u => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (u.username || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.displayName || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 glass-panel rounded-2xl border border-white/10 shadow-lg">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-purple-400" />
            System Users & Role Management
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Manage authenticated accounts, email addresses, and panel access privileges ({usersList.length} registered accounts)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by username, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-2 text-xs glass-input rounded-xl text-white placeholder-zinc-500 w-48 sm:w-60 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setIsCreateOpen(true);
              setFormError('');
              if (setShowCreateUserModal) setShowCreateUserModal(true);
            }}
            className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition cursor-pointer flex items-center gap-2 shadow-md shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900/90 text-zinc-400 font-semibold border-b border-white/10 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-4">User Details</th>
                <th className="p-4">Email Address</th>
                <th className="p-4">Role & Access</th>
                <th className="p-4">Status</th>
                <th className="p-4">Created Date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-zinc-300">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-500">
                    No matching user accounts found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrent = currentUser?.id === u.id || currentUser?.username === u.username;
                  const roleBadge =
                    u.role === 'Admin' || u.role === 'Administrator' || u.role === 'Owner'
                      ? 'bg-purple-900/60 text-purple-300 border-purple-500/40'
                      : u.role === 'Moderator'
                      ? 'bg-emerald-900/60 text-emerald-300 border-emerald-500/40'
                      : u.role === 'Developer'
                      ? 'bg-blue-900/60 text-blue-300 border-blue-500/40'
                      : 'bg-zinc-800 text-zinc-400 border-white/10';

                  return (
                    <tr key={u.id} className="hover:bg-white/5 transition">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600/40 to-indigo-600/40 border border-purple-500/30 flex items-center justify-center text-white font-bold text-xs uppercase shadow shrink-0">
                            {(u.username || 'U').slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>{u.username}</span>
                              {isCurrent && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/30 text-purple-200 font-mono">
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-zinc-400">{u.displayName || u.username}</div>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 font-mono text-zinc-300">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                          <span className="truncate max-w-[200px]">{u.email || '—'}</span>
                        </div>
                      </td>

                      <td className="p-4">
                        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border ${roleBadge}`}>
                          {u.role || 'User'}
                        </span>
                      </td>

                      <td className="p-4">
                        {u.disabled ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-950/60 text-rose-300 border border-rose-500/30">
                            Disabled
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 w-max">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Active
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-zinc-400 font-mono text-[11px]">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'System'}
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(u)}
                            className="p-1.5 text-zinc-400 hover:text-purple-300 hover:bg-purple-950/40 rounded-lg transition"
                            title="Edit User Account"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition"
                              title="Delete User Account"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg glass-panel rounded-3xl border border-purple-500/40 p-6 space-y-5 bg-zinc-950/95 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-500/30">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Create New User Account</h3>
                  <p className="text-xs text-zinc-400">Add a new user with required email and role</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Username */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
                    Username <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. alex_builder"
                    value={createForm.username}
                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs glass-input rounded-xl text-white border border-white/10 focus:border-purple-500/50"
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
                    Email Address <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="user@example.com"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs glass-input rounded-xl text-white border border-white/10 focus:border-purple-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Display Name */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
                    Full / Display Name
                  </label>
                  <input
                    type="text"
                    placeholder="Alex Smith"
                    value={createForm.displayName}
                    onChange={(e) => setCreateForm({ ...createForm, displayName: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs glass-input rounded-xl text-white border border-white/10 focus:border-purple-500/50"
                  />
                </div>

                {/* Role */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
                    Role & Permissions
                  </label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs glass-input rounded-xl text-white border border-white/10 focus:border-purple-500/50"
                  >
                    <option value="Administrator">Administrator (Full Access)</option>
                    <option value="Moderator">Moderator (Server Management)</option>
                    <option value="Developer">Developer (Configs & Files)</option>
                    <option value="User">User (Standard Server Owner)</option>
                    <option value="Viewer">Viewer (Read-Only)</option>
                  </select>
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
                  Password <span className="text-rose-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="Min 6 characters"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs glass-input rounded-xl text-white border border-white/10 focus:border-purple-500/50"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-900/80 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg glass-panel rounded-3xl border border-purple-500/40 p-6 space-y-5 bg-zinc-950/95 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-500/30">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Edit User Account</h3>
                  <p className="text-xs text-zinc-400">Modify email, credentials, and access roles for {editingUser.username}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Username */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
                    Username <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs glass-input rounded-xl text-white border border-white/10 focus:border-purple-500/50"
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
                    Email Address <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs glass-input rounded-xl text-white border border-white/10 focus:border-purple-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Display Name */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={editForm.displayName}
                    onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs glass-input rounded-xl text-white border border-white/10 focus:border-purple-500/50"
                  />
                </div>

                {/* Role */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
                    Role & Permissions
                  </label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs glass-input rounded-xl text-white border border-white/10 focus:border-purple-500/50"
                  >
                    <option value="Administrator">Administrator (Full Access)</option>
                    <option value="Moderator">Moderator (Server Management)</option>
                    <option value="Developer">Developer (Configs & Files)</option>
                    <option value="User">User (Standard Server Owner)</option>
                    <option value="Viewer">Viewer (Read-Only)</option>
                  </select>
                </div>
              </div>

              {/* Password (Optional for Edit) */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
                  Change Password <span className="text-zinc-500 text-[10px] font-normal">(Leave blank to keep existing)</span>
                </label>
                <input
                  type="password"
                  placeholder="Enter new password (optional)"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs glass-input rounded-xl text-white border border-white/10 focus:border-purple-500/50"
                />
              </div>

              {/* Account Status Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/60 border border-white/10">
                <div>
                  <div className="text-xs font-bold text-white">Account Status</div>
                  <div className="text-[10px] text-zinc-400">Enable or disable login access for this account</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!editForm.disabled}
                    onChange={(e) => setEditForm({ ...editForm, disabled: !e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-900/80 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

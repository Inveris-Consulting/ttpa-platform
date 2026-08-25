import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  addPowerBIDashboardSupabase,
  deletePowerBIDashboardSupabase,
  fetchDashboardsFromSupabase,
  fetchUserDashboardLinks,
  saveUserDashboardLinks,
  DashboardItem,
} from '../lib/powerbiStore';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import {
  UserPlus,
  Layout,
  Shield,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  RefreshCw,
  Trash2,
  Link,
  Lock,
  ExternalLink,
  CheckSquare,
  Square,
} from 'lucide-react';

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'dashboards'>('users');

  // User Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [representativeId, setRepresentativeId] = useState<string>('');

  // Power BI Register Form State
  const [pbiTitle, setPbiTitle] = useState('');
  const [pbiDescription, setPbiDescription] = useState('');
  const [pbiCategory, setPbiCategory] = useState('Executive Reports');
  const [pbiIframeUrl, setPbiIframeUrl] = useState('');

  // User-Dashboard Linking State
  const [selectedUserForLinking, setSelectedUserForLinking] = useState<string>('');
  const [userLinkedDashboardIds, setUserLinkedDashboardIds] = useState<string[]>([]);
  const [savingPermissions, setSavingPermissions] = useState(false);

  // Data state
  const [representatives, setRepresentatives] = useState<{ id: string; Representative: string; Type: string }[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [dashboardsList, setDashboardsList] = useState<DashboardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchRepresentatives();
    fetchUsers();
    loadDashboards();
  }, []);

  useEffect(() => {
    if (selectedUserForLinking) {
      loadUserPermissions(selectedUserForLinking);
    }
  }, [selectedUserForLinking]);

  const fetchRepresentatives = async () => {
    try {
      const { data, error } = await supabase
        .from('dRepresentatives')
        .select('id, Representative, Type')
        .order('Representative');
      if (data && !error) {
        setRepresentatives(data);
        if (data.length > 0) setRepresentativeId(data[0].id);
      } else if (error) {
        console.error('Error fetching representatives:', error);
      }
    } catch (err) {
      console.error('Error loading representatives:', err);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, role, representative_id, dRepresentatives(Representative)');

      if (error) {
        console.error('Error fetching users:', error);
        const { data: simpleData } = await supabase.from('users').select('*');
        if (simpleData) {
          setUsersList(simpleData);
          if (simpleData.length > 0 && !selectedUserForLinking) {
            setSelectedUserForLinking(simpleData[0].id);
          }
        }
      } else if (data) {
        setUsersList(data);
        if (data.length > 0 && !selectedUserForLinking) {
          setSelectedUserForLinking(data[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDashboards = async () => {
    try {
      const list = await fetchDashboardsFromSupabase(undefined, 'admin');
      setDashboardsList(list);
    } catch (err) {
      console.error('Error loading dashboards:', err);
    }
  };

  const loadUserPermissions = async (userId: string) => {
    try {
      const linkedIds = await fetchUserDashboardLinks(userId);
      setUserLinkedDashboardIds(linkedIds);
    } catch (err) {
      console.error('Error loading user permissions:', err);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role,
            representative_id: role === 'user' ? (representativeId || null) : null,
          },
        },
      });

      let targetUserId = authData?.user?.id;

      if (authError || !targetUserId) {
        console.warn('Auth signup notice:', authError);
      }

      if (targetUserId) {
        const { error: insertError } = await supabase.from('users').upsert([
          {
            id: targetUserId,
            name,
            role,
            representative_id: role === 'user' ? (representativeId || null) : null,
          },
        ]);

        if (insertError) {
          throw insertError;
        }

        setMsg({ type: 'success', text: `User ${name} successfully registered!` });
      } else {
        const fallbackUuid = crypto.randomUUID();
        const { error: fallbackError } = await supabase.from('users').insert([
          {
            id: fallbackUuid,
            name,
            role,
            representative_id: role === 'user' ? (representativeId || null) : null,
          },
        ]);

        if (fallbackError) {
          throw fallbackError;
        }

        setMsg({ type: 'success', text: `User ${name} registered in permissions catalog!` });
      }

      setName('');
      setEmail('');
      setPassword('');
      fetchUsers();
    } catch (err: any) {
      console.error('Add user error:', err);
      setMsg({ type: 'error', text: err.message || 'Error registering user.' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddPowerBI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pbiTitle || !pbiIframeUrl) return;

    setLoading(true);
    setMsg(null);

    try {
      const newDash = await addPowerBIDashboardSupabase({
        title: pbiTitle,
        description: pbiDescription || 'Embedded published Power BI report.',
        category: pbiCategory,
        iframeUrl: pbiIframeUrl,
      });

      setMsg({ type: 'success', text: `Dashboard "${newDash.title}" successfully added to Supabase!` });
      setPbiTitle('');
      setPbiDescription('');
      setPbiIframeUrl('');
      loadDashboards();
    } catch (err: any) {
      console.error('Add Power BI Error:', err);
      setMsg({ type: 'error', text: err.message || 'Error adding Power BI dashboard.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePowerBI = async (dashboardId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete the Power BI dashboard "${title}"?`)) {
      return;
    }

    setLoading(true);
    setMsg(null);

    try {
      await deletePowerBIDashboardSupabase(dashboardId);
      setMsg({ type: 'success', text: `Dashboard "${title}" deleted from Supabase!` });
      loadDashboards();
    } catch (err: any) {
      console.error('Delete Power BI Error:', err);
      setMsg({ type: 'error', text: err.message || 'Error deleting Power BI dashboard.' });
    } finally {
      setLoading(false);
    }
  };

  const toggleDashboardPermission = (dashboardId: string) => {
    setUserLinkedDashboardIds((prev) =>
      prev.includes(dashboardId) ? prev.filter((id) => id !== dashboardId) : [...prev, dashboardId]
    );
  };

  const handleSaveUserPermissions = async () => {
    if (!selectedUserForLinking) return;
    setSavingPermissions(true);
    setMsg(null);

    try {
      await saveUserDashboardLinks(selectedUserForLinking, userLinkedDashboardIds);
      const targetUser = usersList.find((u) => u.id === selectedUserForLinking);
      setMsg({
        type: 'success',
        text: `Dashboard access permissions updated for ${targetUser?.name || 'user'}!`,
      });
    } catch (err: any) {
      console.error('Save permissions error:', err);
      setMsg({ type: 'error', text: err.message || 'Error updating dashboard permissions.' });
    } finally {
      setSavingPermissions(false);
    }
  };

  const selectedUserObj = usersList.find((u) => u.id === selectedUserForLinking);

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: '1200px', margin: '0 auto' }}>
      <div className="ttpa-card-header" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
            R&R TTPA Platform Settings
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            User Management, Role-Based Access Control (RBAC), and Dashboard Access Management.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          icon={<RefreshCw size={14} />}
          onClick={() => {
            fetchRepresentatives();
            fetchUsers();
            loadDashboards();
          }}
        >
          Refresh Data
        </Button>
      </div>

      {/* Tabs (100% in English) */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <Button
          variant={activeTab === 'users' ? 'navy' : 'outline'}
          icon={<UserPlus size={16} />}
          onClick={() => setActiveTab('users')}
        >
          User Management
        </Button>
        <Button
          variant={activeTab === 'dashboards' ? 'gold' : 'outline'}
          icon={<Layout size={16} />}
          onClick={() => setActiveTab('dashboards')}
        >
          Dashboard Management
        </Button>
      </div>

      {msg && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: msg.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
            color: msg.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
            fontSize: '14px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: 'var(--space-6)',
          }}
        >
          {msg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{msg.text}</span>
        </div>
      )}

      {activeTab === 'users' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
          {/* User Registration Form */}
          <div className="ttpa-card">
            <h3 className="ttpa-card-title" style={{ fontSize: '16px', marginBottom: 'var(--space-4)' }}>
              <UserPlus size={18} style={{ color: 'var(--ttpa-blue-primary)' }} />
              Add New User
            </h3>

            <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rodrigo Pimentel"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-medium)',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@rentandrecruit.com"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-medium)',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                  Initial Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-medium)',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                  Access Profile (Role)
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
                  className="ttpa-select"
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)' }}
                >
                  <option value="user">User (Filtered View & RLS by Representative)</option>
                  <option value="admin">Admin (Full Access)</option>
                </select>
              </div>

              {role === 'user' && (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                    Link with Representative (dRepresentatives)
                  </label>
                  <select
                    value={representativeId}
                    onChange={(e) => setRepresentativeId(e.target.value)}
                    className="ttpa-select"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)' }}
                  >
                    {representatives.map((rep) => (
                      <option key={rep.id} value={rep.id}>
                        {rep.Representative} ({rep.Type})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <Button type="submit" variant="primary" disabled={loading} style={{ marginTop: '8px' }}>
                {loading ? 'Registering...' : 'Register User'}
              </Button>
            </form>
          </div>

          {/* Registered Users List */}
          <div className="ttpa-card">
            <h3 className="ttpa-card-title" style={{ fontSize: '16px', marginBottom: 'var(--space-4)' }}>
              <Shield size={18} style={{ color: 'var(--rr-gold)' }} />
              Registered Users (public.users)
            </h3>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-medium)', textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Name</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Role</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Representative</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map((u, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '8px', fontWeight: 600 }}>{u.name || 'No Name'}</td>
                      <td style={{ padding: '8px' }}>
                        <Badge variant={u.role === 'admin' ? 'navy' : 'blue'}>{u.role}</Badge>
                      </td>
                      <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>
                        {u.dRepresentatives?.Representative || 'Global'}
                      </td>
                    </tr>
                  ))}
                  {usersList.length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {loading ? 'Loading users from Supabase...' : 'No users found in database.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Dashboard Management Section */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
            {/* 1. Add Power BI Dashboard Form */}
            <div className="ttpa-card">
              <h3 className="ttpa-card-title" style={{ fontSize: '16px', marginBottom: 'var(--space-4)' }}>
                <PlusCircle size={18} style={{ color: 'var(--rr-gold)' }} />
                Add Power BI Dashboard
              </h3>

              <form onSubmit={handleAddPowerBI} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                    Dashboard Title
                  </label>
                  <input
                    type="text"
                    required
                    value={pbiTitle}
                    onChange={(e) => setPbiTitle(e.target.value)}
                    placeholder="e.g. Veteran Primes Leads"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-medium)',
                      fontSize: '13px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                    Category
                  </label>
                  <input
                    type="text"
                    value={pbiCategory}
                    onChange={(e) => setPbiCategory(e.target.value)}
                    placeholder="e.g. Executive Reports / Financial"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-medium)',
                      fontSize: '13px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                    Description
                  </label>
                  <textarea
                    value={pbiDescription}
                    onChange={(e) => setPbiDescription(e.target.value)}
                    placeholder="Describe the objective and metrics included in this report..."
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-medium)',
                      fontSize: '13px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                    Power BI Public Link or HTML iFrame Snippet
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={pbiIframeUrl}
                    onChange={(e) => setPbiIframeUrl(e.target.value)}
                    placeholder='https://app.powerbi.com/view?r=... OR <iframe src="https://app.powerbi.com/view?r=..." ...></iframe>'
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-medium)',
                      fontSize: '12px',
                      fontFamily: 'var(--font-family-mono)',
                    }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Accepts direct public link or full HTML iframe code.
                  </span>
                </div>

                <Button type="submit" variant="gold" icon={<PlusCircle size={16} />} disabled={loading}>
                  {loading ? 'Adding...' : 'Add to Catalog'}
                </Button>
              </form>
            </div>

            {/* 2. Link Dashboards to Specific Users */}
            <div className="ttpa-card">
              <h3 className="ttpa-card-title" style={{ fontSize: '16px', marginBottom: 'var(--space-4)' }}>
                <Link size={18} style={{ color: 'var(--ttpa-blue-primary)' }} />
                User Dashboard Permissions
              </h3>

              <div style={{ marginBottom: 'var(--space-4)' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                  Select User to Manage Access:
                </label>
                <select
                  value={selectedUserForLinking}
                  onChange={(e) => setSelectedUserForLinking(e.target.value)}
                  className="ttpa-select"
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)' }}
                >
                  {usersList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email || 'User'} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              {selectedUserObj?.role === 'admin' ? (
                <div
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-info-bg)',
                    color: 'var(--ttpa-blue-primary)',
                    fontSize: '13px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Lock size={16} />
                  <span>Admin users automatically have direct access to ALL native and Power BI dashboards.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Allowed Dashboards for {selectedUserObj?.name || 'Selected User'}:
                  </span>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
                    {dashboardsList.map((dash) => {
                      const isLinked = userLinkedDashboardIds.includes(dash.id);
                      return (
                        <div
                          key={dash.id}
                          onClick={() => toggleDashboardPermission(dash.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-sm)',
                            border: `1px solid ${isLinked ? 'var(--ttpa-blue-primary)' : 'var(--border-subtle)'}`,
                            background: isLinked ? 'var(--blue-50)' : 'var(--bg-surface-elevated)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {isLinked ? (
                              <CheckSquare size={16} style={{ color: 'var(--ttpa-blue-primary)' }} />
                            ) : (
                              <Square size={16} style={{ color: 'var(--slate-400)' }} />
                            )}
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {dash.title}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {dash.type === 'native' ? 'Native Dashboard' : dash.type === 'powerbi' ? 'Power BI Report' : 'Analytics Kit Dashboard'}
                              </div>
                            </div>
                          </div>
                          <Badge variant={dash.type === 'native' ? 'blue' : dash.type === 'powerbi' ? 'gold' : 'success'}>
                            {dash.type}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    onClick={handleSaveUserPermissions}
                    variant="primary"
                    size="sm"
                    disabled={savingPermissions || !selectedUserForLinking}
                    style={{ marginTop: '12px' }}
                  >
                    {savingPermissions ? 'Saving...' : 'Save User Dashboard Permissions'}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* 3. Manage & Delete Custom Dashboards Table */}
          <div className="ttpa-card">
            <h3 className="ttpa-card-title" style={{ fontSize: '16px', marginBottom: 'var(--space-4)' }}>
              <Layout size={18} style={{ color: 'var(--rr-gold)' }} />
              Registered Dashboards (Supabase Catalog & Analytics Kit)
            </h3>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-medium)', textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Title</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Category</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Type</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Embed / Source</th>
                    <th style={{ padding: '10px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardsList.map((dash) => (
                    <tr key={dash.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px', fontWeight: 600, color: 'var(--text-primary)' }}>{dash.title}</td>
                      <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{dash.category}</td>
                      <td style={{ padding: '10px' }}>
                        <Badge variant={dash.type === 'native' ? 'blue' : dash.type === 'powerbi' ? 'gold' : 'success'}>
                          {dash.type === 'native' ? 'Native' : dash.type === 'powerbi' ? 'Power BI' : 'Analytics Kit'}
                        </Badge>
                      </td>
                      <td style={{ padding: '10px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px', fontFamily: 'var(--font-family-mono)', color: 'var(--text-muted)' }}>
                        {dash.iframeUrl ? (
                          <a href={dash.iframeUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ttpa-blue-primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            View Link <ExternalLink size={10} />
                          </a>
                        ) : dash.type === 'analytics_kit' ? (
                          <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Analytics Studio Grid</span>
                        ) : (
                          'Native App Route'
                        )}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        {dash.type !== 'native' ? (
                          <button
                            onClick={() => handleDeletePowerBI(dash.id, dash.title)}
                            className="ttpa-btn ttpa-btn-ghost ttpa-btn-sm"
                            style={{ color: 'var(--color-danger)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            title="Delete Dashboard"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>System Core</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';
import { Lock, Mail, ShieldAlert, ArrowRight } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (userSession: any) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      // 5-second timeout safeguard to prevent hanging network requests
      const timeoutPromise = new Promise<{ data: any; error: any }>((_, reject) =>
        setTimeout(() => reject(new Error('Authentication timed out. Please try again.')), 5000)
      );

      const authPromise = supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      const { data: authData, error: authError } = await Promise.race([authPromise, timeoutPromise]);

      if (authError || !authData?.user) {
        throw new Error('Invalid email or password. Please check your credentials.');
      }

      // Fetch user profile & role from public.users table in Supabase
      const { data: profileData } = await supabase
        .from('users')
        .select('id, name, role, representative_id')
        .eq('id', authData.user.id)
        .maybeSingle();

      const userRole = profileData?.role || authData.user.user_metadata?.role || 'user';

      const fullSession = {
        session: authData.session,
        user: {
          id: authData.user.id,
          email: authData.user.email,
          role: userRole,
          representative_id: profileData?.representative_id || null,
          name: profileData?.name || authData.user.user_metadata?.name || authData.user.email,
        },
      };

      onLoginSuccess(fullSession);
    } catch (err: any) {
      console.error('Login authentication error:', err);
      setErrorMsg(err.message || 'Invalid email or password. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = (role: 'admin' | 'user') => {
    onLoginSuccess({
      user: {
        id: role === 'admin' ? '512b6183-f508-4e93-81ef-f9b34806295b' : 'c21e388f-7ca7-4400-af02-f96389b5ced7',
        email: role === 'admin' ? 'felipe.rosendo@rentandrecruit.com' : 'rodrigo.pimentel@rentandrecruit.com',
        name: role === 'admin' ? 'Felipe Rosendo' : 'Rodrigo Pimentel',
        role,
        representative_id: role === 'user' ? '7617a3a2-0c4f-5ad5-92c8-6ebb534e7f45' : null,
      },
    });
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, var(--rr-navy-deep) 0%, var(--rr-navy-header) 100%)',
        padding: 'var(--space-4)',
      }}
    >
      <div
        className="ttpa-card"
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: 'var(--space-8)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        {/* R&R Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <img
            src="/assets/rr_logo_blue.webp"
            alt="R&R Logo"
            style={{ height: '48px', objectFit: 'contain', marginBottom: 'var(--space-3)' }}
          />
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>
            R&R Analytical Platform
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            TTPA Division — Dashboard Intelligence
          </p>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-danger-bg)',
              color: 'var(--color-danger)',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: 'var(--space-4)',
            }}
          >
            <ShieldAlert size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
              Corporate Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--slate-400)' }} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@rentandrecruit.com"
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 38px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-medium)',
                  fontSize: '14px',
                  outline: 'none',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--slate-400)' }} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 38px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-medium)',
                  fontSize: '14px',
                  outline: 'none',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>

          <Button type="submit" variant="primary" size="lg" disabled={loading} style={{ width: '100%', marginTop: '8px' }}>
            {loading ? 'Authenticating...' : 'Sign In to Platform'}
            <ArrowRight size={16} />
          </Button>
        </form>

        <div style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)', textAlign: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Demo Quick Login Access:</span>
          <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', marginTop: '8px' }}>
            <Button variant="outline" size="sm" onClick={() => handleDemoLogin('admin')}>
              Sign in as Admin
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleDemoLogin('user')}>
              Sign in as User (TTPA)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

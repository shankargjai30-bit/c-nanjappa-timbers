import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Mail, Users, ScanFace, Clock, Wallet, Loader2, Eye, EyeOff, User } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import './Login.css';

export default function Login() {
  const navigate = useNavigate();
  const { login, signup, resetPassword, addToast, loginWithGoogle, isAuthenticated, authLoading, managerProfile } = useApp();
  const [view, setView] = useState<'marketing' | 'login'>('marketing');
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot_password'>('login');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && managerProfile) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, managerProfile, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEmailLoading || isGoogleLoading) return;
    setIsEmailLoading(true);
    try {
      if (authMode === 'login') {
        await login(email, password);
      } else if (authMode === 'signup') {
        if (password !== confirmPassword) {
          addToast('Passwords do not match', 'error');
          setIsEmailLoading(false);
          return;
        }
        await signup(email, password, fullName);
      } else if (authMode === 'forgot_password') {
        await resetPassword(email);
        setIsEmailLoading(false);
        setAuthMode('login');
        return;
      }
    } catch (error) {
      // Error toast is handled in AppContext
      setIsEmailLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isEmailLoading || isGoogleLoading) return;
    setIsGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (error) {
      setIsGoogleLoading(false);
    }
  };

  if (authLoading || (isAuthenticated && managerProfile)) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc', color: '#1e293b' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <Loader2 size={40} style={{ animation: 'spin 1s linear infinite', color: '#4f46e5' }} />
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 500 }}>
            {isAuthenticated ? 'Redirecting to Dashboard...' : 'Authenticating Manager Session...'}
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="split-layout">
      {/* Background Elements */}
      <div className="background-elements">
        <div className="bg-wood-texture"></div>
        <div className="bg-illustration">
          <img src="/workforce-bg.png" alt="Workforce Illustration" />
        </div>
        <div className="bg-wave"></div>
        <div className="bg-gradient-overlay"></div>
      </div>

      <div className={`split-content view-${view}`}>
        {/* LEFT SECTION: GET STARTED */}
        <div className={`left-section ${view === 'marketing' ? 'active-view' : 'hidden-view'}`}>
          <div className="branding-top">
            <div className="logo-placeholder">
              <img src="/cn-logo.webp" alt="CN Logo" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement?.classList.add('fallback-logo'); }} />
            </div>
            <div className="branding-text">
              <h2>C NANJAPPA TIMBER TRADERS</h2>
              <p>Quality Timber. Trusted Legacy.</p>
            </div>
          </div>

          <div className="marketing-hero">
            <h1 className="hero-heading">
              Smart Workforce Management for <span className="highlight-blue">Modern Timber Industries</span>
            </h1>
            <p className="hero-description">
              An intelligent ERP solution to manage your people, attendance, payroll, and operations with AI-powered face biometric technology.
            </p>
            <button className="get-started-btn" onClick={() => setView('login')}>
              Get Started
              <ArrowRight size={20} />
            </button>
          </div>

          <div className="feature-cards-grid">
            <div className="feature-card">
              <div className="feature-icon"><Users size={24} /></div>
              <h3>200+ Employees Managed</h3>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><ScanFace size={24} /></div>
              <h3>AI Face Biometrics</h3>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><Clock size={24} /></div>
              <h3>Real-Time Attendance Tracking</h3>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><Wallet size={24} /></div>
              <h3>Payroll Automation & Accuracy</h3>
            </div>
          </div>

          <div className="bottom-tagline">
            Empowering Timber Businesses. Enhancing Workforce Productivity.
          </div>
        </div>

        {/* RIGHT SECTION: MANAGER LOGIN */}
        <div className={`right-section ${view === 'login' ? 'active-view' : 'hidden-view'}`}>
          <div className="login-card-wrapper">
            <div className="manager-login-card">
              <div className="login-card-header">
                <div className="logo-placeholder small">
                  <img src="/cn-logo.webp" alt="CN Logo" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement?.classList.add('fallback-logo'); }} />
                </div>
                <h2>Welcome Back</h2>
                <h3>{authMode === 'login' ? 'Manager Login' : authMode === 'signup' ? 'Create Account' : 'Reset Password'}</h3>
                <p>{authMode === 'login' ? 'Access your dashboard and manage operations efficiently' : authMode === 'signup' ? 'Sign up to access the TimberPro ERP dashboard' : 'Enter your email to receive a password reset link'}</p>
              </div>

              <form onSubmit={handleLogin} className="login-form">
                {authMode === 'signup' && (
                  <div className="form-group">
                    <label>Full Name</label>
                    <div className="input-with-icon">
                      <User size={18} className="input-icon" />
                      <input 
                        type="text" 
                        placeholder="John Doe" 
                        required 
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        disabled={isEmailLoading || isGoogleLoading}
                      />
                    </div>
                  </div>
                )}
                
                <div className="form-group">
                  <label>Email Address</label>
                  <div className="input-with-icon">
                    <Mail size={18} className="input-icon" />
                    <input 
                      type="email" 
                      placeholder="manager@nanjappa.com" 
                      required 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isEmailLoading || isGoogleLoading}
                    />
                  </div>
                </div>

                {authMode !== 'forgot_password' && (
                  <>
                    <div className="form-group">
                      <label>Password</label>
                      <div className="input-with-icon">
                        <Lock size={18} className="input-icon" />
                        <input 
                          type={showPassword ? 'text' : 'password'} 
                          placeholder="••••••••" 
                          required 
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          disabled={isEmailLoading || isGoogleLoading}
                          style={{ letterSpacing: showPassword ? 'normal' : '0.125rem' }}
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowPassword(!showPassword)}
                          className="password-toggle-btn"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    {authMode === 'signup' && (
                      <div className="form-group">
                        <label>Confirm Password</label>
                        <div className="input-with-icon">
                          <Lock size={18} className="input-icon" />
                          <input 
                            type={showPassword ? 'text' : 'password'} 
                            placeholder="••••••••" 
                            required 
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={isEmailLoading || isGoogleLoading}
                            style={{ letterSpacing: showPassword ? 'normal' : '0.125rem' }}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {authMode === 'login' && (
                  <div className="form-options">
                    <label className="checkbox-label">
                      <input type="checkbox" disabled={isEmailLoading || isGoogleLoading} />
                      <span>Remember me</span>
                    </label>
                    <a href="#" className="forgot-link" onClick={(e) => { e.preventDefault(); setAuthMode('forgot_password'); }}>Forgot password?</a>
                  </div>
                )}

                <button 
                  type="submit" 
                  className="login-btn"
                  disabled={isEmailLoading || isGoogleLoading}
                  style={{ opacity: isEmailLoading ? 0.7 : 1, cursor: isEmailLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  {isEmailLoading ? (
                    <>
                      <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                      {authMode === 'login' ? 'Logging in...' : authMode === 'signup' ? 'Creating Account...' : 'Sending Link...'}
                    </>
                  ) : (
                    <>
                      {authMode === 'login' ? 'Login to Dashboard' : authMode === 'signup' ? 'Create Account' : 'Send Reset Link'}
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
                
                {authMode !== 'forgot_password' && (
                  <>
                    <div className="divider">
                      <span>or</span>
                    </div>
                    
                    <button 
                      type="button" 
                      className="google-login-btn"
                      onClick={handleGoogleLogin}
                      disabled={isGoogleLoading || isEmailLoading}
                      style={{ opacity: (isGoogleLoading || isEmailLoading) ? 0.7 : 1, cursor: (isGoogleLoading || isEmailLoading) ? 'not-allowed' : 'pointer' }}
                    >
                      {isGoogleLoading ? (
                        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" width="20" />
                      )}
                      {isGoogleLoading ? 'Authenticating...' : 'Continue with Google'}
                    </button>
                  </>
                )}

                <div className="auth-mode-switch">
                  {authMode === 'login' ? (
                    <>
                      Don't have an account? <button type="button" className="switch-btn" onClick={() => setAuthMode('signup')}>Create New Account</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="switch-btn" onClick={() => setAuthMode('login')}>Back to Login</button>
                    </>
                  )}
                </div>
              </form>

              <div className="login-footer">
                <p>© 2024 C Nanjappa Timber Traders. All rights reserved.</p>
                <p>C. Nanjappa Timber Traders | C. Nanjappa Wood Infinity</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

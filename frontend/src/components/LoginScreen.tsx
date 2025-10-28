import { useState } from 'react';

interface LoginScreenProps {
  onLogin: () => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const correctPassword = import.meta.env.VITE_APP_PASSWORD || 'changeme';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password === correctPassword) {
      // Store authentication in sessionStorage
      sessionStorage.setItem('authenticated', 'true');
      onLogin();
    } else {
      setError('Incorrect password');
      setIsShaking(true);
      setTimeout(() => {
        setIsShaking(false);
        setError('');
      }, 820);
      setPassword('');
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#2a2a2a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '0 24px',
        }}
      >
        <form onSubmit={handleSubmit}>
          {/* Title */}
          <h1
            style={{
              color: '#ffffff',
              fontSize: '28px',
              fontWeight: '600',
              marginBottom: '32px',
              textAlign: 'center',
              letterSpacing: '-0.5px',
            }}
          >
            Incident Management Simulator
          </h1>

          {/* Password Input */}
          <div style={{ marginBottom: '16px', position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoFocus
              style={{
                width: '100%',
                padding: '14px 48px 14px 16px',
                fontSize: '16px',
                backgroundColor: '#3a3a3a',
                border: error ? '2px solid #ef4444' : '2px solid #4a4a4a',
                borderRadius: '8px',
                color: '#ffffff',
                outline: 'none',
                transition: 'all 0.2s',
                boxSizing: 'border-box',
                animation: isShaking ? 'shake 0.82s cubic-bezier(.36,.07,.19,.97) both' : 'none',
              }}
              onFocus={(e) => {
                if (!error) {
                  e.target.style.borderColor = '#f97316';
                }
              }}
              onBlur={(e) => {
                if (!error) {
                  e.target.style.borderColor = '#4a4a4a';
                }
              }}
            />
            
            {/* Show/Hide Password Button */}
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#f97316';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#888';
              }}
            >
              {showPassword ? (
                // Eye slash icon (hide)
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                // Eye icon (show)
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
            
            {error && (
              <div
                style={{
                  color: '#ef4444',
                  fontSize: '14px',
                  marginTop: '8px',
                  textAlign: 'center',
                }}
              >
                {error}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '16px',
              fontWeight: '600',
              backgroundColor: '#f97316',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxSizing: 'border-box',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#ea580c';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(249, 115, 22, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f97316';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Enter
          </button>
        </form>

        {/* Info Text */}
        <div
          style={{
            marginTop: '24px',
            textAlign: 'center',
            color: '#888',
            fontSize: '13px',
          }}
        >
          Password required for access
        </div>
      </div>

      {/* Shake Animation */}
      <style>{`
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
      `}</style>
    </div>
  );
}


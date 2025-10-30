import { useState } from 'react';

interface LoginScreenProps {
  onLogin: () => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  const correctPassword = import.meta.env.VITE_APP_PASSWORD || 'changeme';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password === correctPassword) {
      // Store authentication in sessionStorage
      sessionStorage.setItem('authenticated', 'true');
      
      // Trigger fade out animation
      setIsFadingOut(true);
      
      // Call onLogin after animation completes
      setTimeout(() => {
        onLogin();
      }, 300);
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
        backgroundColor: '#1a1a1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        opacity: isFadingOut ? 0 : 1,
        transition: 'opacity 0.3s ease-out',
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
              fontSize: '20px',
              fontWeight: '400',
              marginBottom: '16px',
              textAlign: 'center',
              letterSpacing: '-0.3px',
            }}
          >
            Incident Management Simulator
          </h1>

          {/* Password Input with Arrow Button */}
          <div style={{ marginBottom: '16px', position: 'relative' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 20px',
                    fontSize: '15px',
                    backgroundColor: '#3a3a3a',
                    border: error ? '2px solid #ef4444' : '2px solid #4a4a4a',
                    borderRadius: '50px',
                    color: '#ffffff',
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box',
                    animation: isShaking ? 'shake 0.82s cubic-bezier(.36,.07,.19,.97) both' : 'none',
                    height: '40px',
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
                    right: '14px',
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
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    // Eye icon (show)
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Submit Button - Orange Circle with Arrow */}
              <button
                type="submit"
                style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: '#f97316',
                  border: 'none',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#ea580c';
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(249, 115, 22, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f97316';
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'scale(0.95)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
              >
                {/* Arrow Icon */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
            
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


import { useState } from "react";
import api from "../api/axiosConfig";

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [isSignup, setIsSignup] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    try {
      if (isSignup) {
        await api.post("/auth/register", { username, password });
        setIsSignup(false);
        setUsername("");
        setPassword("");
        setError("Account created! Please log in.");
      } else {
        const res = await api.post("/auth/login", { username, password });
        localStorage.setItem("token", res.data.token);
        onLogin();
      }
    } catch (err) {
      console.error(err);
      if (isSignup) {
        setError("Signup failed (username may already exist).");
      } else {
        setError("Invalid username or password.");
      }
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100%',
      padding: '2rem'
    }}>
      <div style={{
        maxWidth: '440px',
        width: '100%',
        animation: 'fadeInUp 0.6s ease-out'
      }}>
        {/* Logo/Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '3rem'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: 'linear-gradient(135deg, #00d4aa 0%, #0099ff 100%)',
            borderRadius: '16px',
            margin: '0 auto 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            boxShadow: '0 0 30px rgba(0, 212, 170, 0.3)',
            animation: 'fadeInUp 0.6s ease-out 0.1s backwards'
          }}>
            💰
          </div>
          <h1 style={{
            fontSize: '2rem',
            marginBottom: '0.5rem',
            background: 'linear-gradient(135deg, #00d4aa 0%, #0099ff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'fadeInUp 0.6s ease-out 0.2s backwards'
          }}>
            {isSignup ? "Create Account" : "Welcome Back"}
          </h1>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '0.95rem',
            animation: 'fadeInUp 0.6s ease-out 0.3s backwards'
          }}>
            {isSignup ? "Join us to manage your finances" : "Sign in to your account"}
          </p>
        </div>

        {/* Main Card */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '20px',
          padding: '2.5rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          animation: 'fadeInUp 0.6s ease-out 0.4s backwards'
        }}>
          {error && (
            <div style={{
              background: error.includes('created') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${error.includes('created') ? 'var(--success)' : 'var(--danger)'}`,
              color: error.includes('created') ? 'var(--success)' : 'var(--danger)',
              padding: '0.875rem 1rem',
              borderRadius: '12px',
              marginBottom: '1.5rem',
              fontSize: '0.9rem',
              fontWeight: '500'
            }}>
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
          >
            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: 'var(--text-secondary)'
              }}>
                Username
              </label>
              <input
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={{
                  fontSize: '1rem'
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: 'var(--text-secondary)'
              }}>
                Password
              </label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  fontSize: '1rem'
                }}
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              style={{
                padding: '1rem',
                fontSize: '1rem',
                marginTop: '0.5rem'
              }}
            >
              {isSignup ? "Create Account" : "Sign In"}
            </button>
          </form>
        </div>

        {/* Toggle Sign up/Login */}
        <div style={{
          textAlign: 'center',
          marginTop: '1.5rem',
          animation: 'fadeInUp 0.6s ease-out 0.5s backwards'
        }}>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            marginBottom: '0.75rem'
          }}>
            {isSignup ? "Already have an account?" : "Don't have an account?"}
          </p>
          <button
            onClick={() => {
              setIsSignup(!isSignup);
              setError(null);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent-primary)',
              fontWeight: '600',
              fontSize: '0.95rem',
              padding: '0.5rem 1rem',
              cursor: 'pointer'
            }}
          >
            {isSignup ? "Sign in instead" : "Create an account"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
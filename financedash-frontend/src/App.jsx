// src/App.jsx
import { useState } from "react";
import axios from "axios";

import LoginPage from "./pages/LoginPage.jsx";
import AccountsPage from "./pages/AccountsPage.jsx";
import TransactionsPage from "./pages/TransactionsPage.jsx";

import { Routes, Route, Link, useLocation } from "react-router-dom";

axios.defaults.baseURL = "http://127.0.0.1:8080";

function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [accountsRefreshKey, setAccountsRefreshKey] = useState(0);
  const location = useLocation();

  function handleLogin() {
    const t = localStorage.getItem("token");
    setToken(t || "");
  }

  function handleLogout() {
    localStorage.removeItem("token");
    setToken("");
  }

  function handleTransactionAdded() {
    setAccountsRefreshKey((k) => k + 1);
  }

  if (!token) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const isAccountsPage = location.pathname === '/accounts' || location.pathname === '/';
  const isTransactionsPage = location.pathname === '/transactions';

  return (
    <div style={{
      width: '100%',
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '0 1.5rem',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <header style={{
        padding: '2rem 0',
        borderBottom: '1px solid var(--border-color)',
        marginBottom: '3rem',
        animation: 'fadeInUp 0.6s ease-out'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          {/* Logo/Brand */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              background: 'linear-gradient(135deg, #00d4aa 0%, #0099ff 100%)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              boxShadow: '0 0 20px rgba(0, 212, 170, 0.3)'
            }}>
              💰
            </div>
            <div>
              <h1 style={{
                fontSize: '1.5rem',
                margin: 0,
                background: 'linear-gradient(135deg, #00d4aa 0%, #0099ff 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                Finance Tracker
              </h1>
            </div>
          </div>

          {/* Navigation & Actions */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem'
          }}>
            {/* Navigation Links */}
            <nav style={{
              display: 'flex',
              gap: '0.5rem',
              background: 'var(--bg-card)',
              padding: '0.5rem',
              borderRadius: '12px',
              border: '1px solid var(--border-color)'
            }}>
              <Link
                to="/accounts"
                style={{
                  padding: '0.625rem 1.25rem',
                  borderRadius: '8px',
                  background: isAccountsPage ? 'linear-gradient(135deg, #00d4aa 0%, #0099ff 100%)' : 'transparent',
                  color: isAccountsPage ? 'white' : 'var(--text-secondary)',
                  fontWeight: '500',
                  fontSize: '0.9rem',
                  transition: 'all 0.2s ease',
                  textDecoration: 'none',
                  display: 'inline-block'
                }}
              >
                Accounts
              </Link>
              <Link
                to="/transactions"
                style={{
                  padding: '0.625rem 1.25rem',
                  borderRadius: '8px',
                  background: isTransactionsPage ? 'linear-gradient(135deg, #00d4aa 0%, #0099ff 100%)' : 'transparent',
                  color: isTransactionsPage ? 'white' : 'var(--text-secondary)',
                  fontWeight: '500',
                  fontSize: '0.9rem',
                  transition: 'all 0.2s ease',
                  textDecoration: 'none',
                  display: 'inline-block'
                }}
              >
                Transactions
              </Link>
            </nav>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid var(--danger)',
                color: 'var(--danger)',
                padding: '0.625rem 1.25rem',
                borderRadius: '10px',
                fontSize: '0.9rem'
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{
        animation: 'fadeInUp 0.6s ease-out 0.1s backwards',
        paddingBottom: '3rem'
      }}>
        <Routes>
          <Route path="/accounts" element={<AccountsPage refreshKey={accountsRefreshKey} />} />
          <Route path="/transactions" element={<TransactionsPage onTransactionAdded={handleTransactionAdded} />} />
          <Route path="*" element={<AccountsPage refreshKey={accountsRefreshKey} />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
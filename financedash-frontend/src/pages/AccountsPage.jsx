// src/AccountsPage.jsx
import { useEffect, useState } from "react";
import api from "../api/axiosConfig";

const API_BASE = "http://127.0.0.1:8080";

function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    name: "",
    type: "checking",
    balance: "",
  });

  const [editingId, setEditingId] = useState(null);

  function handleEditClick(account) {
    setEditingId(account.id);
    setForm({
      name: account.name,
      type: account.type,
      balance: account.balance
    });
  }

  async function loadAccounts() {
    try {
      setLoading(true);
      setError(null);

      const res = await api.get("/api/accounts");
      setAccounts(res.data || []);
    } catch (err) {
      console.error("loadAccounts error", err);

      const status = err.response?.status;

      if (status === 401 || status === 403) {
        setError("Not authorized. Please log in again.");
      } else {
        setError("Failed to load accounts.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function resetForm() {
    setForm({ name: "", type: "checking", balance: "" });
    setEditingId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!form.name || form.balance === "") {
      setError("Name and balance are required.");
      return;
    }

    const payload = {
      name: form.name,
      type: form.type,
      balance: parseFloat(form.balance),
    };

    try {
      if (editingId === null) {
        const res = await api.post('/accounts', payload);
        setAccounts((prev) => [...prev, res.data]);
      } else {
        const res = await api.put(`/accounts/${editingId}`, payload);
        const updated = res.data;

        setAccounts((prev) =>
          prev.map((acc) => (acc.id === updated.id ? updated : acc))
        );
      }

      resetForm();
    } catch (err) {
      console.error(err);
      setError("Failed to save account.");
    }
  }

  async function handleDeleteClick(id) {
    setError(null);
    try {
      await api.delete(`/accounts/${id}`);
      setAccounts((prev) => prev.filter((acc) => acc.id !== id));
      if (editingId === id) resetForm();
    } catch (err) {
      console.error(err);
      setError(err.response?.data || "Failed to delete account.");
    }
  }

  const totalBalance = accounts.reduce(
    (sum, acc) => sum + (acc.balance || 0),
    0
  );

  const accountTypeIcons = {
    checking: "🏦",
    savings: "💰",
    credit: "💳",
    investment: "📈"
  };

  const accountTypeColors = {
    checking: "linear-gradient(135deg, #00d4aa 0%, #0099ff 100%)",
    savings: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    credit: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    investment: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)"
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{
        fontSize: "2.5rem",
        marginBottom: "2rem",
        fontWeight: "700"
      }}>
        Accounts
      </h1>

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1.5rem',
        marginBottom: '3rem'
      }}>
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '1.75rem',
          boxShadow: 'var(--shadow-md)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            top: '-20px',
            right: '-20px',
            width: '100px',
            height: '100px',
            background: 'linear-gradient(135deg, #00d4aa 0%, #0099ff 100%)',
            borderRadius: '50%',
            opacity: '0.1'
          }}></div>
          <p style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
            marginBottom: '0.5rem',
            fontWeight: '500',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Total Accounts
          </p>
          <p style={{
            fontSize: '2.5rem',
            fontWeight: '700',
            margin: 0,
            background: 'linear-gradient(135deg, #00d4aa 0%, #0099ff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            {accounts.length}
          </p>
        </div>

        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '1.75rem',
          boxShadow: 'var(--shadow-md)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            top: '-20px',
            right: '-20px',
            width: '100px',
            height: '100px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            borderRadius: '50%',
            opacity: '0.1'
          }}></div>
          <p style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
            marginBottom: '0.5rem',
            fontWeight: '500',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Total Balance
          </p>
          <p style={{
            fontSize: '2.5rem',
            fontWeight: '700',
            margin: 0,
            fontFamily: "'JetBrains Mono', monospace"
          }}>
            ${totalBalance.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Add/Edit Account Form */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '2rem',
        marginBottom: '2rem',
        boxShadow: 'var(--shadow-md)'
      }}>
        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>
          {editingId === null ? "Add New Account" : "Edit Account"}
        </h2>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--danger)',
            color: 'var(--danger)',
            padding: '1rem',
            marginBottom: '1.5rem',
            borderRadius: '12px',
            fontWeight: '500',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            alignItems: 'end'
          }}
        >
          <div>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: 'var(--text-secondary)'
            }}>
              Account Name
            </label>
            <input
              type="text"
              name="name"
              placeholder="e.g., Main Checking"
              value={form.name}
              onChange={handleChange}
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
              Account Type
            </label>
            <select
              name="type"
              value={form.type}
              onChange={handleChange}
            >
              <option value="checking">🏦 Checking</option>
              <option value="savings">💰 Savings</option>
              <option value="credit">💳 Credit</option>
              <option value="investment">📈 Investment</option>
            </select>
          </div>

          <div>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: 'var(--text-secondary)'
            }}>
              Balance
            </label>
            <input
              type="number"
              name="balance"
              placeholder="0.00"
              value={form.balance}
              onChange={handleChange}
              step="0.01"
            />
          </div>

          <button type="submit" className="btn-primary">
            {editingId === null ? "Add Account" : "Save Changes"}
          </button>

          {editingId !== null && (
            <button
              type="button"
              onClick={resetForm}
              style={{
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)'
              }}
            >
              Cancel
            </button>
          )}
        </form>
      </div>

      {/* Accounts List */}
      <div>
        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>
          Your Accounts
        </h2>

        {loading ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            color: 'var(--text-secondary)'
          }}>
            <div style={{
              display: 'inline-block',
              width: '40px',
              height: '40px',
              border: '3px solid var(--border-color)',
              borderTop: '3px solid var(--accent-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <p style={{ marginTop: '1rem' }}>Loading accounts...</p>
          </div>
        ) : accounts.length === 0 ? (
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '3rem',
            textAlign: 'center'
          }}>
            <p style={{
              fontSize: '3rem',
              marginBottom: '1rem'
            }}>
              🏦
            </p>
            <p style={{
              color: 'var(--text-secondary)',
              fontSize: '1.1rem'
            }}>
              No accounts yet. Add your first account above!
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gap: '1rem'
          }}>
            {accounts.map((acc) => (
              <div
                key={acc.id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateX(4px)';
                  e.currentTarget.style.borderColor = 'var(--border-hover)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateX(0)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    background: accountTypeColors[acc.type],
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                  }}>
                    {accountTypeIcons[acc.type]}
                  </div>

                  <div style={{ flex: 1 }}>
                    <h3 style={{
                      fontSize: '1.125rem',
                      fontWeight: '600',
                      marginBottom: '0.25rem'
                    }}>
                      {acc.name}
                    </h3>
                    <p style={{
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary)',
                      textTransform: 'capitalize',
                      margin: 0
                    }}>
                      {acc.type}
                    </p>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <p style={{
                      fontSize: '1.75rem',
                      fontWeight: '700',
                      fontFamily: "'JetBrains Mono', monospace",
                      margin: 0,
                      color: acc.balance >= 0 ? 'var(--success)' : 'var(--danger)'
                    }}>
                      ${acc.balance?.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleEditClick(acc)}
                    style={{
                      background: 'rgba(0, 212, 170, 0.1)',
                      border: '1px solid var(--accent-primary)',
                      color: 'var(--accent-primary)',
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem'
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteClick(acc.id)}
                    className="btn-danger"
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem'
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AccountsPage;
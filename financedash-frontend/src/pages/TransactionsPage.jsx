import { useEffect, useState } from "react";
import api from "../api/axiosConfig";
import { getTransactions, createTransaction } from "../api/transactions";

export default function TransactionsPage({ onTransactionAdded }) {
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    amount: "",
    description: "",
    category: "",
    txDate: new Date().toISOString().slice(0, 10),
    txType: "EXPENSE"
  });

  // Load accounts
  useEffect(() => {
    async function loadAccounts() {
      const res = await api.get("/api/accounts");
      setAccounts(res.data);
      if (res.data.length) setAccountId(res.data[0].id);
    }
    loadAccounts();
  }, []);

  // Load transactions
  useEffect(() => {
    if (!accountId) return;

    async function loadTransactions() {
      setLoading(true);
      const data = await getTransactions(accountId);
      setTransactions(data);
      setLoading(false);
    }

    loadTransactions();
  }, [accountId]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    await createTransaction({
      accountId: Number(accountId),
      ...form,
      amount: Number(form.amount)
    });

    if (onTransactionAdded) onTransactionAdded();

    const data = await getTransactions(accountId);
    setTransactions(data);

    setForm({
      amount: "",
      description: "",
      category: "",
      txDate: new Date().toISOString().slice(0, 10),
      txType: "EXPENSE"
    });
  };

  const selectedAccount = accounts.find(a => a.id == accountId);

  // Calculate summary
  const totalIncome = transactions
    .filter(t => t.txType === "INCOME")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.txType === "EXPENSE")
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{
        fontSize: "2.5rem",
        marginBottom: "2rem",
        fontWeight: "700"
      }}>
        Transactions
      </h1>

      {/* Account Selector & Summary */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1.5rem',
        marginBottom: '3rem'
      }}>
        {/* Account Selector Card */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '1.75rem',
          boxShadow: 'var(--shadow-md)'
        }}>
          <p style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
            marginBottom: '0.75rem',
            fontWeight: '500',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Selected Account
          </p>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            style={{
              fontSize: '1.1rem',
              fontWeight: '600',
              padding: '0.75rem 1rem'
            }}
          >
            {accounts.map(a => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          {selectedAccount && (
            <p style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              fontFamily: "'JetBrains Mono', monospace",
              marginTop: '0.75rem',
              color: 'var(--accent-primary)'
            }}>
              ${selectedAccount.balance?.toFixed(2)}
            </p>
          )}
        </div>

        {/* Income Card */}
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
            background: 'var(--success)',
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
            Total Income
          </p>
          <p style={{
            fontSize: '2rem',
            fontWeight: '700',
            margin: 0,
            fontFamily: "'JetBrains Mono', monospace",
            color: 'var(--success)'
          }}>
            +${totalIncome.toFixed(2)}
          </p>
        </div>

        {/* Expenses Card */}
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
            background: 'var(--danger)',
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
            Total Expenses
          </p>
          <p style={{
            fontSize: '2rem',
            fontWeight: '700',
            margin: 0,
            fontFamily: "'JetBrains Mono', monospace",
            color: 'var(--danger)'
          }}>
            -${totalExpenses.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Add Transaction Form */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '2rem',
        marginBottom: '2rem',
        boxShadow: 'var(--shadow-md)'
      }}>
        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>
          Add Transaction
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: 'var(--text-secondary)'
              }}>
                Type
              </label>
              <select
                name="txType"
                value={form.txType}
                onChange={handleChange}
                style={{
                  fontWeight: '600'
                }}
              >
                <option value="EXPENSE">💸 Expense</option>
                <option value="INCOME">💰 Income</option>
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
                Amount
              </label>
              <input
                name="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={handleChange}
                required
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
                Description
              </label>
              <input
                name="description"
                placeholder="What was this for?"
                value={form.description}
                onChange={handleChange}
                required
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
                Category
              </label>
              <input
                name="category"
                placeholder="e.g., Food, Rent, Salary"
                value={form.category}
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
                Date
              </label>
              <input
                name="txDate"
                type="date"
                value={form.txDate}
                onChange={handleChange}
                required
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'end' }}>
              <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                Add Transaction
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Transactions List */}
      <div>
        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>
          Transaction History
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
            <p style={{ marginTop: '1rem' }}>Loading transactions...</p>
          </div>
        ) : transactions.length === 0 ? (
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
              📝
            </p>
            <p style={{
              color: 'var(--text-secondary)',
              fontSize: '1.1rem'
            }}>
              No transactions yet. Add your first transaction above!
            </p>
          </div>
        ) : (
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-md)'
          }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t.id}>
                    <td>
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.9rem',
                        color: 'var(--text-secondary)'
                      }}>
                        {new Date(t.txDate).toLocaleDateString()}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.25rem' }}>
                          {t.txType === 'EXPENSE' ? '💸' : '💰'}
                        </span>
                        <span style={{ fontWeight: '500' }}>
                          {t.description}
                        </span>
                      </div>
                    </td>
                    <td>
                      {t.category ? (
                        <span style={{
                          background: 'var(--bg-tertiary)',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          color: 'var(--text-secondary)',
                          display: 'inline-block'
                        }}>
                          {t.category}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)' }}>-</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '1.1rem',
                        fontWeight: '700',
                        color: t.txType === "EXPENSE" ? 'var(--danger)' : 'var(--success)'
                      }}>
                        {t.txType === "EXPENSE" ? "-" : "+"}${t.amount.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
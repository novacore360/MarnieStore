import React, { useState, useEffect, useCallback } from 'react';
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('purchase'); // 'purchase', 'dashboard', 'settings'
  const [customers, setCustomers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [allPurchases, setAllPurchases] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [theme, setTheme] = useState('morning');

  // Load all customers on mount
  useEffect(() => {
    loadCustomers();
    loadAllPurchases();
  }, []);

  // Load saved customer from localStorage on mount (auto-reload purchases)
  useEffect(() => {
    const savedCustomerId = localStorage.getItem('selectedCustomerId');
    const savedCustomerData = localStorage.getItem('selectedCustomerData');
    
    if (savedCustomerId && savedCustomerData) {
      try {
        const customer = JSON.parse(savedCustomerData);
        setSelectedCustomer(customer);
        setSearchTerm(customer.name);
      } catch (e) {
        console.error('Error loading saved customer:', e);
      }
    }
  }, []);

  // Load purchases when selected customer changes
  useEffect(() => {
    if (selectedCustomer) {
      loadPurchases(selectedCustomer.id);
    }
  }, [selectedCustomer]);

  // Apply theme based on time of day
  useEffect(() => {
    const updateTheme = () => {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 8) {
        setTheme('dawn');
      } else if (hour >= 8 && hour < 17) {
        setTheme('morning');
      } else if (hour >= 17 && hour < 19) {
        setTheme('sunset');
      } else {
        setTheme('night');
      }
    };
    
    updateTheme();
    const interval = setInterval(updateTheme, 60000);
    return () => clearInterval(interval);
  }, []);

  // Apply theme class to body
  useEffect(() => {
    document.body.className = `theme-${theme}`;
  }, [theme]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const customersRef = collection(db, 'customers');
      const snapshot = await getDocs(customersRef);
      const customersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCustomers(customersData);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllPurchases = async () => {
    try {
      const purchasesRef = collection(db, 'purchases');
      const snapshot = await getDocs(purchasesRef);
      const allData = snapshot.docs.map(doc => {
        const data = doc.data();
        let productData = [];
        try {
          productData = typeof data.product_data === 'string' 
            ? JSON.parse(data.product_data) 
            : (data.product_data || []);
        } catch (e) {
          productData = [];
        }
        return {
          id: doc.id,
          ...data,
          product_data: productData
        };
      });
      setAllPurchases(allData);
    } catch (error) {
      console.error('Error loading all purchases:', error);
    }
  };

  const loadPurchases = useCallback(async (customerId) => {
    if (!customerId) return;
    
    setLoading(true);
    try {
      const customerPurchases = allPurchases.filter(
        purchase => purchase.customer_id === customerId
      );
      
      setPurchases(customerPurchases.sort((a, b) => 
        new Date(b.purchase_date) - new Date(a.purchase_date)
      ));
    } catch (error) {
      console.error('Error loading purchases:', error);
    } finally {
      setLoading(false);
    }
  }, [allPurchases]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    if (value.trim() === '') {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    
    const filtered = customers.filter(customer =>
      customer.name.toLowerCase().includes(value.toLowerCase())
    );
    setSuggestions(filtered.slice(0, 10));
    setShowSuggestions(true);
  };

  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setSearchTerm(customer.name);
    setSuggestions([]);
    setShowSuggestions(false);
    localStorage.setItem('selectedCustomerId', customer.id);
    localStorage.setItem('selectedCustomerData', JSON.stringify(customer));
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setSearchTerm('');
    setPurchases([]);
    setSuggestions([]);
    setShowSuggestions(false);
    localStorage.removeItem('selectedCustomerId');
    localStorage.removeItem('selectedCustomerData');
  };

  const getTotalSpent = () => {
    return purchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
  };

  const getPendingTotal = () => {
    return purchases
      .filter(p => p.status !== 'paid')
      .reduce((sum, p) => sum + (p.total_amount || 0), 0);
  };

  const getPaidTotal = () => {
    return purchases
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + (p.total_amount || 0), 0);
  };

  const getPendingCount = () => {
    return purchases.filter(p => p.status !== 'paid').length;
  };

  // Dashboard statistics
  const getTotalCustomers = () => customers.length;
  const getTotalSales = () => allPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
  const getTotalPending = () => allPurchases.filter(p => p.status !== 'paid').reduce((sum, p) => sum + (p.total_amount || 0), 0);
  const getTotalOrders = () => allPurchases.length;

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getThemeName = () => {
    switch(theme) {
      case 'dawn': return 'Sunrise';
      case 'morning': return 'Morning';
      case 'sunset': return 'Sunset';
      case 'night': return 'Night';
      default: return 'Morning';
    }
  };

  // Get recent transactions (last 10)
  const getRecentTransactions = () => {
    return [...allPurchases]
      .sort((a, b) => new Date(b.purchase_date) - new Date(a.purchase_date))
      .slice(0, 10);
  };

  return (
    <div className="app">
      <div className="glass-container">
        <header className="header">
          <h1>Purchase History</h1>
          <div className="theme-indicator">
            <span className={`theme-dot theme-${theme}`}></span>
            <span>{getThemeName()}</span>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="tabs">
          <button 
            className={`tab-btn ${activeTab === 'purchase' ? 'active' : ''}`}
            onClick={() => setActiveTab('purchase')}
          >
            My Purchase
          </button>
          <button 
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </div>

        {/* My Purchase Tab */}
        {activeTab === 'purchase' && (
          <div className="tab-content">
            <div className="search-section">
              <div className="search-wrapper">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search customer by name..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  onFocus={() => {
                    if (searchTerm && searchTerm.trim()) {
                      setSuggestions(
                        customers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 10)
                      );
                      setShowSuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowSuggestions(false), 200);
                  }}
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="suggestions-dropdown">
                    {suggestions.map(customer => (
                      <div
                        key={customer.id}
                        className="suggestion-item"
                        onMouseDown={() => handleSelectCustomer(customer)}
                      >
                        <span className="suggestion-name">{customer.name}</span>
                        {customer.phone && <span className="suggestion-phone">{customer.phone}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {selectedCustomer && (
                <button className="clear-btn" onClick={handleClearCustomer}>
                  Change Customer
                </button>
              )}
            </div>

            {selectedCustomer && (
              <>
                <div className="customer-info">
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Customer</label>
                      <h2>{selectedCustomer.name}</h2>
                      {selectedCustomer.phone && <p>Phone: {selectedCustomer.phone}</p>}
                      {selectedCustomer.email && <p>Email: {selectedCustomer.email}</p>}
                    </div>
                    <div className="info-item">
                      <label>Total Spent</label>
                      <h2 className="total-amount">₱{getTotalSpent().toFixed(2)}</h2>
                    </div>
                    <div className="info-item">
                      <label>Pending Payments</label>
                      <h2 className="pending-amount">₱{getPendingTotal().toFixed(2)}</h2>
                      <p>{getPendingCount()} order(s)</p>
                    </div>
                    <div className="info-item">
                      <label>Paid Amount</label>
                      <h2>₱{getPaidTotal().toFixed(2)}</h2>
                      <p>{purchases.filter(p => p.status === 'paid').length} paid orders</p>
                    </div>
                  </div>
                </div>

                <div className="purchases-section">
                  <h3>Purchase History ({purchases.length} orders)</h3>
                  {loading ? (
                    <div className="loading">Loading purchases...</div>
                  ) : purchases.length === 0 ? (
                    <div className="empty-state">No purchases found for this customer</div>
                  ) : (
                    <div className="purchases-list">
                      {purchases.map(purchase => (
                        <div key={purchase.id} className="purchase-card">
                          <div className="purchase-header">
                            <span className="purchase-date">{formatDate(purchase.purchase_date)}</span>
                            <span className={`status-badge ${purchase.status === 'paid' ? 'status-paid' : 'status-pending'}`}>
                              {purchase.status || 'pending'}
                            </span>
                          </div>
                          <div className="purchase-amount">
                            <span>Total Amount</span>
                            <strong>₱{purchase.total_amount?.toFixed(2) || '0.00'}</strong>
                          </div>
                          {purchase.product_data && purchase.product_data.length > 0 && (
                            <div className="purchase-items">
                              <label>Items Purchased</label>
                              <div className="items-list">
                                {purchase.product_data.map((item, idx) => (
                                  <div key={idx} className="item">
                                    <span>{item.name}</span>
                                    <span>{item.quantity} x ₱{item.price?.toFixed(2)}</span>
                                    <span>₱{(item.price * item.quantity).toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {!selectedCustomer && !loading && (
              <div className="welcome-state">
                <div className="welcome-icon">🔍</div>
                <h3>Search for a Customer</h3>
                <p>Enter a customer name above to view their purchase history</p>
              </div>
            )}
          </div>
        )}

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="tab-content">
            <div className="dashboard-stats">
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon">👥</div>
                  <div className="stat-info">
                    <label>Total Customers</label>
                    <h2>{getTotalCustomers()}</h2>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">💰</div>
                  <div className="stat-info">
                    <label>Total Sales</label>
                    <h2>₱{getTotalSales().toFixed(2)}</h2>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">⏳</div>
                  <div className="stat-info">
                    <label>Pending Payments</label>
                    <h2 className="pending-amount">₱{getTotalPending().toFixed(2)}</h2>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">📦</div>
                  <div className="stat-info">
                    <label>Total Orders</label>
                    <h2>{getTotalOrders()}</h2>
                  </div>
                </div>
              </div>
            </div>

            <div className="recent-section">
              <h3>Recent Transactions</h3>
              <div className="recent-list">
                {getRecentTransactions().map(transaction => {
                  const customer = customers.find(c => c.id === transaction.customer_id);
                  return (
                    <div key={transaction.id} className="recent-item">
                      <div className="recent-info">
                        <span className="recent-customer">{customer?.name || transaction.customer_name}</span>
                        <span className="recent-date">{formatDate(transaction.purchase_date)}</span>
                      </div>
                      <div className="recent-amount">
                        <span className={`status-badge ${transaction.status === 'paid' ? 'status-paid' : 'status-pending'}`}>
                          {transaction.status || 'pending'}
                        </span>
                        <strong>₱{transaction.total_amount?.toFixed(2) || '0.00'}</strong>
                      </div>
                    </div>
                  );
                })}
                {getRecentTransactions().length === 0 && (
                  <div className="empty-state">No transactions found</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="tab-content">
            <div className="settings-section">
              <div className="settings-card">
                <h3>About</h3>
                <p><strong>Purchase History Viewer</strong> v1.0.0</p>
                <p>View customer purchase history from Firebase Firestore</p>
                <hr />
                <h4>System Info</h4>
                <p>Firebase Status: Connected</p>
                <p>Database: Firestore</p>
                <p>Customers: {getTotalCustomers()}</p>
                <p>Total Orders: {getTotalOrders()}</p>
                <hr />
                <h4>Theme</h4>
                <p>Current theme: {getThemeName()}</p>
                <p>Themes change automatically based on time of day:</p>
                <ul>
                  <li>🌅 Sunrise (5am - 8am)</li>
                  <li>☀️ Morning (8am - 5pm)</li>
                  <li>🌇 Sunset (5pm - 7pm)</li>
                  <li>🌙 Night (7pm - 5am)</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

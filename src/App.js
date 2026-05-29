import React, { useState, useEffect, useCallback } from 'react';
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';
import './App.css';

function App() {
  const [customers, setCustomers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [theme, setTheme] = useState('morning');

  // Load all customers on mount
  useEffect(() => {
    loadCustomers();
  }, []);

  // Load purchases from localStorage on mount
  useEffect(() => {
    const savedCustomerId = localStorage.getItem('selectedCustomerId');
    const savedCustomerData = localStorage.getItem('selectedCustomerData');
    
    if (savedCustomerId && savedCustomerData) {
      try {
        const customer = JSON.parse(savedCustomerData);
        setSelectedCustomer(customer);
        setSearchTerm(customer.name);
        loadPurchases(savedCustomerId);
      } catch (e) {
        console.error('Error loading saved customer:', e);
      }
    }
  }, []);

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

  const loadPurchases = useCallback(async (customerId) => {
    if (!customerId) return;
    
    try {
      setLoading(true);
      const purchasesRef = collection(db, 'purchases');
      const snapshot = await getDocs(purchasesRef);
      const allPurchases = snapshot.docs.map(doc => {
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
  }, []);

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
    loadPurchases(customer.id);
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

  const getPendingCount = () => {
    return purchases.filter(p => p.status !== 'paid').length;
  };

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

  return (
    <div className="app">
      <div className="glass-container">
        <header className="header">
          <h1>Purchase History</h1>
          <div className="theme-indicator">
            <span className={`theme-dot theme-${theme}`}></span>
            <span>{theme.charAt(0).toUpperCase() + theme.slice(1)}</span>
          </div>
        </header>

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
              Clear
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
                  {selectedCustomer.phone && <p>{selectedCustomer.phone}</p>}
                  {selectedCustomer.email && <p>{selectedCustomer.email}</p>}
                </div>
                <div className="info-item">
                  <label>Total Spent</label>
                  <h2 className="total-amount">${getTotalSpent().toFixed(2)}</h2>
                </div>
                <div className="info-item">
                  <label>Pending Payments</label>
                  <h2 className="pending-amount">${getPendingTotal().toFixed(2)}</h2>
                  <p>{getPendingCount()} order(s)</p>
                </div>
                <div className="info-item">
                  <label>Total Orders</label>
                  <h2>{purchases.length}</h2>
                </div>
              </div>
            </div>

            <div className="purchases-section">
              <h3>Purchase History</h3>
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
                        <strong>${purchase.total_amount?.toFixed(2) || '0.00'}</strong>
                      </div>
                      {purchase.product_data && purchase.product_data.length > 0 && (
                        <div className="purchase-items">
                          <label>Items</label>
                          <div className="items-list">
                            {purchase.product_data.map((item, idx) => (
                              <div key={idx} className="item">
                                <span>{item.name}</span>
                                <span>{item.quantity} x ${item.price?.toFixed(2)}</span>
                                <span>${(item.price * item.quantity).toFixed(2)}</span>
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
            <div className="welcome-icon">📋</div>
            <h3>Search for a Customer</h3>
            <p>Enter a customer name above to view their purchase history</p>
          </div>
        )}

        {loading && !selectedCustomer && (
          <div className="loading-state">Loading customers...</div>
        )}
      </div>
    </div>
  );
}

export default App;

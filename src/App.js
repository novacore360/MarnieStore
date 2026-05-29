import React, { useState, useEffect, useCallback } from 'react';
import { db } from './firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import './App.css';

function App() {
  const [customers, setCustomers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState('morning');

  // Load all customers on mount
  useEffect(() => {
    loadCustomers();
  }, []);

  // Apply theme based on time of day
  useEffect(() => {
    const updateTheme = () => {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 8) {
        setTheme('dawn');
      } else if (hour >= 8 && hour < 17) {
        setTheme('morning');
      } else if (hour >= 17 && hour < 20) {
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

  // Handle customer search with suggestions
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    if (value.trim() === '') {
      setSuggestions([]);
      return;
    }
    
    const filtered = customers.filter(customer =>
      customer.name.toLowerCase().includes(value.toLowerCase())
    );
    setSuggestions(filtered.slice(0, 10));
  };

  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setSearchTerm(customer.name);
    setSuggestions([]);
    loadPurchases(customer.id);
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setSearchTerm('');
    setPurchases([]);
    setSuggestions([]);
  };

  const getTotalSpent = () => {
    return purchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
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
          <h1>Purchase History Viewer</h1>
          <div className="theme-indicator">
            <span className={`theme-dot theme-${theme}`}></span>
            <span>{theme.charAt(0).toUpperCase() + theme.slice(1)}</span>
          </div>
        </header>

        {/* Search Section */}
        <div className="search-section">
          <div className="search-wrapper">
            <input
              type="text"
              className="search-input"
              placeholder="Search customer by name..."
              value={searchTerm}
              onChange={handleSearchChange}
              onFocus={() => searchTerm && setSuggestions(
                customers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 10)
              )}
            />
            {suggestions.length > 0 && (
              <div className="suggestions-dropdown">
                {suggestions.map(customer => (
                  <div
                    key={customer.id}
                    className="suggestion-item"
                    onClick={() => handleSelectCustomer(customer)}
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
              Clear Customer
            </button>
          )}
        </div>

        {/* Customer Info Card */}
        {selectedCustomer && (
          <div className="customer-info">
            <div className="info-grid">
              <div className="info-item">
                <label>Customer Name</label>
                <h3>{selectedCustomer.name}</h3

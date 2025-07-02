import React, { useState, useEffect } from 'react';
import UserFetcher from './UserFetcher';
import DataBrowserTab from './DataBrowserTab';
import QueryRunnerTab from './QueryRunnerTab';
import TransactionsTab from './TransactionsTab';
import AlertsTab from './AlertsTab';
import HealthTab from './HealthTab';
import Dashboards from './Dashboards';

const TabbedApp = () => {
  const [activeTab, setActiveTab] = useState(() => {
    return sessionStorage.getItem('activeTab') || 'tab1';
  });

  useEffect(() => {
    sessionStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    document.body.style.backgroundColor = '#121212';
    document.documentElement.style.backgroundColor = '#121212';
  }, []);

  const labels = {
    tab1: "Event Browser",
    tab2: "Data Browser",
    tab3: "Query Runner",
    tab4: "Transactions",
    tab5: "Alerts",
    tab6: "Dashbaords",
    tab7: "System Health"
  };

  return (
    <div style={{ backgroundColor: '#121212', minHeight: '100vh', padding: '1rem', color: '#f5f5f5' }}>
      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '2px solid #333',
        backgroundColor: '#1f1f1f',
        borderRadius: '8px 8px 0 0',
        overflow: 'hidden'
      }}>
        {Object.entries(labels).map(([tab, label]) => (
          <div
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              cursor: 'pointer',
              padding: '1rem 2rem',
              borderBottom: activeTab === tab ? '3px solid #90caf9' : 'none',
              fontWeight: activeTab === tab ? 'bold' : 'normal',
              backgroundColor: activeTab === tab ? '#333' : '#1f1f1f',
              color: '#f5f5f5',
              flex: 1,
              textAlign: 'center'
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Tab content */}
      <div style={{
        padding: '1rem',
        backgroundColor: '#1f1f1f',
        borderRadius: '0 0 8px 8px',
        marginTop: '-2px',
        boxShadow: '0 2px 10px rgba(255, 255, 255, 0.05)'
      }}>
        {activeTab === 'tab1' && <UserFetcher />}
        {activeTab === 'tab2' && <DataBrowserTab />}
        {activeTab === 'tab3' && <QueryRunnerTab />}
	{activeTab === 'tab4' && <TransactionsTab />}
	{activeTab === 'tab5' && <AlertsTab />}
	{activeTab === 'tab6' && <Dashboards />}
        {activeTab === 'tab7' && <HealthTab />}
      </div>
    </div>
  );
};

export default TabbedApp;


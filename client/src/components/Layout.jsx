import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { useAppContext } from '../App';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/intake', label: 'Cancellation Intake' },
  { to: '/saved', label: 'Saved Cases' },
  { to: '/insights', label: 'Insights' },
  { to: '/settings', label: 'Settings' }
];

const titleMap = {
  '/dashboard': 'Churn Overview',
  '/intake': 'Log a Cancellation',
  '/saved': 'Saved Accounts',
  '/insights': 'Insight Center',
  '/settings': 'Admin Settings'
};

const Layout = () => {
  const { filters, handleFilterChange, clearFilters, error, toast } = useAppContext();
  const location = useLocation();
  const title = useMemo(() => titleMap[location.pathname] || 'Roomvu Churn', [location.pathname]);

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="brand">
          <span>Roomvu</span>
          <small>Churn Insight System</small>
        </div>
        <nav>
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className="nav-link">
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="main-panel">
        <header className="topbar">
          <div>
            <h1>{title}</h1>
            <p>Internal view for churn, saves, and descriptive insights.</p>
          </div>
          <div className="topbar-actions">
            <div className="combo-input">
              <input
                type="search"
                placeholder="Search customers, reasons, closers..."
                value={filters.query || ''}
                onChange={(e) => handleFilterChange('query', e.target.value)}
              />
              {filters.query && (
                <button className="chip ghost clear" onClick={() => handleFilterChange('query', '')}>
                  Clear
                </button>
              )}
            </div>
            <button className="ghost" onClick={clearFilters}>
              Reset filters
            </button>
          </div>
        </header>
        <div className="content-shell">
          {error && <div className="banner error">{error}</div>}
          {toast && <div className="banner success">{toast}</div>}
          <main className="page-body">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;


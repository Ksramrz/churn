import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

const palette = ['#6246ea', '#f06f51', '#ffc857', '#2a9d8f', '#8ac926', '#ff595e', '#1982c4'];

const defaultFilters = {
  startDate: '',
  endDate: '',
  closer: '',
  segment: '',
  reason: '',
  saved: 'all'
};

const defaultForm = {
  customerLookup: '',
  customer_id: '',
  cancellation_date: dayjs().format('YYYY-MM-DD'),
  primary_reason: '',
  secondary_notes: '',
  usage_downloads: 0,
  usage_posts: 0,
  usage_logins: 0,
  usage_minutes: 0,
  closer_name: '',
  saved_flag: false,
  saved_by: '',
  save_reason: '',
  save_notes: ''
};

const savedFilterOptions = [
  { value: 'all', label: 'All' },
  { value: 'saved', label: 'Saved only' },
  { value: 'lost', label: 'Not saved' }
];

const fetchJson = async (path, init) => {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (response.status === 204) {
    return [];
  }
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error || `Request failed (${response.status})`);
  }
  return response.json();
};

const Card = ({ title, actions, children }) => (
  <div className="card">
    <div className="card-header">
      <h3>{title}</h3>
      {actions}
    </div>
    {children}
  </div>
);

const Kpi = ({ label, value }) => (
  <div className="kpi">
    <p>{label}</p>
    <strong>{value}</strong>
  </div>
);

const Table = ({ columns, rows, emptyLabel }) => (
  <div className="table-wrapper">
    <table>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.accessor}>{col.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length ? (
          rows.map((row) => (
            <tr key={row.id}>
              {columns.map((col) => (
                <td key={col.accessor}>{row[col.accessor]}</td>
              ))}
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={columns.length} className="empty-state">
              {emptyLabel}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

function App() {
  const [filters, setFilters] = useState(defaultFilters);
  const [formData, setFormData] = useState(defaultForm);
  const [customers, setCustomers] = useState([]);
  const [options, setOptions] = useState({ closers: [], segments: [], reasons: [] });
  const [cancellations, setCancellations] = useState([]);
  const [overview, setOverview] = useState(null);
  const [reasonData, setReasonData] = useState({ overall: [], bySegment: {} });
  const [monthlyChurn, setMonthlyChurn] = useState([]);
  const [closerStats, setCloserStats] = useState([]);
  const [savedCases, setSavedCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    const bootstrap = async () => {
      const [metadata, customerList] = await Promise.all([
        fetchJson('/metadata/options'),
        fetchJson('/customers')
      ]);
      setOptions(metadata);
      setCustomers(customerList);
      setFormData((prev) => ({
        ...prev,
        closer_name: metadata.closers?.[0] || ''
      }));
    };

    bootstrap().catch((err) => setError(err.message));
  }, []);

  const buildQuery = useCallback(() => {
    const query = new URLSearchParams();
    if (filters.startDate) query.append('startDate', filters.startDate);
    if (filters.endDate) query.append('endDate', filters.endDate);
    if (filters.closer) query.append('closer', filters.closer);
    if (filters.segment) query.append('segment', filters.segment);
    if (filters.reason) query.append('reason', filters.reason);
    if (filters.saved === 'saved') query.append('saved', 'true');
    if (filters.saved === 'lost') query.append('saved', 'false');
    return query.toString();
  }, [filters]);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = buildQuery();
      const [
        cancellationRows,
        overviewResponse,
        reasonResponse,
        monthlyResponse,
        closerResponse,
        savedResponse
      ] = await Promise.all([
        fetchJson(`/cancellations${query ? `?${query}` : ''}`),
        fetchJson('/stats/overview'),
        fetchJson('/stats/reasons'),
        fetchJson('/stats/monthly-churn'),
        fetchJson('/stats/closers'),
        fetchJson('/stats/saved-cases')
      ]);

      setCancellations(cancellationRows);
      setOverview(overviewResponse);
      setReasonData(reasonResponse);
      setMonthlyChurn(monthlyResponse);
      setCloserStats(closerResponse);
      setSavedCases(savedResponse);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleCustomerInput = (value) => {
    setFormData((prev) => {
      const match =
        customers.find(
          (customer) =>
            `${customer.name} (${customer.email})` === value || String(customer.id) === value
        ) || null;

      return {
        ...prev,
        customerLookup: value,
        customer_id: match ? match.id : ''
      };
    });
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      ...defaultForm,
      closer_name: options.closers?.[0] || ''
    });
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setToast('');

    if (!formData.customer_id) {
      setError('Select a customer from the list to log a cancellation.');
      return;
    }

    if (!formData.primary_reason) {
      setError('Primary reason is required.');
      return;
    }

    setFormSubmitting(true);
    try {
      const payload = {
        customer_id: Number(formData.customer_id),
        cancellation_date: formData.cancellation_date,
        primary_reason: formData.primary_reason,
        secondary_notes: formData.secondary_notes,
        usage_downloads: Number(formData.usage_downloads) || 0,
        usage_posts: Number(formData.usage_posts) || 0,
        usage_logins: Number(formData.usage_logins) || 0,
        usage_minutes: Number(formData.usage_minutes) || 0,
        closer_name: formData.closer_name,
        saved_flag: Boolean(formData.saved_flag),
        saved_by: formData.saved_flag ? formData.saved_by : null,
        save_reason: formData.saved_flag ? formData.save_reason : null,
        save_notes: formData.saved_flag ? formData.save_notes : null
      };

      await fetchJson('/cancellations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setToast('Cancellation captured successfully.');
      resetForm();
      loadAnalytics();
    } catch (err) {
      setError(err.message);
    } finally {
      setFormSubmitting(false);
      setTimeout(() => setToast(''), 4000);
    }
  };

  const reasonPieData = reasonData?.overall || [];
  const stackedConfig = useMemo(() => {
    const bySegment = reasonData?.bySegment || {};
    const reasonsSet = new Set();
    Object.values(bySegment).forEach((entries) =>
      entries.forEach((entry) => reasonsSet.add(entry.reason))
    );
    const stackKeys = Array.from(reasonsSet);
    const data = Object.entries(bySegment).map(([segment, entries]) => {
      const row = { segment };
      stackKeys.forEach((key) => {
        row[key] = entries.find((entry) => entry.reason === key)?.value || 0;
      });
      return row;
    });
    return { data, stackKeys };
  }, [reasonData]);

  const monthlyChartData = monthlyChurn.map((entry) => ({
    month: dayjs(entry.month).format('MMM YY'),
    cancellations: entry.value
  }));

  const closerChartData = closerStats.map((closer) => ({
    name: closer.name,
    Saves: closer.saves,
    Losses: closer.cancellations
  }));

  const cancellationColumns = [
    { label: 'Customer', accessor: 'customer_name' },
    { label: 'Segment', accessor: 'segment' },
    { label: 'Closer', accessor: 'closer_name' },
    { label: 'Reason', accessor: 'primary_reason' },
    { label: 'Saved', accessor: 'saved_flag_display' },
    { label: 'Date', accessor: 'cancellation_date' },
    { label: 'Days on platform', accessor: 'days_on_platform' }
  ];

  const cancellationRows = cancellations.map((row) => ({
    ...row,
    saved_flag_display: row.saved_flag ? 'Yes' : 'No'
  }));

  const savedColumns = [
    { label: 'Customer', accessor: 'customer_name' },
    { label: 'Closer', accessor: 'closer_name' },
    { label: 'Saved by', accessor: 'saved_by' },
    { label: 'Reason', accessor: 'save_reason' },
    { label: 'Notes', accessor: 'save_notes' }
  ];

  const savedRows = savedCases.map((row) => ({
    ...row,
    save_reason: row.save_reason || '-',
    save_notes: row.save_notes || '-'
  }));

  const overviewTotals = overview?.totals;

  const handleExport = (path) => {
    window.open(`${API_BASE}${path}`, '_blank', 'noopener');
  };

  return (
    <div className="app-shell">
      <header>
        <div>
          <h1>Roomvu Churn Insight System</h1>
          <p>Live view of cancellations, saves, and descriptive insights.</p>
        </div>
        <div className="header-actions">
          <button onClick={() => handleExport('/exports/cancellations.csv')}>Export CSV</button>
          <button onClick={() => handleExport('/exports/saved-cases.csv')}>Saved CSV</button>
          <button onClick={() => handleExport('/exports/monthly-report.pdf')}>Monthly PDF</button>
        </div>
      </header>

      {error && <div className="banner error">{error}</div>}
      {toast && <div className="banner success">{toast}</div>}

      <div className="layout">
        <section className="form-panel">
          <Card title="Cancellation Intake">
            <form onSubmit={handleFormSubmit} className="form-grid">
              <label>
                Customer
                <input
                  list="customers"
                  value={formData.customerLookup}
                  onChange={(e) => handleCustomerInput(e.target.value)}
                  placeholder="Start typing customer name"
                />
                <datalist id="customers">
                  {customers.map((customer) => (
                    <option
                      key={customer.id}
                      value={`${customer.name} (${customer.email})`}
                      data-id={customer.id}
                    />
                  ))}
                </datalist>
              </label>

              <label>
                Closer
                <select
                  value={formData.closer_name}
                  onChange={(e) => handleFormChange('closer_name', e.target.value)}
                >
                  {options.closers?.map((closer) => (
                    <option key={closer} value={closer}>
                      {closer}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Cancellation date
                <input
                  type="date"
                  value={formData.cancellation_date}
                  onChange={(e) => handleFormChange('cancellation_date', e.target.value)}
                />
              </label>

              <label>
                Primary reason
                <input
                  list="reasons"
                  value={formData.primary_reason}
                  onChange={(e) => handleFormChange('primary_reason', e.target.value)}
                  placeholder="Content not relevant, Not getting results..."
                />
                <datalist id="reasons">
                  {options.reasons?.map((reason) => (
                    <option key={reason} value={reason} />
                  ))}
                </datalist>
              </label>

              <label className="full">
                Secondary notes
                <textarea
                  value={formData.secondary_notes}
                  onChange={(e) => handleFormChange('secondary_notes', e.target.value)}
                  rows={2}
                />
              </label>

              <label>
                Usage downloads
                <input
                  type="number"
                  min="0"
                  value={formData.usage_downloads}
                  onChange={(e) => handleFormChange('usage_downloads', e.target.value)}
                />
              </label>

              <label>
                Usage posts
                <input
                  type="number"
                  min="0"
                  value={formData.usage_posts}
                  onChange={(e) => handleFormChange('usage_posts', e.target.value)}
                />
              </label>

              <label>
                Usage logins
                <input
                  type="number"
                  min="0"
                  value={formData.usage_logins}
                  onChange={(e) => handleFormChange('usage_logins', e.target.value)}
                />
              </label>

              <label>
                Usage minutes
                <input
                  type="number"
                  min="0"
                  value={formData.usage_minutes}
                  onChange={(e) => handleFormChange('usage_minutes', e.target.value)}
                />
              </label>

              <label className="toggle full">
                <input
                  type="checkbox"
                  checked={formData.saved_flag}
                  onChange={(e) => handleFormChange('saved_flag', e.target.checked)}
                />
                Saved on the call?
              </label>

              {formData.saved_flag && (
                <>
                  <label>
                    Saved by
                    <input
                      value={formData.saved_by}
                      onChange={(e) => handleFormChange('saved_by', e.target.value)}
                    />
                  </label>
                  <label>
                    Save reason
                    <input
                      value={formData.save_reason}
                      onChange={(e) => handleFormChange('save_reason', e.target.value)}
                    />
                  </label>
                  <label className="full">
                    Save notes
                    <textarea
                      value={formData.save_notes}
                      onChange={(e) => handleFormChange('save_notes', e.target.value)}
                      rows={2}
                    />
                  </label>
                </>
              )}

              <div className="form-actions">
                <button type="button" className="ghost" onClick={resetForm}>
                  Reset
                </button>
                <button type="submit" disabled={formSubmitting}>
                  {formSubmitting ? 'Saving...' : 'Log cancellation'}
                </button>
              </div>
            </form>
          </Card>
          <Card title="Insights">
            <ul className="insights">
              {overview?.insights?.map((insight, index) => (
                <li key={index}>{insight}</li>
              ))}
              {!overview?.insights?.length && <li>Insights will appear once data loads.</li>}
            </ul>
          </Card>
        </section>

        <section className="analytics-panel">
          <Card
            title="Filters"
            actions={
              <button className="ghost" onClick={() => setFilters(defaultFilters)}>
                Clear
              </button>
            }
          >
            <div className="filter-grid">
              <label>
                Start date
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                />
              </label>
              <label>
                End date
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                />
              </label>
              <label>
                Closer
                <select
                  value={filters.closer}
                  onChange={(e) => handleFilterChange('closer', e.target.value)}
                >
                  <option value="">All closers</option>
                  {options.closers?.map((closer) => (
                    <option key={closer} value={closer}>
                      {closer}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Segment
                <select
                  value={filters.segment}
                  onChange={(e) => handleFilterChange('segment', e.target.value)}
                >
                  <option value="">All segments</option>
                  {options.segments?.map((segment) => (
                    <option key={segment} value={segment}>
                      {segment}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Reason
                <select
                  value={filters.reason}
                  onChange={(e) => handleFilterChange('reason', e.target.value)}
                >
                  <option value="">All reasons</option>
                  {options.reasons?.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Saved status
                <select
                  value={filters.saved}
                  onChange={(e) => handleFilterChange('saved', e.target.value)}
                >
                  {savedFilterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Card>

          <Card title="KPIs">
            <div className="kpi-grid">
              <Kpi label="Total cancellations" value={overviewTotals?.totalCancellations ?? 0} />
              <Kpi label="Total saved cases" value={overviewTotals?.totalSaved ?? 0} />
              <Kpi
                label="Save rate"
                value={`${((overviewTotals?.saveRate || 0) * 100).toFixed(1)}%`}
              />
              <Kpi
                label="Avg days before cancel"
                value={overviewTotals?.avgDaysOnPlatform ?? 0}
              />
            </div>
            <div className="top-reasons">
              <h4>Top reasons</h4>
              <ol>
                {overviewTotals?.topReasons?.map((reason) => (
                  <li key={reason.reason}>
                    {reason.reason} ({reason.count})
                  </li>
                )) || <li>No cancellations yet.</li>}
              </ol>
            </div>
          </Card>

          <div className="chart-grid">
            <Card title="Cancellations by reason">
              <div className="chart">
                {reasonPieData.length ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={reasonPieData}
                        dataKey="value"
                        nameKey="label"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                      >
                        {reasonPieData.map((entry, index) => (
                          <Cell key={entry.label} fill={palette[index % palette.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="empty-state">No data yet</p>
                )}
              </div>
            </Card>

            <Card title="Cancellations by month">
              <div className="chart">
                {monthlyChartData.length ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={monthlyChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="cancellations" fill="#6246ea" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="empty-state">No data yet</p>
                )}
              </div>
            </Card>

            <Card title="Reason by segment (stacked)">
              <div className="chart">
                {stackedConfig.data.length ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={stackedConfig.data}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="segment" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      {stackedConfig.stackKeys.map((key, index) => (
                        <Bar
                          key={key}
                          dataKey={key}
                          stackId="segment"
                          fill={palette[index % palette.length]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="empty-state">Add more data to unlock this view.</p>
                )}
              </div>
            </Card>

            <Card title="Closer performance (saves vs cancellations)">
              <div className="chart">
                {closerChartData.length ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={closerChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Saves" stackId="a" fill="#2a9d8f" />
                      <Bar dataKey="Losses" stackId="a" fill="#f94144" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="empty-state">No closer activity yet.</p>
                )}
              </div>
            </Card>
          </div>

          <Card title="Cancellations list">
            <Table
              columns={cancellationColumns}
              rows={cancellationRows}
              emptyLabel={loading ? 'Loading...' : 'No cancellations match your filters.'}
            />
          </Card>

          <Card title="Saved cases">
            <Table
              columns={savedColumns}
              rows={savedRows}
              emptyLabel="No saved cases logged yet."
            />
          </Card>
        </section>
      </div>
    </div>
  );
}

export default App;

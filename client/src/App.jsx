import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardPage from './pages/Dashboard';
import IntakePage from './pages/Intake';
import SavedCasesPage from './pages/SavedCases';
import InsightsPage from './pages/Insights';
import SettingsPage from './pages/Settings';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
const palette = ['#6c63ff', '#ff7b72', '#fec260', '#2a9d8f', '#8ac926', '#ff595e', '#1982c4'];
const defaultAgentTypes = ['Realtor', 'Mortgage Broker', 'Insurance Advisor', 'Financial Advisor'];
const BASE_PLANS = [
  'Basic Monthly',
  'Basic Yearly',
  'Premium Monthly',
  'Premium 6 Month',
  'Premium Yearly',
  'Platinum 6 Month',
  'Platinum Yearly',
  'Diamond 6 Month',
  'Diamond Yearly'
];
const reasonPresets = [
  'Content not relevant',
  'Not getting results',
  'Pricing objection',
  'Lead quality concerns',
  'No time to focus',
  'Switched to competitor'
];
const savedFilterOptions = [
  { value: 'all', label: 'All' },
  { value: 'saved', label: 'Saved only' },
  { value: 'lost', label: 'Not saved' }
];
const defaultFilters = {
  startDate: '',
  endDate: '',
  closer: '',
  segment: '',
  reason: '',
  saved: 'all',
  query: ''
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
  save_notes: '',
  zoho_ticket_url: '',
  churn_amount: '',
  agent_plan: BASE_PLANS[0],
  saved_revenue: '',
  funds_disputed: false,
  newCustomerEmail: '',
  newCustomerSegment: '',
  newCustomerSource: '',
  newCustomerStart: ''
};

const fetchJson = async (path, init) => {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (response.status === 204) return [];
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error || `Request failed (${response.status})`);
  }
  return response.json();
};

export const AppContext = createContext(null);
export const useAppContext = () => useContext(AppContext);

function App() {
  const [filters, setFilters] = useState(defaultFilters);
  const [formData, setFormData] = useState(defaultForm);
  const [customers, setCustomers] = useState([]);
  const [options, setOptions] = useState({
    closers: [],
    segments: [],
    reasons: [],
    agentTypes: defaultAgentTypes
  });
  const [planOptions, setPlanOptions] = useState(BASE_PLANS);
  const [tempSettings, setTempSettings] = useState({
    closers: [],
    reasons: reasonPresets,
    plans: BASE_PLANS,
    agentTypes: defaultAgentTypes
  });
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
      setOptions((prev) => ({
        ...prev,
        ...metadata,
        agentTypes: metadata.agentTypes?.length ? metadata.agentTypes : defaultAgentTypes
      }));
      setPlanOptions(BASE_PLANS);
      setTempSettings({
        closers: metadata.closers || [],
        reasons: metadata.reasons?.length ? metadata.reasons : reasonPresets,
        plans: BASE_PLANS,
        agentTypes: metadata.agentTypes?.length ? metadata.agentTypes : defaultAgentTypes
      });
      setCustomers(customerList);
      setFormData((prev) => ({
        ...prev,
        closer_name: metadata.closers?.[0] || '',
        agent_plan: BASE_PLANS[0]
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
    if (filters.query) query.append('query', filters.query);
    return query.toString();
  }, [filters]);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = buildQuery();
      const [cancellationRows, overviewResponse, reasonResponse, monthlyResponse, closerResponse, savedResponse] =
        await Promise.all([
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

  const createCustomer = useCallback(
    async ({ name, email, segment, sourceCampaign, subscriptionStartDate }) => {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        segment: segment || null,
        source_campaign: sourceCampaign || null,
        subscription_start_date: subscriptionStartDate || null
      };

      const newCustomer = await fetchJson('/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setCustomers((prev) => [...prev, newCustomer]);
      return newCustomer;
    },
    [setCustomers]
  );

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters(defaultFilters);
  };

  const clearCustomerSelection = () => {
    setFormData((prev) => ({
      ...prev,
      customer_id: '',
      customerLookup: '',
      newCustomerEmail: '',
      newCustomerSegment: '',
      newCustomerSource: '',
      newCustomerStart: ''
    }));
  };

  const handleCustomerInput = (value) => {
    setFormData((prev) => ({ ...prev, customerLookup: value, customer_id: '' }));
  };

  const customerSuggestions = useMemo(() => {
    if (!formData.customerLookup || formData.customer_id) return [];
    const lookup = formData.customerLookup.toLowerCase();
    return customers
      .filter(
        (customer) =>
          customer.name.toLowerCase().includes(lookup) || customer.email.toLowerCase().includes(lookup)
      )
      .slice(0, 5);
  }, [customers, formData.customerLookup, formData.customer_id]);

  const selectCustomer = (customer) => {
    setFormData((prev) => ({
      ...prev,
      customer_id: customer.id,
      customerLookup: `${customer.name} (${customer.email})`,
      newCustomerEmail: '',
      newCustomerSegment: '',
      newCustomerSource: '',
      newCustomerStart: ''
    }));
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({ ...defaultForm, closer_name: options.closers?.[0] || '', agent_plan: planOptions[0] });
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setToast('');

    if (!formData.primary_reason) {
      setError('Primary reason is required.');
      return;
    }

    const hasExistingCustomer = Boolean(formData.customer_id);
    const typedName = formData.customerLookup.trim();
    const typedEmail = formData.newCustomerEmail.trim();

    if (!hasExistingCustomer && !typedName) {
      setError('Type the customer name or select an existing profile.');
      return;
    }

    if (!hasExistingCustomer && !typedEmail) {
      setError('Customer email is required for new profiles.');
      return;
    }

    setFormSubmitting(true);
    try {
      let customerId = hasExistingCustomer ? Number(formData.customer_id) : null;

      if (!customerId) {
        const newCustomer = await createCustomer({
          name: typedName,
          email: typedEmail,
          segment: formData.newCustomerSegment || null,
          sourceCampaign: formData.newCustomerSource || null,
          subscriptionStartDate: formData.newCustomerStart || null
        });
        customerId = newCustomer.id;
      }

      const payload = {
        customer_id: Number(customerId),
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
        save_notes: formData.saved_flag ? formData.save_notes : null,
        zoho_ticket_url: formData.zoho_ticket_url || null,
        churn_amount: formData.churn_amount ? Number(formData.churn_amount) : null,
        agent_plan: formData.agent_plan || null,
        saved_revenue: formData.saved_revenue ? Number(formData.saved_revenue) : null,
        funds_disputed: Boolean(formData.funds_disputed)
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

  const handleExport = (path) => {
    window.open(`${API_BASE}${path}`, '_blank', 'noopener');
  };

  const updateCancellation = async (id, updates) => {
    try {
      await fetchJson(`/cancellations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      setToast('Cancellation updated.');
      loadAnalytics();
    } catch (err) {
      setError(err.message);
    }
  };

  const contextValue = {
    API_BASE,
    palette,
    planOptions,
    filters,
    defaultFilters,
    savedFilterOptions,
    reasonPresets,
    options,
    overview,
    reasonData,
    monthlyChurn,
    closerStats,
    cancellations,
    savedCases,
    tempSettings,
    loading,
    error,
    toast,
    formData,
    formSubmitting,
    customerSuggestions,
    handleFilterChange,
    clearFilters,
    handleCustomerInput,
    clearCustomerSelection,
    selectCustomer,
    handleFormChange,
    handleFormSubmit,
    resetForm,
    setError,
    setToast,
    handleExport,
    updateCancellation,
    setTempSettings,
    setOptions,
    setPlanOptions
  };

  return (
    <AppContext.Provider value={contextValue}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/intake" element={<IntakePage />} />
          <Route path="/saved" element={<SavedCasesPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </AppContext.Provider>
  );
}

export default App;

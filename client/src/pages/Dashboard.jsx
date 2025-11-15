import { useMemo } from 'react';
import dayjs from 'dayjs';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { Card, Kpi, Table } from '../components/Primitives';
import { useAppContext } from '../App';

const DashboardPage = () => {
  const {
    filters,
    handleFilterChange,
    clearFilters,
    savedFilterOptions,
    reasonPresets,
    options,
    overview,
    reasonData,
    monthlyChurn,
    closerStats,
    cancellations,
    loading,
    palette,
    handleExport,
    updateCancellation
  } = useAppContext();

  const currency = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
      }),
    []
  );

  const reasonPieData = (reasonData?.overall || []).map((entry, index) => ({
    ...entry,
    fill: palette[index % palette.length]
  }));
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

  const handleSavedToggle = (row) => {
    const payload = row.saved_flag
      ? { saved_flag: false }
      : {
          saved_flag: true,
          saved_by: row.saved_by || row.closer_name,
          save_reason: row.save_reason || 'Saved via dashboard'
        };
    updateCancellation(row.id, payload);
  };

  const handleDisputeToggle = (row) => {
    updateCancellation(row.id, { funds_disputed: !row.funds_disputed });
  };

  const cancellationColumns = [
    { label: 'Customer', accessor: 'customer_name' },
    { label: 'Agent type', accessor: 'segment' },
    { label: 'Plan', accessor: 'agent_plan' },
    { label: 'Closer', accessor: 'closer_name' },
    { label: 'Reason', accessor: 'primary_reason' },
    { label: 'Churn $', accessor: 'churn_amount_display' },
    { label: 'Saved $', accessor: 'saved_revenue_display' },
    { label: 'Saved?', accessor: 'saved_flag_display' },
    { label: 'Disputed?', accessor: 'funds_disputed_display' },
    { label: 'Zoho ticket', accessor: 'ticket_link' },
    { label: 'Actions', accessor: 'action_buttons' },
    { label: 'Date', accessor: 'cancellation_date' },
    { label: 'Days on platform', accessor: 'days_on_platform' }
  ];

  const cancellationRows = cancellations.map((row) => ({
    ...row,
    saved_flag_display: row.saved_flag ? 'Yes' : 'No',
    funds_disputed_display: row.funds_disputed ? 'Yes' : 'No',
    churn_amount_display: row.churn_amount ? currency.format(row.churn_amount) : '—',
    saved_revenue_display: row.saved_revenue ? currency.format(row.saved_revenue) : '—',
    ticket_link: row.zoho_ticket_url ? (
      <a href={row.zoho_ticket_url} target="_blank" rel="noreferrer">
        Ticket
      </a>
    ) : (
      '—'
    ),
    action_buttons: (
      <div className="table-actions">
        <button className="chip ghost" onClick={() => handleSavedToggle(row)}>
          {row.saved_flag ? 'Mark lost' : 'Mark saved'}
        </button>
        <button className="chip ghost" onClick={() => handleDisputeToggle(row)}>
          {row.funds_disputed ? 'Clear dispute' : 'Flag dispute'}
        </button>
      </div>
    )
  }));

  const overviewTotals = overview?.totals;

  return (
    <>
      <Card title="Quick exports" subtitle="Pull the latest CSV/PDF snapshots">
        <div className="header-actions">
          <button onClick={() => handleExport('/exports/cancellations.csv')}>Export CSV</button>
          <button onClick={() => handleExport('/exports/saved-cases.csv')}>Saved CSV</button>
          <button onClick={() => handleExport('/exports/monthly-report.pdf')}>Monthly PDF</button>
        </div>
      </Card>

      <Card title="Filters" actions={<button className="ghost" onClick={clearFilters}>Clear all</button>}>
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
            <select value={filters.closer} onChange={(e) => handleFilterChange('closer', e.target.value)}>
              <option value="">All closers</option>
              {options.closers?.map((closer) => (
                <option key={closer} value={closer}>
                  {closer}
                </option>
              ))}
            </select>
          </label>
          <label>
            Agent type
            <select value={filters.segment} onChange={(e) => handleFilterChange('segment', e.target.value)}>
              <option value="">All agent types</option>
              {options.agentTypes?.map((segment) => (
                <option key={segment} value={segment}>
                  {segment}
                </option>
              ))}
            </select>
          </label>
          <label>
            Reason
            <select value={filters.reason} onChange={(e) => handleFilterChange('reason', e.target.value)}>
              <option value="">All reasons</option>
              {(options.reasons?.length ? options.reasons : reasonPresets).map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </label>
          <label>
            Saved status
            <select value={filters.saved} onChange={(e) => handleFilterChange('saved', e.target.value)}>
              {savedFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      <Card title="Insights" subtitle="Top observations based on current filters">
        <ul className="insights">
          {overview?.insights?.map((insight, index) => (
            <li key={index}>{insight}</li>
          )) || <li>Insights will appear once data loads.</li>}
        </ul>
      </Card>

      <Card title="Key metrics">
        <div className="kpi-grid">
          <Kpi label="Total cancellations" value={overviewTotals?.totalCancellations ?? 0} />
          <Kpi label="Total saved cases" value={overviewTotals?.totalSaved ?? 0} />
          <Kpi label="Save rate" value={`${((overviewTotals?.saveRate || 0) * 100).toFixed(1)}%`} />
          <Kpi label="Avg days before cancel" value={overviewTotals?.avgDaysOnPlatform ?? 0} />
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
              <ResponsiveContainer width="100%" height={280}>
                <RadialBarChart
                  innerRadius="20%"
                  outerRadius="100%"
                  barSize={18}
                  data={reasonPieData}
                  startAngle={90}
                  endAngle={-270}
                >
                  <RadialBar
                    minAngle={15}
                    label={{ position: 'insideStart', fill: '#fff', fontSize: 12 }}
                    background
                    dataKey="value"
                  />
                  <Legend iconType="circle" layout="vertical" verticalAlign="middle" align="right" />
                  <Tooltip />
                </RadialBarChart>
              </ResponsiveContainer>
            ) : (
              <p className="empty-state">No data yet</p>
            )}
          </div>
        </Card>

        <Card title="Cancellations trend">
          <div className="chart">
            {monthlyChartData.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={monthlyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="churnGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6246ea" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#6246ea" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="cancellations"
                    stroke="#6246ea"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#churnGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="empty-state">No data yet</p>
            )}
          </div>
        </Card>

        <Card title="Reason by agent type (stacked)">
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
                    <Bar key={key} dataKey={key} stackId="segment" fill={palette[index % palette.length]} />
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
    </>
  );
};

export default DashboardPage;


import { useMemo } from 'react';
import { Card, Table } from '../components/Primitives';
import { useAppContext } from '../App';

const SavedCasesPage = () => {
  const { savedCases, loading } = useAppContext();

  const currency = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
      }),
    []
  );

  const savedColumns = [
    { label: 'Customer', accessor: 'customer_name' },
    { label: 'Plan', accessor: 'agent_plan' },
    { label: 'Closer', accessor: 'closer_name' },
    { label: 'Saved by', accessor: 'saved_by' },
    { label: 'Reason', accessor: 'save_reason' },
    { label: 'Saved $', accessor: 'saved_revenue_display' },
    { label: 'Ticket', accessor: 'ticket_link' },
    { label: 'Disputed?', accessor: 'funds_disputed_display' },
    { label: 'Notes', accessor: 'save_notes' },
    { label: 'Date', accessor: 'cancellation_date' }
  ];

  const savedRows = savedCases.map((row) => ({
    ...row,
    save_reason: row.save_reason || '-',
    save_notes: row.save_notes || '-',
    saved_revenue_display: row.saved_revenue ? currency.format(row.saved_revenue) : '—',
    funds_disputed_display: row.funds_disputed ? 'Yes' : 'No',
    ticket_link: row.zoho_ticket_url ? (
      <a href={row.zoho_ticket_url} target="_blank" rel="noreferrer">
        Ticket
      </a>
    ) : (
      '—'
    )
  }));

  return (
    <Card title="Saved accounts" subtitle="Deep dives for accounts retained on the call">
      <Table
        columns={savedColumns}
        rows={savedRows}
        emptyLabel={loading ? 'Loading...' : 'No saved cases logged yet.'}
      />
    </Card>
  );
};

export default SavedCasesPage;

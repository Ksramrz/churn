const dayjs = require('dayjs');
const { REASON_ALIASES } = require('./config');

const normalizeReason = (rawReason = '') => {
  const cleaned = String(rawReason || '')
    .trim()
    .toLowerCase();

  if (!cleaned) return 'Other';

  return REASON_ALIASES[cleaned] || rawReason.trim() || 'Other';
};

const calculateDaysOnPlatform = (subscriptionStart, cancellationDate) => {
  const start = dayjs(subscriptionStart);
  const end = dayjs(cancellationDate);
  if (!start.isValid() || !end.isValid()) return null;
  return Math.max(end.diff(start, 'day'), 0);
};

const mapCancellationRow = (row) => ({
  id: row.id,
  customer_id: row.customer_id,
  customer_name: row.customer_name,
  email: row.email,
  segment: row.segment,
  subscription_start_date: row.subscription_start_date,
  source_campaign: row.source_campaign,
  cancellation_date: row.cancellation_date,
  primary_reason: row.primary_reason,
  secondary_notes: row.secondary_notes,
  usage_downloads: row.usage_downloads,
  usage_posts: row.usage_posts,
  usage_logins: row.usage_logins,
  usage_minutes: row.usage_minutes,
  days_on_platform: row.days_on_platform,
  closer_name: row.closer_name,
  saved_flag: Boolean(row.saved_flag),
  saved_by: row.saved_by,
  save_reason: row.save_reason,
  save_notes: row.save_notes,
  zoho_ticket_url: row.zoho_ticket_url,
  churn_amount: row.churn_amount,
  agent_plan: row.agent_plan,
  saved_revenue: row.saved_revenue
});

const toCsv = (rows) => {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escapeCell = (value) => {
    if (value === null || value === undefined) return '';
    const stringValue = String(value).replace(/"/g, '""');
    return `"${stringValue}"`;
  };

  const body = rows
    .map((row) => headers.map((header) => escapeCell(row[header])).join(','))
    .join('\n');

  return `${headers.join(',')}\n${body}`;
};

module.exports = {
  normalizeReason,
  calculateDaysOnPlatform,
  mapCancellationRow,
  toCsv
};


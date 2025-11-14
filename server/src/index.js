const express = require('express');
const cors = require('cors');
const dayjs = require('dayjs');
const db = require('./db');
const { ROOMVU_CLOSERS } = require('./config');
const {
  normalizeReason,
  calculateDaysOnPlatform,
  mapCancellationRow,
  toCsv
} = require('./utils');
const { generateInsights } = require('./insights');
const { buildMonthlyReport } = require('./reporting');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const baseCancellationSelect = `
  SELECT
    can.*,
    cust.name AS customer_name,
    cust.email,
    cust.segment,
    cust.subscription_start_date,
    cust.source_campaign
  FROM cancellations can
  JOIN customers cust ON cust.id = can.customer_id
`;

const buildFilterClause = (query) => {
  const filters = [];
  const params = {};

  if (query.startDate) {
    filters.push('can.cancellation_date >= @startDate');
    params.startDate = query.startDate;
  }

  if (query.endDate) {
    filters.push('can.cancellation_date <= @endDate');
    params.endDate = query.endDate;
  }

  if (query.closer) {
    filters.push('can.closer_name = @closer');
    params.closer = query.closer;
  }

  if (query.segment) {
    filters.push('cust.segment = @segment');
    params.segment = query.segment;
  }

  if (query.reason) {
    filters.push('can.primary_reason = @reason');
    params.reason = normalizeReason(query.reason);
  }

  if (query.saved === 'true') {
    filters.push('can.saved_flag = 1');
  } else if (query.saved === 'false') {
    filters.push('can.saved_flag = 0');
  }

  return {
    clause: filters.length ? `WHERE ${filters.join(' AND ')}` : '',
    params
  };
};

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/cancellations', (req, res) => {
  const { clause, params } = buildFilterClause(req.query);
  const rows = db.prepare(`${baseCancellationSelect} ${clause} ORDER BY can.cancellation_date DESC`).all(params);
  res.json(rows.map(mapCancellationRow));
});

app.get('/cancellations/:id', (req, res) => {
  const row = db.prepare(`${baseCancellationSelect} WHERE can.id = ?`).get(req.params.id);
  if (!row) {
    return res.status(404).json({ error: 'Cancellation not found' });
  }
  res.json(mapCancellationRow(row));
});

app.post('/cancellations', (req, res) => {
  try {
    const {
      customer_id,
      cancellation_date,
      primary_reason,
      secondary_notes,
      usage_downloads = 0,
      usage_posts = 0,
      usage_logins = 0,
      usage_minutes = 0,
      closer_name,
      saved_flag = false,
      saved_by = null,
      save_reason = null,
      save_notes = null
    } = req.body;

    if (!customer_id || !cancellation_date || !primary_reason) {
      return res.status(400).json({ error: 'customer_id, cancellation_date, and primary_reason are required.' });
    }

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const normalizedReason = normalizeReason(primary_reason);
    const days_on_platform = calculateDaysOnPlatform(
      customer.subscription_start_date,
      cancellation_date
    );

    const insert = db.prepare(`
      INSERT INTO cancellations (
        customer_id,
        cancellation_date,
        primary_reason,
        secondary_notes,
        usage_downloads,
        usage_posts,
        usage_logins,
        usage_minutes,
        days_on_platform,
        closer_name,
        saved_flag,
        saved_by,
        save_reason,
        save_notes
      ) VALUES (
        @customer_id,
        @cancellation_date,
        @primary_reason,
        @secondary_notes,
        @usage_downloads,
        @usage_posts,
        @usage_logins,
        @usage_minutes,
        @days_on_platform,
        @closer_name,
        @saved_flag,
        @saved_by,
        @save_reason,
        @save_notes
      )
    `);

    const result = insert.run({
      customer_id,
      cancellation_date,
      primary_reason: normalizedReason,
      secondary_notes,
      usage_downloads,
      usage_posts,
      usage_logins,
      usage_minutes,
      days_on_platform,
      closer_name,
      saved_flag: saved_flag ? 1 : 0,
      saved_by,
      save_reason,
      save_notes
    });

    const created = db.prepare(`${baseCancellationSelect} WHERE can.id = ?`).get(result.lastInsertRowid);
    res.status(201).json(mapCancellationRow(created));
  } catch (error) {
    console.error('Failed to create cancellation', error);
    res.status(500).json({ error: 'Failed to create cancellation record.' });
  }
});

const getTotals = () => {
  const total = db.prepare('SELECT COUNT(*) as value FROM cancellations').get().value;
  const saved = db.prepare('SELECT COUNT(*) as value FROM cancellations WHERE saved_flag = 1').get().value;
  const avgDaysRow = db.prepare('SELECT AVG(days_on_platform) AS avg_days FROM cancellations').get();
  const topReasons = db
    .prepare(`
      SELECT primary_reason as reason, COUNT(*) as count
      FROM cancellations
      GROUP BY primary_reason
      ORDER BY count DESC
      LIMIT 3
    `)
    .all();
  const earlyChurn = db
    .prepare('SELECT COUNT(*) as value FROM cancellations WHERE days_on_platform IS NOT NULL AND days_on_platform <= 7')
    .get().value;

  const reasonCounts = db
    .prepare('SELECT primary_reason as reason, COUNT(*) as count FROM cancellations GROUP BY primary_reason')
    .all()
    .reduce((acc, row) => ({ ...acc, [row.reason]: row.count }), {});

  const closerRows = db
    .prepare(`
      SELECT closer_name as name,
        SUM(CASE WHEN saved_flag = 1 THEN 1 ELSE 0 END) as saves,
        COUNT(*) as total
      FROM cancellations
      GROUP BY closer_name
    `)
    .all();

  const closers = ROOMVU_CLOSERS.map((name) => {
    const match = closerRows.find((row) => row.name === name) || { saves: 0, total: 0 };
    return {
      name,
      saves: match.saves || 0,
      cancellations: (match.total || 0) - (match.saves || 0),
      total: match.total || 0,
      saveRate: match.total ? (match.saves || 0) / match.total : 0
    };
  });

  const campaignStats = db
    .prepare(`
      SELECT cust.source_campaign as campaign,
             COUNT(DISTINCT cust.id) as customers,
             COUNT(can.id) as cancellations
      FROM customers cust
      LEFT JOIN cancellations can ON can.customer_id = cust.id
      GROUP BY cust.source_campaign
    `)
    .all()
    .reduce((acc, row) => {
      acc[row.campaign || 'Unknown'] = {
        customers: row.customers,
        cancellations: row.cancellations
      };
      return acc;
    }, {});

  return {
    total,
    saved,
    avgDays: avgDaysRow?.avg_days ? Math.round(avgDaysRow.avg_days) : 0,
    topReasons,
    earlyChurn,
    reasonCounts,
    closers,
    campaignStats
  };
};

app.get('/stats/overview', (_req, res) => {
  const totals = getTotals();
  const savedRate = totals.total ? totals.saved / totals.total : 0;
  const insights = generateInsights({
    totalCancellations: totals.total,
    reasonCounts: totals.reasonCounts,
    earlyChurnCount: totals.earlyChurn,
    closerStats: totals.closers,
    campaignChurn: totals.campaignStats,
    savedRate
  });

  res.json({
    totals: {
      totalCancellations: totals.total,
      totalSaved: totals.saved,
      saveRate: savedRate,
      avgDaysOnPlatform: totals.avgDays,
      topReasons: totals.topReasons
    },
    insights
  });
});

app.get('/stats/reasons', (_req, res) => {
  const rows = db
    .prepare('SELECT primary_reason as label, COUNT(*) as value FROM cancellations GROUP BY primary_reason')
    .all();

  const bySegment = db
    .prepare(`
      SELECT cust.segment as segment,
             can.primary_reason as reason,
             COUNT(*) as value
      FROM cancellations can
      JOIN customers cust ON cust.id = can.customer_id
      GROUP BY cust.segment, can.primary_reason
    `)
    .all();

  const transformed = bySegment.reduce((acc, row) => {
    const key = row.segment || 'Unknown';
    acc[key] = acc[key] || [];
    acc[key].push({ reason: row.reason, value: row.value });
    return acc;
  }, {});

  res.json({ overall: rows, bySegment: transformed });
});

app.get('/stats/closers', (_req, res) => {
  const totals = getTotals();
  res.json(totals.closers);
});

app.get('/stats/saved-cases', (_req, res) => {
  const rows = db
    .prepare(`${baseCancellationSelect} WHERE can.saved_flag = 1 ORDER BY can.cancellation_date DESC`)
    .all()
    .map(mapCancellationRow);
  res.json(rows);
});

app.get('/stats/monthly-churn', (_req, res) => {
  const rows = db
    .prepare(`
      SELECT strftime('%Y-%m', cancellation_date) as month,
             COUNT(*) as value
      FROM cancellations
      GROUP BY month
      ORDER BY month
    `)
    .all();
  res.json(rows);
});

const getCancellationsForExport = () =>
  db
    .prepare(
      `${baseCancellationSelect}
       ORDER BY can.cancellation_date DESC`
    )
    .all()
    .map(mapCancellationRow);

app.get('/exports/cancellations.csv', (_req, res) => {
  const cancellations = getCancellationsForExport();
  if (!cancellations.length) {
    return res.status(204).end();
  }

  const csvRows = cancellations.map((row) => ({
    id: row.id,
    customer: row.customer_name,
    email: row.email,
    segment: row.segment,
    closer: row.closer_name,
    cancellation_date: row.cancellation_date,
    primary_reason: row.primary_reason,
    saved: row.saved_flag ? 'Yes' : 'No'
  }));

  const csv = toCsv(csvRows);
  res.header('Content-Type', 'text/csv');
  res.attachment('roomvu-cancellations.csv');
  res.send(csv);
});

app.get('/exports/saved-cases.csv', (_req, res) => {
  const rows = getCancellationsForExport().filter((row) => row.saved_flag);
  if (!rows.length) {
    return res.status(204).end();
  }

  const csvRows = rows.map((row) => ({
    id: row.id,
    customer: row.customer_name,
    closer: row.closer_name,
    saved_by: row.saved_by,
    save_reason: row.save_reason,
    save_notes: row.save_notes,
    cancellation_date: row.cancellation_date
  }));

  const csv = toCsv(csvRows);
  res.header('Content-Type', 'text/csv');
  res.attachment('roomvu-saved-cases.csv');
  res.send(csv);
});

app.get('/exports/monthly-report.pdf', (_req, res) => {
  const totals = getTotals();
  const savedRate = totals.total ? totals.saved / totals.total : 0;
  const insights = generateInsights({
    totalCancellations: totals.total,
    reasonCounts: totals.reasonCounts,
    earlyChurnCount: totals.earlyChurn,
    closerStats: totals.closers,
    campaignChurn: totals.campaignStats,
    savedRate
  });

  const doc = buildMonthlyReport({
    kpis: {
      'Total cancellations': totals.total,
      'Total saved cases': totals.saved,
      'Save rate': `${(savedRate * 100).toFixed(1)}%`,
      'Avg days on platform': totals.avgDays
    },
    reasons: Object.entries(totals.reasonCounts).map(([label, value]) => ({ label, value })),
    closers: totals.closers,
    insights
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=roomvu-monthly-report.pdf');
  doc.pipe(res);
});

app.get('/customers', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, name, email, segment, subscription_start_date, source_campaign
       FROM customers
       ORDER BY name`
    )
    .all();
  res.json(rows);
});

app.get('/metadata/options', (_req, res) => {
  const segments = db.prepare('SELECT DISTINCT segment FROM customers WHERE segment IS NOT NULL').all();
  const reasons = db.prepare('SELECT DISTINCT primary_reason FROM cancellations').all();
  const campaigns = db.prepare('SELECT DISTINCT source_campaign FROM customers').all();

  res.json({
    closers: ROOMVU_CLOSERS,
    segments: segments.map((row) => row.segment).filter(Boolean),
    reasons: reasons.map((row) => row.primary_reason).filter(Boolean),
    campaigns: campaigns.map((row) => row.source_campaign).filter(Boolean)
  });
});

app.listen(PORT, () => {
  console.log(`Roomvu churn insight server is running on http://localhost:${PORT}`);
});


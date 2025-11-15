const express = require('express');
const cors = require('cors');
const { pool, runMigrations } = require('./db');
const { ROOMVU_CLOSERS } = require('./config');
const { normalizeReason, calculateDaysOnPlatform, mapCancellationRow, toCsv } = require('./utils');
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
  const values = [];

  if (query.startDate) {
    values.push(query.startDate);
    filters.push(`can.cancellation_date >= $${values.length}`);
  }

  if (query.endDate) {
    values.push(query.endDate);
    filters.push(`can.cancellation_date <= $${values.length}`);
  }

  if (query.closer) {
    values.push(query.closer);
    filters.push(`can.closer_name = $${values.length}`);
  }

  if (query.segment) {
    values.push(query.segment);
    filters.push(`cust.segment = $${values.length}`);
  }

  if (query.reason) {
    const normalized = normalizeReason(query.reason);
    values.push(normalized);
    filters.push(`can.primary_reason = $${values.length}`);
  }

  if (query.saved === 'true') {
    filters.push('can.saved_flag = TRUE');
  } else if (query.saved === 'false') {
    filters.push('can.saved_flag = FALSE');
  }

  if (query.query) {
    const terms = query.query
      .split(/\s+/)
      .map((term) => term.trim())
      .filter(Boolean);
    terms.forEach((term) => {
      values.push(`%${term.toLowerCase()}%`);
      filters.push(
        `(LOWER(cust.name) LIKE $${values.length} OR LOWER(cust.email) LIKE $${values.length} OR LOWER(can.primary_reason) LIKE $${values.length} OR LOWER(can.closer_name) LIKE $${values.length})`
      );
    });
  }

  return {
    clause: filters.length ? `WHERE ${filters.join(' AND ')}` : '',
    values
  };
};

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/cancellations', async (req, res) => {
  try {
    const { clause, values } = buildFilterClause(req.query);
    const { rows } = await pool.query(
      `${baseCancellationSelect} ${clause} ORDER BY can.cancellation_date DESC`,
      values
    );
    res.json(rows.map(mapCancellationRow));
  } catch (error) {
    console.error('Failed to fetch cancellations', error);
    res.status(500).json({ error: 'Failed to fetch cancellations.' });
  }
});

app.get('/cancellations/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`${baseCancellationSelect} WHERE can.id = $1`, [req.params.id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Cancellation not found' });
    }
    res.json(mapCancellationRow(rows[0]));
  } catch (error) {
    console.error('Failed to fetch cancellation', error);
    res.status(500).json({ error: 'Failed to fetch cancellation.' });
  }
});

app.post('/cancellations', async (req, res) => {
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
      save_notes = null,
      zoho_ticket_url = null,
      churn_amount = null,
      agent_plan = null,
      saved_revenue = null
    } = req.body;

    if (!customer_id || !cancellation_date || !primary_reason) {
      return res
        .status(400)
        .json({ error: 'customer_id, cancellation_date, and primary_reason are required.' });
    }

    const customerResult = await pool.query('SELECT * FROM customers WHERE id = $1', [customer_id]);
    if (!customerResult.rows.length) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const customer = customerResult.rows[0];
    const normalizedReason = normalizeReason(primary_reason);
    const days_on_platform = calculateDaysOnPlatform(
      customer.subscription_start_date,
      cancellation_date
    );

    const insertResult = await pool.query(
      `
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
        save_notes,
        zoho_ticket_url,
        churn_amount,
        agent_plan,
        saved_revenue
        ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
        )
        RETURNING id
      `,
      [
        customer_id,
        cancellation_date,
        normalizedReason,
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
        save_notes,
        zoho_ticket_url,
        churn_amount,
        agent_plan,
        saved_revenue
      ]
    );

    const newId = insertResult.rows[0].id;
    const { rows } = await pool.query(`${baseCancellationSelect} WHERE can.id = $1`, [newId]);
    res.status(201).json(mapCancellationRow(rows[0]));
  } catch (error) {
    console.error('Failed to create cancellation', error);
    res.status(500).json({ error: 'Failed to create cancellation record.' });
  }
});

const getTotals = async () => {
  const total = Number(
    (await pool.query('SELECT COUNT(*) as value FROM cancellations')).rows[0].value || 0
  );
  const saved = Number(
    (await pool.query('SELECT COUNT(*) as value FROM cancellations WHERE saved_flag = TRUE')).rows[0]
      .value || 0
  );
  const avgDaysRow = await pool.query('SELECT AVG(days_on_platform) AS avg_days FROM cancellations');
  const topReasons = (
    await pool.query(
      `
        SELECT primary_reason as reason, COUNT(*) as count
        FROM cancellations
        GROUP BY primary_reason
        ORDER BY count DESC
        LIMIT 3
      `
    )
  ).rows;
  const earlyChurn = Number(
    (
      await pool.query(
        'SELECT COUNT(*) as value FROM cancellations WHERE days_on_platform IS NOT NULL AND days_on_platform <= 7'
      )
    ).rows[0].value || 0
  );

  const reasonCountsRows = (
    await pool.query('SELECT primary_reason as reason, COUNT(*) as count FROM cancellations GROUP BY primary_reason')
  ).rows;
  const reasonCounts = reasonCountsRows.reduce((acc, row) => {
    acc[row.reason] = Number(row.count);
    return acc;
  }, {});

  const closerRows = (
    await pool.query(`
      SELECT closer_name as name,
        SUM(CASE WHEN saved_flag THEN 1 ELSE 0 END) as saves,
        COUNT(*) as total
      FROM cancellations
      GROUP BY closer_name
    `)
  ).rows;

  const closers = ROOMVU_CLOSERS.map((name) => {
    const match = closerRows.find((row) => row.name === name) || { saves: 0, total: 0 };
    const saves = Number(match.saves || 0);
    const totalCalls = Number(match.total || 0);
    return {
      name,
      saves,
      cancellations: totalCalls - saves,
      total: totalCalls,
      saveRate: totalCalls ? saves / totalCalls : 0
    };
  });

  const campaignRows = (
    await pool.query(`
      SELECT cust.source_campaign as campaign,
             COUNT(DISTINCT cust.id) as customers,
             COUNT(can.id) as cancellations
      FROM customers cust
      LEFT JOIN cancellations can ON can.customer_id = cust.id
      GROUP BY cust.source_campaign
    `)
  ).rows;

  const campaignStats = campaignRows.reduce((acc, row) => {
    acc[row.campaign || 'Unknown'] = {
      customers: Number(row.customers),
      cancellations: Number(row.cancellations)
    };
    return acc;
  }, {});

  return {
    total,
    saved,
    avgDays: avgDaysRow.rows[0].avg_days ? Math.round(Number(avgDaysRow.rows[0].avg_days)) : 0,
    topReasons,
    earlyChurn,
    reasonCounts,
    closers,
    campaignStats
  };
};

app.get('/stats/overview', async (_req, res) => {
  try {
    const totals = await getTotals();
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
  } catch (error) {
    console.error('Failed to load overview stats', error);
    res.status(500).json({ error: 'Failed to load stats.' });
  }
});

app.get('/stats/reasons', async (_req, res) => {
  try {
    const overall = (
      await pool.query('SELECT primary_reason as label, COUNT(*) as value FROM cancellations GROUP BY primary_reason')
    ).rows;

    const bySegmentRows = (
      await pool.query(`
        SELECT cust.segment as segment,
               can.primary_reason as reason,
               COUNT(*) as value
        FROM cancellations can
        JOIN customers cust ON cust.id = can.customer_id
        GROUP BY cust.segment, can.primary_reason
      `)
    ).rows;

    const bySegment = bySegmentRows.reduce((acc, row) => {
      const key = row.segment || 'Unknown';
      acc[key] = acc[key] || [];
      acc[key].push({ reason: row.reason, value: Number(row.value) });
      return acc;
    }, {});

    res.json({ overall, bySegment });
  } catch (error) {
    console.error('Failed to load reason stats', error);
    res.status(500).json({ error: 'Failed to load stats.' });
  }
});

app.get('/stats/closers', async (_req, res) => {
  try {
    const totals = await getTotals();
    res.json(totals.closers);
  } catch (error) {
    console.error('Failed to load closer stats', error);
    res.status(500).json({ error: 'Failed to load closer stats.' });
  }
});

app.get('/stats/saved-cases', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `${baseCancellationSelect} WHERE can.saved_flag = TRUE ORDER BY can.cancellation_date DESC`
    );
    res.json(rows.map(mapCancellationRow));
  } catch (error) {
    console.error('Failed to load saved cases', error);
    res.status(500).json({ error: 'Failed to load saved cases.' });
  }
});

app.get('/stats/monthly-churn', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT TO_CHAR(cancellation_date, 'YYYY-MM') as month,
             COUNT(*) as value
      FROM cancellations
      GROUP BY month
      ORDER BY month
    `);
    res.json(rows);
  } catch (error) {
    console.error('Failed to load monthly churn', error);
    res.status(500).json({ error: 'Failed to load monthly churn.' });
  }
});

const getCancellationsForExport = async () => {
  const { rows } = await pool.query(
    `${baseCancellationSelect}
     ORDER BY can.cancellation_date DESC`
  );
  return rows.map(mapCancellationRow);
};

app.get('/exports/cancellations.csv', async (_req, res) => {
  try {
    const cancellations = await getCancellationsForExport();
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
      saved: row.saved_flag ? 'Yes' : 'No',
      agent_plan: row.agent_plan,
      churn_amount: row.churn_amount,
      zoho_ticket_url: row.zoho_ticket_url,
      saved_revenue: row.saved_revenue
    }));

    const csv = toCsv(csvRows);
    res.header('Content-Type', 'text/csv');
    res.attachment('roomvu-cancellations.csv');
    res.send(csv);
  } catch (error) {
    console.error('Failed to export cancellations', error);
    res.status(500).json({ error: 'Failed to export cancellations.' });
  }
});

app.get('/exports/saved-cases.csv', async (_req, res) => {
  try {
    const rows = (await getCancellationsForExport()).filter((row) => row.saved_flag);
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
      cancellation_date: row.cancellation_date,
      agent_plan: row.agent_plan,
      saved_revenue: row.saved_revenue,
      zoho_ticket_url: row.zoho_ticket_url
    }));

    const csv = toCsv(csvRows);
    res.header('Content-Type', 'text/csv');
    res.attachment('roomvu-saved-cases.csv');
    res.send(csv);
  } catch (error) {
    console.error('Failed to export saved cases', error);
    res.status(500).json({ error: 'Failed to export saved cases.' });
  }
});

app.get('/exports/monthly-report.pdf', async (_req, res) => {
  try {
    const totals = await getTotals();
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
  } catch (error) {
    console.error('Failed to export monthly report', error);
    res.status(500).json({ error: 'Failed to export report.' });
  }
});

app.get('/customers', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, segment, subscription_start_date, source_campaign
       FROM customers
       ORDER BY name`
    );
    res.json(rows);
  } catch (error) {
    console.error('Failed to load customers', error);
    res.status(500).json({ error: 'Failed to load customers.' });
  }
});

app.get('/metadata/options', async (_req, res) => {
  try {
    const segments = (
      await pool.query('SELECT DISTINCT segment FROM customers WHERE segment IS NOT NULL')
    ).rows;
    const reasons = (await pool.query('SELECT DISTINCT primary_reason FROM cancellations')).rows;
    const campaigns = (
      await pool.query('SELECT DISTINCT source_campaign FROM customers WHERE source_campaign IS NOT NULL')
    ).rows;

    const AGENT_TYPES = ['Realtor', 'Mortgage Broker', 'Insurance Advisor', 'Financial Advisor'];

    const agentTypes = Array.from(
      new Set([...AGENT_TYPES, ...segments.map((row) => row.segment).filter(Boolean)])
    );

    res.json({
      closers: ROOMVU_CLOSERS,
      segments: segments.map((row) => row.segment).filter(Boolean),
      reasons: reasons.map((row) => row.primary_reason).filter(Boolean),
      campaigns: campaigns.map((row) => row.source_campaign).filter(Boolean),
      agentTypes
    });
  } catch (error) {
    console.error('Failed to load metadata options', error);
    res.status(500).json({ error: 'Failed to load metadata.' });
  }
});

const start = async () => {
  try {
    await runMigrations();
    app.listen(PORT, () => {
      console.log(`Roomvu churn insight server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize database', error);
    process.exit(1);
  }
};

start();


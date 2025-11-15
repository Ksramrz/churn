const { pool, runMigrations } = require('./db');
const { ROOMVU_CLOSERS } = require('./config');
const { calculateDaysOnPlatform, normalizeReason } = require('./utils');

const customers = [
  {
    name: 'Lena Hu',
    email: 'lena.hu@roomvu.com',
    segment: 'Luxury Realtor',
    subscription_start_date: '2024-10-15',
    source_campaign: 'YouTube Masterclass'
  },
  {
    name: 'Carlos Mendes',
    email: 'carlos.mendes@roomvu.com',
    segment: 'First-time Realtor',
    subscription_start_date: '2024-11-20',
    source_campaign: 'Paid Ads - Meta'
  },
  {
    name: 'Jasmine Ogun',
    email: 'jasmine.ogun@roomvu.com',
    segment: 'Team Lead',
    subscription_start_date: '2024-09-05',
    source_campaign: 'Referral Program'
  },
  {
    name: 'Noah Park',
    email: 'noah.park@roomvu.com',
    segment: 'Commercial Realtor',
    subscription_start_date: '2024-08-18',
    source_campaign: 'Events - Inman'
  },
  {
    name: 'Sara Bell',
    email: 'sara.bell@roomvu.com',
    segment: 'Solo Agent',
    subscription_start_date: '2024-12-01',
    source_campaign: 'Roomvu Blog CTA'
  }
];

const cancellationTemplates = [
  {
    customerIndex: 0,
    cancellation_date: '2025-01-03',
    primary_reason: 'Content not relevant',
    secondary_notes: 'Needs more Vancouver luxury listings',
    usage_downloads: 4,
    usage_posts: 1,
    usage_logins: 3,
    usage_minutes: 45,
    closer_name: 'Ava Liang',
    saved_flag: 0,
    agent_plan: 'Premium Monthly',
    churn_amount: 149,
    zoho_ticket_url: 'https://desk.zoho.com/ticket/RV-1000'
  },
  {
    customerIndex: 1,
    cancellation_date: '2025-01-12',
    primary_reason: 'Not getting results',
    secondary_notes: 'No leads from ads after 3 weeks',
    usage_downloads: 1,
    usage_posts: 0,
    usage_logins: 2,
    usage_minutes: 30,
    closer_name: 'Diego Morales',
    saved_flag: 1,
    saved_by: 'Priya Shah',
    save_reason: 'Extended onboarding',
    save_notes: 'Scheduled weekly accountability check-in',
    agent_plan: 'Basic Monthly',
    churn_amount: 79,
    saved_revenue: 59,
    zoho_ticket_url: 'https://desk.zoho.com/ticket/RV-1001'
  },
  {
    customerIndex: 2,
    cancellation_date: '2025-02-02',
    primary_reason: 'Pricing objection',
    secondary_notes: 'Considering Canva Pro upgrade instead',
    usage_downloads: 3,
    usage_posts: 2,
    usage_logins: 7,
    usage_minutes: 110,
    closer_name: 'Marcus Lee',
    saved_flag: 0,
    agent_plan: 'Premium Yearly',
    churn_amount: 899
  },
  {
    customerIndex: 3,
    cancellation_date: '2025-02-10',
    primary_reason: 'Switched to competitor',
    secondary_notes: 'Broker mandated new platform',
    usage_downloads: 0,
    usage_posts: 0,
    usage_logins: 1,
    usage_minutes: 12,
    closer_name: 'Hannah Cho',
    saved_flag: 0,
    agent_plan: 'Diamond 6 Month',
    churn_amount: 1299,
    zoho_ticket_url: 'https://desk.zoho.com/ticket/RV-1002'
  },
  {
    customerIndex: 4,
    cancellation_date: '2025-02-18',
    primary_reason: 'Content not relevant',
    secondary_notes: 'Wants hyper-local scripts for Seattle',
    usage_downloads: 2,
    usage_posts: 1,
    usage_logins: 5,
    usage_minutes: 75,
    closer_name: 'Noah Patel',
    saved_flag: 1,
    saved_by: 'Noah Patel',
    save_reason: 'Customized content pack',
    save_notes: 'Provided Seattle starter kit',
    agent_plan: 'Platinum Yearly',
    churn_amount: 1599,
    saved_revenue: 800,
    zoho_ticket_url: 'https://desk.zoho.com/ticket/RV-1003'
  }
];

const activityLogs = [
  { customerIndex: 0, last_active_date: '2025-01-02', engagement_level: 'low' },
  { customerIndex: 1, last_active_date: '2025-01-11', engagement_level: 'medium' },
  { customerIndex: 2, last_active_date: '2025-01-30', engagement_level: 'high' },
  { customerIndex: 3, last_active_date: '2025-02-08', engagement_level: 'low' },
  { customerIndex: 4, last_active_date: '2025-02-16', engagement_level: 'medium' }
];

const seed = async () => {
  await runMigrations();

  const customerCountResult = await pool.query('SELECT COUNT(*)::int as count FROM customers');
  let hydratedCustomers = [];

  if (!customerCountResult.rows[0].count) {
    for (let index = 0; index < customers.length; index += 1) {
      const customer = customers[index];
      const result = await pool.query(
        `
          INSERT INTO customers (name, email, segment, subscription_start_date, source_campaign)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `,
        [
          customer.name,
          customer.email,
          customer.segment,
          customer.subscription_start_date,
          customer.source_campaign
        ]
      );

      const inserted = result.rows[0];
      hydratedCustomers[index] = inserted;

      const log = activityLogs.find((logEntry) => logEntry.customerIndex === index);
      if (log) {
        await pool.query(
          `
            INSERT INTO activity_logs (customer_id, last_active_date, engagement_level)
            VALUES ($1, $2, $3)
          `,
          [inserted.id, log.last_active_date, log.engagement_level]
        );
      }
    }
  } else {
    const existing = await pool.query('SELECT * FROM customers ORDER BY id');
    hydratedCustomers = existing.rows;
  }

  const cancellationCountResult = await pool.query('SELECT COUNT(*)::int as count FROM cancellations');
  if (!cancellationCountResult.rows[0].count) {
    for (const template of cancellationTemplates) {
      const customer = hydratedCustomers[template.customerIndex];
      if (!customer) continue;

      await pool.query(
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
        `,
        [
          customer.id,
          template.cancellation_date,
          normalizeReason(template.primary_reason),
          template.secondary_notes,
          template.usage_downloads,
          template.usage_posts,
          template.usage_logins,
          template.usage_minutes,
          calculateDaysOnPlatform(customer.subscription_start_date, template.cancellation_date),
          template.closer_name || ROOMVU_CLOSERS[0],
          Boolean(template.saved_flag),
          template.saved_by || null,
          template.save_reason || null,
          template.save_notes || null,
          template.zoho_ticket_url || null,
          template.churn_amount || null,
          template.agent_plan || 'Basic Monthly',
          template.saved_revenue || null
        ]
      );
    }
  }

  console.log('Roomvu churn DB ready.');
};

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to seed Roomvu DB', error);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });

module.exports = seed;


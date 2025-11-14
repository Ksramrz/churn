const dayjs = require('dayjs');
const db = require('./db');
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
    saved_flag: 0
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
    save_notes: 'Scheduled weekly accountability check-in'
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
    saved_flag: 0
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
    saved_flag: 0
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
    save_notes: 'Provided Seattle starter kit'
  }
];

const activityLogs = [
  { customerIndex: 0, last_active_date: '2025-01-02', engagement_level: 'low' },
  { customerIndex: 1, last_active_date: '2025-01-11', engagement_level: 'medium' },
  { customerIndex: 2, last_active_date: '2025-01-30', engagement_level: 'high' },
  { customerIndex: 3, last_active_date: '2025-02-08', engagement_level: 'low' },
  { customerIndex: 4, last_active_date: '2025-02-16', engagement_level: 'medium' }
];

const seed = () => {
  const customerCount = db.prepare('SELECT COUNT(*) as count FROM customers').get().count;
  if (!customerCount) {
    const insertCustomer = db.prepare(`
      INSERT INTO customers (name, email, segment, subscription_start_date, source_campaign)
      VALUES (@name, @email, @segment, @subscription_start_date, @source_campaign)
    `);
    const insertLog = db.prepare(`
      INSERT INTO activity_logs (customer_id, last_active_date, engagement_level)
      VALUES (@customer_id, @last_active_date, @engagement_level)
    `);

    customers.forEach((customer, index) => {
      const result = insertCustomer.run(customer);
      const log = activityLogs.find((logEntry) => logEntry.customerIndex === index);
      if (log) {
        insertLog.run({
          customer_id: result.lastInsertRowid,
          last_active_date: log.last_active_date,
          engagement_level: log.engagement_level
        });
      }
      customers[index].id = result.lastInsertRowid;
    });
  } else {
    const rows = db.prepare('SELECT * FROM customers ORDER BY id').all();
    rows.forEach((row, index) => {
      customers[index] = { ...row };
    });
  }

  const cancellationCount = db.prepare('SELECT COUNT(*) as count FROM cancellations').get().count;
  if (!cancellationCount) {
    const insertCancellation = db.prepare(`
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

    cancellationTemplates.forEach((template) => {
      const customer = customers[template.customerIndex];
      if (!customer) return;
      insertCancellation.run({
        customer_id: customer.id,
        cancellation_date: template.cancellation_date,
        primary_reason: normalizeReason(template.primary_reason),
        secondary_notes: template.secondary_notes,
        usage_downloads: template.usage_downloads,
        usage_posts: template.usage_posts,
        usage_logins: template.usage_logins,
        usage_minutes: template.usage_minutes,
        days_on_platform: calculateDaysOnPlatform(
          customer.subscription_start_date,
          template.cancellation_date
        ),
        closer_name: template.closer_name || ROOMVU_CLOSERS[0],
        saved_flag: template.saved_flag ? 1 : 0,
        saved_by: template.saved_by || null,
        save_reason: template.save_reason || null,
        save_notes: template.save_notes || null
      });
    });
  }

  console.log('Roomvu churn DB ready.');
};

seed();

module.exports = seed;


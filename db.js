const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

async function init () {
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id          SERIAL PRIMARY KEY,
        title       TEXT NOT NULL,
        category    TEXT NOT NULL,
        client      TEXT,
        year        INTEGER,
        budget      INTEGER,
        gradient    TEXT NOT NULL DEFAULT 'linear-gradient(135deg,#1a1a2e,#16213e)',
        summary     TEXT,
        description TEXT,
        tags        TEXT,
        featured    INTEGER NOT NULL DEFAULT 0,
        status      TEXT NOT NULL DEFAULT 'delivered',
        created_at  TEXT NOT NULL DEFAULT (NOW()::TEXT)
      );

      CREATE TABLE IF NOT EXISTS inquiries (
        id          SERIAL PRIMARY KEY,
        name        TEXT NOT NULL,
        email       TEXT NOT NULL,
        company     TEXT,
        budget_range TEXT,
        message     TEXT,
        status      TEXT NOT NULL DEFAULT 'new',
        source      TEXT NOT NULL DEFAULT 'website',
        created_at  TEXT NOT NULL DEFAULT (NOW()::TEXT)
      );

      CREATE TABLE IF NOT EXISTS clients (
        id          SERIAL PRIMARY KEY,
        name        TEXT NOT NULL,
        company     TEXT,
        email       TEXT,
        project_id  INTEGER,
        status      TEXT NOT NULL DEFAULT 'active',
        notes       TEXT,
        created_at  TEXT NOT NULL DEFAULT (NOW()::TEXT),
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );
    `)

    await seed(client)
  } finally {
    client.release()
  }
}

async function seed (client) {
  const { rows } = await client.query('SELECT COUNT(*) AS c FROM projects')
  if (Number(rows[0].c) > 0) return

  const projects = [
    ['Aurora Capital Rebrand', 'Branding', 'Aurora Capital', 2025, 32000,
      'linear-gradient(135deg,#0f2027,#203a43)',
      'Full identity system for a private equity firm.',
      'Complete brand refresh including logo suite, typography, stationery and a 60-page brand book. Delivered in 6 weeks with a fully remote team.',
      'Strategy,Identity,Design System', 1, 'delivered'],
    ['Harbor & Co. E-Commerce Platform', 'Web Development', 'Harbor & Co.', 2025, 48000,
      'linear-gradient(135deg,#134e5e,#71b280)',
      'Headless storefront with 4.2x conversion lift.',
      'Custom Shopify headless build with Vue storefront, subscription engine and real-time inventory sync. Scaled to 120k monthly sessions.',
      'Vue,Shopify,Stripe,Node.js', 1, 'delivered'],
    ['Nexa SaaS Marketing Site', 'Web Design', 'Nexa Software', 2024, 26000,
      'linear-gradient(135deg,#42275a,#734b6d)',
      'Conversion-focused marketing site for a B2B SaaS.',
      'Messaging architecture, page system and interactive product demo baked into 12 high-converting pages. 3.1x demo bookings in 90 days.',
      'UX,Webflow,SEO,Analytics', 1, 'delivered'],
    ['Fieldglass Mobile App', 'Product Design', 'Fieldglass', 2024, 41000,
      'linear-gradient(135deg,#11998e,#38ef7d)',
      'Field-service app used by 800+ technicians.',
      'End-to-end product design from research to hi-fi prototypes. Shipped to 800+ field technicians with a 94% adoption rate.',
      'Research,Figma,Prototype', 0, 'delivered'],
    ['Kinetiq Rebrand & Site', 'Branding', 'Kinetiq', 2023, 19000,
      'linear-gradient(135deg,#283048,#859398)',
      'Rebrand and launch site for a motion studio.',
      'Visual identity, motion language and launch site that won a CSSDA award within two months of going live.',
      'Identity,Motion,Site', 0, 'delivered'],
    ['Vantage Dashboard', 'Web Development', 'Vantage Analytics', 2023, 35000,
      'linear-gradient(135deg,#2c3e50,#4ca1af)',
      'Real-time analytics dashboard for enterprise teams.',
      'React + D3 data platform visualizing 2M+ daily events. Role-based access, alerting and 25 custom report templates.',
      'React,D3,WebSockets,AWS', 1, 'delivered']
  ]

  for (const p of projects) {
    await client.query(
      `INSERT INTO projects (title, category, client, year, budget, gradient, summary, description, tags, featured, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      p
    )
  }

  const clients = [
    ['Morgan Hale', 'Aurora Capital', 'morgan@auroracap.io', 1, 'active', 'Retainer client, Q3 brand extensions.'],
    ['Dana Whitfield', 'Harbor & Co.', 'dana@harborco.com', 2, 'active', 'Interested in mobile app next.'],
    ['Leo Nakamura', 'Nexa Software', 'leo@nexa.dev', 3, 'active', 'Annual retainer, ongoing A/B testing.'],
    ['Priya Raman', 'Fieldglass', 'priya@fieldglass.com', 4, 'active', 'Wants a referral partner program.'],
    ['Owen Cross', 'Kinetiq', 'owen@kinetiq.studio', 5, 'inactive', 'Wrap-up call done, follow up Q4.'],
    ['Sofia Marques', 'Vantage Analytics', 'sofia@vantage.ai', 6, 'active', 'Onboarding sprint in progress.']
  ]
  for (const c of clients) {
    await client.query(
      `INSERT INTO clients (name, company, email, project_id, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      c
    )
  }

  console.log('Database seeded.')
}

module.exports = { pool, init }

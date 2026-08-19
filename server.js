require('dotenv').config()
const path = require('node:path')
const express = require('express')
const cookieParser = require('cookie-parser')
const helmet = require('helmet')
const jwt = require('jsonwebtoken')
const { pool, init } = require('./db')

const app = express()
const PORT = process.env.PORT || 3000

const JWT_SECRET = process.env.JWT_SECRET
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

app.use(helmet())
app.use(express.json())
app.use(cookieParser())

app.use(express.static(path.join(__dirname, 'public')))

let dbReady = init().catch((err) => {
  console.error('Database initialization failed:', err.message)
  dbReady = Promise.reject(err)
})

app.use(async (req, res, next) => {
  try {
    await dbReady
    next()
  } catch (err) {
    res.status(500).json({ error: 'Database not ready' })
  }
})

function requireAuth (req, res, next) {
  const token = req.cookies.admin_token
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    jwt.verify(token, JWT_SECRET)
    next()
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' })
  }
}

app.post('/api/login', async (req, res) => {
  if (!ADMIN_PASSWORD) return res.status(500).json({ error: 'Server misconfigured' })
  const { password } = req.body
  if (password === ADMIN_PASSWORD) {
    const token = jwt.sign({ admin: true }, JWT_SECRET || 'fallback', { expiresIn: '12h' })
    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 12 * 60 * 60 * 1000
    })
    res.json({ ok: true })
  } else {
    res.status(401).json({ error: 'Invalid password' })
  }
})

app.post('/api/logout', (req, res) => {
  res.clearCookie('admin_token')
  res.json({ ok: true })
})

app.get('/api/auth-status', (req, res) => {
  const token = req.cookies.admin_token
  if (!token) return res.json({ authenticated: false })
  try {
    jwt.verify(token, JWT_SECRET || 'fallback')
    res.json({ authenticated: true })
  } catch (err) {
    res.json({ authenticated: false })
  }
})

app.get('/admin', (req, res) => {
  const token = req.cookies.admin_token
  if (!token) return res.redirect('/login.html')
  try {
    jwt.verify(token, JWT_SECRET || 'fallback')
    res.sendFile(path.join(__dirname, 'public', 'admin.html'))
  } catch (err) {
    res.redirect('/login.html')
  }
})

// ---------- Projects ----------
app.get('/api/projects', async (req, res) => {
  const { category } = req.query
  let result
  if (category && category !== 'All') {
    result = await pool.query(
      'SELECT * FROM projects WHERE category = $1 ORDER BY featured DESC, year DESC',
      [category]
    )
  } else {
    result = await pool.query('SELECT * FROM projects ORDER BY featured DESC, year DESC')
  }
  res.json(result.rows)
})

app.get('/api/projects/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id])
  if (!rows.length) return res.status(404).json({ error: 'Project not found' })
  res.json(rows[0])
})

app.post('/api/projects', requireAuth, async (req, res) => {
  const { title, category, client, year, budget, gradient, summary, description, tags, featured } = req.body
  if (!title || !category) {
    return res.status(400).json({ error: 'title and category are required' })
  }
  const { rows } = await pool.query(
    `INSERT INTO projects (title, category, client, year, budget, gradient, summary, description, tags, featured)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [
      title, category, client || null, year || null, budget || null,
      gradient || 'linear-gradient(135deg,#1a1a2e,#16213e)',
      summary || null, description || null, tags || null, featured ? 1 : 0
    ]
  )
  res.status(201).json({ id: rows[0].id })
})

app.put('/api/projects/:id', requireAuth, async (req, res) => {
  const { title, category, client, year, budget, gradient, summary, description, tags, featured, status } = req.body
  const { rows: existing } = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id])
  if (!existing.length) return res.status(404).json({ error: 'Project not found' })
  const e = existing[0]
  const { rows } = await pool.query(
    `UPDATE projects SET title = $1, category = $2, client = $3, year = $4, budget = $5, gradient = $6,
     summary = $7, description = $8, tags = $9, featured = $10, status = $11 WHERE id = $12 RETURNING *`,
    [
      title ?? e.title, category ?? e.category, client ?? e.client,
      year ?? e.year, budget ?? e.budget, gradient ?? e.gradient,
      summary ?? e.summary, description ?? e.description, tags ?? e.tags,
      featured ?? e.featured, status ?? e.status, req.params.id
    ]
  )
  res.json(rows[0])
})

app.delete('/api/projects/:id', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM projects WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})

// ---------- Inquiries ----------
app.get('/api/inquiries', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM inquiries ORDER BY created_at DESC')
  res.json(rows)
})

app.post('/api/inquiries', async (req, res) => {
  const { name, email, company, budget_range, message, source } = req.body
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'name, email and message are required' })
  }
  const { rows } = await pool.query(
    `INSERT INTO inquiries (name, email, company, budget_range, message, source)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [name, email, company || null, budget_range || null, message, source || 'website']
  )
  res.status(201).json({ id: rows[0].id })
})

app.patch('/api/inquiries/:id', requireAuth, async (req, res) => {
  const { status } = req.body
  await pool.query('UPDATE inquiries SET status = $1 WHERE id = $2', [status, req.params.id])
  res.json({ ok: true })
})

app.delete('/api/inquiries/:id', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM inquiries WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})

// ---------- Clients ----------
app.get('/api/clients', requireAuth, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT c.*, p.title AS project_title
    FROM clients c LEFT JOIN projects p ON p.id = c.project_id
    ORDER BY c.created_at DESC
  `)
  res.json(rows)
})

app.post('/api/clients', requireAuth, async (req, res) => {
  const { name, company, email, project_id, status, notes } = req.body
  if (!name) return res.status(400).json({ error: 'name is required' })
  const { rows } = await pool.query(
    `INSERT INTO clients (name, company, email, project_id, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [name, company || null, email || null, project_id || null, status || 'active', notes || null]
  )
  res.status(201).json({ id: rows[0].id })
})

app.patch('/api/clients/:id', requireAuth, async (req, res) => {
  const { status, notes } = req.body
  const { rows: existing } = await pool.query('SELECT status, notes FROM clients WHERE id = $1', [req.params.id])
  await pool.query(
    'UPDATE clients SET status = $1, notes = $2 WHERE id = $3',
    [
      status ?? existing[0]?.status ?? 'active',
      notes ?? existing[0]?.notes ?? null,
      req.params.id
    ]
  )
  res.json({ ok: true })
})

app.delete('/api/clients/:id', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM clients WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})

// ---------- Stats ----------
app.get('/api/stats', async (req, res) => {
  const [projects, clients, inquiries] = await Promise.all([
    pool.query("SELECT COUNT(*) AS c, COALESCE(SUM(budget),0) AS s FROM projects WHERE status = 'delivered'"),
    pool.query("SELECT COUNT(*) AS c FROM clients WHERE status = 'active'"),
    pool.query("SELECT COUNT(*) AS c FROM inquiries WHERE status = 'new'")
  ])
  res.json({
    deliveredProjects: Number(projects.rows[0].c),
    totalRevenue: Number(projects.rows[0].s),
    activeClients: Number(clients.rows[0].c),
    newInquiries: Number(inquiries.rows[0].c)
  })
})

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Portfolio server running at http://localhost:${PORT}`)
  })
}

module.exports = app

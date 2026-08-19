(() => {
  'use strict'

  // Check auth status before loading
  fetch('/api/auth-status')
    .then(r => r.json())
    .then(data => {
      if (!data.authenticated) {
        window.location.href = '/login.html'
      }
    })

  const $ = (sel, root = document) => root.querySelector(sel)
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel))
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]))
  const fmtMoney = (n) => n ? '$' + (n >= 1000 ? (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'k' : n) : '—'

  const api = async (path, opts = {}) => {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...opts
    })
    if (res.status === 401) {
      window.location.href = '/login.html'
      throw new Error('Unauthorized')
    }
    if (!res.ok) throw new Error('Request failed: ' + path)
    return res.status === 204 ? null : res.json()
  }

  /* ---------- Tabs ---------- */
  const tabs = $('#tabs')
  tabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab')
    if (!tab) return
    $$('.tab', tabs).forEach((t) => t.classList.remove('active'))
    tab.classList.add('active')
    $$('.panel').forEach((p) => p.classList.remove('active'))
    $('#panel-' + tab.dataset.tab).classList.add('active')
  })

  /* ---------- Modal helpers ---------- */
  const closeModals = () => {
    $$('.modal').forEach((m) => (m.hidden = true))
  }
  document.addEventListener('click', (e) => {
    if (e.target.hasAttribute('data-close')) closeModals()
  })
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModals() })

  /* ---------- Stats ---------- */
  async function loadStats () {
    try {
      const s = await api('/api/stats')
      $('#scProjects').textContent = s.deliveredProjects
      $('#scRevenue').textContent = fmtMoney(s.totalRevenue)
      $('#scClients').textContent = s.activeClients
      $('#scInquiries').textContent = s.newInquiries
    } catch (err) { /* silent */ }
  }

  /* ---------- Inquiries ---------- */
  async function loadInquiries () {
    const tbody = $('#tbodyInquiries')
    try {
      const rows = await api('/api/inquiries')
      if (!rows.length) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No inquiries yet. Submissions from the site form land here.</td></tr>'
        return
      }
      tbody.innerHTML = rows.map((r) => `
        <tr>
          <td><span class="cell-main">${esc(r.name)}</span></td>
          <td><span class="cell-main">${esc(r.email)}</span><br /><span class="cell-sub">${esc(r.company || '')}</span></td>
          <td>${esc(r.budget_range || '—')}</td>
          <td class="cell-sub">${esc(r.message)}</td>
          <td><span class="badge ${esc(r.status)}">${esc(r.status)}</span></td>
          <td class="cell-sub">${esc(r.created_at.slice(0, 16))}</td>
          <td>
            <div class="actions">
              <button class="icon-btn" data-status="new" data-id="${r.id}">New</button>
              <button class="icon-btn" data-status="contacted" data-id="${r.id}">Contacted</button>
              <button class="icon-btn" data-status="done" data-id="${r.id}">Done</button>
              <button class="icon-btn danger" data-del="inquiry" data-id="${r.id}">Delete</button>
            </div>
          </td>
        </tr>`).join('')
    } catch (err) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Failed to load inquiries.</td></tr>'
    }
  }

  /* ---------- Clients ---------- */
  async function loadClients () {
    const tbody = $('#tbodyClients')
    try {
      const rows = await api('/api/clients')
      if (!rows.length) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No clients yet.</td></tr>'
        return
      }
      tbody.innerHTML = rows.map((c) => `
        <tr>
          <td><span class="cell-main">${esc(c.name)}</span></td>
          <td>${esc(c.company || '—')}</td>
          <td class="cell-sub">${esc(c.email || '—')}</td>
          <td class="cell-sub">${esc(c.project_title || '—')}</td>
          <td><span class="badge ${esc(c.status)}">${esc(c.status)}</span></td>
          <td class="cell-sub">${esc(c.notes || '')}</td>
          <td>
            <div class="actions">
              <button class="icon-btn" data-toggle-client data-id="${c.id}" data-status="${c.status === 'active' ? 'inactive' : 'active'}">
                ${c.status === 'active' ? 'Deactivate' : 'Activate'}
              </button>
              <button class="icon-btn danger" data-del="client" data-id="${c.id}">Delete</button>
            </div>
          </td>
        </tr>`).join('')
    } catch (err) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Failed to load clients.</td></tr>'
    }
  }

  /* ---------- Projects ---------- */
  async function loadProjects (fillSelect = true) {
    const tbody = $('#tbodyProjects')
    try {
      const rows = await api('/api/projects')
      if (fillSelect) {
        const sel = $('#clientForm [name="project_id"]')
        sel.innerHTML = '<option value="">— none —</option>' +
          rows.map((p) => `<option value="${p.id}">${esc(p.title)}</option>`).join('')
      }
      if (!rows.length) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No projects yet.</td></tr>'
        return
      }
      tbody.innerHTML = rows.map((p) => `
        <tr>
          <td><span class="cell-main">${esc(p.title)}</span></td>
          <td>${esc(p.category)}</td>
          <td class="cell-sub">${esc(p.client || '—')}</td>
          <td>${esc(p.year || '—')}</td>
          <td>${fmtMoney(p.budget)}</td>
          <td><span class="badge ${esc(p.status)}">${esc(p.status)}</span></td>
          <td>${p.featured ? '★' : ''}</td>
          <td><div class="actions">
            <button class="icon-btn danger" data-del="project" data-id="${p.id}">Delete</button>
          </div></td>
        </tr>`).join('')
    } catch (err) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="8">Failed to load projects.</td></tr>'
    }
  }

  /* ---------- Logout ---------- */
  const logoutBtn = $('#logoutBtn')
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await fetch('/api/logout', { method: 'POST' })
      window.location.href = '/login.html'
    })
  }

  /* ---------- Event delegation ---------- */
  document.addEventListener('click', async (e) => {
    const toggle = e.target.closest('[data-toggle-client]')
    if (toggle) {
      await api(`/api/clients/${toggle.dataset.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: toggle.dataset.status })
      })
      loadClients()
      loadStats()
      return
    }
    const statusBtn = e.target.closest('[data-status]')
    if (statusBtn) {
      await api(`/api/inquiries/${statusBtn.dataset.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: statusBtn.dataset.status })
      })
      loadInquiries()
      loadStats()
      return
    }
    const del = e.target.closest('[data-del]')
    if (del) {
      const type = del.dataset.del
      const label = { inquiry: 'inquiry', client: 'client', project: 'project' }[type]
      if (!confirm(`Delete this ${label}? This cannot be undone.`)) return
      await api(`/api/${type}s/${del.dataset.id}`, { method: 'DELETE' })
      if (type === 'inquiry') { loadInquiries(); loadStats() }
      if (type === 'client') { loadClients(); loadStats() }
      if (type === 'project') { loadProjects(); loadStats() }
    }
  })

  /* ---------- Add client modal ---------- */
  $('#addClientBtn').addEventListener('click', () => {
    $('#clientModal').hidden = false
    $('#clientForm').reset()
  })
  $('#clientForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    const data = Object.fromEntries(new FormData(e.target))
    data.project_id = data.project_id ? Number(data.project_id) : null
    await api('/api/clients', { method: 'POST', body: JSON.stringify(data) })
    closeModals()
    loadClients()
    loadStats()
  })

  /* ---------- Add project modal ---------- */
  $('#addProjectBtn').addEventListener('click', () => {
    $('#projectModal').hidden = false
    $('#projectForm').reset()
  })
  $('#projectForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    const data = Object.fromEntries(new FormData(e.target))
    data.year = data.year ? Number(data.year) : null
    data.budget = data.budget ? Number(data.budget) : null
    data.featured = data.featured ? 1 : 0
    await api('/api/projects', { method: 'POST', body: JSON.stringify(data) })
    closeModals()
    loadProjects()
    loadStats()
  })

  loadStats()
  loadInquiries()
  loadClients()
  loadProjects()
})()

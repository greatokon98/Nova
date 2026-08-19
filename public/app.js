(() => {
  'use strict'

  const $ = (sel, root = document) => root.querySelector(sel)
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel))
  const fmtMoney = (n) => '$' + (n >= 1000 ? (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'k' : n)
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]))

  /* ---------- Nav ---------- */
  const nav = $('#nav')
  const navToggle = $('#navToggle')
  const navLinks = $('#navLinks')
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 30)
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
  navToggle.addEventListener('click', () => {
    navToggle.classList.toggle('open')
    navLinks.classList.toggle('open')
  })
  navLinks.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') {
      navToggle.classList.remove('open')
      navLinks.classList.remove('open')
    }
  })

  /* ---------- Reveal on scroll ---------- */
  const revealEls = $$('.reveal')
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible')
          io.unobserve(entry.target)
        }
      })
    }, { threshold: 0.12 })
    revealEls.forEach((el) => io.observe(el))
  } else {
    revealEls.forEach((el) => el.classList.add('visible'))
  }

  /* ---------- Animated stats ---------- */
  const animateNum = (el) => {
    const target = Number(el.dataset.target)
    const prefix = el.dataset.prefix || ''
    const suffix = el.dataset.suffix || ''
    const dur = 1200
    const start = performance.now()
    const tick = (t) => {
      const p = Math.min((t - start) / dur, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      el.textContent = prefix + Math.round(target * eased) + suffix
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }
  const statsEl = $('#stats')
  const statNumEls = $$('.stat-num', statsEl)
  const statIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        statsEl.dataset.animated = 'true'
        statNumEls.forEach(animateNum)
        statIO.unobserve(e.target)
      }
    })
  }, { threshold: 0.4 })
  if (statsEl) statIO.observe(statsEl)

  fetch('/api/stats')
    .then((r) => r.json())
    .then((s) => {
      statNumEls[0].dataset.target = s.deliveredProjects
      statNumEls[2].dataset.target = s.activeClients
      const rev = $('#statRevenue')
      rev.dataset.target = Math.round(s.totalRevenue / 1000)
      
      if (statsEl.dataset.animated) {
        statNumEls.forEach(animateNum)
      }
    })
    .catch(() => {})

  /* ---------- Work grid + filters ---------- */
  const grid = $('#grid')
  const filters = $('#filters')
  let projectsCache = []

  const cardHtml = (p) => `
    <article class="card" data-id="${p.id}" tabindex="0" role="button" aria-label="View ${esc(p.title)}">
      <div class="card-art" style="background:${esc(p.gradient)}">${esc(p.title.split(' ')[0])}</div>
      <div class="card-body">
        <h3 class="card-title">${esc(p.title)}</h3>
        <span class="card-cat">${esc(p.category)}</span>
        <p class="card-summary">${esc(p.summary)}</p>
      </div>
    </article>`

  const renderProjects = (list) => {
    if (!list.length) {
      grid.innerHTML = '<div class="empty">No projects in this category yet.</div>'
      return
    }
    grid.innerHTML = list.map(cardHtml).join('')
  }

  const loadProjects = async (category = 'All') => {
    grid.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div>'
    try {
      const res = await fetch('/api/projects' + (category !== 'All' ? '?category=' + encodeURIComponent(category) : ''))
      const data = await res.json()
      projectsCache = data
      renderProjects(data)
    } catch (err) {
      grid.innerHTML = '<div class="empty">Could not load projects. Is the server running?</div>'
    }
  }

  filters.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter')
    if (!btn) return
    $$('.filter', filters).forEach((b) => b.classList.remove('active'))
    btn.classList.add('active')
    loadProjects(btn.dataset.filter)
  })

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.card')
    if (card) openModal(Number(card.dataset.id))
  })
  grid.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('card')) {
      openModal(Number(e.target.dataset.id))
    }
  })

  /* ---------- Modal ---------- */
  const modal = $('#modal')
  const openModal = (id) => {
    const p = projectsCache.find((x) => x.id === id)
    if (!p) return
    $('#modalArt').style.background = p.gradient
    $('#modalArt').textContent = p.title.split(' ')[0]
    $('#modalCategory').textContent = p.category
    $('#modalTitle').textContent = p.title
    $('#modalSummary').textContent = p.summary
    $('#modalDesc').textContent = p.description
    $('#modalMeta').innerHTML = `
      <div><span>Client</span><strong>${esc(p.client || 'Confidential')}</strong></div>
      <div><span>Year</span><strong>${esc(p.year)}</strong></div>
      <div><span>Budget</span><strong>${fmtMoney(p.budget)}</strong></div>
      <div><span>Status</span><strong>${esc(p.status)}</strong></div>`
    $('#modalTags').innerHTML = (p.tags || '')
      .split(',')
      .filter(Boolean)
      .map((t) => `<span>${esc(t)}</span>`)
      .join('')
    modal.hidden = false
    document.body.style.overflow = 'hidden'
  }
  const closeModal = () => {
    modal.hidden = true
    document.body.style.overflow = ''
  }
  $('#modalClose').addEventListener('click', closeModal)
  $('#modalBackdrop').addEventListener('click', closeModal)
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal() })

  /* ---------- Testimonials slider ---------- */
  const testimonials = [
    { quote: 'Nova rebuilt our entire digital presence in eight weeks. The site pays for itself — demo bookings are up 3x and our close rate jumped.', name: 'Leo Nakamura', role: 'CEO, Nexa Software', initials: 'LN', color: 'linear-gradient(135deg,#42275a,#734b6d)' },
    { quote: 'The rare partner that sweats the brand and the code. Launch was flawless and the analytics dashboard they built is now core to our operations.', name: 'Sofia Marques', role: 'COO, Vantage Analytics', initials: 'SM', color: 'linear-gradient(135deg,#2c3e50,#4ca1af)' },
    { quote: 'They handled strategy, design and engineering as one team. Our conversion rate went from 0.8% to 3.4% within a quarter of launching.', name: 'Dana Whitfield', role: 'Founder, Harbor & Co.', initials: 'DW', color: 'linear-gradient(135deg,#134e5e,#71b280)' }
  ]

  const slidesEl = $('#slides')
  const dotsEl = $('#sliderDots')
  let slideIndex = 0

  slidesEl.innerHTML = testimonials.map((t) => `
    <figure class="slide">
      <blockquote class="slide-quote">&ldquo;${esc(t.quote)}&rdquo;</blockquote>
      <figcaption class="slide-person">
        <span class="slide-avatar" style="background:${t.color}">${t.initials}</span>
        <span><span class="slide-name">${esc(t.name)}</span><br /><span class="slide-role">${esc(t.role)}</span></span>
      </figcaption>
    </figure>`).join('')
  dotsEl.innerHTML = testimonials.map((_, i) => `<button data-i="${i}" aria-label="Testimonial ${i + 1}"></button>`).join('')

  const renderSlide = () => {
    slidesEl.style.transform = `translateX(-${slideIndex * 100}%)`
    $$('button', dotsEl).forEach((d, i) => d.classList.toggle('active', i === slideIndex))
    $('#prevBtn').disabled = slideIndex === 0
    $('#nextBtn').disabled = slideIndex === testimonials.length - 1
  }
  $('#prevBtn').addEventListener('click', () => { if (slideIndex > 0) { slideIndex--; renderSlide() } })
  $('#nextBtn').addEventListener('click', () => { if (slideIndex < testimonials.length - 1) { slideIndex++; renderSlide() } })
  dotsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button')
    if (btn) { slideIndex = Number(btn.dataset.i); renderSlide() }
  })
  renderSlide()

  /* ---------- Contact form ---------- */
  const form = $('#contactForm')
  const statusEl = $('#formStatus')

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const data = Object.fromEntries(new FormData(form))
    let valid = true
    $$('input[required], textarea[required]', form).forEach((el) => {
      const bad = !el.value.trim()
      el.classList.toggle('invalid', bad)
      if (bad) valid = false
    })
    const email = form.email
    if (email.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
      email.classList.add('invalid')
      valid = false
    }
    if (!valid) {
      statusEl.className = 'form-status err'
      statusEl.textContent = 'Please fill in the required fields correctly.'
      return
    }

    const btn = form.querySelector('button[type="submit"]')
    btn.disabled = true
    btn.textContent = 'Sending…'
    statusEl.className = 'form-status'
    statusEl.textContent = ''
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, source: 'website' })
      })
      if (!res.ok) throw new Error('bad response')
      statusEl.className = 'form-status ok'
      statusEl.textContent = 'Thanks — your inquiry is in the pipeline. We reply within one business day.'
      form.reset()
    } catch (err) {
      statusEl.className = 'form-status err'
      statusEl.textContent = 'Something went wrong sending your message. Please try again.'
    } finally {
      btn.disabled = false
      btn.textContent = 'Send inquiry'
    }
  })
  $$('input, textarea', form).forEach((el) => el.addEventListener('input', () => el.classList.remove('invalid')))

  $('#year').textContent = new Date().getFullYear()

  loadProjects()
})()

document.addEventListener('DOMContentLoaded', () => {
  // Check if already authenticated
  fetch('/api/auth-status')
    .then(res => res.json())
    .then(data => {
      if (data.authenticated) {
        window.location.href = '/admin'; // Already logged in
      }
    });

  const form = document.getElementById('loginForm');
  const errorMsg = document.getElementById('error-message');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('password').value;
    
    errorMsg.textContent = '';
    
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      const data = await res.json();
      
      if (res.ok && data.ok) {
        window.location.href = '/admin';
      } else {
        errorMsg.textContent = data.error || 'Login failed';
      }
    } catch (err) {
      errorMsg.textContent = 'A network error occurred. Please try again.';
    }
  });
});

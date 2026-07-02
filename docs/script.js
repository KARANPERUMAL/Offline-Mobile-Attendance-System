/* =======================================================
   Offline Attendance System — Portfolio Showcase Script
   ======================================================= */

// ── CONFIG ────────────────────────────────────────────────
// UPDATE THIS after you deploy to Railway!
const API_BASE = 'https://offline-attendance-systemfinal-year-project-production.up.railway.app';

let jwtToken = null;

// ── INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  checkApiStatus();
  initScrollAnimations();
  startTypingEffect();
  setApiBaseUrl();
});

// ── NAVBAR ────────────────────────────────────────────────
function initNavbar() {
  const navbar = document.getElementById('navbar');
  const toggle = document.getElementById('navToggle');
  const links  = document.querySelector('.nav-links');

  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  });

  toggle?.addEventListener('click', () => {
    links?.classList.toggle('open');
  });

  // Smooth close on link click (mobile)
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.addEventListener('click', () => links?.classList.remove('open'));
  });
}

// ── SCROLL ANIMATIONS ────────────────────────────────────
function initScrollAnimations() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  // Cards and sections
  document.querySelectorAll(
    '.feature-card, .download-panel, .credential-card, .guide-step, .diagram-band, .diagram-node, .tech-card, .endpoint-group'
  ).forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = `opacity 0.5s ease ${i * 0.06}s, transform 0.5s ease ${i * 0.06}s`;
    observer.observe(el);
  });
}

// ── TYPING EFFECT (phone mockup) ─────────────────────────
function startTypingEffect() {
  const el = document.getElementById('typingText');
  if (!el) return;

  const texts = [
    'http://192.168.1.1:8080',
    'http://192.168.0.105:8080',
    API_BASE,
  ];
  let idx = 0;

  function typeText(text) {
    el.textContent = '';
    let i = 0;
    const interval = setInterval(() => {
      el.textContent += text[i];
      i++;
      if (i >= text.length) {
        clearInterval(interval);
        setTimeout(() => eraseText(text), 2200);
      }
    }, 50);
  }

  function eraseText(text) {
    let i = text.length;
    const interval = setInterval(() => {
      el.textContent = text.slice(0, i - 1);
      i--;
      if (i <= 0) {
        clearInterval(interval);
        idx = (idx + 1) % texts.length;
        setTimeout(() => typeText(texts[idx]), 400);
      }
    }, 30);
  }

  typeText(texts[0]);
}

// ── SET API BASE URL DISPLAY ──────────────────────────────
function setApiBaseUrl() {
  const el = document.getElementById('apiBaseUrl');
  if (el) el.textContent = API_BASE;
}

// ── API STATUS CHECK ─────────────────────────────────────
async function checkApiStatus() {
  const dot  = document.getElementById('statusDot');
  const text = document.getElementById('statusText');

  try {
    const res = await fetch(`${API_BASE}/api/auth/health`, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      dot.classList.add('online');
      text.textContent = 'API Online ✓';
    } else {
      throw new Error('Non-OK response');
    }
  } catch {
    dot.classList.add('offline');
    text.textContent = 'API Offline (deploy to Railway first)';
  }
}

// ── TAB SWITCHING ────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.api-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.api-panel').forEach(p => p.classList.add('hidden'));

  document.getElementById(`tab-${tab}`).classList.add('active');
  document.getElementById(`panel-${tab}`).classList.remove('hidden');
}

// ── API CALLS ────────────────────────────────────────────

async function runHealth() {
  const btn  = document.getElementById('healthBtn');
  const resp = document.getElementById('resp-health');

  setLoading(btn, true);
  resp.innerHTML = '<div class="resp-placeholder">Calling API...</div>';

  try {
    const start = Date.now();
    const res   = await fetch(`${API_BASE}/api/auth/health`);
    const ms    = Date.now() - start;
    const data  = await res.json();

    resp.innerHTML = buildResponse(res.status, data, ms);
  } catch (err) {
    resp.innerHTML = buildError(err.message);
  } finally {
    setLoading(btn, false);
  }
}

async function runLogin() {
  const btn  = document.getElementById('loginBtn');
  const resp = document.getElementById('resp-login');

  setLoading(btn, true);
  resp.innerHTML = '<div class="resp-placeholder">Authenticating...</div>';

  try {
    const start = Date.now();
    const res   = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Admin@1234' }),
    });
    const ms   = Date.now() - start;
    const data = await res.json();

    if (res.ok && data?.data?.token) {
      jwtToken = data.data.token;
      // Add a hint that token was captured
      data._note = '✓ Token saved — admin endpoint tabs can use it now.';
    }

    resp.innerHTML = buildResponse(res.status, data, ms);
  } catch (err) {
    resp.innerHTML = buildError(err.message);
  } finally {
    setLoading(btn, false);
  }
}

async function runGetDepts() {
  return runAuthedJson('deptsBtn', 'resp-depts', '/api/admin/departments', 'Fetching departments...');
}

async function runGetTeachers() {
  return runAuthedJson('teachersBtn', 'resp-teachers', '/api/admin/teachers', 'Fetching teachers...');
}

async function runGetStudents() {
  return runAuthedJson('studentsBtn', 'resp-students', '/api/admin/students', 'Fetching students...');
}

async function runGetSubjects() {
  return runAuthedJson('subjectsBtn', 'resp-subjects', '/api/admin/subjects', 'Fetching subjects...');
}

async function runAttendanceStats() {
  return runAuthedJson('statsBtn', 'resp-stats', '/api/admin/attendance/stats', 'Fetching attendance statistics...');
}

async function runExcelExport() {
  const btn  = document.getElementById('exportBtn');
  const resp = document.getElementById('resp-export');

  if (!hasJwt(resp)) return;

  setLoading(btn, true);
  resp.innerHTML = '<div class="resp-placeholder">Preparing Excel export...</div>';

  try {
    const start = Date.now();
    const res   = await fetch(`${API_BASE}/api/admin/attendance/export`, {
      headers: authHeaders(),
    });
    const ms   = Date.now() - start;

    if (!res.ok) {
      const data = await readResponseData(res);
      resp.innerHTML = buildResponse(res.status, data, ms);
      return;
    }

    const blob = await res.blob();
    const filename = getDownloadFilename(res.headers.get('content-disposition')) || 'attendance-report.xlsx';
    downloadBlob(blob, filename);

    resp.innerHTML = buildResponse(res.status, {
      success: true,
      message: 'Excel report downloaded',
      data: {
        filename,
        contentType: blob.type || res.headers.get('content-type') || 'application/octet-stream',
        sizeBytes: blob.size,
      },
    }, ms);
  } catch (err) {
    resp.innerHTML = buildError(err.message);
  } finally {
    setLoading(btn, false);
  }
}

// ── HELPERS ──────────────────────────────────────────────

function setLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn.innerHTML = '<span class="spinner"></span> Running...';
  } else {
    // Restore original label based on id
    const labels = {
      healthBtn: '▶ Run Request',
      loginBtn:  '▶ Run Login',
      statsBtn:  '▶ Get Statistics',
      deptsBtn:  '▶ Get Departments',
      teachersBtn: '▶ Get Teachers',
      studentsBtn: '▶ Get Students',
      subjectsBtn: '▶ Get Subjects',
      exportBtn: '⬇ Download Excel',
    };
    btn.innerHTML = labels[btn.id] || '▶ Run';
  }
}

async function runAuthedJson(buttonId, responseId, path, loadingText) {
  const btn  = document.getElementById(buttonId);
  const resp = document.getElementById(responseId);

  if (!hasJwt(resp)) return;

  setLoading(btn, true);
  resp.innerHTML = `<div class="resp-placeholder">${loadingText}</div>`;

  try {
    const start = Date.now();
    const res   = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
    const ms   = Date.now() - start;
    const data = await readResponseData(res);

    resp.innerHTML = buildResponse(res.status, data, ms);
  } catch (err) {
    resp.innerHTML = buildError(err.message);
  } finally {
    setLoading(btn, false);
  }
}

function hasJwt(resp) {
  if (jwtToken) return true;
  resp.innerHTML = buildError('No JWT token! Please login first on the "POST /login" tab.');
  return false;
}

function authHeaders() {
  return { 'Authorization': `Bearer ${jwtToken}` };
}

async function readResponseData(res) {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return {
      success: res.ok,
      message: text || res.statusText,
    };
  }
}

function getDownloadFilename(contentDisposition) {
  if (!contentDisposition) return null;
  const match = contentDisposition.match(/filename\*?=(?:UTF-8'')?["']?([^;"']+)/i);
  return match ? decodeURIComponent(match[1]) : null;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function buildResponse(status, data, ms) {
  const isOk     = status >= 200 && status < 300;
  const headerCls = isOk ? '' : ' error';
  const statusCls = isOk ? 'status-200' : 'status-401';
  const pretty    = syntaxHighlight(JSON.stringify(data, null, 2));

  return `
    <div class="resp-block">
      <div class="resp-header${headerCls}">
        <span class="resp-status ${statusCls}">HTTP ${status}</span>
        <span style="color:var(--text-muted);font-size:0.75rem;">${ms}ms</span>
      </div>
      <div class="resp-body">${pretty}</div>
    </div>
  `;
}

function buildError(msg) {
  return `
    <div class="resp-block">
      <div class="resp-header error">
        <span class="resp-status status-401">Network Error</span>
      </div>
      <div class="resp-body" style="color:var(--accent2);">
${escapeHtml(msg)}

Tip: Make sure the backend is deployed on Railway
and the API_BASE URL in script.js is updated.
      </div>
    </div>
  `;
}

function syntaxHighlight(json) {
  json = escapeHtml(json);
  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = 'json-num';
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? 'json-key' : 'json-str';
      } else if (/true|false/.test(match)) {
        cls = 'json-bool';
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(process.cwd(), 'Resumo de Impostos _ Dauto Tintas.html'), 'utf8');
const match = html.match(/<style>([\s\S]*?)<\/style>/);
if (!match) {
  console.error('Style block not found');
  process.exit(1);
}

const sidebarExtras = `
/* Sidebar + toolbar (app Express) */
.dashboard-shell {
  display: flex;
  min-height: 100vh;
  background: #eef1f5;
  font-family: Arial, Helvetica, sans-serif;
}

.dashboard-shell__main {
  flex: 1;
  min-width: 0;
}

.dashboard-shell .app {
  max-width: none;
  margin: 0;
}

.dashboard-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
  padding: 12px 16px;
  background: #fff;
  border-radius: 14px;
  border: 1px solid var(--line);
  box-shadow: 0 4px 14px rgba(15, 23, 42, .05);
}

.dashboard-toolbar__spacer {
  flex: 1;
}

.dashboard-toolbar a {
  text-decoration: none;
  color: inherit;
}

.save-status {
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
}

.save-status[data-status="success"] { color: #0f6b32; }
.save-status[data-status="warning"] { color: #9a6b00; }
.save-status[data-status="error"] { color: #a01218; }

.alert-success,
.alert-error {
  border-radius: 12px;
  padding: 10px 14px;
  margin-bottom: 14px;
  font-size: 13px;
  font-weight: 700;
}

.alert-success {
  background: #e7f8ee;
  border: 1px solid #b8e6c8;
  color: #0f6b32;
}

.alert-error {
  background: #fdecec;
  border: 1px solid #f3b7ba;
  color: #a01218;
}

.hamburger-btn {
  width: 40px;
  height: 40px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  padding: 0;
}

.hamburger-btn span {
  display: block;
  width: 18px;
  height: 2px;
  background: #111;
  border-radius: 2px;
}

.sidebar-drawer {
  position: fixed;
  top: 0;
  left: 0;
  width: min(300px, 88vw);
  height: 100vh;
  background: #fff;
  z-index: 1000;
  transform: translateX(-100%);
  transition: transform .25s ease;
  box-shadow: 8px 0 24px rgba(0,0,0,.12);
  overflow-y: auto;
}

.sidebar-drawer.is-open {
  transform: translateX(0);
}

.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.4);
  z-index: 999;
  opacity: 0;
  pointer-events: none;
  transition: opacity .25s ease;
}

.sidebar-overlay.is-open {
  opacity: 1;
  pointer-events: auto;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 18px 16px;
  border-bottom: 1px solid var(--line);
}

.sidebar-header__eyebrow {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .08em;
  color: var(--muted);
}

.sidebar-header__main {
  margin: 4px 0 0;
  font-size: 16px;
  color: #111;
}

.sidebar-close-btn {
  border: 0;
  background: #eef1f5;
  border-radius: 8px;
  width: 32px;
  height: 32px;
  cursor: pointer;
  font-size: 14px;
}

.sidebar-nav-year summary {
  padding: 10px 16px;
  font-weight: 800;
  cursor: pointer;
  list-style: none;
}

.sidebar-nav-month {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px 8px 24px;
  text-decoration: none;
  color: #111;
  font-size: 13px;
  border-left: 3px solid transparent;
}

.sidebar-nav-month--active {
  background: #edfdf3;
  border-left-color: var(--green);
  font-weight: 800;
}

.status-badge {
  font-size: 10px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 999px;
  text-transform: uppercase;
}

.status-badge--concluido { background: #e7f8ee; color: #0f6b32; }
.status-badge--em_processo { background: #fff8e1; color: #9a6b00; }
.status-badge--rascunho { background: #eef2f7; color: #46505d; }

/* Login */
.login-page {
  min-height: 100vh;
  background: #eef1f5;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  font-family: Arial, Helvetica, sans-serif;
}

.login-card {
  width: min(100%, 420px);
  background: #fff;
  border-radius: 18px;
  padding: 28px 24px;
  box-shadow: 0 10px 26px rgba(15, 23, 42, .07);
  border: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

.login-card .logo-card.dauto {
  width: min(100%, 280px);
}

.login-card__form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.login-alert {
  width: 100%;
  background: #fdecec;
  border: 1px solid #f3b7ba;
  color: #a01218;
  border-radius: 11px;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 700;
}

.login-card button[type="submit"] {
  width: 100%;
  margin-top: 4px;
}

.skip-link {
  position: absolute;
  left: -9999px;
}

.skip-link:focus {
  left: 16px;
  top: 16px;
  z-index: 2000;
  background: #111;
  color: #fff;
  padding: 8px 12px;
  border-radius: 8px;
}

/* PDF body override for Puppeteer */
body.pdf-render-body {
  margin: 0;
  background: #fff;
  font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
}

body.pdf-render-body #pdfArea {
  position: static;
  width: auto;
  pointer-events: auto;
  z-index: auto;
  overflow: visible;
}

.print-value {
  display: block;
  text-align: right;
}

.print-value--left {
  text-align: left;
  font-weight: 700;
}
`;

const out = `/* Ported from Resumo de Impostos _ Dauto Tintas.html */\n${match[1]}\n${sidebarExtras}`;
fs.writeFileSync(path.join(process.cwd(), 'public', 'css', 'dauto-layout.css'), out, 'utf8');
console.log('Wrote dauto-layout.css', out.length, 'chars');

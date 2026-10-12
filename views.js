import { LANGS, T } from './i18n.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function layout(lang, title, body) {
  const t = T[lang];
  const langs = Object.entries(LANGS).map(([k, v]) => `<a href="/lang/${k}" class="${k === lang ? 'on' : ''}">${esc(v)}</a>`).join('');
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#2f6f5e">
<link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/icon-192.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<link rel="stylesheet" href="/app.css"></head><body>
<header><b>${esc(t.app)}</b><nav class="langs">${langs}</nav></header>
<main>${body}</main>
<script src="/app.js" defer></script></body></html>`;
}

const field = (label, name, type, extra = '') =>
  `<label>${esc(label)}<input name="${name}" type="${type}" required ${extra}></label>`;

export function landing(lang) {
  const t = T[lang];
  return layout(lang, t.app, `<h1>${esc(t.app)}</h1><p>${esc(t.tagline)}</p>
<p><a class="btn" href="/register">${esc(t.register)}</a> <a class="btn alt" href="/login">${esc(t.login)}</a></p>`);
}

export function registerPage(lang, csrf, err = '', v = {}) {
  const t = T[lang];
  return layout(lang, t.register, `<h1>${esc(t.register)}</h1>${err ? `<p class="err">${esc(err)}</p>` : ''}
<form method="post" action="/register"><input type="hidden" name="csrf" value="${esc(csrf)}">
${field(t.name, 'name', 'text', `autocomplete="name" value="${esc(v.name)}" maxlength="80"`)}
${field(t.email, 'email', 'email', `autocomplete="email" value="${esc(v.email)}" maxlength="120"`)}
${field(t.password, 'password', 'password', 'autocomplete="new-password" minlength="8" maxlength="200"')}
<label class="chk"><input type="checkbox" name="terms" value="1" required> ${esc(t.terms)}</label>
<button class="btn">${esc(t.create)}</button></form>
<p>${esc(t.haveAcc)} <a href="/login">${esc(t.login)}</a></p>`);
}

export function loginPage(lang, csrf, err = '', v = {}) {
  const t = T[lang];
  return layout(lang, t.login, `<h1>${esc(t.login)}</h1>${err ? `<p class="err">${esc(err)}</p>` : ''}
<form method="post" action="/login"><input type="hidden" name="csrf" value="${esc(csrf)}">
${field(t.email, 'email', 'email', `autocomplete="email" value="${esc(v.email)}"`)}
${field(t.password, 'password', 'password', 'autocomplete="current-password"')}
<button class="btn">${esc(t.login)}</button></form>
<p>${esc(t.noAcc)} <a href="/register">${esc(t.register)}</a></p>`);
}

export function cabinetPage(lang, user, csrf, opts = {}) {
  const t = T[lang];
  const st = user.status;
  let block = '';
  if (st === 'awaiting_payment' || st === 'rejected') {
    block = `<section class="card"><h2>${esc(t.payTitle)}</h2>
${st === 'rejected' ? `<p class="err">${esc(t.rejectedNote)}</p>` : ''}
<p>${esc(t.payAmount)} ${esc(t.payHow)}</p>
${opts.payDetails ? `<p><b>${esc(t.payDetailsLabel)}:</b><br>${esc(opts.payDetails).replace(/\n/g, '<br>')}</p>` : ''}
<form id="receipt-form" data-csrf="${esc(csrf)}" data-uploading="${esc(t.uploading)}" data-sent="${esc(t.receiptSent)}" data-err="${esc(t.errFile)}">
<label>${esc(t.receiptHint)}<input id="receipt-file" type="file" accept="image/jpeg,image/png,application/pdf" required></label>
<button class="btn">${esc(t.sendReceipt)}</button> <span id="receipt-msg" class="hint"></span></form></section>`;
  } else if (st === 'receipt_sent') {
    block = `<p>${esc(t.waitNote)}</p>`;
  } else if (st === 'paid') {
    block = `<p>${esc(t.paidNote)}</p>`;
  }
  return layout(lang, t.cabinet, `<h1>${esc(t.hello)}, ${esc(user.name)}!</h1>
<section class="card"><div>${esc(t.statusLabel)}</div><b>${esc(t['status_' + st] || st)}</b></section>
${block}
${user.is_owner ? `<p><a class="btn alt" href="/admin">${esc(t.toAdmin)}</a></p>` : ''}
<p><button id="install" class="btn" hidden>${esc(t.install)}</button>
<span id="ios-hint" class="hint" hidden>${esc(t.iosHint)}</span></p>
<form method="post" action="/logout"><input type="hidden" name="csrf" value="${esc(csrf)}"><button class="btn alt">${esc(t.logout)}</button></form>`);
}

export function adminPage(lang, items, csrf) {
  const t = T[lang];
  const rows = items.map((r) => `<section class="card"><b>${esc(r.name)}</b> · ${esc(r.email)}<br><span class="hint">${esc(new Date(r.created_at).toISOString().slice(0, 16).replace('T', ' '))} UTC</span>
<p><a href="/admin/receipt/${Number(r.id)}" target="_blank" rel="noopener">${esc(t.openReceipt)}</a></p>
<form method="post" action="/admin/decide" class="row"><input type="hidden" name="csrf" value="${esc(csrf)}"><input type="hidden" name="id" value="${Number(r.id)}">
<button class="btn" name="decision" value="confirm">${esc(t.confirm)}</button> <button class="btn alt" name="decision" value="reject">${esc(t.reject)}</button></form></section>`).join('');
  return layout(lang, t.admin, `<h1>${esc(t.admin)}</h1>${rows || `<p>${esc(t.adminEmpty)}</p>`}<p><a href="/cabinet">${esc(t.toCabinet)}</a></p>`);
}

export function notFound(lang) {
  const t = T[lang];
  return layout(lang, t.notFound, `<h1>${esc(t.notFound)}</h1><p><a href="/">${esc(t.back)}</a></p>`);
}

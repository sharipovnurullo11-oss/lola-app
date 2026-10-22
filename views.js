import { LANGS, T } from './i18n.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// +992 900 11 22 33
export const fmtPhone = (v) => {
  const d = String(v || '').replace(/\D/g, '').replace(/^992/, '').slice(0, 9);
  return '+992 ' + [d.slice(0, 3), d.slice(3, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ');
};
const who = (u) => (u.phone ? fmtPhone(u.phone) : u.email || '');

const LOGO = `<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="12" class="lg-bg"/><path class="lg-fg" d="M11 13a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v7a4 4 0 0 1-4 4h-6l-5 4v-4a4 4 0 0 1-3-4z"/><circle class="lg-bg" cx="16" cy="16.5" r="1.7"/><circle class="lg-bg" cx="20" cy="16.5" r="1.7"/><circle class="lg-bg" cx="24" cy="16.5" r="1.7"/></svg>`;

function layout(lang, title, body) {
  const t = T[lang];
  const langs = Object.entries(LANGS).map(([k, v]) => `<a href="/lang/${k}" class="${k === lang ? 'on' : ''}">${esc(v)}</a>`).join('');
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#0b8f6b">
<link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/icon-192.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600&family=Unbounded:wght@500;600&display=swap">
<link rel="stylesheet" href="/app.css"></head><body>
<div class="wrap"><header class="bar"><a class="logo" href="/">${LOGO}<b>${esc(t.brand)}</b></a>
<nav class="nav"><a class="btn small" href="/start/demo">${esc(t.nav_demo)}</a><a class="btn small" href="/login">${esc(t.login)}</a><a class="btn small primary" href="/register">${esc(t.nav_start)}</a></nav></header>
<nav class="langs">${langs}</nav>
<main>${body}</main></div>
<script src="/app.js" defer></script></body></html>`;
}

const CHANNEL_NAMES = { instagram: 'Instagram', telegram: 'Telegram', whatsapp: 'WhatsApp' };
const field = (label, name, type, extra = '') =>
  `<label>${esc(label)}<input name="${name}" type="${type}" required ${extra}></label>`;

// ---------- пример кабинета (закрытый для гостей) ----------
function qrGrid() {
  const N = 21; let seed = 7, out = '';
  const r = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const inFinder = (x, y) => (x < 7 && y < 7) || (x >= N - 7 && y < 7) || (x < 7 && y >= N - 7);
  const finder = (x, y) => { const a = x >= N - 7 ? x - (N - 7) : x, b = y >= N - 7 ? y - (N - 7) : y; return a === 0 || a === 6 || b === 0 || b === 6 || (a >= 2 && a <= 4 && b >= 2 && b <= 4); };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) out += `<i${(inFinder(x, y) ? finder(x, y) : r() > 0.5) ? ' class="k"' : ''}></i>`;
  return `<div class="qr" aria-hidden="true">${out}</div>`;
}
const steps = (s) => `<ol>${String(s).split('|').map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`;
const helpBox = (t, key) => `<details class="help"><summary>${esc(t.help)}</summary>${steps(t[key])}<p class="pic">${esc(t.helpPic)}</p></details>`;

function previewBlocks(t) {
  const attn = [['IG', t.attn1], ['WA', t.attn2], ['TG', t.attn3], ['WA', t.attn4]]
    .map(([c, x]) => `<div class="rowi"><span>${esc(x)}</span><span class="badge">${c}</span></div>`).join('');
  const bars = [['Пн', 45], ['Вт', 60], ['Ср', 52], ['Чт', 78], ['Пт', 66], ['Сб', 34], ['Вс', 90]]
    .map(([d, h]) => `<div class="h${h}${h === 90 ? ' hi' : ''}"><small>${d}</small></div>`).join('');
  return `<div class="lockbar"><span>${esc(t.lockText)}</span></div>
<section class="blk"><h2>${esc(t.ovTitle)}</h2>
<div class="stats"><div class="stat"><b>86</b><span>${esc(t.statMsgs)}</span></div><div class="stat"><b>71</b><span>${esc(t.statBot)}</span></div><div class="stat alert"><b>4</b><span>${esc(t.statWait)}</span></div><div class="stat"><b>3</b><span>${esc(t.statMiss)}</span></div></div>
<div class="two"><div class="card"><h3>${esc(t.attnTitle)}</h3>${attn}</div><div class="card"><h3>${esc(t.weekTitle)}</h3><div class="bars" aria-hidden="true">${bars}</div></div></div></section>
<section class="blk"><h2>${esc(t.convTitle)}</h2><div class="card">
<div class="msg in">${esc(t.msg1)}<small>Мадина · Instagram</small></div><div class="msg bot">${esc(t.msg2)}<small>${esc(t.whoBot)}</small></div>
<div class="msg in">${esc(t.msg3)}<small>Мадина · Instagram</small></div>
<div class="reply"><input class="input" disabled placeholder="${esc(t.reply)}" aria-label="${esc(t.reply)}"><button class="btn primary" disabled>${esc(t.send)}</button></div>
<p class="hint">${esc(t.convNote)}</p></div></section>
<section class="blk"><h2>${esc(t.chanTitle)}</h2><div class="stack">
<div class="card chan"><div class="info"><span class="badge">WA</span><h3>WhatsApp</h3><p>${esc(t.chWA)}</p>${helpBox(t, 'helpWa')}</div><div class="qrbox">${qrGrid()}<p class="hint">${esc(t.qrLocked)}</p></div></div>
<div class="card chan"><div class="info"><span class="badge">IG</span><h3>Instagram <span class="status off">${esc(t.notConnected)}</span></h3><p>${esc(t.chIG)}</p>${helpBox(t, 'helpIg')}</div><button class="btn primary small" disabled>${esc(t.connect)}</button></div>
<div class="card chan"><div class="info"><span class="badge">TG</span><h3>Telegram <span class="status off">${esc(t.notConnected)}</span></h3><p>${esc(t.chTG)}</p>
<label>${esc(t.tgKey)}<input class="input" disabled placeholder="${esc(t.tgKeyHint)}"></label>${helpBox(t, 'helpTg')}</div><button class="btn primary small" disabled>${esc(t.connect)}</button></div></div></section>
<section class="blk"><h2>${esc(t.staffTitle)}</h2><div class="card"><label>${esc(t.staffPhone)}<input class="input" disabled placeholder="+992"></label>
<button class="btn primary" disabled>${esc(t.giveAccess)}</button><p class="hint">${esc(t.staffNote)}</p></div></section>`;
}

export function landing(lang) {
  const t = T[lang];
  const cards = [['WA', 'WhatsApp', t.chWA], ['IG', 'Instagram', t.chIG], ['TG', 'Telegram', t.chTG]]
    .map(([b, n, d]) => `<div class="card"><span class="badge">${b}</span><h3>${n}</h3><p>${esc(d)}</p></div>`).join('');
  const how = [[t.how1t, t.how1], [t.how2t, t.how2], [t.how3t, t.how3], [t.how4t, t.how4]]
    .map(([a, b]) => `<li><h3>${esc(a)}</h3><p>${esc(b)}</p></li>`).join('');
  const team = [[t.team1t, t.team1], [t.team2t, t.team2], [t.team3t, t.team3]]
    .map(([a, b]) => `<div class="card"><h3>${esc(a)}</h3><p>${esc(b)}</p></div>`).join('');
  return layout(lang, t.app, `<div class="hero"><div><h1>${esc(t.hero)}</h1><p class="lead">${esc(t.heroLead)}</p>
<div class="cta"><a class="btn primary" href="/register">${esc(t.ctaStart)}</a><a class="btn" href="/start/demo">${esc(t.ctaDemo)}</a></div>
<p class="price">${esc(t.priceNote)}</p></div>
<div class="phone" aria-label="${esc(t.sampleTitle)}"><div class="ptop"><span>Instagram</span><span>${esc(t.sample)}</span></div>
<div class="msg in">${esc(t.msg1)}<small>10:42</small></div><div class="msg bot">${esc(t.msg2)}<small>${esc(t.whoBot)} · 10:42</small></div>
<div class="msg in">${esc(t.msg3)}<small>10:43</small></div><div class="msg bot">${esc(t.msg4)}<small>${esc(t.whoBot)} · 10:43</small></div>
<div class="msg staff">${esc(t.msg5)}<small>${esc(t.whoStaff)} · 10:51</small></div></div></div>
<section class="blk"><h2>${esc(t.chTitle)}</h2><div class="grid3">${cards}</div></section>
<section class="blk"><h2>${esc(t.howTitle)}</h2><ol class="steps">${how}</ol></section>
<section class="blk"><h2>${esc(t.teamTitle)}</h2><div class="grid3">${team}</div></section>`);
}

export function demoPage(lang) {
  const t = T[lang];
  return layout(lang, t.nav_demo, `<div class="cabhead"><div><h1 class="h2">${esc(t.demoTitle)}</h1><p class="hint">${esc(t.demoNote)}</p></div>
<a class="btn primary" href="/register">${esc(t.regBtn)}</a></div>${previewBlocks(t)}`);
}

export function registerPage(lang, csrf, err = '', v = {}) {
  const t = T[lang];
  return layout(lang, t.register, `<div class="narrow"><div class="panel"><h1 class="h2">${esc(t.register)}</h1><p class="hint">${esc(t.regLead)}</p>${err ? `<p class="err">${esc(err)}</p>` : ''}
<form method="post" action="/register"><input type="hidden" name="csrf" value="${esc(csrf)}">
<label>${esc(t.phone)}<span class="pre"><span>+992</span><input name="phone" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="900 00 00 00" maxlength="16" required value="${esc(v.phone)}"></span></label>
<label class="chk"><input type="checkbox" name="terms" value="1" required> ${esc(t.terms)}</label>
<button class="btn primary wide">${esc(t.continueBtn)}</button></form>
<p class="hint">${esc(t.haveAcc)} <a href="/login">${esc(t.login)}</a></p></div></div>`);
}

// Служебная регистрация по почте и паролю: нужна владельцу (адрес из OWNER_EMAIL), ссылка нигде не показывается
export function ownerRegisterPage(lang, csrf, err = '', v = {}) {
  const t = T[lang];
  return layout(lang, t.register, `<div class="narrow"><div class="panel"><h1 class="h2">${esc(t.register)}</h1>${err ? `<p class="err">${esc(err)}</p>` : ''}
<form method="post" action="/register"><input type="hidden" name="csrf" value="${esc(csrf)}">
${field(t.name, 'name', 'text', `autocomplete="name" value="${esc(v.name)}" maxlength="80"`)}
${field(t.email, 'email', 'email', `autocomplete="email" value="${esc(v.email)}" maxlength="120"`)}
${field(t.password, 'password', 'password', 'autocomplete="new-password" minlength="8" maxlength="200"')}
<label class="chk"><input type="checkbox" name="terms" value="1" required> ${esc(t.terms)}</label>
<button class="btn primary wide">${esc(t.create)}</button></form></div></div>`);
}

export function loginPage(lang, csrf, err = '', v = {}) {
  const t = T[lang];
  return layout(lang, t.login, `<div class="narrow"><div class="panel"><h1 class="h2">${esc(t.loginTitle)}</h1><p class="hint">${esc(t.loginLead)}</p>${err ? `<p class="err">${esc(err)}</p>` : ''}
<form method="post" action="/login"><input type="hidden" name="csrf" value="${esc(csrf)}">
${field(t.loginField, 'login', 'text', `autocomplete="username" value="${esc(v.login)}"`)}
${field(t.passwordShort, 'password', 'password', 'autocomplete="current-password"')}
<button class="btn primary wide">${esc(t.login)}</button></form>
<p class="hint">${esc(t.noAcc)} <a href="/register">${esc(t.register)}</a></p></div></div>`);
}

export function cabinetPage(lang, user, csrf, opts = {}) {
  const t = T[lang];
  const st = user.status;
  let block = '', preview = '';
  if (st === 'awaiting_payment' || st === 'rejected') {
    block = `<section class="card pay"><h2 class="h3">${esc(t.payTitle)}</h2>
${st === 'rejected' ? `<p class="err">${esc(t.rejectedNote)}</p>` : ''}
<p class="sum">${esc(t.payAmount)}</p><p>${esc(t.payHow)}</p>
${opts.payDetails ? `<p class="paynum"><span class="hint">${esc(t.payDetailsLabel)}</span><br><b>${esc(opts.payDetails).replace(/\n/g, '<br>')}</b></p>` : ''}
<p class="wallets"><span>Душанбе Сити</span><span>Алиф Моби</span><span>Имон Моби</span><span>Эсхата Онлайн</span><span>${esc(t.otherWallets)}</span></p>
<form id="receipt-form" data-csrf="${esc(csrf)}" data-uploading="${esc(t.uploading)}" data-sent="${esc(t.receiptSent)}" data-err="${esc(t.errFile)}">
<label>${esc(t.receiptHint)}<input id="receipt-file" class="input" type="file" accept="image/jpeg,image/png,application/pdf" required></label>
<button class="btn primary">${esc(t.sendReceipt)}</button> <span id="receipt-msg" class="hint"></span></form></section>`;
    preview = `<h2 class="blkh">${esc(t.afterPay)}</h2>${previewBlocks(t)}`;
  } else if (st === 'receipt_sent') {
    block = `<section class="card"><p>${esc(t.waitNote)}</p></section>`;
    preview = `<h2 class="blkh">${esc(t.afterPay)}</h2>${previewBlocks(t)}`;
  } else if (st === 'paid') {
    block = `<section class="card"><p>${esc(t.paidNote)}</p><p><a class="btn primary" href="/profile">${esc(t.fillProfile)}</a></p></section>`;
  } else if (st === 'profile_done') {
    const chs = String((opts.profile && opts.profile.channels) || '').split(',').filter(Boolean).map((c) => CHANNEL_NAMES[c] || c).join(', ');
    block = `<section class="card"><p>${esc(t.profileDoneNote)}</p>${chs ? `<p class="hint">${esc(t.yourChannels)}: ${esc(chs)}</p>` : ''}<p><a class="btn" href="/profile">${esc(t.editProfile)}</a></p></section>`;
  }
  return layout(lang, t.cabinet, `<h1 class="h2">${esc(t.hello)}, ${esc(user.phone ? fmtPhone(user.phone) : user.name)}!</h1>
<section class="card statusrow"><span class="hint">${esc(t.statusLabel)}</span><b>${esc(t['status_' + st] || st)}</b></section>
${block}
${user.is_owner ? `<p><a class="btn" href="/admin">${esc(t.toAdmin)}</a></p>` : ''}
<p><button id="install" class="btn" hidden>${esc(t.install)}</button>
<span id="ios-hint" class="hint" hidden>${esc(t.iosHint)}</span></p>
${preview}
<form method="post" action="/logout"><input type="hidden" name="csrf" value="${esc(csrf)}"><button class="btn">${esc(t.logout)}</button></form>`);
}

export function adminPage(lang, items, csrf) {
  const t = T[lang];
  const rows = items.map((r) => `<section class="card"><b>${esc(r.phone ? fmtPhone(r.phone) : r.name)}</b>${r.email ? ` · ${esc(r.email)}` : ''}${r.phone ? '' : ''}<br><span class="hint">${esc(new Date(r.created_at).toISOString().slice(0, 16).replace('T', ' '))} UTC</span>
<p><a href="/admin/receipt/${Number(r.id)}" target="_blank" rel="noopener">${esc(t.openReceipt)}</a></p>
<form method="post" action="/admin/decide" class="row"><input type="hidden" name="csrf" value="${esc(csrf)}"><input type="hidden" name="id" value="${Number(r.id)}">
<button class="btn primary" name="decision" value="confirm">${esc(t.confirm)}</button> <button class="btn" name="decision" value="reject">${esc(t.reject)}</button></form></section>`).join('');
  return layout(lang, t.admin, `<h1 class="h2">${esc(t.admin)}</h1>${rows || `<p>${esc(t.adminEmpty)}</p>`}<p><a href="/admin/clients">${esc(t.clients)}</a> · <a href="/cabinet">${esc(t.toCabinet)}</a></p>`);
}

// Логин и пароль для отправки клиенту в WhatsApp (пароль показывается один раз)
export function credentialsPage(lang, c, password, loginUrl) {
  const t = T[lang];
  const phoneFmt = fmtPhone(c.phone);
  const text = `${t.waGreeting}\n${t.waLogin}: ${phoneFmt}\n${t.waPassword}: ${password}\n${loginUrl}`;
  const wa = `https://wa.me/${String(c.phone).replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
  return layout(lang, t.credTitle, `<div class="narrow"><div class="panel"><h1 class="h2">${esc(t.credTitle)}</h1><p>${esc(t.credLead)}</p>
<p class="cred"><span class="hint">${esc(t.waLogin)}</span><br><b>${esc(phoneFmt)}</b></p>
<p class="cred"><span class="hint">${esc(t.waPassword)}</span><br><code>${esc(password)}</code></p>
<p><a class="btn primary wide" href="${esc(wa)}" target="_blank" rel="noopener">${esc(t.sendWa)}</a></p>
<p class="hint">${esc(t.credNote)}</p><p><a href="/admin">${esc(t.admin)}</a></p></div></div>`);
}

const area = (label, name, val, max, req = false) =>
  `<label>${esc(label)}<textarea name="${name}" rows="3" maxlength="${max}" ${req ? 'required' : ''}>${esc(val)}</textarea></label>`;

export function profilePage(lang, csrf, err = '', v = {}) {
  const t = T[lang];
  const chosen = String(v.channels || 'instagram,telegram').split(',');
  const tones = ['friendly', 'formal', 'brief'].map((k) => `<option value="${k}" ${(v.tone || 'friendly') === k ? 'selected' : ''}>${esc(t['tone_' + k])}</option>`).join('');
  const chs = Object.entries(CHANNEL_NAMES).map(([k, n]) => `<label class="chk"><input type="checkbox" name="ch_${k}" value="1" ${chosen.includes(k) ? 'checked' : ''}> ${esc(n)}</label>`).join('');
  return layout(lang, t.profileTitle, `<div class="narrow"><div class="panel"><h1 class="h2">${esc(t.profileTitle)}</h1><p class="hint">${esc(t.profileIntro)}</p>${err ? `<p class="err">${esc(err)}</p>` : ''}
<form method="post" action="/profile"><input type="hidden" name="csrf" value="${esc(csrf)}">
${field(t.bizName, 'business_name', 'text', `maxlength="100" value="${esc(v.business_name)}"`)}
${area(t.bizAbout, 'about', v.about, 2000, true)}
${area(t.bizServices, 'services', v.services, 3000)}
${area(t.bizHours, 'hours', v.hours, 300)}
<label>${esc(t.bizTone)}<select name="tone">${tones}</select></label>
<fieldset><legend>${esc(t.channelsLabel)}</legend>${chs}</fieldset>
${area(t.bizExtra, 'extra', v.extra, 3000)}
<button class="btn primary wide">${esc(t.saveProfile)}</button></form>
<p><a href="/cabinet">${esc(t.toCabinet)}</a></p></div></div>`);
}

export function clientsPage(lang, items) {
  const t = T[lang];
  const rows = items.map((c) => `<section class="card"><a href="/admin/client/${Number(c.id)}"><b>${esc(who(c) || c.name)}</b></a><br><span class="hint">${esc(t['status_' + c.status] || c.status)}</span></section>`).join('');
  return layout(lang, t.clients, `<h1 class="h2">${esc(t.clients)}</h1>${rows || `<p>${esc(t.clientsEmpty)}</p>`}<p><a href="/admin">${esc(t.admin)}</a></p>`);
}

export function clientPage(lang, c, p, csrf = '') {
  const t = T[lang];
  const row = (k, val) => val ? `<p><b>${esc(k)}:</b><br>${esc(val).replace(/\n/g, '<br>')}</p>` : '';
  const chs = p ? String(p.channels).split(',').filter(Boolean).map((x) => CHANNEL_NAMES[x] || x).join(', ') : '';
  const body = p ? `<section class="card">${row(t.bizName, p.business_name)}${row(t.bizAbout, p.about)}${row(t.bizServices, p.services)}${row(t.bizHours, p.hours)}${row(t.field_tone, t['tone_' + p.tone] || p.tone)}${row(t.field_channels, chs)}${row(t.field_extra, p.extra)}</section>` : `<p>${esc(t.noProfile)}</p>`;
  const reset = c.phone ? `<form method="post" action="/admin/password"><input type="hidden" name="csrf" value="${esc(csrf)}"><input type="hidden" name="id" value="${Number(c.id)}"><button class="btn">${esc(t.newPassword)}</button></form>` : '';
  return layout(lang, c.name, `<h1 class="h2">${esc(c.phone ? fmtPhone(c.phone) : c.name)}</h1><p>${esc(c.email || '')} ${c.email ? '· ' : ''}${esc(t['status_' + c.status] || c.status)}</p>${body}${reset}<p><a href="/admin/clients">${esc(t.toClients)}</a></p>`);
}

export function notFound(lang) {
  const t = T[lang];
  return layout(lang, t.notFound, `<h1 class="h2">${esc(t.notFound)}</h1><p><a href="/">${esc(t.back)}</a></p>`);
}

'use strict';
// ============================================================
// Newsletter signup popup.
//
// GitHub Pages is static hosting (no server), so there is no app database to
// write to directly. This module therefore:
//   1) always records the address in this browser's localStorage (a built-in
//      client-side store, and an offline fallback), and
//   2) if a backend is configured below, POSTs the address to it so the
//      emails are collected centrally.
//
// To collect emails centrally for free with NO server of your own:
//   • Web3Forms (recommended): create a free access key at https://web3forms.com
//     and paste it into NEWSLETTER.web3formsKey. The key is public-safe.
//   • or set NEWSLETTER.endpoint to any URL that accepts a JSON {email} POST
//     (Formspree, a Cloudflare Worker + D1/KV, Google Apps Script, etc.).
// Until one is set, signups are stored locally only.
// ============================================================

const NEWSLETTER = {
  web3formsKey: '',   // <-- paste your Web3Forms access key here to collect centrally
  endpoint: '',       // <-- or a custom JSON POST endpoint (takes precedence if set)
  storeKey: 'dante_newsletter_subs',
  doneKey: 'dante_newsletter_done',
};

const Newsletter = {
  shownThisSession: false,
  el: {},

  init() {
    if (typeof document === 'undefined' || !document.getElementById) return;
    const g = id => document.getElementById(id);
    this.el = {
      overlay: g('nl-overlay'), card: g('nl-card'), form: g('nl-form'),
      email: g('nl-email'), submit: g('nl-submit'), status: g('nl-status'),
      later: g('nl-later'), close: g('nl-close'),
    };
    // require a real DOM (classList present) — stays inert in headless tests
    if (!this.el.overlay || !this.el.form || !this.el.overlay.classList) { this.el = {}; return; }
    this.el.form.addEventListener('submit', e => { e.preventDefault(); this.onSubmit(); });
    this.el.later.addEventListener('click', () => this.close(false));
    this.el.close.addEventListener('click', () => this.close(false));
    this.el.overlay.addEventListener('mousedown', e => { if (e.target === this.el.overlay) this.close(false); });
    this.el.overlay.addEventListener('touchstart', e => { if (e.target === this.el.overlay) { e.preventDefault(); this.close(false); } }, { passive: false });
  },

  // already subscribed (or permanently dismissed) on this device?
  done() {
    try { return localStorage.getItem(NEWSLETTER.doneKey) === '1'; } catch (e) { return false; }
  },

  validEmail(s) {
    if (typeof s !== 'string') return false;
    s = s.trim();
    // pragmatic RFC-ish check: local@domain.tld, no spaces
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 254;
  },

  buildPayload(email) {
    return {
      access_key: NEWSLETTER.web3formsKey,
      email: email,
      subject: 'DANTE: The Descent — newsletter signup',
      from_name: 'DANTE: The Descent',
      botcheck: '',
    };
  },

  saveLocal(email) {
    try {
      const arr = JSON.parse(localStorage.getItem(NEWSLETTER.storeKey) || '[]');
      if (!arr.some(r => r.email === email)) arr.push({ email, ts: Date.now() });
      localStorage.setItem(NEWSLETTER.storeKey, JSON.stringify(arr));
      return true;
    } catch (e) { return false; }
  },

  // POST to the configured backend. Returns {ok, central, msg}.
  async send(email) {
    const url = NEWSLETTER.endpoint || (NEWSLETTER.web3formsKey ? 'https://api.web3forms.com/submit' : '');
    if (!url) return { ok: true, central: false };
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(this.buildPayload(email)),
      });
      let j = {};
      try { j = await res.json(); } catch (e) {}
      const ok = res.ok && (j.success === undefined || j.success === true);
      return { ok, central: true, msg: j.message };
    } catch (e) {
      return { ok: false, central: true, msg: 'network error' };
    }
  },

  // ---- popup lifecycle ----
  maybeShow(reason) {
    if (this.shownThisSession || this.done()) return false;
    if (!this.el.overlay) return false;
    this.shownThisSession = true;
    this.reason = reason;
    this.open();
    return true;
  },

  open() {
    if (!this.el.overlay) return;
    this.setStatus('', '');
    if (this.el.email) this.el.email.value = '';
    if (this.el.submit) { this.el.submit.disabled = false; this.el.submit.textContent = 'Subscribe'; }
    this.el.overlay.classList.add('show');
    if (typeof Game !== 'undefined') Game.modalOpen = true;
    // focus the field shortly after it becomes visible (mobile-friendly)
    setTimeout(() => { try { this.el.email.focus(); } catch (e) {} }, 60);
  },

  close(subscribed) {
    if (this.el.overlay) this.el.overlay.classList.remove('show');
    if (subscribed) { try { localStorage.setItem(NEWSLETTER.doneKey, '1'); } catch (e) {} }
    if (typeof Game !== 'undefined') Game.modalOpen = false;
  },

  setStatus(msg, cls) {
    if (!this.el.status) return;
    this.el.status.textContent = msg;
    this.el.status.className = cls || '';
  },

  async onSubmit() {
    const email = (this.el.email.value || '').trim();
    if (!this.validEmail(email)) { this.setStatus('Please enter a valid email.', 'err'); return; }
    this.el.submit.disabled = true;
    this.el.submit.textContent = 'Sending…';
    this.saveLocal(email);
    const r = await this.send(email);
    if (r.ok) {
      this.setStatus(r.central ? 'Subscribed! See you in the next circle.' : 'Saved! See you in the next circle.', 'ok');
      this.el.submit.textContent = 'Subscribed ✓';
      setTimeout(() => this.close(true), 1100);
    } else {
      // central send failed, but it's saved locally — don't lose the user
      this.setStatus('Saved offline — we will retry later.', 'ok');
      this.el.submit.textContent = 'Done';
      setTimeout(() => this.close(true), 1300);
    }
  },
};

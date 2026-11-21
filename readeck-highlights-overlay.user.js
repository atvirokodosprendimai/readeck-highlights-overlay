// ==UserScript==
// @name         Readeck Highlights Overlay
// @namespace    readeck-overlay
// @version      0.7.3
// @description  Local-first Readeck highlights with a popup cloned from Readeck's own in-app highlight menu. Server + token are set once via the menu and kept in manager storage, so updates never wipe them. English UI by default, switchable in the menu; highlight mode is off until toggled per site.
// @updateURL    https://raw.githubusercontent.com/atvirokodosprendimai/readeck-highlights-overlay/main/readeck-highlights-overlay.user.js
// @downloadURL  https://raw.githubusercontent.com/atvirokodosprendimai/readeck-highlights-overlay/main/readeck-highlights-overlay.user.js
// @match        *://*/*
// @noframes
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ---- Configuration -------------------------------------------------------
  // Server and token live in the script manager's storage (GM_getValue/GM_setValue),
  // so they survive auto-updates. Nothing personal is kept in this file.
  // Set them once: script menu -> "Readeck: set server and token".
  let ORIGIN = '';
  let API_TOKEN = '';

  // ---- UI language -----------------------------------------------------------
  // Every user-visible string lives in this table. Default language: English.
  // Switch language: script menu -> "Readeck: language / kalba" (kept in
  // manager storage, so updates never wipe it).
  // Add a language: copy the "en" block under a new key (e.g. "de") and
  // translate the values - it appears in the language prompt automatically.
  const LANGS = {
    en: {
      'setup.promptOrigin': 'Readeck server URL (e.g. https://readeck.example.com):',
      'setup.badOrigin': 'The server URL must start with http:// or https://',
      'setup.promptToken': 'Readeck API token (Readeck: Profile -> API tokens; saving and highlights need the "bookmarks write" scope):',
      'setup.emptyToken': 'Token is empty - nothing saved.',
      'setup.saved': 'Settings saved. Testing the connection…',
      'setup.needed': 'Set the server and token first: script menu -> "Readeck: set server and token".',
      'sync.syncing': 'Syncing with Readeck…',
      'sync.synced': (h, b) => 'Synced: ' + h + ' highlights, ' + b + ' pages.',
      'sync.progressPages': (n) => n + ' pages',
      'sync.progressHls': (n) => n + ' highlights',
      'create.savingPage': 'Readeck: saving the page…',
      'create.emptyDropped': 'Empty highlight removed from the queue.',
      'create.creating': 'Readeck: creating the highlight…',
      'create.synced': 'Highlight synced with Readeck.',
      'create.noText': 'No text was captured - select it again.',
      'create.marked': 'Marked. Syncing with Readeck in the background…',
      'update.synced': 'Highlight updated in Readeck.',
      'update.marked': 'Updated. Syncing with Readeck in the background…',
      'update.doneLocal': 'Updated.',
      'delete.done': 'Deleted from Readeck too.',
      'delete.localOnly': 'Removed on this page; Readeck ID unknown (do a full sync with Shift+click).',
      'delete.removed': 'Removed. Deleting from Readeck in the background…',
      'queue.unreachable': (n) => 'Readeck unreachable; will sync later (' + n + ' queued).',
      'queue.failedFinal': (err) => 'Readeck sync failed permanently: ' + err + ' (menu: retry sync)',
      'queue.failedRetry': (err) => 'Readeck sync failed (' + err + '). Will retry.',
      'overlay.hasBmNoHl': 'Page is in Readeck, no highlights yet - select some text.',
      'overlay.noHl': (k) => 'This page has no Readeck highlights. Key: ' + k,
      'overlay.placed': (p, n, missed) => 'Placed ' + p + ' of ' + n + (missed ? ' (' + missed + ' not found in the text)' : ''),
      'test.testing': (o) => 'Testing the connection to ' + o + '…',
      'test.ok': (v) => 'Connection OK: Readeck ' + (v || '(version unknown)') + '.',
      'retry.retrying': 'Retrying sync…',
      'mode.on': 'Highlight mode ON for this site (remembered).',
      'mode.off': 'Highlight mode OFF for this site. Selecting text will not pop the highlight menu.',
      'badge.title': 'Readeck highlights (click = highlight mode on/off for this site, Shift+click = full sync)',
      'lang.prompt': (list) => 'Language (' + list + '):',
      'lang.switched': (l) => 'Language: ' + l + '. Menu labels update on the next page load.',
      'lang.unknown': (l, list) => 'Unknown language "' + l + '". Available: ' + list,
      'ui.highlight': 'Highlight',
      'ui.note': 'Note:',
      'ui.save': 'Save',
      'ui.delete': 'Delete',
      'menu.setup': 'Readeck: set server and token',
      'menu.mode': 'Readeck: highlight mode on/off (this site)',
      'menu.lang': 'Readeck: language / kalba',
      'menu.fullSync': 'Readeck: full sync',
      'menu.clear': 'Readeck: remove highlights',
      'menu.test': 'Readeck: test connection',
      'menu.retry': 'Readeck: retry failed sync',
      'menu.diag': 'Readeck: diagnostics',
      'menu.version': (v) => 'Readeck: v' + v,
      'version.status': (v) => 'Script version: v' + v + ' (shown in the button tooltip and this menu).',
      'err.noGm': 'GM_xmlhttpRequest is not supported by this userscript manager. Use Tampermonkey (Chrome) or Violentmonkey (Firefox).',
      'err.badJson': 'Bad JSON from Readeck',
      'err.tokenRejected': (s) => 'Readeck rejected the token (' + s + '). Check it in the script menu ("Readeck: set server and token"); saving/creating/deleting needs the "bookmarks write" scope.',
      'err.tokenRejectedShort': (s) => 'Readeck rejected the token (' + s + '). Check it in the script menu.',
      'err.reqRejected': (s, body) => 'Readeck rejected the request (' + s + '): ' + body,
      'err.http': (s) => 'Readeck error ' + s,
      'err.unreachable': (o, d) => 'Could not reach ' + o + '. If the userscript manager asked for permission, choose "Always allow domain"; also check the server address in the menu.' + d,
      'err.unreachableShort': (o, d) => 'Could not reach ' + o + d,
      'err.timeout': 'Readeck request timed out',
      'err.badBookmarks': 'Unexpected Readeck response (bookmarks).',
      'err.badAnnotations': 'Unexpected Readeck response (annotations).',
      'err.emptySync': 'Cannot sync an empty highlight (no text was captured).',
      'err.emptyArticle': 'The Readeck article is empty.',
      'err.textNotFound': "Could not find that text in Readeck's version of the article (the article may differ).",
      'err.textMapShort': "Could not find that text in Readeck's version of the article (text map shorter).",
      'err.noBookmarkId': (s, h, b) => 'Readeck did not return a bookmark ID (status ' + s + ', headers: ' + (h || 'none') + ', body: ' + b + ')',
      'err.extractFailed': 'Readeck could not extract the article from this page.',
      'err.tooSlow': 'Readeck is taking too long to process the page; try again in a minute.',
      'diag.noManager': 'MISSING (unsupported manager)',
      'diag.missing': 'MISSING',
      'diag.present': 'set',
      'diag.notSaved': 'not saved',
      'diag.line': (o) => 'Script: v' + o.ver + ' | manager: ' + o.mgr + ' | server: ' + o.origin + ' | token: ' + o.token +
        ' | server index: ' + o.bmN + ' pages, ' + o.idxN + ' hl.' +
        ' | local: ' + o.localN + ' hl., queued: ' + o.pend + ', failed: ' + o.failed +
        ' | page: ' + o.page + ' | key: ' + o.key,
    },
    lt: {
      'setup.promptOrigin': 'Readeck serverio adresas (pvz. https://read.example.com):',
      'setup.badOrigin': 'Serverio adresas turi prasidėti http:// arba https://',
      'setup.promptToken': 'Readeck API token’as (Readeck: Profile → API tokens; saugojimui ir highlight’ams reikia „bookmarks write“ teisės):',
      'setup.emptyToken': 'Token’as tuščias - nieko neišsaugojau.',
      'setup.saved': 'Nustatymai išsaugoti. Tikrinu ryšį…',
      'setup.needed': 'Pirmiausia nustatyk serverį ir token’ą: script’o meniu → „Readeck: nustatyti serverį ir token’ą“.',
      'sync.syncing': 'Sinchronizuoju su Readeck…',
      'sync.synced': (h, b) => 'Sinchronizuota: ' + h + ' highlight’ų, ' + b + ' puslapių.',
      'sync.progressPages': (n) => 'puslapių ' + n,
      'sync.progressHls': (n) => 'highlight’ų ' + n,
      'create.savingPage': 'Readeck: saugau puslapį…',
      'create.emptyDropped': 'Tuščias highlight’as pašalintas iš eilės.',
      'create.creating': 'Readeck: kuriu highlight’ą…',
      'create.synced': 'Highlight’as sinchronizuotas su Readeck.',
      'create.noText': 'Tekstas nebuvo užfiksuotas - pažymėk dar kartą.',
      'create.marked': 'Pažymėta. Sinchronizuoju su Readeck fone…',
      'update.synced': 'Highlight’as atnaujintas Readeck.',
      'update.marked': 'Atnaujinta. Sinchronizuoju su Readeck fone…',
      'update.doneLocal': 'Atnaujinta.',
      'delete.done': 'Ištrinta ir Readeck.',
      'delete.localOnly': 'Nuimta šiame puslapyje; Readeck ID nežinomas (pilnai sinchronizuok Shift+spustelėjus).',
      'delete.removed': 'Nuimta. Trinu iš Readeck fone…',
      'queue.unreachable': (n) => 'Readeck nepasiekiamas; sinchronizuosiu vėliau (' + n + ' laukia).',
      'queue.failedFinal': (err) => 'Readeck sinchronizacija galutinai nepavyko: ' + err + ' (meniu: pakartoti)',
      'queue.failedRetry': (err) => 'Readeck sinchronizacija nepavyko (' + err + '). Pakartosiu.',
      'overlay.hasBmNoHl': 'Puslapis Readeck yra, highlight’ų dar nėra - pažymėk tekstą.',
      'overlay.noHl': (k) => 'Šis puslapis Readeck highlight’ų neturi. Raktas: ' + k,
      'overlay.placed': (p, n, missed) => 'Uždėta ' + p + ' iš ' + n + (missed ? ' (' + missed + ' tekste nerasta)' : ''),
      'test.testing': (o) => 'Tikrinu ryšį su ' + o + '…',
      'test.ok': (v) => 'Ryšys gerai: Readeck ' + (v || '(versija nežinoma)') + '.',
      'retry.retrying': 'Kartoju sinchronizaciją…',
      'mode.on': 'Highlight režimas ĮJUNGTAS šiame saite (atsiminsiu).',
      'mode.off': 'Highlight režimas IŠJUNGTAS šiame saite. Žymint tekstą meniu neiššoks.',
      'badge.title': 'Readeck highlight’ai (spustelėk = highlight režimas šiam saitui įjungti/išjungti, Shift+spustelėk = pilna sinchronizacija)',
      'lang.prompt': (list) => 'Kalba (' + list + '):',
      'lang.switched': (l) => 'Kalba: ' + l + '. Meniu pavadinimai atsinaujins kitą kartą užkrovus puslapį.',
      'lang.unknown': (l, list) => 'Nežinoma kalba „' + l + '“. Galimos: ' + list,
      'ui.highlight': 'Highlight',
      'ui.note': 'Pastaba:',
      'ui.save': 'Išsaugoti',
      'ui.delete': 'Ištrinti',
      'menu.setup': 'Readeck: nustatyti serverį ir token’ą',
      'menu.mode': 'Readeck: highlight režimas įjungti/išjungti (šis saitas)',
      'menu.lang': 'Readeck: language / kalba',
      'menu.fullSync': 'Readeck: pilna sinchronizacija',
      'menu.clear': 'Readeck: nuimti highlight’us',
      'menu.test': 'Readeck: patikrinti ryšį',
      'menu.retry': 'Readeck: pakartoti nepavykusią sinchronizaciją',
      'menu.diag': 'Readeck: diagnostika',
      'menu.version': (v) => 'Readeck: v' + v,
      'version.status': (v) => 'Script’o versija: v' + v + ' (matosi mygtuko paaiškinime ir šiame meniu).',
      'err.noGm': 'GM_xmlhttpRequest nepalaikomas šiame script’u tvarkytuvėje. Naudok Tampermonkey (Chrome) arba Violentmonkey (Firefox).',
      'err.badJson': 'Bad JSON from Readeck',
      'err.tokenRejected': (s) => 'Readeck atmete token’ą (' + s + '). Patikrink jį script’o meniu („Readeck: nustatyti serverį ir token’ą“); saugojant/kuriant/trinant reikia „bookmarks write“ teisės.',
      'err.tokenRejectedShort': (s) => 'Readeck atmete token’ą (' + s + '). Patikrink jį script’o meniu.',
      'err.reqRejected': (s, body) => 'Readeck atmete užklausa (' + s + '): ' + body,
      'err.http': (s) => 'Readeck klaida ' + s,
      'err.unreachable': (o, d) => 'Nepavyko pasiekti ' + o + '. Jei script’u tvarkytuvė klausė leidimo, rinkis „Always allow domain“; patikrink ir serverio adresą meniu.' + d,
      'err.unreachableShort': (o, d) => 'Nepavyko pasiekti ' + o + d,
      'err.timeout': 'Readeck užklausa užstrigo',
      'err.badBookmarks': 'Netikėtas Readeck atsakymas (bookmarks).',
      'err.badAnnotations': 'Netikėtas Readeck atsakymas (annotations).',
      'err.emptySync': 'Tuščio highlight’o sinchronizuoti negalima (tekstas nebuvo užfiksuotas).',
      'err.emptyArticle': 'Readeck straipsnis tuščias.',
      'err.textNotFound': 'To teksto Readeck straipsnio versijoje neradau (straipsnis gal skiriasi).',
      'err.textMapShort': 'To teksto Readeck straipsnio versijoje neradau (teksto žemėlapis trumpesnis).',
      'err.noBookmarkId': (s, h, b) => 'Readeck negrąžino bookmark ID (status ' + s + ', headeriai: ' + (h || 'nėra') + ', body: ' + b + ')',
      'err.extractFailed': 'Readeck nepavyko išgauti straipsnio iš šio puslapio.',
      'err.tooSlow': 'Readeck per ilgai apdoroja puslapį; pabandyk dar kartą po minutės.',
      'diag.noManager': 'NĖRA (netinkamas tvarkytuvas)',
      'diag.missing': 'NĖRA',
      'diag.present': 'yra',
      'diag.notSaved': 'neišsaugotas',
      'diag.line': (o) => 'Script’as: v' + o.ver + ' | tvarkytuvas: ' + o.mgr + ' | serveris: ' + o.origin + ' | token’as: ' + o.token +
        ' | serverio indeksas: ' + o.bmN + ' psl., ' + o.idxN + ' hl.' +
        ' | lokalus: ' + o.localN + ' hl., laukia: ' + o.pend + ', nepavyko: ' + o.failed +
        ' | puslapis: ' + o.page + ' | raktas: ' + o.key,
    },
  };
  let LANG = 'en';
  function t(key, ...args) {
    const table = LANGS[LANG] || LANGS.en;
    const v = table[key] !== undefined ? table[key] : LANGS.en[key];
    if (v === undefined) return key;
    return typeof v === 'function' ? v(...args) : v;
  }

  async function setupLanguage() {
    const codes = Object.keys(LANGS);
    const pick = window.prompt(t('lang.prompt', codes.join(', ')), LANG);
    if (pick === null) return;
    const code = pick.trim().toLowerCase();
    if (!LANGS[code]) { setStatus(t('lang.unknown', code, codes.join(', ')), true); return; }
    LANG = code;
    await gmSet('rd_lang', code);
    const btn = document.querySelector('#rd-hl-btn');
    if (btn) btn.title = badgeTitle();
    setStatus(t('lang.switched', code), false);
  }

  // ---- Highlight mode (per site) ----------------------------------------------
  // Off by default: selecting text for copy/paste never pops the highlight menu.
  // The bottom-right button toggles it for the current site; the choice is
  // remembered per site in manager storage.
  let HL_ON = false;
  function hlSiteKey() { return 'rd_hlon_' + location.hostname; }
  async function setHlMode(on) {
    HL_ON = !!on;
    await gmSet(hlSiteKey(), HL_ON);
    refreshBadge();
  }
  async function toggleHlMode() {
    await setHlMode(!HL_ON);
    setStatus(HL_ON ? t('mode.on') : t('mode.off'), false);
    if (HL_ON) run(false);
  }

  async function loadConfig() {
    ORIGIN = String(await gmGet('rd_origin', '') || '').replace(/\/+$/, '');
    API_TOKEN = String(await gmGet('rd_token', '') || '');
    LANG = String(await gmGet('rd_lang', 'en') || 'en');
    if (!LANGS[LANG]) LANG = 'en';
  }

  async function setupConnection() {
    const originIn = window.prompt(t('setup.promptOrigin'), ORIGIN || 'https://');
    if (originIn === null) return;
    const o = originIn.trim().replace(/\/+$/, '');
    if (!/^https?:\/\/.+/.test(o)) {
      setStatus(t('setup.badOrigin'), true);
      return;
    }
    const tokenIn = window.prompt(t('setup.promptToken'), API_TOKEN || '');
    if (tokenIn === null) return;
    if (!tokenIn.trim()) {
      setStatus(t('setup.emptyToken'), true);
      return;
    }
    await gmSet('rd_origin', o);
    await gmSet('rd_token', tokenIn.trim());
    await loadConfig();
    setStatus(t('setup.saved'), true);
    testConnection();
  }

  const SYNC_MAX_AGE_MS = 24 * 60 * 60 * 1000; // re-sync server index when older than this
  const HTML_MAX_LEN = 1500000;  // cap for page HTML kept for deferred saves
  const MAX_TRIES = 6;           // queue attempts before an op is marked failed
  const RETRY_MS = 120000;       // background queue retry cadence

  // ---- Userscript-manager compatibility ------------------------------------
  function gmRequest(opts) {
    if (typeof GM_xmlhttpRequest === 'function') { GM_xmlhttpRequest(opts); return; }
    if (typeof GM !== 'undefined' && typeof GM.xmlHttpRequest === 'function') { GM.xmlHttpRequest(opts); return; }
    if (opts.onerror) opts.onerror(new Error(t('err.noGm')));
  }
  async function gmGet(key, def) {
    if (typeof GM_getValue === 'function') return GM_getValue(key, def);
    if (typeof GM !== 'undefined' && GM.getValue) return await GM.getValue(key, def);
    return def;
  }
  async function gmSet(key, val) {
    if (typeof GM_setValue === 'function') { GM_setValue(key, val); return; }
    if (typeof GM !== 'undefined' && GM.setValue) { await GM.setValue(key, val); return; }
  }
  function gmMenu(label, fn) {
    if (typeof GM_registerMenuCommand === 'function') GM_registerMenuCommand(label, fn);
    else if (typeof GM !== 'undefined' && GM.registerMenuCommand) GM.registerMenuCommand(label, fn);
  }

  // Loaded script version (from the manager via GM_info), shown in the
  // bottom-right button tooltip and as a menu entry, so it is always visible
  // at a glance which version is running on the page.
  const SCRIPT_VERSION = (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version)
    ? String(GM_info.script.version) : '?';
  function badgeTitle() { return t('badge.title') + ' · v' + SCRIPT_VERSION; }
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // ---- URL normalization ---------------------------------------------------
  const TRACKING_PARAMS = /^(utm_|fbclid|gclid|dclid|gbraid|wbraid|mc_cid|mc_eid|igshid|spm|ref$|ref_src|_bhlid|cndid|guccounter|syn-|oly_|vero_|wicked|sscid)/i;

  function normalizeUrl(raw) {
    try {
      const u = new URL(raw);
      u.hash = '';
      u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
      const kept = [];
      u.searchParams.forEach((v, k) => { if (!TRACKING_PARAMS.test(k)) kept.push([k, v]); });
      kept.sort((a, b) => a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0]));
      const qs = kept.map(([k, v]) => k + '=' + v).join('&');
      let path = u.pathname.replace(/\/+$/, '') || '/';
      return u.hostname + path + (qs ? '?' + qs : '');
    } catch (e) { return raw; }
  }

  function candidateUrls() {
    const urls = new Set([location.href]);
    const canon = document.querySelector('link[rel="canonical"]');
    if (canon && canon.href) urls.add(canon.href);
    const og = document.querySelector('meta[property="og:url"]');
    if (og && og.content) urls.add(og.content);
    return [...urls].map(normalizeUrl);
  }

  // ---- Readeck API ---------------------------------------------------------
  function apiRequest(method, path, body, rawText) {
    return new Promise((resolve, reject) => {
      gmRequest({
        method,
        url: ORIGIN + path,
        headers: {
          'Authorization': 'Bearer ' + API_TOKEN,
          'Accept': rawText ? 'text/html' : 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        data: body ? JSON.stringify(body) : undefined,
        onload: (r) => {
          if (r.status >= 200 && r.status < 300) {
            if (rawText) return resolve(r.responseText);
            if (r.status === 204 || !r.responseText) return resolve(null);
            try { resolve(JSON.parse(r.responseText)); }
            catch (e) { reject(new Error(t('err.badJson'))); }
          } else if (r.status === 401 || r.status === 403) {
            reject(new Error(t('err.tokenRejected', r.status)));
          } else if (r.status === 400 || r.status === 422) {
            reject(new Error(t('err.reqRejected', r.status, String(r.responseText || '').slice(0, 140))));
          } else {
            reject(new Error(t('err.http', r.status)));
          }
        },
        onerror: (e) => reject(new Error(t('err.unreachable', ORIGIN, (e && e.error ? ' [' + e.error + ']' : '')))),
        ontimeout: () => reject(new Error(t('err.timeout'))),
        timeout: 30000,
      });
    });
  }

  function parseHeaders(raw) {
    const h = {};
    String(raw || '').split(/\r?\n/).forEach(line => {
      const i = line.indexOf(':');
      if (i > 0) h[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
    });
    return h;
  }

  function apiRequestRaw(method, path, body) {
    return new Promise((resolve, reject) => {
      gmRequest({
        method,
        url: ORIGIN + path,
        headers: {
          'Authorization': 'Bearer ' + API_TOKEN,
          'Accept': 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        data: body ? JSON.stringify(body) : undefined,
        onload: (r) => {
          if (r.status >= 200 && r.status < 300) {
            let json = null;
            try { json = r.responseText ? JSON.parse(r.responseText) : null; } catch (e) { json = null; }
            resolve({ status: r.status, headers: parseHeaders(r.responseHeaders), json, text: r.responseText || '' });
          } else if (r.status === 401 || r.status === 403) {
            reject(new Error(t('err.tokenRejectedShort', r.status)));
          } else if (r.status === 400 || r.status === 422) {
            reject(new Error(t('err.reqRejected', r.status, String(r.responseText || '').slice(0, 140))));
          } else {
            reject(new Error(t('err.http', r.status)));
          }
        },
        onerror: (e) => reject(new Error(t('err.unreachableShort', ORIGIN, (e && e.error ? ' [' + e.error + ']' : '')))),
        ontimeout: () => reject(new Error(t('err.timeout'))),
        timeout: 30000,
      });
    });
  }

  const apiGet = (path) => apiRequest('GET', path, null, false);
  const apiGetHtml = (path) => apiRequest('GET', path, null, true);
  const apiPost = (path, body) => apiRequest('POST', path, body, false);
  const apiPatch = (path, body) => apiRequest('PATCH', path, body, false);
  const apiDelete = (path) => apiRequest('DELETE', path, null, false);

  // ---- Text helpers ----------------------------------------------------------
  // Single-char folds only: buildTextMap's char->position map assumes 1 char in = 1 char out.
  const FOLD = {
    '\u2018': "'", '\u2019': "'", '\u201A': "'", '\u201B': "'", '\u2032': "'", '\u2039': "'", '\u203A': "'",
    '\u201C': '"', '\u201D': '"', '\u201E': '"', '\u201F': '"', '\u2033': '"', '\u00AB': '"', '\u00BB': '"',
    '\u2010': '-', '\u2011': '-', '\u2012': '-', '\u2013': '-', '\u2014': '-', '\u2015': '-', '\u2212': '-',
    '\u2026': '.', '\u00A0': ' ', '\u2002': ' ', '\u2003': ' ', '\u2007': ' ', '\u2009': ' ', '\u202F': ' ',
  };
  // Invisible chars dropped on both sides before matching (soft hyphen, zero-width spaces, word joiner, BOM).
  const DROP_CHARS = new Set(['\u00AD', '\u200B', '\u200C', '\u200D', '\u2060', '\uFEFF']);
  const DROP_RE = /[\u00AD\u200B\u200C\u200D\u2060\uFEFF]/g;
  function foldText(str) {
    return String(str).replace(DROP_RE, '').replace(/[\u2018\u2019\u201A\u201B\u2032\u2039\u203A\u201C\u201D\u201E\u201F\u2033\u00AB\u00BB\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u2026\u00A0\u2002\u2003\u2007\u2009\u202F]/g, c => FOLD[c]);
  }
  function normText(str) { return foldText(str).replace(/\s+/g, ' ').trim(); }

  // ---- Local stores ------------------------------------------------------------
  // Server cache (GM storage): hl2_index {normUrl: [{id,b,text,color,note}]}, hl2_bmarks {normUrl:{id,title}}
  // Local replica (GM storage): rd_replica {normUrl: [{lid,text,color,note,state,bookmarkId,annId,created}]}
  //   state: pending | synced | failed | deleting
  // Queue (GM storage): rd_queue [{op:'create',lid,key,url,title,html?,bookmarkId?,tries,lastError} |
  //                               {op:'delete',annId,bookmarkId,tries,lastError}]
  let cachedIndex = null;
  let cachedBmarks = null;
  let replica = {};
  let queue = [];

  async function loadCaches() {
    const raw = await gmGet('hl2_index', null);
    const rawB = await gmGet('hl2_bmarks', null);
    try { cachedIndex = raw ? JSON.parse(raw) : {}; } catch (e) { cachedIndex = {}; }
    try { cachedBmarks = rawB ? JSON.parse(rawB) : {}; } catch (e) { cachedBmarks = {}; }
  }

  async function saveCaches() {
    if (cachedIndex) await gmSet('hl2_index', JSON.stringify(cachedIndex));
    if (cachedBmarks) await gmSet('hl2_bmarks', JSON.stringify(cachedBmarks));
    await gmSet('hl2_index_ts', Date.now());
  }

  async function loadLocal() {
    const r = await gmGet('rd_replica', null);
    const q = await gmGet('rd_queue', null);
    try { replica = r ? JSON.parse(r) : {}; } catch (e) { replica = {}; }
    try { queue = q ? JSON.parse(q) : []; } catch (e) { queue = []; }
  }

  async function saveLocal() {
    await gmSet('rd_replica', JSON.stringify(replica));
    await gmSet('rd_queue', JSON.stringify(queue));
  }

  function pageHighlights() {
    if (!cachedIndex) return { key: null, list: [] };
    for (const k of candidateUrls()) {
      if (cachedIndex[k] && cachedIndex[k].length) return { key: k, list: cachedIndex[k] };
    }
    return { key: null, list: [] };
  }

  function pageBookmark() {
    if (!cachedBmarks) return { key: null, bm: null };
    for (const k of candidateUrls()) {
      if (cachedBmarks[k]) return { key: k, bm: cachedBmarks[k] };
    }
    return { key: null, bm: null };
  }

  // Merged view for this page: server entries first, local replica on top, deduped by text.
  function pageEntries() {
    const seen = new Set();
    const out = [];
    for (const h of pageHighlights().list) {
      const t = normText(h.text);
      if (t && !seen.has(t)) { seen.add(t); out.push(h); }
    }
    for (const k of candidateUrls()) {
      for (const e of (replica[k] || [])) {
        if (e.state === 'deleting') continue;
        if (seen.has(e.text)) continue;
        seen.add(e.text);
        out.push({ text: e.text, color: e.color, note: e.note, lid: e.lid, id: e.annId, b: e.bookmarkId });
      }
    }
    return out;
  }

  // ---- Server index sync -----------------------------------------------------
  async function syncAll(onProgress) {
    const bmarks = {};
    let offset = 0;
    const limit = 100;
    for (;;) {
      const page = await apiGet('/api/bookmarks?limit=' + limit + '&offset=' + offset);
      if (!Array.isArray(page)) throw new Error(t('err.badBookmarks'));
      if (page.length === 0) break;
      for (const b of page) {
        if (!b.url || !b.id) continue;
        const key = normalizeUrl(b.url);
        if (!bmarks[key]) bmarks[key] = { id: b.id, title: b.title || '' };
      }
      onProgress && onProgress(t('sync.progressPages', offset + page.length));
      if (page.length < limit) break;
      offset += limit;
      if (offset > 100000) break;
    }
    const index = {};
    offset = 0;
    for (;;) {
      const page = await apiGet('/api/bookmarks/annotations?limit=' + limit + '&offset=' + offset);
      if (!Array.isArray(page)) throw new Error(t('err.badAnnotations'));
      if (page.length === 0) break;
      for (const a of page) {
        if (!a.text || !a.bookmark_url) continue;
        const key = normalizeUrl(a.bookmark_url);
        (index[key] = index[key] || []).push({ id: a.id, b: a.bookmark_id, text: a.text, color: a.color || 'yellow', note: a.note || '' });
      }
      onProgress && onProgress(t('sync.progressHls', offset + page.length));
      if (page.length < limit) break;
      offset += limit;
      if (offset > 100000) break;
    }
    for (const key of Object.keys(index)) {
      const seen = new Set();
      index[key] = index[key].filter(h => {
        const t = normText(h.text);
        return seen.has(t) ? false : (seen.add(t), true);
      });
    }
    await gmSet('hl2_index', JSON.stringify(index));
    await gmSet('hl2_bmarks', JSON.stringify(bmarks));
    await gmSet('hl2_index_ts', Date.now());
    const n = Object.values(index).reduce((s, arr) => s + arr.length, 0);
    return { highlights: n, bookmarks: Object.keys(bmarks).length };
  }

  // After a full server sync, drop local entries that the server now has.
  function reconcileReplica() {
    for (const key of Object.keys(replica)) {
      const server = cachedIndex[key] || [];
      replica[key] = replica[key].filter(e => {
        if (e.state === 'deleting') return false;
        if (e.state === 'synced') {
          return !server.some(h => (e.annId && h.id === e.annId) || normText(h.text) === e.text);
        }
        return true; // pending and failed stay local
      });
      if (!replica[key].length) delete replica[key];
    }
  }

  async function trySync(force) {
    const ts = await gmGet('hl2_index_ts', 0);
    if (!force && cachedIndex && Object.keys(cachedIndex).length && (Date.now() - ts) <= SYNC_MAX_AGE_MS) return;
    setBadge('\u2026', '#4a4a4a');
    setStatus(t('sync.syncing'), true);
    const r = await syncAll((done) => setStatus(t('sync.syncing') + ' ' + done, true));
    await loadCaches();
    reconcileReplica();
    await saveLocal();
    setStatus(t('sync.synced', r.highlights, r.bookmarks), false);
  }

  // ---- Text mapping & wrapping ---------------------------------------------
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'SVG', 'CANVAS', 'IFRAME', 'MARK']);

  function buildTextMap(root) {
    const walker = (root.ownerDocument || document).createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        let el = node.parentElement;
        if (!el || SKIP_TAGS.has(el.tagName)) return NodeFilter.FILTER_REJECT;
        if (el.closest('#rd-hl-panel') || el.closest('#rd-hl-pop')) return NodeFilter.FILTER_REJECT;
        // Whitespace-only text nodes stay: they are the spaces between block
        // elements (</p>\n<p>), which a browser selection DOES include. Dropping
        // them made every cross-paragraph highlight unfindable in the article.
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);

    let text = '';
    const map = [];
    let pendingSpace = null;
    for (const node of nodes) {
      const data = node.data;
      for (let i = 0; i < data.length; i++) {
        if (DROP_CHARS.has(data[i])) continue;
        const ch = FOLD[data[i]] || data[i];
        if (/\s/.test(ch)) {
          if (text.length > 0 && !pendingSpace) pendingSpace = { node, offset: i };
          continue;
        }
        if (pendingSpace) { text += ' '; map.push(pendingSpace); pendingSpace = null; }
        text += ch;
        map.push({ node, offset: i });
      }
    }
    return { text, map };
  }

  // Find a needle in a built text map. Exact match first; then a
  // whitespace-insensitive (squashed) match; then, for long needles, a
  // prefix/suffix anchor match that tolerates mid-text differences between
  // the live page and Readeck's stored article. Returns { from, to } as
  // positions in the folded text (to is exclusive), or null.
  function findNeedle(text, needle) {
    let idx = text.indexOf(needle);
    if (idx !== -1) return { from: idx, to: idx + needle.length };
    const sqChars = [];
    const pos = [];
    for (let i = 0; i < text.length; i++) {
      if (!/\s/.test(text[i])) { sqChars.push(text[i]); pos.push(i); }
    }
    const sq = sqChars.join('');
    const sqNeedle = needle.replace(/\s+/g, '');
    if (!sqNeedle) return null;
    idx = sq.indexOf(sqNeedle);
    if (idx !== -1) return { from: pos[idx], to: pos[idx + sqNeedle.length - 1] + 1 };
    if (sqNeedle.length >= 40) {
      const k = Math.min(24, sqNeedle.length >> 1);
      const head = sqNeedle.slice(0, k);
      const tail = sqNeedle.slice(-k);
      let hs = sq.indexOf(head);
      while (hs !== -1) {
        const te = sq.indexOf(tail, hs + head.length);
        if (te !== -1) return { from: pos[hs], to: pos[te + tail.length - 1] + 1 };
        hs = sq.indexOf(head, hs + 1);
      }
    }
    return null;
  }

  // Readeck's exact palette (light theme), taken from its own stylesheet:
  // bg = painted mark background, border = 1px bottom border, box = menu color circle.
  const COLORS = {
    yellow: { bg: '#fef0cb', border: '#f9b807', box: '#f9b807' },
    red:    { bg: '#fbd4d4', border: '#ef4444', box: '#ef4444' },
    blue:   { bg: '#dcf2f7', border: '#0da6c9', box: '#0da6c9' },
    green:  { bg: '#d5edaf', border: '#84cc16', box: '#84cc16' },
    none:   { bg: 'transparent', border: '#b4a69b', box: '#fcfbfb' },
    // legacy colors painted by older versions of this script
    purple: { bg: 'rgba(156, 39, 176, 0.30)', border: '#9c27b0', box: '#9c27b0' },
    orange: { bg: 'rgba(255, 152, 0, 0.35)', border: '#ff9800', box: '#ff9800' },
  };
  // the five choices Readeck's own menu offers, in its order
  const MENU_COLORS = ['yellow', 'red', 'blue', 'green', 'none'];

  function unwrapMark(mark) {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  }

  function clearButKeepBadge() {
    document.querySelectorAll('mark.rd-hl').forEach(mark => unwrapMark(mark));
  }

  function clearHighlights() {
    clearButKeepBadge();
    refreshBadge();
  }

  function wrapRange(map, from, to, h) {
    const c = COLORS[h.color] || COLORS.yellow;
    let i = from;
    while (i < to) {
      const cell = map[i];
      if (!cell || !cell.node) break;
      const { node, offset } = cell;
      let j = i + 1;
      while (j < to && map[j] && map[j].node === node) j++;
      const endOffset = map[j - 1].offset + 1;
      if (node.isConnected && node.parentNode && !node.parentElement.closest('mark.rd-hl') && offset <= node.data.length) {
        // measure BEFORE splitText truncates node.data
        const keep = Math.max(0, Math.min(endOffset, node.data.length) - offset);
        const target = node.splitText(offset);
        target.splitText(keep);
        if (!target.data.length) { i = j; continue; }
        const mark = document.createElement('mark');
        mark.className = 'rd-hl';
        // inline !important beats site stylesheets that reset <mark>
        mark.style.setProperty('background-color', c.bg, 'important');
        mark.style.setProperty('border-bottom', '1px solid ' + c.border, 'important');
        mark.style.setProperty('color', 'inherit', 'important');
        mark.style.setProperty('padding', '0', 'important');
        mark.dataset.rdColor = COLORS[h.color] ? h.color : 'yellow';
        if (h.note) mark.title = h.note;
        if (h.id) mark.dataset.rdId = h.id;
        if (h.b) mark.dataset.rdB = h.b;
        if (h.lid) mark.dataset.rdLid = h.lid;
        target.parentNode.insertBefore(mark, target);
        mark.appendChild(target);
      }
      i = j;
    }
  }

  function overlayHighlights(highlights) {
    const { text, map } = buildTextMap(document.body);
    const used = [];
    const jobs = [];
    let missed = 0;
    for (const h of highlights) {
      const needle = normText(h.text);
      if (!needle) { missed++; continue; }
      let idx = -1, from = 0, sawExact = false;
      for (;;) {
        idx = text.indexOf(needle, from);
        if (idx === -1) break;
        sawExact = true;
        const covered = used.some(([a, b]) => idx < b && idx + needle.length > a);
        if (!covered) break;
        from = idx + 1;
      }
      let range = null;
      if (idx !== -1) range = { from: idx, to: idx + needle.length };
      else if (!sawExact) range = findNeedle(text, needle); // fuzzy only when nothing exact exists
      if (!range) { missed++; continue; }
      used.push([range.from, range.to]);
      jobs.push({ from: range.from, to: range.to, h });
    }
    // Wrap from the end of the page backwards: each splitText then happens
    // after every remaining range, so earlier map offsets stay valid.
    jobs.sort((a, b) => b.from - a.from);
    let placed = 0;
    for (const job of jobs) {
      try { wrapRange(map, job.from, job.to, job.h); placed++; }
      catch (e) { missed++; }
    }
    return { placed, missed };
  }

  // ---- Readeck-side creation helpers -----------------------------------------
  function relXpath(root, el) {
    const parts = [];
    let cur = el;
    while (cur && cur !== root && cur.parentElement) {
      const tag = cur.tagName.toLowerCase();
      let idx = 1;
      for (let s = cur.previousElementSibling; s; s = s.previousElementSibling) {
        if (s.tagName === cur.tagName) idx++;
      }
      parts.unshift(tag + '[' + idx + ']');
      cur = cur.parentElement;
    }
    return parts.join('/');
  }

  function textOffsetWithin(el, node, offset) {
    const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let len = 0, n;
    while ((n = walker.nextNode())) {
      if (n === node) return len + offset;
      len += n.data.length;
    }
    return len;
  }

  async function createReadeckHighlight(bookmarkId, needle, color, note) {
    if (!needle) throw new Error(t('err.emptySync'));
    const html = await apiGetHtml('/api/bookmarks/' + bookmarkId + '/article');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const root = doc.body;
    if (!root) throw new Error(t('err.emptyArticle'));
    const { text, map } = buildTextMap(root);
    const hit = findNeedle(text, needle);
    if (!hit) throw new Error(t('err.textNotFound'));
    const start = map[hit.from];
    const end = map[hit.to - 1];
    if (!start || !end) throw new Error(t('err.textMapShort'));
    const startEl = start.node.parentElement;
    const endEl = end.node.parentElement;
    const body = {
      start_selector: relXpath(root, startEl),
      start_offset: textOffsetWithin(startEl, start.node, start.offset),
      end_selector: relXpath(root, endEl),
      end_offset: textOffsetWithin(endEl, end.node, end.offset) + 1,
      color: color || 'yellow',
      note: note || '',
    };
    return await apiPost('/api/bookmarks/' + bookmarkId + '/annotations', body);
  }

  function cleanedPageHtml() {
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('#rd-hl-panel, #rd-hl-pop').forEach(el => el.remove());
    clone.querySelectorAll('mark.rd-hl').forEach(mark => {
      const parent = mark.parentNode;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
    });
    const html = clone.outerHTML;
    return html.length <= HTML_MAX_LEN ? html : null;
  }

  async function findBookmarkByUrlKeys(keys) {
    const page = await apiGet('/api/bookmarks?limit=100&offset=0');
    if (Array.isArray(page)) {
      for (const b of page) {
        if (b.url && b.id && keys.has(normalizeUrl(b.url))) return { id: b.id, title: b.title || '' };
      }
    }
    return null;
  }

  // Save a page (op carries url/title/html captured at highlight time).
  async function savePageToReadeck(op) {
    const wanted = new Set([op.key, normalizeUrl(op.url)]);
    const existing = await findBookmarkByUrlKeys(wanted);
    if (existing) return existing;
    const body = { url: op.url, title: op.title || undefined };
    let html = op.html || null;
    if (!html && normalizeUrl(location.href) === op.key) html = cleanedPageHtml();
    if (html && html.length <= HTML_MAX_LEN) body.html = html;
    // Readeck answers 202 with the ID in the Bookmark-Id header, not the body.
    const resp = await apiRequestRaw('POST', '/api/bookmarks', body);
    let id = resp.headers['bookmark-id'];
    if (!id && resp.headers['location']) {
      const m = resp.headers['location'].match(/\/bookmarks\/([^/?#]+)/);
      if (m) id = m[1];
    }
    if (!id && resp.json && resp.json.id) id = resp.json.id;
    if (!id) {
      throw new Error(t('err.noBookmarkId', resp.status,
        Object.keys(resp.headers).join(', '),
        String(resp.text || '').slice(0, 120)));
    }
    // wait until Readeck has processed the article
    for (let i = 0; i < 25; i++) {
      await sleep(1500);
      const info = await apiGet('/api/bookmarks/' + id);
      const state = info && typeof info.state === 'number' ? info.state : (info && info.loaded ? 0 : 2);
      if (state === 0) return { id, title: (info && info.title) || op.title || '' };
      if (state === 1) throw new Error(t('err.extractFailed'));
    }
    throw new Error(t('err.tooSlow'));
  }

  // ---- Queue processor ---------------------------------------------------------
  let processing = false;

  function findReplicaEntry(lid) {
    for (const k of Object.keys(replica)) {
      const e = replica[k].find(x => x.lid === lid);
      if (e) return { key: k, entry: e };
    }
    return null;
  }

  async function processCreate(op) {
    let bid = op.bookmarkId;
    if (!bid && cachedBmarks && cachedBmarks[op.key]) bid = cachedBmarks[op.key].id;
    if (!bid) {
      setStatus(t('create.savingPage'), false);
      const saved = await savePageToReadeck(op);
      bid = saved.id;
      cachedBmarks[op.key] = { id: bid, title: saved.title };
      await saveCaches();
    }
    op.bookmarkId = bid;
    const found = findReplicaEntry(op.lid);
    if (!found) return; // entry was deleted locally meanwhile
    if (!found.entry.text) {
      // corrupted empty entry (selection was not captured at create time): drop it cleanly
      replica[found.key] = replica[found.key].filter(x => x.lid !== op.lid);
      if (!replica[found.key].length) delete replica[found.key];
      await saveLocal();
      setStatus(t('create.emptyDropped'), false);
      return;
    }
    setStatus(t('create.creating'), false);
    const info = await createReadeckHighlight(bid, found.entry.text, found.entry.color, found.entry.note);
    found.entry.state = 'synced';
    found.entry.bookmarkId = bid;
    found.entry.annId = info && info.id;
    // let the server cache know too, so overlays carry the ids
    (cachedIndex[found.key] = cachedIndex[found.key] || []);
    if (info && info.id && !cachedIndex[found.key].some(h => h.id === info.id)) {
      cachedIndex[found.key].push({ id: info.id, b: bid, text: found.entry.text, color: found.entry.color, note: found.entry.note || '' });
      await saveCaches();
    }
    // upgrade any on-page mark with the server ids
    if (info && info.id) {
      document.querySelectorAll('mark.rd-hl[data-rd-lid="' + op.lid + '"]').forEach(m => {
        m.dataset.rdId = info.id;
        m.dataset.rdB = bid;
      });
    }
    setStatus(t('create.synced'), false);
  }

  async function processDelete(op) {
    await apiDelete('/api/bookmarks/' + op.bookmarkId + '/annotations/' + op.annId);
    if (cachedIndex) {
      for (const k of Object.keys(cachedIndex)) {
        cachedIndex[k] = cachedIndex[k].filter(h => h.id !== op.annId);
      }
      await saveCaches();
    }
    setStatus(t('delete.done'), false);
  }

  async function processUpdate(op) {
    await apiPatch('/api/bookmarks/' + op.bookmarkId + '/annotations/' + op.annId, { color: op.color, note: op.note || '' });
    setStatus(t('update.synced'), false);
  }

  async function processQueue() {
    if (processing) return;
    processing = true;
    try {
      if (!queue.length) return;
      // cheap connectivity probe: offline should not burn op retries
      try { await apiGet('/api/info'); }
      catch (e) { setStatus(t('queue.unreachable', queue.length), false); return; }
      await loadLocal(); // merge across tabs
      for (const op of [...queue]) {
        try {
          if (op.op === 'create') await processCreate(op);
          else if (op.op === 'update') await processUpdate(op);
          else await processDelete(op);
          queue = queue.filter(q => q !== op);
          await saveLocal();
        } catch (e) {
          op.tries = (op.tries || 0) + 1;
          op.lastError = e.message || String(e);
          if (op.tries >= MAX_TRIES) {
            queue = queue.filter(q => q !== op);
            if (op.op === 'create') {
              const found = findReplicaEntry(op.lid);
              if (found) found.entry.state = 'failed';
            }
            setStatus(t('queue.failedFinal', op.lastError), true);
          } else {
            setStatus(t('queue.failedRetry', op.lastError), false);
          }
          await saveLocal();
          break; // likely a shared cause; retry remaining ops next round
        }
      }
      refreshBadge();
    } finally {
      processing = false;
    }
  }

  // ---- UI ------------------------------------------------------------------
  function ensurePanel() {
    let el = document.getElementById('rd-hl-panel');
    if (el) return el;
    const host = document.body || document.documentElement;
    if (!host) return null;
    el = document.createElement('div');
    el.id = 'rd-hl-panel';
    el.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:2147483647;display:flex;flex-direction:column;align-items:flex-end;gap:6px;font-family:system-ui,sans-serif;';
    el.innerHTML =
      '<div id="rd-hl-status" style="display:none;background:#222;color:#fff;padding:6px 10px;border-radius:8px;font-size:12px;max-width:300px;box-shadow:0 2px 8px rgba(0,0,0,.3)"></div>' +
      '<button id="rd-hl-btn" title="Readeck highlights" style="width:40px;height:40px;border-radius:50%;border:none;background:#4a4a4a;color:#fff;font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.35)">R</button>';
    host.appendChild(el);
    el.querySelector('#rd-hl-btn').addEventListener('click', async (ev) => {
      if (ev.shiftKey) { if (!HL_ON) await setHlMode(true); run(true); return; }
      toggleHlMode();
    });
    el.querySelector('#rd-hl-btn').title = badgeTitle();
    return el;
  }

  function setStatus(msg, sticky) {
    const panel = ensurePanel();
    if (!panel) return;
    const s = panel.querySelector('#rd-hl-status');
    s.textContent = msg;
    s.style.display = msg ? 'block' : 'none';
    if (msg && !sticky) setTimeout(() => { if (s.textContent === msg) s.style.display = 'none'; }, 6000);
  }

  function setBadge(txt, bg) {
    const panel = ensurePanel();
    if (!panel) return;
    const b = panel.querySelector('#rd-hl-btn');
    b.textContent = txt;
    if (bg) b.style.background = bg;
  }

  function refreshBadge() {
    const failed = Object.values(replica || {}).flat().filter(e => e.state === 'failed').length;
    const left = document.querySelectorAll('mark.rd-hl').length;
    const { bm } = pageBookmark();
    if (failed > 0) setBadge('!', '#b71c1c');
    else if (queue && queue.length > 0) setBadge('\u21e1' + queue.length, '#e65100');
    else if (left) setBadge(String(left), '#2e7d32');
    else if (bm) setBadge('+', '#4a90d9'); // bookmarked, no highlights yet
    else setBadge('R', '#4a4a4a');
    const btn = document.querySelector('#rd-hl-btn');
    if (btn) {
      btn.style.opacity = HL_ON ? '1' : '0.55';
      // "No highlights on this page" is a normal state, not an error, so it
      // never pops up; it is only noted in the button tooltip.
      let tip = badgeTitle();
      if (!left && !pageEntries().length) {
        tip += ' \u00b7 ' + (bm ? t('overlay.hasBmNoHl') : t('overlay.noHl', candidateUrls()[0]));
      }
      btn.title = tip;
    }
  }

  let popShownAt = 0;

  function hidePop() {
    const p = document.getElementById('rd-hl-pop');
    if (p) p.remove();
  }

  // ---- Readeck-native annotator popup -----------------------------------------
  // A visual clone of Readeck's own highlight menu (markup in
  // internal/bookmarks/routes/x-components.templ, styles in web/ui/styles/annotations.scss,
  // theme colors from its compiled stylesheet): same layout, same five colors in the
  // same order, same check and trash icons, same Save button, same arrow card.
  const RD_FG = '#2b2521';            // gray-900 (app text, checked border + check)
  const RD_CARD = '#f6f4f2';          // gray-100 (card + arrow)
  const RD_PRIMARY = '#0b8eac';       // blue-600 (Save)
  const RD_PRIMARY_HOVER = '#096f86'; // blue-700
  const RD_DANGER = '#dd3f3f';        // red-600
  const RD_DANGER_HOVER = '#852626';  // red-800
  const RD_CHECK = "url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path d=\"M20.285 2l-11.285 11.567-5.286-5.011-3.714 3.716 9 8.728 15-15.285z\"/></svg>')";
  const RD_TRASH_SVG = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M5 20a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8h2V6h-4V4a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v2H3v2h2zM9 4h6v2H9zM8 8h9v12H7V8z"/>' +
    '<path d="M9 10h2v8H9zm4 0h2v8h-2z"/></svg>';

  function showAnnotPop(rect, opts) {
    // opts: {color, note, onSave(color, note), onDelete?}
    hidePop();
    const p = document.createElement('div');
    p.id = 'rd-hl-pop';
    p.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;width:480px;max-width:calc(100vw - 8px);' +
      'display:flex;flex-direction:column;margin:0;padding:0;background:transparent;user-select:none;visibility:hidden;' +
      'filter:drop-shadow(0 0 1px #706156) drop-shadow(0 12px 8px rgba(112,97,86,0.1)) drop-shadow(0 4px 5px rgba(112,97,86,0.8));' +
      'font-family:\'Public Sans Variable\',system-ui,sans-serif;font-size:16px;line-height:1.5;color:' + RD_FG + ';';

    // arrow starts borderless (0 height) so it does not skew the measurement
    const arrow = document.createElement('div');
    arrow.style.cssText = 'height:0;width:0;padding:0;border-right:8px solid transparent;border-left:8px solid transparent;';

    const content = document.createElement('div');
    content.style.cssText = 'background-color:' + RD_CARD + ';border-radius:8px;display:flex;flex-direction:column;gap:8px;padding:8px;';

    // "Highlight" + the five color circles
    const colorRow = document.createElement('div');
    colorRow.style.cssText = 'display:flex;align-items:center;gap:8px;';
    colorRow.appendChild(document.createTextNode(t('ui.highlight')));
    let curColor = MENU_COLORS.indexOf(opts.color) !== -1 ? opts.color : 'yellow';
    const colorBtns = [];
    for (const name of MENU_COLORS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.rdColor = name;
      b.setAttribute('aria-label', name);
      b.style.cssText = 'appearance:none;position:relative;padding:0;margin:0;border-radius:50%;width:24px;height:24px;flex:0 0 auto;cursor:pointer;' +
        'border:2px solid rgba(43,37,33,0.2);background-color:' + COLORS[name].box + ';';
      const ck = document.createElement('span');
      ck.style.cssText = 'display:none;position:absolute;top:-2px;left:-2px;width:24px;height:24px;border-radius:50%;pointer-events:none;' +
        'background-color:' + RD_FG + ';' +
        '-webkit-mask-image:' + RD_CHECK + ';mask-image:' + RD_CHECK + ';' +
        '-webkit-mask-size:50% 50%;mask-size:50% 50%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;';
      b.appendChild(ck);
      b.addEventListener('click', () => { curColor = name; paintColorChecks(); });
      colorRow.appendChild(b);
      colorBtns.push(b);
    }
    function paintColorChecks() {
      for (const b of colorBtns) {
        const on = b.dataset.rdColor === curColor;
        b.style.borderColor = on ? RD_FG : 'rgba(43,37,33,0.2)';
        b.firstChild.style.display = on ? 'block' : 'none';
      }
    }
    content.appendChild(colorRow);

    // "Note:" + textarea
    const noteWrap = document.createElement('div');
    noteWrap.style.cssText = 'display:flex;flex-direction:column;';
    const noteLabel = document.createElement('label');
    noteLabel.textContent = t('ui.note');
    const noteArea = document.createElement('textarea');
    noteArea.rows = 3;
    noteArea.maxLength = 1024;
    noteArea.value = opts.note || '';
    noteArea.style.cssText = 'width:100%;box-sizing:border-box;max-width:100%;background-color:#fff;color:#000;' +
      'border:1px solid #b4a69b;border-radius:4px;padding:8px;font-size:16px;line-height:1.25;resize:vertical;overscroll-behavior-y:contain;' +
      'font-family:inherit;user-select:text;';
    noteArea.addEventListener('focus', () => {
      noteArea.style.outline = 'none';
      noteArea.style.borderColor = RD_PRIMARY;
      noteArea.style.boxShadow = '0 0 3px 0 ' + RD_PRIMARY;
    });
    noteArea.addEventListener('blur', () => {
      noteArea.style.borderColor = '#b4a69b';
      noteArea.style.boxShadow = 'none';
    });
    noteWrap.appendChild(noteLabel);
    noteWrap.appendChild(noteArea);
    content.appendChild(noteWrap);

    // Save (+ trash in edit mode, pushed right)
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;';
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.textContent = t('ui.save');
    saveBtn.style.cssText = 'display:inline-block;cursor:pointer;white-space:nowrap;line-height:1.25;border:none;border-radius:4px;' +
      'padding:9px 8px;color:#fff;background-color:' + RD_PRIMARY + ';font-size:16px;font-family:inherit;';
    saveBtn.addEventListener('mouseenter', () => { saveBtn.style.backgroundColor = RD_PRIMARY_HOVER; });
    saveBtn.addEventListener('mouseleave', () => { saveBtn.style.backgroundColor = RD_PRIMARY; });
    saveBtn.addEventListener('click', () => opts.onSave(curColor, noteArea.value.replace(/\s+$/,'').replace(/^\s+/,'')));
    btnRow.appendChild(saveBtn);
    if (opts.onDelete) {
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.title = t('ui.delete');
      delBtn.setAttribute('aria-label', t('ui.delete'));
      delBtn.innerHTML = RD_TRASH_SVG;
      delBtn.style.cssText = 'margin-left:auto;display:inline-flex;align-items:center;cursor:pointer;line-height:1.25;border-radius:4px;' +
        'padding:8px;color:' + RD_DANGER + ';background-color:transparent;border:1px solid ' + RD_DANGER + ';font-family:inherit;';
      delBtn.addEventListener('mouseenter', () => { delBtn.style.backgroundColor = RD_DANGER_HOVER; delBtn.style.color = '#fff'; delBtn.style.borderColor = RD_DANGER_HOVER; });
      delBtn.addEventListener('mouseleave', () => { delBtn.style.backgroundColor = 'transparent'; delBtn.style.color = RD_DANGER; delBtn.style.borderColor = RD_DANGER; });
      delBtn.addEventListener('click', () => opts.onDelete());
      btnRow.appendChild(delBtn);
    }
    content.appendChild(btnRow);

    p.appendChild(arrow);
    p.appendChild(content);
    (document.body || document.documentElement).appendChild(p);
    popShownAt = Date.now();
    paintColorChecks();

    // Readeck positioning: above the selection by default, below it when there is
    // no room above; the little arrow tracks the selection's center.
    const w = p.offsetWidth;
    const h = p.offsetHeight + 8; // + the arrow once it gets its colored border
    const below = rect.top - 20 < h;
    if (below) arrow.style.borderBottom = '8px solid ' + RD_CARD;
    else arrow.style.borderTop = '8px solid ' + RD_CARD;
    const x = Math.max(0, Math.min(rect.left + rect.width / 2 - w / 2, window.innerWidth - w - 1));
    let y = below ? rect.bottom + 4 : rect.top - h - 4;
    y = Math.max(0, Math.min(y, window.innerHeight - h - 4));
    const arrowX = Math.max(8, Math.min(rect.left + rect.width / 2 - x - 8, w - 24));
    arrow.style.marginLeft = arrowX + 'px';
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    p.style.visibility = '';

    // keep the page selection alive while using the menu (like Readeck):
    // don't let clicks on colors/buttons collapse it; the textarea may take focus
    p.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      if (!(e.target instanceof HTMLTextAreaElement)) e.preventDefault();
    });
    p.addEventListener('mouseup', (e) => e.stopPropagation());
    p.addEventListener('click', (e) => e.stopPropagation());
    return p;
  }

  // like Readeck: Escape closes the menu and drops the selection
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && document.getElementById('rd-hl-pop')) {
      hidePop();
      const s = window.getSelection();
      if (s) s.removeAllRanges();
    }
  });

  // ---- Highlight creation: local first, replicate async ------------------------
  function selectionValid(sel) {
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
    const txt = sel.toString().replace(/\s+/g, ' ').trim();
    if (txt.length < 2) return null;
    const anchorEl = sel.anchorNode && sel.anchorNode.parentElement;
    if (anchorEl && (anchorEl.closest('#rd-hl-panel') || anchorEl.closest('#rd-hl-pop'))) return null;
    if (anchorEl && anchorEl.closest('input, textarea')) return null;
    return txt;
  }

  function showCreatePop(sel) {
    if (!HL_ON) return;
    // capture the text NOW: focusing the Note field collapses the page
    // selection, and reading it at Save time would yield an empty string
    const needle = normText(sel.toString());
    if (!needle || needle.length < 2) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    showAnnotPop(rect, {
      color: 'yellow',
      note: '',
      onSave: (color, note) => createFromSelection(needle, color, note),
    });
  }

  async function createFromSelection(needle, color, note) {
    color = color || 'yellow';
    note = note || '';
    hidePop();
    if (!needle || needle.length < 2) {
      setStatus(t('create.noText'), true);
      return;
    }
    if (!API_TOKEN) {
      setStatus(t('setup.needed'), true);
      return;
    }
    const key = candidateUrls()[0];
    const lid = 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const entry = { lid, text: needle, color, note, state: 'pending', created: Date.now() };
    (replica[key] = replica[key] || []).push(entry);
    const { bm } = pageBookmark();
    const op = { op: 'create', lid, key, url: location.href, title: document.title || '', bookmarkId: bm ? bm.id : null, tries: 0 };
    if (!bm) {
      const html = cleanedPageHtml();
      if (html) op.html = html;
    }
    queue.push(op);
    await saveLocal();
    window.getSelection().removeAllRanges();
    // paint immediately from the local replica
    overlayHighlights([{ text: needle, color, note, lid }]);
    refreshBadge();
    setStatus(t('create.marked'), false);
    processQueue();
  }

  // Readeck behavior: the menu only appears once the selection is FINISHED.
  // While the mouse is down (dragging out a longer highlight) or Shift is held
  // (extending with the keyboard) the menu stays retracted so it never covers
  // the text being selected.
  let selecting = false;
  let shiftHeld = false;
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Shift') shiftHeld = true; });
  document.addEventListener('keyup', (ev) => {
    if (ev.key !== 'Shift') return;
    shiftHeld = false;
    const sel = window.getSelection();
    if (!selecting && selectionValid(sel) && !document.getElementById('rd-hl-pop')) showCreatePop(sel);
  });

  document.addEventListener('mouseup', (ev) => {
    if (ev.target && ev.target.closest && (ev.target.closest('#rd-hl-panel') || ev.target.closest('#rd-hl-pop'))) return;
    selecting = false;
    setTimeout(() => {
      const sel = window.getSelection();
      if (selectionValid(sel)) showCreatePop(sel);
    }, 10);
  });

  let selTimer = null;
  document.addEventListener('selectionchange', () => {
    clearTimeout(selTimer);
    if (selecting || shiftHeld) {
      // selection still being built: keep the menu out of the way
      if (document.getElementById('rd-hl-pop')) hidePop();
      return;
    }
    selTimer = setTimeout(() => {
      if (selecting || shiftHeld) return;
      const sel = window.getSelection();
      if (selectionValid(sel) && !document.getElementById('rd-hl-pop')) showCreatePop(sel);
    }, 500);
  });

  document.addEventListener('mousedown', (ev) => {
    if (ev.target && ev.target.closest && ev.target.closest('#rd-hl-pop')) return;
    selecting = true;
    hidePop();
  });

  // ---- Highlight deletion: local first, replicate async ------------------------
  document.addEventListener('click', (ev) => {
    if (Date.now() - popShownAt < 350) return; // the click ending the selection
    if (ev.target && ev.target.closest && ev.target.closest('#rd-hl-pop')) return;
    const mark = ev.target && ev.target.closest && ev.target.closest('mark.rd-hl');
    if (mark && HL_ON) showMarkPop(mark);
  });

  // Clicking an existing highlight opens the same menu in edit mode:
  // its color pre-checked, its note pre-filled, Save updates, the trash deletes.
  function showMarkPop(mark) {
    const rect = mark.getBoundingClientRect();
    showAnnotPop(rect, {
      color: mark.dataset.rdColor || 'yellow',
      note: mark.title || '',
      onSave: (color, note) => updateMark(mark, color, note),
      onDelete: () => deleteMark(mark),
    });
  }

  async function updateMark(mark, color, note) {
    hidePop();
    const lid = mark.dataset.rdLid;
    const annId = mark.dataset.rdId;
    const bid = mark.dataset.rdB;
    let text = null;
    if (lid) {
      const found = findReplicaEntry(lid);
      if (found) {
        found.entry.color = color;
        found.entry.note = note;
        text = found.entry.text;
        // a pending create op reads color/note from this entry when it runs
      }
    }
    if (!text) {
      const sel = lid ? 'mark.rd-hl[data-rd-lid="' + lid + '"]' : (annId ? 'mark.rd-hl[data-rd-id="' + annId + '"]' : null);
      if (sel) text = normText([...document.querySelectorAll(sel)].map(m => m.textContent).join(' '));
    }
    if (annId && bid) {
      // one queued update per annotation; the latest color/note wins
      queue = queue.filter(q => !(q.op === 'update' && q.annId === annId));
      queue.push({ op: 'update', annId, bookmarkId: bid, color, note, tries: 0 });
      if (cachedIndex) {
        for (const k of Object.keys(cachedIndex)) {
          for (const h2 of cachedIndex[k]) {
            if (h2.id === annId) { h2.color = color; h2.note = note; }
          }
        }
        await saveCaches();
      }
    }
    await saveLocal();
    // repaint with the new color/note
    const matches = [...document.querySelectorAll('mark.rd-hl')].filter(m =>
      (lid && m.dataset.rdLid === lid) || (annId && m.dataset.rdId === annId));
    matches.forEach(m => unwrapMark(m));
    if (text) overlayHighlights([{ text, color, note, lid, id: annId, b: bid }]);
    refreshBadge();
    if (annId && bid) {
      setStatus(t('update.marked'), false);
      processQueue();
    } else {
      setStatus(t('update.doneLocal'), false);
    }
  }

  async function deleteMark(mark) {
    hidePop();
    const lid = mark.dataset.rdLid;
    const annId = mark.dataset.rdId;
    const bid = mark.dataset.rdB;
    // one highlight can span several <mark> elements; unwrap all of them
    [...document.querySelectorAll('mark.rd-hl')].filter(m =>
      (lid && m.dataset.rdLid === lid) || (annId && m.dataset.rdId === annId) || (!lid && !annId && m === mark)
    ).forEach(m => unwrapMark(m));
    if (lid) {
      const found = findReplicaEntry(lid);
      if (found) {
        if (found.entry.annId) {
          found.entry.state = 'deleting';
          queue.push({ op: 'delete', annId: found.entry.annId, bookmarkId: found.entry.bookmarkId, tries: 0 });
        } else {
          // never reached the server: drop it and its pending create op
          replica[found.key] = replica[found.key].filter(x => x.lid !== lid);
          if (!replica[found.key].length) delete replica[found.key];
          queue = queue.filter(q => !(q.op === 'create' && q.lid === lid));
        }
        await saveLocal();
      }
    } else if (annId && bid) {
      queue.push({ op: 'delete', annId, bookmarkId: bid, tries: 0 });
      if (cachedIndex) {
        for (const k of Object.keys(cachedIndex)) {
          cachedIndex[k] = cachedIndex[k].filter(h => h.id !== annId);
        }
        await saveCaches();
      }
      await saveLocal();
    } else {
      setStatus(t('delete.localOnly'), false);
      refreshBadge();
      return;
    }
    refreshBadge();
    setStatus(t('delete.removed'), false);
    processQueue();
  }

  // ---- Main flow ---------------------------------------------------------------
  let busy = false;

  function applyOverlay(verbose) {
    const entries = pageEntries();
    clearButKeepBadge();
    if (!entries.length) {
      // A page without highlights is a normal state, not an error: no status
      // popup. refreshBadge() puts the neutral note in the button tooltip.
      refreshBadge();
      return;
    }
    const { placed, missed } = overlayHighlights(entries);
    refreshBadge();
    if (verbose || missed) {
      setStatus(t('overlay.placed', placed, entries.length, missed), false);
    }
  }

  async function run(forceSync) {
    if (busy) return;
    if (!API_TOKEN) {
      setStatus(t('setup.needed'), true);
      return;
    }
    busy = true;
    try {
      await trySync(forceSync);
      applyOverlay(true);
      processQueue();
    } catch (e) {
      setBadge('!', '#b71c1c');
      setStatus(e.message || String(e), true);
    } finally {
      busy = false;
    }
  }

  async function auto() {
    // Local-first startup: paint from replica + stale cache instantly,
    // then refresh from the server in the background.
    if (!API_TOKEN) return;
    await loadLocal();
    await loadCaches();
    applyOverlay(false);
    refreshBadge();
    try {
      await trySync(false);
      applyOverlay(false);
      refreshBadge();
    } catch (e) {
      setBadge('!', '#b71c1c');
      setStatus(e.message || String(e), true);
    }
    processQueue();
  }

  async function testConnection() {
    if (!API_TOKEN) {
      setStatus(t('setup.needed'), true);
      return;
    }
    setStatus(t('test.testing', ORIGIN), true);
    try {
      const info = await apiGet('/api/info');
      setStatus(t('test.ok', info.version || ''), false);
      refreshBadge();
    } catch (e) {
      setBadge('!', '#b71c1c');
      setStatus(e.message || String(e), true);
    }
  }

  async function retryFailed() {
    // drop corrupted empty entries so they never requeue
    for (const k of Object.keys(replica)) {
      replica[k] = replica[k].filter(e => !!e.text);
      if (!replica[k].length) delete replica[k];
    }
    for (const k of Object.keys(replica)) {
      for (const e of replica[k]) {
        if (e.state === 'failed') e.state = 'pending';
      }
    }
    for (const op of queue) op.tries = 0;
    // requeue failed creates that lost their op
    for (const k of Object.keys(replica)) {
      for (const e of replica[k]) {
        if (e.state === 'pending' && !queue.some(q => q.op === 'create' && q.lid === e.lid)) {
          queue.push({ op: 'create', lid: e.lid, key: k, url: k, title: '', bookmarkId: e.bookmarkId || null, tries: 0 });
        }
      }
    }
    await saveLocal();
    setStatus(t('retry.retrying'), false);
    processQueue();
  }

  function diagnostics() {
    const mgr = (typeof GM_xmlhttpRequest === 'function') ? 'GM_*' :
      (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? 'GM.*' : t('diag.noManager');
    const tokenOk = !!API_TOKEN;
    const idxN = cachedIndex ? Object.values(cachedIndex).reduce((s, a) => s + a.length, 0) : 0;
    const bmN = cachedBmarks ? Object.keys(cachedBmarks).length : 0;
    const localAll = Object.values(replica || {}).flat();
    const pend = queue.length;
    const failed = localAll.filter(e => e.state === 'failed').length;
    const { bm } = pageBookmark();
    setStatus(t('diag.line', {
      ver: SCRIPT_VERSION,
      mgr,
      origin: ORIGIN || t('diag.missing'),
      token: tokenOk ? t('diag.present') : t('diag.missing'),
      bmN, idxN,
      localN: localAll.length, pend, failed,
      page: bm ? 'Readeck #' + bm.id : t('diag.notSaved'),
      key: candidateUrls()[0],
    }), true);
  }

  gmMenu(t('menu.setup'), setupConnection);
  gmMenu(t('menu.mode'), toggleHlMode);
  gmMenu(t('menu.lang'), setupLanguage);
  gmMenu(t('menu.fullSync'), () => run(true));
  gmMenu(t('menu.clear'), clearHighlights);
  gmMenu(t('menu.test'), testConnection);
  gmMenu(t('menu.retry'), retryFailed);
  gmMenu(t('menu.diag'), diagnostics);
  gmMenu(t('menu.version', SCRIPT_VERSION), () => setStatus(t('version.status', SCRIPT_VERSION), false));

  setInterval(() => { if (queue.length) processQueue(); }, RETRY_MS);
  window.addEventListener('online', () => processQueue());

  async function init() {
    await loadConfig();
    HL_ON = !!(await gmGet(hlSiteKey(), false));
    ensurePanel();
    auto();
  }

  if (document.body) init();
  else window.addEventListener('DOMContentLoaded', init, { once: true });
})();


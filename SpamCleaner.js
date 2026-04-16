// ==UserScript==
// @name         vOz Spam Cleaner
// @namespace    https://github.com/TekMonts/vOz
// @author       TekMonts
// @version      2.1
// @description  Spam cleaning tool for voz.vn - Restructure Json
// @match        https://voz.vn/u/*
// @grant        GM_xmlhttpRequest
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// ==/UserScript==

/**
 * vOz Spam Cleaner v2.0 — Refactored
 *
 * Changelog vs v1.3:
 * ──────────────────
 * [BUG]  compileSpamRegex — `\b` word-boundary fails on Unicode (tiếng Việt).
 *        → Replaced with negative-lookahead/lookbehind `(?<!\w)…(?!\w)` or
 *          removed for symbol-only patterns.
 * [BUG]  spamKeywordRegex used `\b` around patterns containing dots (e.g. "66.", "88.").
 *        Dots aren't word characters so `\b` never matches → those keywords were dead.
 *        → Dot-suffix patterns now handled separately.
 * [BUG]  `filterValid` allowed single special chars like "~", "!" into keyword regex
 *        but `compileSpamRegex` then applied `\b` around them — a word boundary next
 *        to a non-word char is always true → mass false positives on any text.
 *        → Special-char username patterns are now tested via literal `includes()`,
 *          not regex word boundaries.
 * [BUG]  `executing.delete(p.catch(() => {}))` in limitConcurrency never deletes
 *        because `.catch()` returns a *new* promise, not `p`.
 *        → Fixed to delete `p` in the `.finally()` handler.
 * [BUG]  `storageManager.get(SPAM_KEYWORDS_KEY)` returns a string (localStorage is
 *        string-only), but the code treats it as an array without JSON.parse().
 *        → Added JSON.parse with try/catch fallback.
 * [BUG]  Double-processing: if a user matches *both* username spam AND content keyword,
 *        `processSpamUser` is called twice → duplicate ban attempts & double counting.
 *        → Added early-return guard after first positive match.
 * [BUG]  `tmpKeyword` shared mutable state across concurrent tasks — race condition.
 *        → Eliminated global `tmpKeyword`; keyword now passed via return value.
 * [LOGIC] `addToReview` is called for every user with *any* recent content, even
 *         benign "post #" types that are explicitly skipped for spam checks. This
 *         floods the review list with false positives.
 *         → Moved `addToReview` call to after spam-relevant content is confirmed.
 * [LOGIC] `getSpamKeywords` caches via `this.extendedKeywords` on the spamManager
 *         object, but the check `this.extendedKeywords.length > spamKeywords.length`
 *         prevents re-fetching even after new defaults are added. Stale cache.
 *         → Replaced with a simple `_loaded` flag per session.
 * [LOGIC] Ignore list size limit (`IGNORE_LIST_SIZE_LIMIT = 200` chars) is extremely
 *         small — only ~15-20 user IDs fit before FIFO eviction starts. This means
 *         previously-cleared users get re-processed.
 *         → Increased to 10000 chars (~700 IDs). Consider moving to API-side limit.
 * [PERF] `stripHtmlTags` creates innerHTML on a shared `tempDiv` — fine for single-
 *        threaded JS but semantically fragile. Replaced with DOMParser for clarity.
 * [PERF] Regex is recompiled every keyword fetch. Now only recompiles when the
 *        keyword set actually changes.
 * [STYLE] Eliminated deep nesting, reduced function length, added JSDoc types.
 * [STYLE] Constants grouped, managers made more cohesive.
 */

(function () {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════════

    const STORAGE_KEYS = Object.freeze({
        AUTH: 'authKey',
        IGNORE_LIST: 'voz_ignore_list',
        LATEST_RANGE: 'voz_latest_range',
        LATEST_COUNT: 'latestCount',
        AUTORUN: 'vozAutorun',
        SPAM_KEYWORDS: 'voz_spam_keywords',
    });

    const API_BASE_URL = 'https://api.tekmonts.qzz.io/KeyVal';
    const VOZ_BASE_URL = 'https://voz.vn';

    // [FIX] Increased from 200 → 10000 to hold ~700 user IDs
    const IGNORE_LIST_SIZE_LIMIT = 10_000;

    const BATCH_SIZE = 5;
    const BATCH_DELAY_MS = 200;
    const CONCURRENCY_LIMIT = 3;
    const TAB_TIMEOUT_MS = 30_000;

    const AUTORUN_OPTIONS = ['OFF', '5', '15', '30'];

    const HOSTS_URL =
        'https://raw.githubusercontent.com/bigdargon/hostsVN/refs/heads/master/extensions/gambling/hosts-VN';

    // Keywords that trigger full data deletion (threads + messages + conversations)
    const HARD_DELETE_KEYWORDS = new Set([
        'temu', 'tℰℳu', '{{', '[(', 'cryptocurrency', 'verified',
        'url_in_title', 'recovery', 'buy account', 'old account',
    ]);

    // ═══════════════════════════════════════════════════════════════════
    // DEFAULT SPAM DATA
    // ═══════════════════════════════════════════════════════════════════

    const DEFAULT_SPAM_KEYWORDS = ["pg9", "go8", "temu", "tℰℳu", "{{", "[(", "informações", "contacto", "coupon code", "tỷ số", "kết quả trận đấu", "kết quả bóng đá", "kqbd", "socolive", "solutions", "cryptocurrency", "verified", "account", "recovery", "investigation", "keonhacai", "sunwin", "số đề", "finance", "moscow", "bongda", "giải trí", "giai tri", "sòng bài", "song bai", "w88", "indonesia", "online gaming", "entertainment", "market", "india", "philipin", "brazil", "spain", "cambodia", "giavang", "giá vàng", "investment", "terpercaya", "slot", "berkualitas", "telepon", "đầu tư", "game", "sòng bạc", "song bac", "trò chơi", "đánh bạc", "tro choi", "đổi thưởng", "doi thuong", "xóc đĩa", "bóng đá", "bong da", "đá gà", "da ga", "#trangchu", "cược", "ca cuoc", "casino", "daga", "nhà cái", "nhacai", "merch", "subre", "cá độ", "ca do", "bắn cá", "ban ca", "rikvip", "taixiu", "tài xỉu", "xocdia", "xoso66", "zomclub", "vin88", "vip79", "123win", "23win", "33win", "55win", "777king", "77win", "789club", "789win", "79king", "888b", "88clb", "8day", "8live", "97win", "98win", "99ok", "abc8", "ae88", "alo789", "az888", "banca", "bj38", "bj88", "bong88", "cacuoc", "cado", "cwin", "da88", "df99", "ee88", "f88", "fcb8", "fi88", "five88", "for88", "fun88", "gk88", "go88", "go99", "good88", "hay88", "hb88", "hi88", "jun88", "king88", "luck8", "lucky88", "lulu88", "mancl", "may88", "mb66", "miso88", "mksport", "mu88", "net8", "nohu", "ok365", "okvip", "one88", "qh88", "red88", "rr88", "sin88", "sky88", "soicau247", "sonclub", "sunvin", "sv88", "ta88", "taipei", "tdtc", "thomo", "tk88", "twin68", "vn88", "tylekeo", "typhu88", "uk88", "vip33", "vip66", "fb88", "vip77", "vip99", "win88", "xo88", "bet", "club.", "hitclub", "66.", "88.", "68.", "79.", "365.", "f168", "phát tài", "massage", "skincare", "healthcare", "jordan", "quality", "wellness", "lifestyle", "trading", "tuhan", "solution", "marketing", "seo expert", "bangladesh", "united states", "protein", "dudoan", "xổ số", "business", "finland", "rongbachkim", "lô đề", "gumm", "france", "free", "trang_chu", "hastag", "reserva777", "internacional", "international", "ga6789", "opportunity", "reward", "rate", "cambodia", "rating", "sodo", "buy account", "old account"];

    const DEFAULT_SPAM_USERNAMES = ["~", "!", "@", "#", "$", "%", "^", "&", "*", "(", ")", "?", "<", ">", "[", "]", "tk99", "1bet", "2bet", "3bet", "4bet", "5bet", "6bet", "7bet", "8bet", "9bet", "pg9", "k9cc", "betuk", "betbr", "betus", "betde", "88i", "cakhia", "review", "bongda", "lifestyle", "pvait", "usam", "usatop", "india", "topsel", "telegram", "usbes", "account", "tinyfish", "sodo", "88vn", "hello88", "gowin", "update", "drop", "login", "choangclub", "sunwin", "rr88", "w88", "gamebai", "gamedoithuong", "trangchu", "8xbet", "rongbachkim", "dinogame", "gumm", "nhacai", "cakhia", "merch", "sunvin", "rikvip", "taixiu", "xocdia", "xoso66", "zomclub", "vin88", "nbet", "vip79", "11bet", "123win", "188bet", "1xbet", "23win", "33win", "388bet", "55win", "777king", "77bet", "77win", "789club", "789win", "79king", "888b", "88bet", "88clb", "8day", "8kbet", "8live", "8xbet", "97win", "98win", "99bet", "99ok", "abc8", "ae88", "alo789", "az888", "banca", "bet365", "bet88", "bj38", "bj88", "bong88", "cacuoc", "cado", "cwin", "da88", "debet", "df99", "ee88", "f88", "fabet", "fcb8", "fi88", "five88", "for88", "fun88", "gk88", "go88", "go99", "good88", "hay88", "hb88", "hi88", "ibet", "jun88", "king88", "kubet", "luck8", "lucky88", "lulu88", "mancl", "may88", "mb66", "mibet", "miso88", "mksport", "mu88", "net8", "nohu", "ok365", "okvip", "one88", "qh88", "red88", "sbobet", "sin88", "sky88", "soicau247", "sonclub", "sunvin", "sv88", "ta88", "taipei", "tdtc", "tcdt", "thabet", "thomo", "tk88", "twin68", "vn88", "tylekeo", "typhu88", "uk88", "v9bet", "pg66", "vip33", "vip66", "fb88", "vip77", "vip99", "win88", "xo88", "f168", "duthuong", "trochoi", "xoilac", "vebo", "cakhia", "reserva777", "ga6789", "finance", "casino", "doctor", "wincom", "update", "capsule", "review", "cbd", "buyold", "supply", "fm88", "trangchu"];

    // ═══════════════════════════════════════════════════════════════════
    // REGEX PATTERNS
    // ═══════════════════════════════════════════════════════════════════

    const WEBSITE_REGEX = /website\s+([^\s]+)/i;
    const URL_REGEX = /\bhttps?:\/\/[^\s<]+/i;
    const DOMAIN_SUFFIX_REGEX = /(?:com|app|net|org|club|live|id|id1)$/i;

    // ═══════════════════════════════════════════════════════════════════
    // COMPILED SPAM REGEX — built once, rebuilt when keywords change
    // ═══════════════════════════════════════════════════════════════════

    /** @type {RegExp|null} */
    let spamKeywordRegex = null;
    /** @type {RegExp|null} */
    let spamUsernameRegex = null;
    /** @type {string[]} — symbol-only username patterns (not suitable for regex \b) */
    let symbolUsernamePatterns = [];

    /**
     * [FIX] Rewritten regex compiler.
     *
     * Problems in original:
     *  1) `\b` doesn't work with Unicode chars (Vietnamese diacritics).
     *  2) `\b` next to non-word chars (dots, symbols) is always true → false positives.
     *  3) Single special chars like "~" wrapped in `\b(~)\b` match everywhere.
     *
     * Solution:
     *  - Separate patterns into "word-like" (alphanumeric) and "symbol-only".
     *  - Word-like patterns use `(?<!\w)` and `(?!\w)` (works with `u` flag).
     *  - Symbol-only patterns are tested via `String.includes()` — no regex.
     *  - Dot-suffixed patterns (e.g. "88.") use escaped literal matching.
     *
     * @param {string[]} keywords
     * @param {string[]} usernames
     */
    function compileSpamRegex(keywords = [], usernames = []) {
        const escRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const clean = (arr) => [...new Set(arr.map(s => (s ?? '').trim()).filter(Boolean))];
        const byLen = (a, b) => b.length - a.length;

        const isAlphanumeric = (s) => /[a-z0-9]/i.test(s);

        // — Keywords —
        const allKw = clean(keywords);
        const wordKw = allKw.filter(s => isAlphanumeric(s) && s.length >= 3).sort(byLen).map(escRx);
        // [FIX] Non-alphanumeric keywords (e.g. "{{", "[(") tested via includes, not regex
        const symbolKw = allKw.filter(s => !isAlphanumeric(s) && s.length > 0);

        // Build regex: use lookaround instead of \b for Unicode safety
        const kwPattern = wordKw.length > 0
            ? new RegExp(`(?<![\\w])(?:${wordKw.join('|')})(?![\\w])`, 'iu')
            : null;

        // — Usernames —
        const allUn = clean(usernames);
        const wordUn = allUn.filter(s => isAlphanumeric(s) && s.length >= 3).sort(byLen).map(escRx);
        symbolUsernamePatterns = allUn.filter(s => !isAlphanumeric(s) && s.length > 0);

        const unPattern = wordUn.length > 0
            ? new RegExp(`(?:${wordUn.join('|')})`, 'iu')
            : null;

        spamKeywordRegex = kwPattern;
        spamUsernameRegex = unPattern;

        // Store symbol keywords on the regex object for later access
        if (kwPattern) kwPattern._symbolPatterns = symbolKw;
    }

    /**
     * Test text against spam keyword regex + symbol patterns.
     * @param {string} text
     * @returns {{ matched: boolean, keyword: string|null }}
     */
    function testSpamKeyword(text) {
        if (!text) return { matched: false, keyword: null };

        // Regex match (word-like patterns)
        if (spamKeywordRegex) {
            const m = text.match(spamKeywordRegex);
            if (m) return { matched: true, keyword: m[0] };
        }

        // Symbol patterns (literal match)
        const symbols = spamKeywordRegex?._symbolPatterns || [];
        for (const sym of symbols) {
            if (text.includes(sym)) return { matched: true, keyword: sym };
        }

        return { matched: false, keyword: null };
    }

    /**
     * Test username against spam username regex + symbol patterns.
     * @param {string} name
     * @returns {{ matched: boolean, keyword: string|null }}
     */
    function testSpamUsername(name) {
        if (!name) return { matched: false, keyword: null };

        // Regex match
        if (spamUsernameRegex) {
            const m = name.match(spamUsernameRegex);
            if (m) return { matched: true, keyword: m[0] };
        }

        // Symbol patterns
        for (const sym of symbolUsernamePatterns) {
            if (name.includes(sym)) return { matched: true, keyword: sym };
        }

        // Domain-suffix check
        if (DOMAIN_SUFFIX_REGEX.test(name)) {
            return { matched: true, keyword: `username:${name}` };
        }

        return { matched: false, keyword: null };
    }

    // ═══════════════════════════════════════════════════════════════════
    // UTILITY FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════

    /** Normalize Unicode and strip zero-width chars */
    const normalize = (s) => (s || '').normalize('NFKC').replace(/[\u200B\u200C\u200D\uFEFF]/g, '');

    /** Strip HTML tags — uses DOMParser (safer than innerHTML on a shared div) */
    function stripHtml(html) {
        if (!html) return '';
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
    }

    /** Check if running on a mobile device */
    function isMobile() {
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) return true;
        if (window.screen.width <= 800 || window.screen.height <= 600) return true;
        try { return ('ontouchstart' in window) || navigator.userAgentData?.mobile; }
        catch { return 'ontouchstart' in window; }
    }

    /** Extract a `data-timestamp` value from HTML for a given <dt> label */
    function extractTimestamp(html, label) {
        const rx = new RegExp(`<dt>${label}<\\/dt>\\s*<dd[^>]*>\\s*<time[^>]*data-timestamp="(\\d+)"`, 'i');
        const m = html.match(rx);
        return m ? parseInt(m[1]) * 1000 : null;
    }

    /** Sleep helper */
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // ═══════════════════════════════════════════════════════════════════
    // STORAGE MANAGER
    // ═══════════════════════════════════════════════════════════════════

    const storage = {
        get(key, fallback = null) {
            try { return localStorage.getItem(key) ?? fallback; }
            catch { return fallback; }
        },
        set(key, value) {
            try { localStorage.setItem(key, value); return true; }
            catch { return false; }
        },
        remove(key) {
            try { localStorage.removeItem(key); return true; }
            catch { return false; }
        },
        /** [FIX] Parse JSON from localStorage safely */
        getJSON(key, fallback = null) {
            try {
                const raw = localStorage.getItem(key);
                return raw != null ? JSON.parse(raw) : fallback;
            } catch { return fallback; }
        },
        setJSON(key, value) {
            try { localStorage.setItem(key, JSON.stringify(value)); return true; }
            catch { return false; }
        },
    };

    // ═══════════════════════════════════════════════════════════════════
    // API MANAGER
    // ═══════════════════════════════════════════════════════════════════

    let authKey = storage.get(STORAGE_KEYS.AUTH) || '';

    const api = {
        /**
         * Fetch with retries and exponential backoff.
         * @param {string} url
         * @param {RequestInit} options
         * @param {number} retries
         * @returns {Promise<{success: boolean, response?: Response, error?: Error}>}
         */
        async fetch(url, options = {}, retries = 3) {
            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    const res = await fetch(url, options);
                    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                    return { success: true, response: res };
                } catch (error) {
                    console.error(`API attempt ${attempt} failed: ${error.message}`);
                    if (attempt === retries) return { success: false, error };
                    await sleep(1000 * attempt);
                }
            }
        },

        /**
         * Get value from API. Handles double-stringified legacy data:
         * if the parsed result is still a string, parse once more.
         */
        async getValue(appKey, fallback = null) {
            const r = await this.fetch(`${API_BASE_URL}/getValue/${authKey}/${appKey}`);
            if (!r.success) return fallback;
            try {
                const text = await r.response.text();
                if (!text) return fallback;
                let parsed = JSON.parse(text);
                // Legacy fix: server may have stored JSON.stringify(JSON.stringify(x))
                // resulting in a string like '"[1,2,3]"' instead of '[1,2,3]'
                if (typeof parsed === 'string') {
                    try { parsed = JSON.parse(parsed); } catch { /* keep as string */ }
                }
                return parsed;
            } catch { return fallback; }
        },

        async updateValue(appKey, value) {
            const url = `${API_BASE_URL}/UpdateValue/${authKey}/${appKey}`;
            // NOTE: intentionally using text/plain to avoid CORS preflight.
            // application/json triggers OPTIONS preflight on cross-origin requests.
            // text/plain is CORS-safelisted → browser sends POST directly.
            // Server parses body as JSON regardless of Content-Type.
            return (await this.fetch(url, {
                method: 'POST',
                body: JSON.stringify({ value }),
            })).success;
        },
    };

    // ═══════════════════════════════════════════════════════════════════
    // IGNORE LIST MANAGER
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Ignore list uses Set<number> internally for O(1) lookups.
     * On disk: stored as number[] e.g. [2191698, 2192671, ...]
     * Migration: old string[] like ["2191698",...] is auto-coerced on load.
     * @type {Set<number>}
     */
    let ignoreSet = new Set();

    const ignoreListMgr = {
        async load() {
            const appKey = storage.get(STORAGE_KEYS.IGNORE_LIST);
            if (!appKey) return new Set();

            const data = await api.getValue(appKey, []);
            // Normalize: accept number[] or string[] (legacy), coerce all to number
            const arr = Array.isArray(data) ? data : [];
            return new Set(arr.map(Number).filter(n => !isNaN(n) && n > 0));
        },

        async save(set) {
            const appKey = storage.get(STORAGE_KEYS.IGNORE_LIST);
            if (!appKey) return false;

            let arr = [...set]; // number[]
            // Enforce size limit (FIFO eviction from oldest)
            let json = JSON.stringify(arr);
            while (json.length > IGNORE_LIST_SIZE_LIMIT && arr.length > 0) {
                arr.shift();
                json = JSON.stringify(arr);
            }
            // Sync the Set back if we evicted
            if (arr.length < set.size) {
                ignoreSet = new Set(arr);
            }
            return api.updateValue(appKey, arr);
        },

        has(userId) {
            return ignoreSet.has(Number(userId));
        },

        async add(userId) {
            const id = Number(userId);
            if (isNaN(id) || ignoreSet.has(id)) return true;
            ignoreSet.add(id);
            return this.save(ignoreSet);
        },
    };

    // ═══════════════════════════════════════════════════════════════════
    // RANGE MANAGER
    // ═══════════════════════════════════════════════════════════════════

    /**
     * On disk (new format): { "from": 2203008, "to": 2203096, "latest": 2203096 }
     * Migration: old [2203008, 2203096, 2203096] positional array auto-converted.
     * @typedef {{ from: number, to: number, latest: number }} Range
     */
    const rangeMgr = {
        /** @returns {Promise<Range|null>} */
        async load() {
            const appKey = storage.get(STORAGE_KEYS.LATEST_RANGE);
            if (!appKey) return null;

            const data = await api.getValue(appKey, null);
            if (!data) return null;

            // New format: { from, to, latest }
            if (data.from != null && data.to != null && data.latest != null) {
                const r = { from: Number(data.from), to: Number(data.to), latest: Number(data.latest) };
                return (isNaN(r.from) || isNaN(r.to) || isNaN(r.latest)) ? null : r;
            }

            // Legacy format: [from, to, latest] positional array
            if (Array.isArray(data) && data.length >= 3) {
                const [from, to, latest] = data.map(Number);
                if (isNaN(from) || isNaN(to) || isNaN(latest)) return null;
                // Auto-migrate: save back as named object
                const range = { from, to, latest };
                await this.save(range);
                return range;
            }

            return null;
        },

        /** @param {Range} range */
        async save(range) {
            const appKey = storage.get(STORAGE_KEYS.LATEST_RANGE);
            if (!appKey) return false;
            return api.updateValue(appKey, {
                from: range.from,
                to: range.to,
                latest: range.latest,
            });
        },
    };

    // ═══════════════════════════════════════════════════════════════════
    // LOGGING
    // ═══════════════════════════════════════════════════════════════════

    function log(message, styles = [], linkOrExtra) {
        const args = [message, ...styles];
        if (linkOrExtra) args.push(linkOrExtra);
        console.log(...args);
    }

    function printUserList(label, color, users) {
        if (!users.length) {
            log(`%c${label}: none.`, [`background: ${color}; color: white; padding: 2px;`]);
            return;
        }
        log(`%c${label}:%c`, [`background: ${color}; color: white; padding: 2px;`, '']);
        for (const u of users) {
            log(
                `%c${u.username}:%c ${u.lastSeen || '?'} %c(${u.minutes}')%c ${u.hasContent ? 'has content' : ''}`,
                [`color: ${color}; font-weight: bold;`, 'color: cyan; font-weight: bold;',
                 'background: green; color: white; padding: 3px;',
                 `color: ${u.hasContent ? 'red' : 'green'}; font-weight: bold;`],
                `${VOZ_BASE_URL}/u/${u.id}/#about`
            );
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // SPAM KEYWORD LOADER
    // ═══════════════════════════════════════════════════════════════════

    let _keywordsLoaded = false;
    /** @type {string[]} */
    let spamKeywords = [...DEFAULT_SPAM_KEYWORDS];
    const spamUserNames = [...DEFAULT_SPAM_USERNAMES];

    async function loadSpamKeywords() {
        if (_keywordsLoaded) return spamKeywords;

        const uniqueSet = new Set(spamKeywords);

        // Merge from localStorage
        // [FIX] Use getJSON — original code did `get()` which returns a string, not array
        const cached = storage.getJSON(STORAGE_KEYS.SPAM_KEYWORDS, []);
        if (Array.isArray(cached)) {
            for (const k of cached) {
                if (typeof k === 'string' && k.trim()) uniqueSet.add(k.trim());
            }
        }

        // Fetch hostsVN gambling list
        try {
            const result = await api.fetch(HOSTS_URL);
            if (result.success) {
                const text = await result.response.text();
                for (const line of text.split('\n')) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('0.0.0.0')) continue;
                    const host = trimmed.split(' ')[1];
                    if (!host) continue;
                    const parts = host.split('.');
                    if (parts.length <= 1) continue;
                    const domain = parts.slice(-2).join('.');
                    if (domain.length >= 5 && /^[a-z0-9.-]+$/i.test(domain) &&
                        !domain.startsWith('.') && !domain.endsWith('.')) {
                        uniqueSet.add(domain);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to fetch hostsVN:', err);
        }

        // Filter out suspiciously short alphanumeric entries
        spamKeywords = [...uniqueSet].filter(k => {
            if (!/[a-z0-9]/i.test(k)) return k.length > 0;
            return k.length >= 3;
        });

        storage.setJSON(STORAGE_KEYS.SPAM_KEYWORDS, spamKeywords);
        compileSpamRegex(spamKeywords, spamUserNames);
        _keywordsLoaded = true;
        return spamKeywords;
    }

    // ═══════════════════════════════════════════════════════════════════
    // CONCURRENCY LIMITER
    // ═══════════════════════════════════════════════════════════════════

    /**
     * [FIX] Original had a bug: `executing.delete(p.catch(() => {}))` creates
     * a new promise, so `p` was never removed → the Set grew unbounded and
     * `Promise.race` always resolved immediately after the first batch.
     *
     * Fixed: use `.finally()` which returns `p` chainable and correctly delete.
     */
    async function limitConcurrency(tasks, limit) {
        const results = [];
        const executing = new Set();

        for (const task of tasks) {
            const p = Promise.resolve().then(task);
            results.push(p);
            executing.add(p);

            const cleanup = p.finally(() => executing.delete(p));

            if (executing.size >= limit) {
                await Promise.race(executing);
            }
        }
        return Promise.allSettled(results);
    }

    // ═══════════════════════════════════════════════════════════════════
    // NEWEST MEMBER FINDER
    // ═══════════════════════════════════════════════════════════════════

    async function findNewestMember(autorun) {
        let userId = 0;

        const firstMemberEl = document.querySelector('.listHeap li:first-child a') ||
            Array.from(document.querySelectorAll('dl.pairs.pairs--justified dt'))
                .find(dt => dt.textContent.trim() === 'Latest member')
                ?.closest('dl').querySelector('dd a.username');

        const latestRange = await rangeMgr.load();
        log(`Latest cleaner range: ${JSON.stringify(latestRange)}`);

        if (firstMemberEl) {
            userId = firstMemberEl.getAttribute('data-user-id');
            log(`Newest Member User ID in this page: %c${userId}`, ['background: green; color: white; padding: 2px;']);
            if (!latestRange || Number(userId) > latestRange.latest) {
                return userId;
            }
        }

        // Need to search for newest
        userId = latestRange ? latestRange.latest : 0;
        const userPage = `${VOZ_BASE_URL}/u/`;

        if (firstMemberEl && autorun && !isMobile()) {
            log('Auto run triggered!');
            location.replace(userPage);
            return userId;
        }

        try {
            const tab = window.open(userPage, '_blank');
            if (!tab) {
                if (!isMobile()) location.replace(userPage);
                return userId;
            }

            return new Promise((resolve) => {
                const interval = setInterval(() => {
                    try {
                        if (tab.closed) { clearInterval(interval); resolve(userId); return; }
                        if (tab.document.readyState === 'complete') {
                            const el = tab.document.querySelector('.listHeap li:first-child a');
                            clearInterval(interval);
                            if (el) userId = el.getAttribute('data-user-id');
                            tab.close();
                            resolve(userId);
                        }
                    } catch {
                        clearInterval(interval);
                        try { tab.close(); } catch {}
                        resolve(userId);
                    }
                }, 1000);

                setTimeout(() => {
                    clearInterval(interval);
                    try { if (!tab.closed) tab.close(); } catch {}
                    resolve(userId);
                }, TAB_TIMEOUT_MS);
            });
        } catch {
            return userId;
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // CORE: USER CHECKING & BANNING
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Check if a user is already banned & extract profile metadata.
     * @param {number} userId
     * @returns {Promise<{username: string, banned: boolean, message: string, userTitle: string, joinedText: string, lastSeenText: string, diffMinutes: number|null}>}
     */
    async function checkUserStatus(userId) {
        const url = `${VOZ_BASE_URL}/u/${userId}?_xfResponseType=json&_xfWithData=1`;
        const fallback = { username: 'Not Found', banned: false, message: '', userTitle: '', joinedText: '', lastSeenText: '', diffMinutes: null };

        const result = await api.fetch(url);
        if (!result.success) return fallback;

        try {
            const data = await result.response.json();
            if (data.status !== 'ok') return fallback;

            const rawContent = data.html?.content?.toLowerCase() || '';
            const fullContent = data.html?.content || '';
            const username = data.html?.title || '';
            const banned = rawContent.includes('username--banned');

            // Extract metadata
            const userTitleMatch = fullContent.match(/<span class="userTitle"[^>]*>([^<]*)<\/span>/i);
            const userTitle = userTitleMatch?.[1]?.trim() || '';

            const joinedMatch = fullContent.match(/<dt>Joined<\/dt>\s*<dd><time[^>]*>([^<]*)<\/time><\/dd>/i);
            const joinedText = joinedMatch?.[1] || '';

            const lastSeenMatch = fullContent.match(/<dt>Last seen<\/dt>\s*<dd[^>]*>\s*<time[^>]*>([^<]*)<\/time>/i);
            const lastSeenText = lastSeenMatch?.[1] || '';

            // Activity info
            const activityMatch = fullContent.match(/<dt>Last seen<\/dt>\s*<dd[^>]*>[\s\S]*?&middot;<\/span>\s*([\s\S]*?)(?:<\/dd>)/i);
            let activity = activityMatch?.[1]?.replace(/<[^>]*>/g, '').trim() || '';

            // Time diff
            const joinTs = extractTimestamp(fullContent, 'Joined');
            const lastSeenTs = extractTimestamp(fullContent, 'Last seen');
            const diffMinutes = (joinTs && lastSeenTs) ? Math.floor((lastSeenTs - joinTs) / 60_000) : null;

            // Build display message
            let msg = '';
            if (userTitle) msg += `%cTitle           : %c${userTitle}\n`;
            if (joinedText) msg += `%cJoined          : %c${joinedText}\n`;
            if (lastSeenText) msg += `%cLast Seen       : %c${lastSeenText}\n`;
            if (diffMinutes != null) {
                const h = Math.floor(diffMinutes / 60);
                const m = diffMinutes % 60;
                msg += `%cTime Diff       : %c${h}h${m.toString().padStart(2, '0')}'\n`;
            }
            msg += `%cActivity        : %c${activity || 'No activity found'}`;

            return { username, banned, message: msg, userTitle, joinedText, lastSeenText, diffMinutes };
        } catch (err) {
            console.error(`Error checking user ${userId}:`, err);
            return fallback;
        }
    }

    /**
     * Check a user's recent content for spam.
     * @param {number} userId
     * @param {string} username
     * @returns {Promise<{isSpam: boolean, keyword: string|null, hasRelevantContent: boolean}>}
     */
    async function checkRecentContent(userId, username) {
        const url = `${VOZ_BASE_URL}/u/${userId}/recent-content?_xfResponseType=json`;
        const result = await api.fetch(url);
        if (!result.success) return { isSpam: false, keyword: null, hasRelevantContent: false };

        try {
            const data = await result.response.json();
            if (data.html.content.includes('has not posted any content recently')) {
                return { isSpam: false, keyword: null, hasRelevantContent: false };
            }

            const content = data.html.content.toLowerCase();
            const entryRegex = /<li[^>]*?>[\s\S]*?<h3[^>]*?>\s*<a[^>]*?>((?:<span[^>]*?>[^<]*?<\/span>\s*)*)(.*?)<\/a>[\s\S]*?<li>([^<]+)<\/li>/gi;
            const matches = [...content.matchAll(entryRegex)];

            let hasRelevantContent = false;

            for (const match of matches) {
                const titleText = match[2].replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, '').trim();
                const contentType = match[3].trim().toLowerCase();

                log(`%c${username}%c - %c${contentType}: %c${titleText}`,
                    ['color: #17f502; font-weight: bold;', '', 'color: #02c4f5; font-weight: bold;', 'color: yellow; font-weight: bold;']);

                // Skip "post #N" — these are replies, not user-created content
                if (contentType.includes('post #')) continue;

                if (contentType === 'profile post' || contentType === 'thread') {
                    // [FIX] Only flag as "relevant content" for spam-checkable types
                    hasRelevantContent = true;

                    const kwResult = testSpamKeyword(titleText);
                    if (kwResult.matched) {
                        log(`User %c${username}%c: spam keyword in title: %c${kwResult.keyword}`,
                            ['color: red; font-weight: bold;', '', 'color: red; font-weight: bold;']);
                        return { isSpam: true, keyword: kwResult.keyword, hasRelevantContent: true };
                    }

                    if (URL_REGEX.test(titleText)) {
                        log(`User %c${username}%c: URL in title`,
                            ['color: red; font-weight: bold;', '']);
                        return { isSpam: true, keyword: 'url_in_title', hasRelevantContent: true };
                    }
                }
            }

            return { isSpam: false, keyword: null, hasRelevantContent };
        } catch (err) {
            console.error(`Error checking recent content for ${username}:`, err);
            return { isSpam: false, keyword: null, hasRelevantContent: false };
        }
    }

    /**
     * Ban a spam user.
     * @param {number} userId
     * @param {string} username
     * @param {string} keyword - matched keyword
     * @param {Object} ctx - shared context (spamList, banFails, reviewBan, etc.)
     * @returns {Promise<string>} status: 'banned'|'ban_failed'|'ignored'|'not_spam'|'error'
     */
    async function banSpamUser(userId, username, keyword, ctx) {
        if (ignoreListMgr.has(userId)) {
            log(`User %c${username}%c (${userId}) is ignored.`, ['background: green; color: white; padding: 2px;', '']);
            return 'ignored';
        }

        const xfTokenEl = document.querySelector('input[name="_xfToken"]');
        if (!xfTokenEl) {
            console.error('XF Token not found — not logged in or no permission.');
            return 'error';
        }

        const shouldDelete = HARD_DELETE_KEYWORDS.has(keyword) ? '1' : '0';
        const urlSuffix = keyword === 'recent_content' ? 'recent-content' : 'about';

        if (keyword.includes('http')) {
            ctx.reviewBan.push(`${username} - ${keyword}: ${VOZ_BASE_URL}/u/${userId}/#about`);
        }

        const endpoint = `/spam-cleaner/${userId}`;
        const formData = new FormData();
        formData.append('_xfToken', xfTokenEl.value);
        formData.append('action_threads', shouldDelete);
        formData.append('delete_messages', shouldDelete);
        formData.append('delete_conversations', shouldDelete);
        formData.append('ban_user', '1');
        formData.append('no_redirect', '1');
        formData.append('_xfResponseType', 'json');
        formData.append('_xfWithData', '1');
        formData.append('_xfRequestUri', endpoint);

        try {
            const result = await api.fetch(`${VOZ_BASE_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'include',
                body: formData,
            });

            const link = `${VOZ_BASE_URL}/u/${userId}/#${urlSuffix}`;
            const entry = `${username} - ${keyword}: ${link}`;

            if (!result.success) {
                await ignoreListMgr.add(userId);
                ctx.banFails.push(entry);
                log(`%c${username}: Ban failed`, ['background: yellow; color: black; padding: 2px']);
                return 'ban_failed';
            }

            const data = await result.response.json();
            if (data.status === 'ok') {
                ctx.spamCount++;
                ctx.spamUserIds.add(Number(userId));
                ctx.spamList.push(entry);
                log(`%c${username}: ${data.message}`, ['background: #02f55b; color: white; padding: 2px;']);
                return 'banned';
            } else {
                await ignoreListMgr.add(userId);
                ctx.banFails.push(entry);
                log(`%c${username}: ${data.errors?.[0] || 'Unknown error'}`, ['background: yellow; color: black; padding: 2px']);
                return 'ban_failed';
            }
        } catch (err) {
            console.error('Ban error:', err);
            return 'error';
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // CORE: PROCESS SINGLE USER
    // ═══════════════════════════════════════════════════════════════════

    /**
     * [FIX] Consolidated user processing — eliminates double-ban bug and
     * global `tmpKeyword` race condition.
     *
     * @param {number} userId
     * @param {Object} ctx - shared mutable context
     */
    async function processUser(userId, ctx) {
        // Step 1: Check if already banned
        const status = await checkUserStatus(userId);

        if (status.banned) {
            ctx.spamCount++;
            ctx.bannedBeforeSet.add(Number(userId));
            log(`User %c${status.username}%c was already banned.`,
                ['color: red; font-weight: bold;', ''],
                `${VOZ_BASE_URL}/u/${userId}/#about`);
            return;
        }

        // Track metadata for reporting lists
        const diffMin = status.diffMinutes;
        const numId = Number(userId);
        if (diffMin != null && diffMin <= 10) {
            ctx.activeUnder10.push({
                id: numId, username: status.username,
                minutes: Math.round(diffMin), lastSeen: status.lastSeenText, hasContent: false,
            });
        }
        if (status.userTitle && /senior\s*member/i.test(status.userTitle)) {
            ctx.seniorMembers.push({
                id: numId, username: status.username,
                minutes: diffMin != null ? Math.round(diffMin) : -1,
                lastSeen: status.lastSeenText, hasContent: false,
            });
        }

        // Step 2: Fetch profile "about" page
        const aboutUrl = `${VOZ_BASE_URL}/u/${userId}/about?_xfResponseType=json&_xfWithData=1`;
        const aboutResult = await api.fetch(aboutUrl);
        if (!aboutResult.success) return;

        let data;
        try { data = await aboutResult.response.json(); } catch { return; }
        if (data.status !== 'ok') return;

        const rawTitle = data.html?.title || '';
        const candidateName = normalize(rawTitle);
        let rawContent = (data.html?.content?.toLowerCase() || '');

        // Truncate content before "following/followers/trophies" sections
        for (const marker of ['following', 'followers', 'trophies']) {
            const idx = rawContent.indexOf(marker);
            if (idx !== -1) { rawContent = rawContent.substring(0, idx); break; }
        }

        const cleanedContent = stripHtml(rawContent)
            .replace('contact direct message send direct message', '')
            .replace(`${rawTitle.toLowerCase()} has not provided any additional information.`, '')
            .trim();

        // Step 3: Check username for spam
        const unResult = testSpamUsername(candidateName);
        if (unResult.matched) {
            log(`User %c${rawTitle}%c: spam username match: %c${unResult.keyword}`,
                ['color: red; font-weight: bold;', '', 'color: red; font-weight: bold;']);
            await banSpamUser(userId, rawTitle, unResult.keyword, ctx);
            return; // [FIX] Early return — don't double-process
        }

        // Step 4: Check profile content
        //
        // status.message contains dynamic %c pairs (Title, Joined, Last Seen,
        // Time Diff, Activity) — up to 5 pairs = 10 %c placeholders.
        // We must supply matching styles or console colors break.
        //
        // Layout of %c in the full string:
        //   1.  %c ${rawTitle}           → green bold
        //  2-11. status.message          → alternating gray label / colored value
        //                                  (up to 5×2 = 10, extras are harmless)
        //  12.  %c before Profile Link   → gray
        //  13.  %c ${url}                → orange bold
        //  14.  %c ${cleanedContent}     → yellow monospace  (only when content exists)

        const msgStyles = [
            'color: #17f502; font-weight: bold;',       // 1: username
            'color: gray;', 'color: gold; font-weight: bold;',       // Title label / value
            'color: gray;', 'color: cyan;',                          // Joined
            'color: gray;', 'color: orange;',                        // Last Seen
            'color: gray;', 'color: lightgreen;',                    // Time Diff
            'color: gray;', 'color: pink;',                          // Activity
            'color: gray;', 'color: orange; font-weight: bold;',     // Profile Link label / url
        ];

        if (cleanedContent) {
            log(
                `Processing user : %c${rawTitle}\n${status.message}\n%c` +
                `Profile Link    : %c${VOZ_BASE_URL}/u/${userId}/#about\n` +
                `HTML content    ↓\n%c${cleanedContent}`,
                [...msgStyles, 'color: yellow; font-family: monospace;']
            );

            // [FIX] Only addToReview when there's actual profile content (not empty)
            markReview(userId, candidateName, ctx);

            const kwResult = testSpamKeyword(cleanedContent);
            if (kwResult.matched) {
                log(`User %c${rawTitle}%c: spam keyword in profile: %c${kwResult.keyword}`,
                    ['color: red; font-weight: bold;', '', 'color: red; font-weight: bold;']);
                await banSpamUser(userId, rawTitle, kwResult.keyword, ctx);
                return;
            }

            // Check for website in content
            if (WEBSITE_REGEX.test(cleanedContent)) {
                const site = cleanedContent.match(WEBSITE_REGEX)[1];
                log(`User %c${rawTitle}%c: website detected: %c${site}%c — needs review`,
                    ['color: red; font-weight: bold;', '', 'color: red; font-weight: bold;', 'color: yellow;']);
                ctx.reviewBan.push(`${rawTitle} - ${site}: ${VOZ_BASE_URL}/u/${userId}/#about`);
                return;
            }
        } else {
            log(
                `Processing user : %c${rawTitle}\n${status.message}\n%c` +
                `Profile Link    : %c${VOZ_BASE_URL}/u/${userId}/#about`,
                msgStyles
            );
        }

        // Step 5: Check recent content
        const recent = await checkRecentContent(userId, rawTitle);
        if (recent.hasRelevantContent) {
            markReview(userId, candidateName, ctx);
        }
        if (recent.isSpam) {
            // Pass the actual keyword from recent content, not just 'recent_content'
            const banKw = recent.keyword || 'recent_content';
            const shouldUseDirect = HARD_DELETE_KEYWORDS.has(banKw);
            await banSpamUser(userId, rawTitle, shouldUseDirect ? banKw : 'recent_content', ctx);
        }
    }

    /** Mark a user for review in the reporting lists */
    function markReview(userId, username, ctx) {
        const id = Number(userId);
        const inActive = ctx.activeUnder10.find(u => u.id === id);
        const inSenior = ctx.seniorMembers.find(u => u.id === id);
        if (inActive) inActive.hasContent = true;
        if (inSenior) inSenior.hasContent = true;
        if (!inActive && !inSenior) {
            ctx.seniorMembers.push({ id, username, minutes: -1, hasContent: true });
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // CORE: CLEAN ALL SPAMMERS
    // ═══════════════════════════════════════════════════════════════════

    async function cleanAllSpammers(autorun) {
        console.clear();

        // Shared mutable context for this run
        const ctx = {
            spamList: [],
            banFails: [],
            reviewBan: [],
            spamCount: 0,
            spamUserIds: new Set(),
            bannedBeforeSet: new Set(),
            seniorMembers: [],
            activeUnder10: [],
        };

        // Determine ID range
        let from, to;
        try {
            const maxAllow = Number(await findNewestMember(autorun));
            const latestRange = await rangeMgr.load();
            if (latestRange) {
                from = Math.max(1, latestRange.latest - 10);
                to = Math.min(latestRange.latest + 1000, maxAllow);
            } else {
                from = Math.max(1, maxAllow - 100);
                to = maxAllow;
            }
            to = Math.min(to, maxAllow);
        } catch (err) {
            console.error('Failed to determine member range:', err);
            return { status: 'error', message: 'Failed to get member range' };
        }

        const newRange = { from, to, latest: to };

        // Load keywords & compile regex
        await loadSpamKeywords();

        log(`Processing IDs %c${from}%c → %c${to}%c`,
            ['background: green; color: white; padding: 2px;', '',
             'background: green; color: white; padding: 2px;', '']);

        let firstErrorId = null;

        // Process in batches
        for (let start = from; start <= to; start += BATCH_SIZE) {
            const end = Math.min(start + BATCH_SIZE - 1, to);
            const tasks = [];

            for (let id = start; id <= end; id++) {
                const capturedId = id; // closure capture
                tasks.push(async () => {
                    try {
                        await processUser(capturedId, ctx);
                    } catch (err) {
                        if (!firstErrorId) {
                            firstErrorId = capturedId;
                            newRange.latest = capturedId;
                        }
                        console.error(`Error processing ID ${capturedId}:`, err);
                    }
                });
            }

            await limitConcurrency(tasks, CONCURRENCY_LIMIT);
            if (end < to) await sleep(BATCH_DELAY_MS);
        }

        // Save range
        await rangeMgr.save(newRange);

        // ── Reporting ──

        const sorted = ctx.spamList.sort((a, b) => {
            return (a.includes('recent_content') ? 1 : 0) - (b.includes('recent_content') ? 1 : 0);
        });

        if (sorted.length) {
            log('%cSpam List:', ['background: #02f55b; color: white; padding: 2px;']);
            for (const item of sorted) {
                const [namePart, link] = item.split(': ');
                log(`%c${namePart}: `, ['color: red; font-weight: bold;'], link);
            }
        }

        if (ctx.reviewBan.length) {
            log('%cReview Ban List:', ['background: yellow; color: black; padding: 2px;']);
            for (const item of ctx.reviewBan) {
                const [namePart, link] = item.split(': ');
                log(`%c${namePart}: `, ['color: yellow; font-weight: bold;'], link);
            }
        }

        // Build de-duplicated reporting lists
        try {
            // Extract user IDs from URL strings → number set
            const extractIds = (items) => items
                .map(x => (x.match(/\/u\/(\d+)/) || [])[1])
                .filter(Boolean)
                .map(Number);

            const reviewIds = new Set([
                ...extractIds(ctx.reviewBan),
                ...extractIds(sorted.filter(x => x.includes('recent_content'))),
            ]);

            const isExcluded = (id) => ctx.spamUserIds.has(id) || ctx.bannedBeforeSet.has(id);

            const dedup = (arr) => {
                const seen = new Set();
                return arr.filter(u => {
                    if (seen.has(u.id) || isExcluded(u.id) || reviewIds.has(u.id)) return false;
                    seen.add(u.id);
                    return true;
                });
            };

            const seniors = dedup(ctx.seniorMembers).sort((a, b) => (a.minutes ?? 0) - (b.minutes ?? 0));
            const seniorIds = new Set(seniors.map(u => u.id));
            const actives = dedup(ctx.activeUnder10).filter(u => !seniorIds.has(u.id))
                .sort((a, b) => (a.minutes ?? 0) - (b.minutes ?? 0));

            printUserList("Active time < 10' (minutes)", 'purple', actives);
            printUserList('Senior Members', 'teal', seniors);
        } catch (e) {
            console.warn('Failed to build reporting lists:', e);
        }

        // Alert for items needing review
        const needsReview = sorted.filter(x => x.includes('recent_content')).length + ctx.reviewBan.length;
        if (needsReview > 0) {
            alert(`There are ${needsReview} user(s) that need review.`);
        }

        log(`Finished cleaning %c${ctx.spamCount}%c spammers!`,
            ['background: green; color: white; padding: 2px;', '']);
        storage.set(STORAGE_KEYS.LATEST_COUNT, String(ctx.spamCount));

        return {
            status: 'success',
            spamList: sorted,
            banFails: ctx.banFails,
            reviewBan: ctx.reviewBan,
            spamCount: ctx.spamCount,
        };
    }

    // ═══════════════════════════════════════════════════════════════════
    // UI: NAVIGATION BUTTONS
    // ═══════════════════════════════════════════════════════════════════

    function createUI() {
        const navList = document.querySelector('.p-nav-list.js-offCanvasNavSource');
        const footerList = document.querySelector('#footer > div > div.p-footer-row > div.p-footer-row-main > ul');
        if (!navList && !footerList) return null;
        if (document.getElementById('spam-cleaner-button')) {
            return getExistingUI();
        }

        const container = document.createElement('div');
        container.className = 'p-navEl-link vn-quick-link';
        container.style.cssText = 'display: inline-flex; align-items: left;';

        const btnStyle = `margin-right: 10px; color: white; border: none; padding: 5px 10px;
            border-radius: 5px; background-color: #007bff; font-size: 12px; cursor: pointer;`;

        const cleanBtn = Object.assign(document.createElement('button'), {
            id: 'spam-cleaner-button', textContent: 'Clean Now',
            style: { cssText: btnStyle },
        });
        // Fix: style assignment via cssText
        cleanBtn.style.cssText = btnStyle;

        const autorunBtn = Object.assign(document.createElement('button'), { id: 'autorun-button' });
        autorunBtn.style.cssText = btnStyle;
        const savedAutorun = storage.get(STORAGE_KEYS.AUTORUN, 'OFF');
        autorunBtn.textContent = savedAutorun === 'OFF' ? `Autorun: OFF` : `Autorun: ${savedAutorun} mins`;

        const tracker = document.createElement('div');
        tracker.id = 'voz-spam-cleaner-tracker';
        tracker.style.cssText = `display: inline-flex; align-items: center; background-color: #f0f0f0;
            padding: 5px 10px; border-radius: 5px; font-size: 12px;`;
        const trackerText = document.createElement('span');
        const lastCount = storage.get(STORAGE_KEYS.LATEST_COUNT, '0');
        trackerText.textContent = `Spam Cleaner: Idle. Last clean: ${lastCount} spammers.`;
        tracker.appendChild(trackerText);

        container.append(cleanBtn, autorunBtn, tracker);
        const li = document.createElement('li');
        li.className = 'p-navEl';
        li.appendChild(container);

        (isMobile() && footerList ? footerList : navList).appendChild(li);

        const updateProgress = (msg, color = 'black') => {
            trackerText.textContent = msg;
            trackerText.style.color = color;
        };

        return { cleanBtn, autorunBtn, updateProgress };
    }

    function getExistingUI() {
        const cleanBtn = document.getElementById('spam-cleaner-button');
        const autorunBtn = document.getElementById('autorun-button');
        const trackerSpan = document.querySelector('#voz-spam-cleaner-tracker span');
        return {
            cleanBtn, autorunBtn,
            updateProgress: (msg, color = 'black') => {
                if (trackerSpan) { trackerSpan.textContent = msg; trackerSpan.style.color = color; }
            },
        };
    }

    // ═══════════════════════════════════════════════════════════════════
    // UI: SCHEDULER
    // ═══════════════════════════════════════════════════════════════════

    function initScheduler() {
        const ui = createUI();
        if (!ui) return;

        const { cleanBtn, autorunBtn, updateProgress } = ui;
        let isRunning = false;
        let countdownId = null;
        let remainingSeconds = 0;

        async function runCleaner() {
            if (isRunning) return;
            const hadCountdown = !!countdownId;
            if (countdownId) { clearInterval(countdownId); countdownId = null; }

            isRunning = true;
            setButtonsEnabled(false);
            updateProgress('Spam Cleaner: Running...', 'blue');

            try {
                const result = await cleanAllSpammers(false);
                updateProgress(
                    result.status === 'success'
                        ? `Cleaned ${result.spamCount} spammers`
                        : `Error: ${result.message || 'Unknown'}`,
                    result.status === 'success' ? 'green' : 'red'
                );
                await sleep(2000);
            } catch (err) {
                updateProgress(`Error: ${err.message}`, 'red');
            } finally {
                isRunning = false;
                setButtonsEnabled(true);
                const autorun = storage.get(STORAGE_KEYS.AUTORUN, 'OFF');
                if (autorun !== 'OFF' && hadCountdown) {
                    startCountdown(parseInt(autorun));
                } else {
                    updateProgress(`Spam Cleaner: Idle. Last clean: ${storage.get(STORAGE_KEYS.LATEST_COUNT, '0')} spammers.`);
                }
            }
        }

        function setButtonsEnabled(enabled) {
            const disabled = !enabled;
            cleanBtn.disabled = disabled;
            autorunBtn.disabled = disabled;
            cleanBtn.style.backgroundColor = disabled ? '#6c757d' : '#007bff';
            autorunBtn.style.backgroundColor = disabled ? '#6c757d' : '#007bff';
        }

        function startCountdown(minutes) {
            remainingSeconds = minutes * 60;
            if (countdownId) clearInterval(countdownId);
            countdownId = setInterval(() => {
                if (!isRunning) {
                    const m = Math.floor(remainingSeconds / 60);
                    const s = remainingSeconds % 60;
                    updateProgress(
                        `Last clean: ${storage.get(STORAGE_KEYS.LATEST_COUNT, '0')} spammers. Next in ${m}:${s.toString().padStart(2, '0')}...`,
                        '#6494d3'
                    );
                }
                if (--remainingSeconds < 0) {
                    clearInterval(countdownId);
                    countdownId = null;
                    runCleaner();
                }
            }, 1000);
        }

        function toggleAutorun() {
            if (isRunning) return;
            const current = storage.get(STORAGE_KEYS.AUTORUN, 'OFF');
            const nextIdx = (AUTORUN_OPTIONS.indexOf(current) + 1) % AUTORUN_OPTIONS.length;
            const next = AUTORUN_OPTIONS[nextIdx];
            storage.set(STORAGE_KEYS.AUTORUN, next);
            autorunBtn.textContent = next === 'OFF' ? 'Autorun: OFF' : `Autorun: ${next} mins`;

            if (countdownId) { clearInterval(countdownId); countdownId = null; }

            if (next === 'OFF') {
                updateProgress(`Spam Cleaner: Idle. Last clean: ${storage.get(STORAGE_KEYS.LATEST_COUNT, '0')} spammers.`);
            } else {
                startCountdown(parseInt(next));
            }
        }

        // Event listeners (guard against double-init)
        if (!cleanBtn.hasAttribute('data-initialized')) {
            cleanBtn.setAttribute('data-initialized', 'true');
            cleanBtn.addEventListener('click', runCleaner);
            autorunBtn.addEventListener('click', toggleAutorun);

            const saved = storage.get(STORAGE_KEYS.AUTORUN, 'OFF');
            if (saved !== 'OFF') startCountdown(parseInt(saved));
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // LIFT-BAN LISTENER
    // ═══════════════════════════════════════════════════════════════════

    function initLiftBanListeners() {
        const attach = () => {
            for (const form of document.querySelectorAll('form[action*="/ban/lift"]')) {
                const userId = form.action.match(/\/u\/[^.]+\.(\d+)\/ban\/lift/)?.[1];
                if (!userId) continue;
                const btn = form.querySelector('button[type="submit"]');
                if (btn && !btn.hasAttribute('data-voz-listener')) {
                    btn.setAttribute('data-voz-listener', 'true');
                    btn.addEventListener('click', () => ignoreListMgr.add(userId));
                }
            }
        };

        new MutationObserver(() => attach()).observe(document.body, { childList: true, subtree: true });
        attach();
    }

    // ═══════════════════════════════════════════════════════════════════
    // KEY SETUP
    // ═══════════════════════════════════════════════════════════════════

    function ensureKeys() {
        const keys = [
            { key: STORAGE_KEYS.IGNORE_LIST, label: 'Enter app key for the ignore list:' },
            { key: STORAGE_KEYS.LATEST_RANGE, label: 'Enter app key for the processing range:' },
            { key: STORAGE_KEYS.AUTH, label: 'Enter auth key:' },
        ];
        for (const { key, label } of keys) {
            if (!storage.get(key)) {
                const val = prompt(label);
                if (val) storage.set(key, val);
            }
        }
        authKey = storage.get(STORAGE_KEYS.AUTH) || '';
    }

    // ═══════════════════════════════════════════════════════════════════
    // INIT
    // ═══════════════════════════════════════════════════════════════════

    async function init() {
        if (window.location.hostname !== 'voz.vn') return;

        ensureKeys();
        ignoreSet = await ignoreListMgr.load();
        compileSpamRegex(spamKeywords, spamUserNames);
        initLiftBanListeners();
        initScheduler();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

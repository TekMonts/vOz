// ==UserScript==
// @name         vOz Spam Cleaner
// @namespace    https://github.com/TekMonts/vOz
// @author       TekMonts
// @version      5.7
// @description  Spam cleaning tool for voz.vn - add more keywords/logic fix
// @match        https://voz.vn/u/
// @grant        GM_xmlhttpRequest
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// ==/UserScript==

/**
 * vOz Spam Cleaner - An automated tool for detecting and handling spam users on the voz.vn forum.
 *
 * This script works by:
 * 1. Scanning new members
 * 2. Checking profile content and recent posts
 * 3. Comparing with a list of spam keywords (now loaded from API)
 * 4. Automatically banning users detected as spammers
 */

(function () {
    'use strict';

    // === CONSTANTS & VARIABLES ===

    // Local storage for the ignore list and processing range.
    const IGNORE_LIST_KEY = 'voz_ignore_list';
    const LATEST_RANGE_KEY = 'voz_latest_range';
    const LATEST_COUNT_KEY = 'latestCount';
    const AUTORUN_KEY = 'vozAutorun';
    const SPAM_KEYWORDS_KEY = 'voz_spam_keywords';  // New key for spam keywords API
    const API_BASE_URL = 'https://keyvalue.immanuel.co/api/KeyVal';
    const VOZ_BASE_URL = 'https://voz.vn';

    // Size limit for the ignore list (in characters).
    const IGNORE_LIST_SIZE_LIMIT = 200;

    // List to track spam users and processing status
    let spamList = []; // List of users marked as spam
    let ignoreList = [];
    // ===== Added: Advanced reporting lists (keep original logic intact) =====
    // Temporary containers for additional lists
    let seniorMembers = [];          // [{ id, username, minutes }]
    let activeUnder10 = [];          // [{ id, username, minutes }]
    // Track IDs to enforce global uniqueness + easy exclusion
    let spamUserIds = new Set();     // spammers banned in current run
    let bannedBeforeSet = new Set(); // users banned before this run (pre-existing bans)
    // =======================================================================
    let banFails = []; // List of users who could not be banned
    let reviewBan = []; // List of users needing further review
    let spamCount = 0; // Count of processed spam users
	let tmpKeyword = '';

    // Regular expression to detect a website in the content.
    const websiteRegex = /website\s+([^\s]+)/i;
    const urlRegex = /\bhttps?:\/\/[^\s<]+/i;

    // Default spam keywords and usernames (fallback if API fails)
    let spamKeywords = ["go8", "temu", "tℰℳu", "{{", "[(", "cryptocurrency", "verified", "account", "recovery", "investigation", "keonhacai", "sunwin", "số đề", "finance", "moscow", "bongda", "giải trí", "giai tri", "sòng bài", "song bai", "w88", "indonesia", "online gaming", "entertainment", "market", "india", "philipin", "brazil", "spain", "cambodia", "giavang", "giá vàng", "investment", "terpercaya", "slot", "berkualitas", "telepon", "đầu tư", "game", "sòng bạc", "song bac", "trò chơi", "đánh bạc", "tro choi", "đổi thưởng", "doi thuong", "xóc đĩa", "bóng đá", "bong da", "đá gà", "da ga", "#trangchu", "cược", "ca cuoc", "casino", "daga", "nhà cái", "nhacai", "merch", "subre", "cá độ", "ca do", "bắn cá", "ban ca", "rikvip", "taixiu", "tài xỉu", "xocdia", "xoso66", "zomclub", "vin88", "vip79", "123win", "23win", "33win", "55win", "777king", "77win", "789club", "789win", "79king", "888b", "88clb", "8day", "8live", "97win", "98win", "99ok", "abc8", "ae88", "alo789", "az888", "banca", "bj38", "bj88", "bong88", "cacuoc", "cado", "cwin", "da88", "df99", "ee88", "f88", "fcb8", "fi88", "five88", "for88", "fun88", "gk88", "go88", "go99", "good88", "hay88", "hb88", "hi88", "jun88", "king88", "luck8", "lucky88", "lulu88", "mancl", "may88", "mb66", "miso88", "mksport", "mu88", "net8", "nohu", "ok365", "okvip", "one88", "qh88", "red88", "rr88", "sin88", "sky88", "soicau247", "sonclub", "sunvin", "sv88", "ta88", "taipei", "tdtc", "thomo", "tk88", "twin68", "vn88", "tylekeo", "typhu88", "uk88", "vip33", "vip66", "fb88", "vip77", "vip99", "win88", "xo88", "bet", "club.", "hitclub", "66.", "88.", "68.", "79.", "365.", "f168", "phát tài", "massage", "skincare", "healthcare", "jordan", "quality", "wellness", "lifestyle", "trading", "tuhan", "solution", "marketing", "seo expert", "bangladesh", "united states", "protein", "dudoan", "xổ số", "business", "finland", "rongbachkim", "lô đề", "gumm", "france", "free", "trang_chu", "hastag", "reserva777", "internacional", "international", "ga6789", "opportunity", "reward", "rate", "cambodia", "rating", "sodo"];
    let spamUserName = ["~", "!", "@", "#", "$", "%", "^", "&", "*", "(", ")", "?", "k9cc", "88i", "cakhia", "review", "bongda", "lifestyle", "pvait", "usam", "usatop", "india", "topsel", "telegram","usbes", "account", "tinyfish", "sodo", "88vn", "hello88", "gowin", "update", "drop", "login", "choangclub", "sunwin", "rr88", "w88", "gamebai", "gamedoithuong", "trangchu", "rr88", "8xbet", "rongbachkim", "dinogame", "gumm", "nhacai", "cakhia", "merch", "sunvin", "rikvip", "taixiu", "xocdia", "xoso66", "zomclub", "vin88", "nbet", "vip79", "11bet", "123win", "188bet", "1xbet", "23win", "33win", "388bet", "55win", "777king", "77bet", "77win", "789club", "789win", "79king", "888b", "88bet", "88clb", "8day", "8kbet", "8live", "8xbet", "97win", "98win", "99bet", "99ok", "abc8", "ae88", "alo789", "az888", "banca", "bet365", "bet88", "bj38", "bj88", "bong88", "cacuoc", "cado", "cwin", "da88", "debet", "df99", "ee88", "f88", "fabet", "fcb8", "fi88", "five88", "for88", "fun88", "gk88", "go88", "go99", "good88", "hay88", "hb88", "hi88", "ibet", "jun88", "king88", "kubet", "luck8", "lucky88", "lulu88", "mancl", "may88", "mb66", "mibet", "miso88", "mksport", "mu88", "net8", "nohu", "ok365", "okvip", "one88", "qh88", "red88", "sbobet", "sin88", "sky88", "soicau247", "sonclub", "sunvin", "sv88", "ta88", "taipei", "tdtc", "tcdt", "thabet", "thomo", "tk88", "twin68", "vn88", "tylekeo", "typhu88", "uk88", "v9bet", "pg66", "vip33", "vip66", "fb88", "vip77", "vip99", "win88", "xo88", "f168", "duthuong", "trochoi", "xoilac", "vebo", "reserva777", "ga6789", "finance", "casino", "doctor", "wincom", "update", ".com", "capsule", "review", "cbd", "buyold", "supply", "fm88", "trangchu"];

    // Precompile regex for spam checks (Unicode-safe + punctuation-safe)
	let spamKeywordRegex;
	let spamUsernameRegex;

	function compileSpamRegex() {
		const toArr = (v) => Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : [];
		const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

		const uniq = (arr) => [...new Set(arr.map(s => (s || '').trim()).filter(Boolean))];
		const byLenDesc = (a, b) => b.length - a.length;

		const kwList = uniq(toArr(spamKeywords)).sort(byLenDesc).map(escapeRegex);
		const unList = uniq(toArr(spamUserName)).sort(byLenDesc).map(escapeRegex);

		const kwAlt = kwList.join('|');
		const unAlt = unList.join('|');

		// ✅ match substring anywhere, case-insensitive + unicode-safe
		spamKeywordRegex  = new RegExp(`(${kwAlt})`, 'iu');
		spamUsernameRegex = new RegExp(`(${unAlt})`, 'iu');
	}


    // Store the default number of keywords to check when updating.
    const defaultSpamKeywordsCount = spamKeywords.length;

    // Temporary element to process HTML.
    const tempDiv = document.createElement('div');

    // Automatic run configuration.
    const autorunStates = ['OFF', '5', '15', '30'];

    /**
     * Local storage manager with integrated error handling.
     */
    const storageManager = {
        get: (key, defaultValue = null) => {
            try {
                const value = localStorage.getItem(key);
                return value !== null ? value : defaultValue;
            } catch (error) {
                console.error(`Error getting ${key} from localStorage:`, error);
                return defaultValue;
            }
        },

        set: (key, value) => {
            try {
                localStorage.setItem(key, value);
                return true;
            } catch (error) {
                console.error(`Error setting ${key} in localStorage:`, error);
                return false;
            }
        },

        remove: (key) => {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (error) {
                console.error(`Error removing ${key} from localStorage:`, error);
                return false;
            }
        }
    };

    /**
     * API manager with integrated error handling and retries.
     */
    const apiManager = {
        /**
         * Send a fetch request with error handling and retries
         *
         * @param {string} url - The request URL
         * @param {Object} options - Fetch options
         * @param {number} retries - Number of retries (default 3)
         * @returns {Promise<Object>} The request result
         */
        async fetchWithErrorHandling(url, options = {}, retries = 3) {
            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    const response = await fetch(url, options);

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`HTTP error ${response.status}: ${response.statusText} - ${errorText}`);
                    }

                    return {
                        success: true,
                        response
                    };
                } catch (error) {
                    console.error(`API request failed (attempt ${attempt}): ${error.message}`);
                    if (attempt === retries) {
                        return {
                            success: false,
                            error
                        };
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
                }
            }
        },

        /**
         * Get value from API keyvalue
         *
         * @param {string} appKey - Application key
         * @param {string} dataKey - Data key
         * @param {*} defaultValue - Default value in case of error
         * @returns {Promise<*>} Data from the API
         */
        async getValue(appKey, dataKey, defaultValue = null) {
            const url = `${API_BASE_URL}/getValue/${appKey}/${dataKey}`;
            const result = await this.fetchWithErrorHandling(url);

            if (result.success) {
                try {
                    const text = await result.response.text();
                    return text ? JSON.parse(text) : defaultValue;
                } catch (error) {
                    console.error(`Error parsing API response:`, error);
                    return defaultValue;
                }
            }

            return defaultValue;
        },

        /**
         * Update value to API keyvalue
         *
         * @param {string} appKey - Application key
         * @param {string} dataKey - Data key
         * @param {*} value - The value to update
         * @returns {Promise<boolean>} Update result
         */
        async updateValue(appKey, dataKey, value) {
            const jsonStr = JSON.stringify(value);
            const url = `${API_BASE_URL}/UpdateValue/${appKey}/${dataKey}/${encodeURIComponent(jsonStr)}`;

            const result = await this.fetchWithErrorHandling(url, {
                method: 'POST'
            });

            return result.success;
        }
    };

    /**
     * Ignore list manager.
     */
    const ignoreListManager = {
        /**
         * Get the list of ignored users from the API
         *
         * @returns {Promise<Array>} Array containing the IDs of ignored users
         */
        async getIgnoreList() {
            const appKey = storageManager.get(IGNORE_LIST_KEY);
            if (!appKey) return [];

            const list = await apiManager.getValue(appKey, 'data', []);

            let parsedArray = null;

            if (typeof list === "string") {
                try {
                    parsedArray = JSON.parse(list);
                } catch (error) {
                    console.error("Error parsing JSON:", error);
                    return null;
                }
            } else if (Array.isArray(list)) {
                parsedArray = list;
            }
            return parsedArray;
        },

        /**
         * Update the list of ignored users to the API
         *
         * @param {Array} list - Array containing the IDs of ignored users
         * @returns {Promise<boolean>} Update result
         */
        async setIgnoreList(list) {
            if (!Array.isArray(list)) {
                list = [];
            }
            const appKey = storageManager.get(IGNORE_LIST_KEY);
            if (!appKey) return false;

            let jsonStr = JSON.stringify(list);
            while (jsonStr.length > IGNORE_LIST_SIZE_LIMIT && list.length > 0) {
                list.shift();
                jsonStr = JSON.stringify(list);
            }
            return await apiManager.updateValue(appKey, 'data', list);
        },

        /**
         * Add a user to the ignore list
         *
         * @param {string|number} userId - The user ID to add to the ignore list
         * @returns {Promise<boolean>} Result of the addition
         */
        async addToIgnoreList(userId) {
            try {
                if (ignoreList.includes(userId)) {
                    return true;
                }

                ignoreList.push(userId);
                return await this.setIgnoreList(ignoreList);
            } catch (error) {
                console.error(`Error adding ${userId} to ignore list:`, error);
                return false;
            }
        }
    };

    /**
     * Processing range manager
     */
    const rangeManager = {
        /**
         * Get the range of recently processed user IDs from the API
         *
         * @returns {Promise<Object|null>} Object containing the range information or null if there's an error
         */
        async getLastRange() {
            const appKey = storageManager.get(LATEST_RANGE_KEY);
            if (!appKey) return null;

            const rangeArray = await apiManager.getValue(appKey, 'data', null);

            let parsedArray = null;

            if (typeof rangeArray === "string") {
                try {
                    parsedArray = JSON.parse(rangeArray);
                } catch (error) {
                    console.error("Cannot parse JSON:", error);
                    return null;
                }
            } else if (Array.isArray(rangeArray)) {
                parsedArray = rangeArray;
            }

            if (Array.isArray(parsedArray) && parsedArray.length >= 3) {
                const fromID = Number(parsedArray[0]);
                const toID = Number(parsedArray[1]);
                const latestID = Number(parsedArray[2]);

                if (!isNaN(fromID) && !isNaN(toID) && !isNaN(latestID)) {
                    return {
                        fromID,
                        toID,
                        latestID
                    };
                }
            }

            return null;
        },

        /**
         * Update the range of processed user IDs to the API
         *
         * @param {Object} range - Object containing the range information (fromID, toID, latestID)
         * @returns {Promise<boolean>} Update result
         */
        async setLastRange(range) {
            const appKey = storageManager.get(LATEST_RANGE_KEY);
            if (!appKey) return false;

            const rangeArray = [range.fromID, range.toID, range.latestID];
            return await apiManager.updateValue(appKey, 'data', rangeArray);
        }
    };

    /**
     * Spam manager
     */
    const spamManager = {
        /**
         * Manage the count of processed spam
         *
         * @param {number} count - The new spam count (if updating)
         * @returns {number} The current spam count
         */
        getSpamCount() {
            return parseInt(storageManager.get(LATEST_COUNT_KEY, '0'));
        },

        /**
         * Update the count of processed spam
         *
         * @param {number} count - The new spam count
         * @returns {boolean} Update result
         */
        setSpamCount(count) {
            return storageManager.set(LATEST_COUNT_KEY, count.toString());
        },

        /**
         * Fetch the list of spam keywords from an external source and update the current list
         *
         * @returns {Promise<Array>} The updated list of spam keywords
         */
        async getSpamKeywords() {
			const storedKeywords = storageManager.get(SPAM_KEYWORDS_KEY) || [];
            const uniqueHosts = new Set([
                        ...spamKeywords,
                        ...storedKeywords,
                    ]);
			this.extendedKeywords = Array.from(uniqueHosts) ;
            if (this.extendedKeywords && this.extendedKeywords.length > defaultSpamKeywordsCount) {
				spamKeywords = this.extendedKeywords;
				compileSpamRegex();
                return this.extendedKeywords;
            }

            const url = 'https://raw.githubusercontent.com/bigdargon/hostsVN/refs/heads/master/extensions/gambling/hosts-VN';
            try {
                const result = await apiManager.fetchWithErrorHandling(url);

                if (!result.success) {
                    this.extendedKeywords = [...spamKeywords];
                    return this.extendedKeywords;
                }

                const text = await result.response.text();
                const lines = text.split('\n');
                for (let line of lines) {
                    line = line.trim();
                    if (line.startsWith('0.0.0.0')) {
                        const hostPart = line.split(' ')[1];
                        if (hostPart) {
                            const parts = hostPart.split('.');
                            if (parts.length > 1) {
                                // Get the second-level domain (e.g., example.com from sub.example.com).
                                const domain = parts.slice(-2).join('.');
                                uniqueHosts.add(domain);
                            }
                        }
                    }
                }

                this.extendedKeywords = Array.from(uniqueHosts);
				storageManager.set(SPAM_KEYWORDS_KEY, this.extendedKeywords)
				spamKeywords = this.extendedKeywords;
				compileSpamRegex();  // Recompile after extension
                return this.extendedKeywords;
            } catch (error) {
                console.error(`Failed to load content from ${url}:`, error);
                this.extendedKeywords = [...spamKeywords];
                return this.extendedKeywords;
            }
        },

        /**
         * Check the recent content of a user to detect spam
         *
         * @param {string|number} userId - The user ID
         * @param {string} username - The username
         * @param {Array} keywords - The list of spam keywords (unused now, regex handles)
         * @returns {Promise<boolean>} true if spam is detected, false otherwise
         */
        async checkRecentContent(userId, username, keywords) {
            const recentUrl = `${VOZ_BASE_URL}/u/${userId}/recent-content?_xfResponseType=json`;
            const result = await apiManager.fetchWithErrorHandling(recentUrl);
            if (!result.success) {
                return false;
            }

            try {
                const data = await result.response.json();

                if (data.html.content.includes("has not posted any content recently")) {
                    return false;
                }

                const content = data.html.content.toLowerCase();

                const contentRegex = /<li[^>]*?>[\s\S]*?<h3[^>]*?>\s*<a[^>]*?>((?:<span[^>]*?>[^<]*?<\/span>\s*)*)(.*?)<\/a>[\s\S]*?<li>([^<]+)<\/li>/gi;
                const matches = [...content.matchAll(contentRegex)];
				//to review list if user has content In about page
				if (matches.length > 0) {
					addToReview(userId, username);
				}
                for (const match of matches) {
                    const titleText = match[2].replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, '').trim();
                    const contentType = match[3].trim().toLowerCase();

                    logMessage(`%c${username}%c - %c${contentType}: %c${titleText}`,
                        ['color: #17f502; font-weight: bold; padding: 2px;', '', 'color: #02c4f5; font-weight: bold; padding: 2px;', 'color: yellow; font-weight: bold; padding: 2px;']);

                    if (contentType.includes('post #')) {
                        continue;
                    }

                    if (contentType === 'profile post' || contentType === 'thread') {
                        if (spamKeywordRegex.test(titleText)) {
                            const keyword = titleText.match(spamKeywordRegex)[0];
                            logMessage(`User %c${username}%c detected as spammer. Title contains keyword: %c${keyword}%c`,
                                ['color: red; font-weight: bold; padding: 2px;', '', 'color: red; font-weight: bold; padding: 2px;', '']);
							tmpKeyword = keyword;
                            return true;
                        }
						if (urlRegex.test(titleText)) {
                            logMessage(`User %c${username}%c detected as spammer. Title contains URL: %c${titleText}%c`,
                                ['color: red; font-weight: bold; padding: 2px;', '', 'color: red; font-weight: bold; padding: 2px;', '']);
                            return true;
                        }
                    }
                }

                return false;
            } catch (error) {
                console.error(`Error checking recent content for ${username}:`, error);
                return false;
            }
        },

        /**
         * Handle users detected as spam
         *
         * @param {string|number} userId - The user ID
         * @param {string} username - The username
         * @param {string} inputKW - The detected spam keyword (if any)
         * @param {Array} keywords - The list of spam keywords (unused now)
         * @returns {Promise<Object>} The result of the processing
         */
        async processSpamUser(userId, username, inputKW, keywords) {
            const userIdStr = userId.toString();

            if (ignoreList.includes(userIdStr)) {
                logMessage(`User %c${username}%c with id %c${userId}%c is ignored.`,
                    ['background: green; color: white; padding: 2px;', '', 'background: green; color: white; padding: 2px;', '']);
                return {
                    status: 'ignored'
                };
            }

            const endpoint = `/spam-cleaner/${userId}`;
            const xfTokenElement = document.querySelector('input[name="_xfToken"]');

            if (!xfTokenElement) {
                console.error('XF Token not found. User might not be logged in or have permission.');
                return {
                    status: 'error',
                    message: 'XF Token not found'
                };
            }

            const xfToken = xfTokenElement.value;
            const userUrl = `${VOZ_BASE_URL}/u/${userId}/about?_xfResponseType=json&_xfWithData=1`;

            let finalKW = inputKW || '';
            let isSpam = !!finalKW?.trim();

            if (!isSpam) {
                await new Promise(resolve => setTimeout(resolve, 100));

                const result = await apiManager.fetchWithErrorHandling(userUrl);
                if (result.success) {
                    const data = await result.response.json();
                    const content = data.html?.content?.toLowerCase() || "";

                    if (spamKeywordRegex.test(content)) {
                        isSpam = true;
                        finalKW = content.match(spamKeywordRegex)[0];
                        logMessage(`User %c${username}%c detected as spammer based on keyword %c${finalKW}%c.`,
                            ['color: red; font-weight: bold; padding: 2px;', '', 'color: red; font-weight: bold; padding: 2px;', '']);
                    }
                }
            }

            if (!isSpam) {
                logMessage(`User %c${username}%c is not a spammer. Skipping ban.`,
                    ['background: green; color: white; padding: 2px;', '']);
                await ignoreListManager.addToIgnoreList(userId);
                return {
                    status: 'not_spam'
                };
            }
			const shouldDelDataKeyWorld = ["temu", "tℰℳu", "{{", "[(", "cryptocurrency", "verified"];

			const shouldDelData = finalKW === 'recent_content' && tmpKeyword && shouldDelDataKeyWorld.includes(tmpKeyword) ? '1' : '0';


			tmpKeyword = '';
            const urlSubfix = finalKW === 'recent_content' ? 'recent-content' : 'about';

            if (finalKW.includes("http")) {
                reviewBan.push(`${username} - ${finalKW}: ${VOZ_BASE_URL}/u/${userId}/#about`);
            }

            const formData = new FormData();
            formData.append('_xfToken', xfToken);
            formData.append('action_threads', shouldDelData);
            formData.append('delete_messages', shouldDelData);
            formData.append('delete_conversations', shouldDelData);
            formData.append('ban_user', '1');
            formData.append('no_redirect', '1');
            formData.append('_xfResponseType', 'json');
            formData.append('_xfWithData', '1');
            formData.append('_xfRequestUri', endpoint);

            try {
                const result = await apiManager.fetchWithErrorHandling(`${VOZ_BASE_URL}${endpoint}`, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    credentials: 'include',
                    body: formData
                });

                if (!result.success) {
                    await ignoreListManager.addToIgnoreList(userId);
                    banFails.push(`${username} - ${finalKW}: ${VOZ_BASE_URL}/u/${userId}/#${urlSubfix}`);
                    logMessage(`%c${username}: Ban failed`, ['background: yellow; color: black; padding: 2px']);
                    return {
                        status: 'ban_failed',
                        error: result.error
                    };
                }

                const data = await result.response.json();

                if (data.status === 'ok') {
                    spamCount++;
                    spamUserIds.add(String(userId));
                    spamList.push(`${username} - ${finalKW}: ${VOZ_BASE_URL}/u/${userId}/#${urlSubfix}`);
                    logMessage(`%c${username}: ${data.message}`, ['background: #02f55b; color: white; padding: 2px;']);
                    return {
                        status: 'banned',
                        message: data.message
                    };
                } else {
                    await ignoreListManager.addToIgnoreList(userId);
                    banFails.push(`${username} - ${finalKW}: ${VOZ_BASE_URL}/u/${userId}/#${urlSubfix}`);
                    logMessage(`%c${username}: ${data.errors ? data.errors[0] : 'Unknown error'}`,
                        ['background: yellow; color: black; padding: 2px']);
                    return {
                        status: 'ban_failed',
                        errors: data.errors
                    };
                }
            } catch (error) {
                console.error('Error processing spammer:', error);
                return {
                    status: 'error',
                    message: error.message
                };
            }
        }
    };

    /**
     * Member manager
     */
    const memberManager = {
        /**
         * Check if the user is using a mobile device
         *
         * @returns {boolean} true if the user is using a mobile device
         */
        isUserUsingMobile() {
            let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

            if (!isMobile) {
                let screenWidth = window.screen.width;
                let screenHeight = window.screen.height;
                isMobile = (screenWidth <= 800 || screenHeight <= 600);
            }

            if (!isMobile) {
                try {
                    isMobile = (('ontouchstart' in window) || navigator.userAgentData?.mobile);
                } catch (e) {
                    isMobile = 'ontouchstart' in window;
                }
            }

            return isMobile;
        },

        /**
         * Find the ID of the latest member
         *
         * @param {boolean} autorun - Whether to automatically redirect
         * @returns {Promise<number|string>} The ID of the latest member
         */
        async findNewestMember(autorun) {
            let searchForNewest = false;
            let userId = 0;

            const firstMemberElement = document.querySelector('.listHeap li:first-child a') ||
                Array.from(document.querySelectorAll('dl.pairs.pairs--justified dt'))
                .find(dt => dt.textContent.trim() === 'Latest member')
                ?.closest('dl').querySelector('dd a.username');

            let latestRange = await rangeManager.getLastRange();
            logMessage(`Latest cleaner range: ${JSON.stringify(latestRange)}`);

            if (firstMemberElement) {
                userId = firstMemberElement.getAttribute('data-user-id');
                logMessage(`Newest Member User ID in this page: %c${userId}`, ['background: green; color: white; padding: 2px;']);

                if (latestRange && parseInt(userId) <= parseInt(latestRange.latestID)) {
                    searchForNewest = true;
                } else {
                    return userId;
                }
            } else {
                searchForNewest = true;
            }

            const userPage = `${VOZ_BASE_URL}/u/`;

            if (firstMemberElement && autorun) {
                logMessage('Auto run triggred!');
                if (!this.isUserUsingMobile()) {
                    location.replace(userPage);
                }
                return userId;
            }

            if (searchForNewest) {
                userId = latestRange ? parseInt(latestRange.latestID) : 0;

                try {
                    const tab = window.open(userPage, '_blank');
                    if (!tab) {
                        console.warn('Failed to open tab');
                        if (!this.isUserUsingMobile()) {
                            location.replace(userPage);
                        }
                        return userId;
                    }

                    return new Promise((resolve) => {
                        const checkTabInterval = setInterval(() => {
                            try {
                                if (tab.closed) {
                                    clearInterval(checkTabInterval);
                                    console.warn('Tab was closed unexpectedly');
                                    resolve(userId);
                                    return;
                                }

                                if (tab.document.readyState === 'complete') {
                                    const firstMember = tab.document.querySelector('.listHeap li:first-child a');
                                    if (firstMember) {
                                        userId = firstMember.getAttribute('data-user-id');
                                        clearInterval(checkTabInterval);
                                        tab.close();
                                        logMessage(`Newest Member User ID: %c${userId}`, ['background: green; color: white; padding: 2px;']);
                                        resolve(userId);
                                    } else {
                                        clearInterval(checkTabInterval);
                                        tab.close();
                                        console.warn('No member found in the list!');
                                        resolve(userId);
                                    }
                                }
                            } catch (error) {
                                clearInterval(checkTabInterval);
                                try {
                                    tab.close();
                                } catch (e) {
                                    // Ignore errors when closing tab
                                }
                                console.warn('Error accessing the tab: ' + error.message);
                                resolve(userId);
                            }
                        }, 1000);

                        setTimeout(() => {
                            clearInterval(checkTabInterval);
                            try {
                                if (!tab.closed) {
                                    tab.close();
                                }
                            } catch (e) {
                                // Ignore errors when closing tab
                            }
                            console.warn('Tab check timed out after 30 seconds');
                            resolve(userId);
                        }, 30000);
                    });
                } catch (error) {
                    console.error('Error opening new tab:', error);
                    return userId;
                }
            }

            return userId;
        }
    };

    /**
     * Centralized logging function to maintain color styles
     *
     * @param {string} message - The message with %c placeholders
     * @param {array} styles - Array of style strings for each %c
     */
    function logMessage(message, styles = [], linker) {
		const styleArray = Array.isArray(styles) ? styles : [];

		if (linker) {
			console.log(message, ...styleArray, linker);
		} else {
			console.log(message, ...styleArray);
		}
	}

	/**
	 * Pretty-print a list of users in console with styled colors.
	 * - Displays section header with background color.
	 * - Each user line shows username, active minutes, and content status.
	 *
	 * @param {string} label  - Section title (e.g. "Active < 10 min", "Senior Members").
	 * @param {string} color  - Base color for section and username text.
	 * @param {Array}  users  - List of user objects [{ id, username, minutes, hasContent }].
	 */
	function printUsers(label, color, users) {
	    if (users.length === 0) {
	        logMessage(`%c${label}: none.`, [`background: ${color}; color: white; padding: 2px;`]);
	        return;
	    }

	    logMessage(`%c${label}:%c`, [`background: ${color}; color: white; padding: 2px;`, '']);
	    for (const u of users) {
	        const linker = `${VOZ_BASE_URL}/u/${u.id}/#about`;
	        const hasContentColor = u.hasContent ? 'red' : 'green';
	        const hasContentText = u.hasContent ? 'has content' : '';
	        logMessage(
				`%c${u.username}:%c ${u.lastSeen} %c(${u.minutes}')%c ${hasContentText}`,
	            [
					`color: ${color}; font-weight: bold;`,
	                'color: cyan; font-weight: bold;',
	                'background: green; color: white; padding: 3px;',
					`color: ${hasContentColor}; font-weight: bold;`
	            ],
	            linker
			);
	    }
	}

	/**
	* Utility function for managing review candidates in the
	* "seniorMembers" and "activeUnder10" lists.
	*
	* @param {string|number} userID   - Unique ID of the user.
	* @param {string} userName        - Display name of the user.
	*/
	function addToReview(userID, userName) {
	    const idStr = userID.toString();

	    // Find user in both lists
	    const inActive = activeUnder10.find(u => u.id === idStr);
	    const inSenior = seniorMembers.find(u => u.id === idStr);

	    if (inActive || inSenior) {
	        // Mark hasContent = true on both lists where applicable
	        if (inActive)
	            inActive.hasContent = true;
	        if (inSenior)
	            inSenior.hasContent = true;
	    } else {
	        // Not found anywhere -> add to seniorMembers
	        seniorMembers.push({
	            id: idStr,
	            username: userName,
	            minutes: -1,
	            hasContent: true
	        });
	    }
	}

    /**
     * Remove HTML tags from a string
     *
     * @param {string} html - The HTML string to be processed
     * @returns {string} The processed text string
     */
    function stripHtmlTags(html) {
        if (!html) return '';

        tempDiv.innerHTML = html;
        let text = tempDiv.textContent || tempDiv.innerText || '';
        text = text.replace(/\s+/g, ' ').trim();
        return text;
    }

    /**
     * Set up a listener for unban forms
     * When a user is unbanned, automatically add them to the ignore list
     */
    function setupLiftBanListeners() {
        const liftBanForms = document.querySelectorAll('form[action*="/ban/lift"]');

        liftBanForms.forEach(form => {
            const userId = form.action.match(/\/u\/[^.]+\.(\d+)\/ban\/lift/)?.[1];
            if (userId) {
                const submitButton = form.querySelector('button[type="submit"]');
                if (submitButton && !submitButton.hasAttribute('data-voz-listener')) {
                    submitButton.setAttribute('data-voz-listener', 'true');
                    submitButton.addEventListener('click', async function (e) {
                        try {
                            await ignoreListManager.addToIgnoreList(userId);
                            logMessage(`Added ${userId} to ignore list after lift ban`);
                        } catch (error) {
                            console.error(`Error adding ${userId} to ignore list:`, error);
                        }
                    });
                }
            }
        });
    }

    /**
     * Initialize a DOM observer to monitor changes and set up event listeners
     */
    function initializeBanListeners() {
        // Create a MutationObserver to monitor DOM changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length) {
                    setupLiftBanListeners();
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        setupLiftBanListeners();
    }

    /**
     * Limit concurrent promises
     *
     * @param {array} tasks - Array of async functions
     * @param {number} limit - Max concurrent tasks
     * @returns {Promise<array>} Results
     */
    async function limitConcurrency(tasks, limit) {
        const results = [];
        const executing = new Set();

        for (const task of tasks) {
            const p = Promise.resolve().then(task);
            results.push(p);
            executing.add(p);

            if (executing.size >= limit) {
                await Promise.race(executing);
            }
            executing.delete(p.catch(() => {}));  // Handle errors
        }
        return Promise.allSettled(results);  // Use allSettled to continue on errors
    }

    /**
     * Clean up all spam users within an ID range
     *
     * @param {boolean} autorun - Whether to automatically redirect
     * @returns {Promise<Object>} The cleanup result
     */
    async function cleanAllSpamer(autorun) {
        console.clear();
        spamList = [];
        spamCount = 0;
        banFails = [];
        reviewBan = [];
        spamUserIds = new Set();
        bannedBeforeSet = new Set();
        seniorMembers = [];
        activeUnder10 = [];

        let fromID = 0;
        let toID = 0;
        let newRange = {};

        try {
            let maxAllow = await memberManager.findNewestMember(autorun);
            let latestRange = await rangeManager.getLastRange();
            if (latestRange) {
                fromID = Math.max(1, parseInt(latestRange.latestID) - 10);
                toID = Math.min(parseInt(latestRange.latestID) + 1000, maxAllow);
            } else {
                fromID = Math.max(1, parseInt(maxAllow) - 100);
                toID = parseInt(maxAllow);
            }

            toID = Math.min(toID, maxAllow);
            newRange = {
                fromID,
                toID,
                latestID: toID
            };
        } catch (error) {
            console.error('Failed to get the member range to process:', error);
            return {
                status: 'error',
                message: 'Failed to get the member range to process'
            };
        }

        const extendedKeywords = await spamManager.getSpamKeywords();
        logMessage(`Process to clean all spamer has ID from %c${fromID}%c to %c${toID}%c.`,
            ['background: green; color: white; padding: 2px;', '', 'background: green; color: white; padding: 2px;', '']);
		console.log('keywords:' + extendedKeywords);
		console.log('spamKeywords:' + spamKeywords);
        let firstErrorId = null;
        const batchSize = 5;
        const delay = 200;
        const concurrencyLimit = 3;

        for (let startId = fromID; startId <= toID; startId += batchSize) {
            const endId = Math.min(startId + batchSize - 1, toID);
            const tasks = [];

            for (let currentId = startId; currentId <= endId; currentId++) {
                tasks.push(() => processUser(currentId));
            }

            await limitConcurrency(tasks, concurrencyLimit);

            if (endId < toID) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        /**
         * Handle check if user has been banned
         *
         * @param {string|number} userId - The user ID
         * @return {username, status(true|false)}
         */
        async function checkIfUserBanned(currentId) {
            const url = `${VOZ_BASE_URL}/u/${currentId}?_xfResponseType=json&_xfWithData=1`;
            let username = '';
            try {
                const result = await apiManager.fetchWithErrorHandling(url);
                if (!result.success) {
                    console.error(`Failed to fetch data for ID: ${currentId}`);
                    return {
                        username: 'Not Found',
                        status: false,
                        message: ''
                    };
                }
                const data = await result.response.json();
                if (data.status === "ok") {
                    const rawContent = data.html?.content?.toLowerCase() || '';
                    const fullContent = data.html?.content || '';
                    username = data.html?.title || '';
                    const isBanned = rawContent.includes('username--banned');

                    // Extract join and last seen information
                    let joinedText = '';
                    let lastSeenText = '';
                    let timeDiff = '';
                    let viewingInfo = '';
                    let userTitle = '';

                    // Extract userTitle
                    const userTitleMatch = fullContent.match(/<span class="userTitle"[^>]*>([^<]*)<\/span>/i);
                    if (userTitleMatch) {
                        userTitle = userTitleMatch[1].trim();
                    }

                    // Extract joined date
                    const joinedMatch = fullContent.match(/<dt>Joined<\/dt>\s*<dd><time[^>]*title="([^"]*)"[^>]*>([^<]*)<\/time><\/dd>/i);
                    if (joinedMatch) {
                        joinedText = joinedMatch[2];
                    }

                    // FIXED: Extract last seen info and activity (allow full HTML capture)
                    const lastSeenMatch = fullContent.match(/<dt>Last seen<\/dt>\s*<dd[^>]*>\s*<time[^>]*>([^<]*)<\/time>\s*(<span[^>]*>&middot;<\/span>\s*(.*))?/i);
                    if (lastSeenMatch) {
                        lastSeenText = lastSeenMatch[1]; // e.g., "5 minutes ago"
                        let activityText = lastSeenMatch[3] || '';

                        if (activityText.includes('Viewing thread')) {
                            const threadMatch = activityText.match(/Viewing thread <em><a[^>]*>([^<]*)<\/a><\/em>/);
                            viewingInfo = threadMatch ? `Viewing thread: ${threadMatch[1]}` : 'Viewing thread';
                        } else if (activityText.includes('Viewing direct messages')) {
                            viewingInfo = 'Viewing direct messages';
                        } else if (activityText.includes('Managing account details')) {
                            viewingInfo = 'Managing account details';
                        } else if (activityText.includes('Viewing member profile')) {
                            const profileMatch = activityText.match(/Viewing member profile <em><a[^>]*>([^<]*)<\/a><\/em>/);
                            viewingInfo = profileMatch ? `Viewing member profile ${profileMatch[1]}` : 'Viewing member profile';
                        } else if (activityText.includes('Viewing')) {
                            viewingInfo = activityText.replace(/<[^>]*>/g, '').trim();
                        } else if (activityText) {
                            viewingInfo = activityText.replace(/<[^>]*>/g, '').trim();
                        }
                    }

                    // Calculate time difference
                    const joinedTimestamp = extractTimestamp(fullContent, 'Joined');
                    const lastSeenTimestamp = extractTimestamp(fullContent, 'Last seen');
                    // ===== Added: collect candidates for custom lists =====
                    try {
                        const diffMin = (joinedTimestamp && lastSeenTimestamp) ? Math.abs((lastSeenTimestamp - joinedTimestamp) / 60000) : null;
                        if (diffMin !== null && diffMin <= 10) {
                            activeUnder10.push({ id: currentId.toString(), username: username || '', minutes: Math.round(diffMin), lastSeen: lastSeenText, hasContent: false });
                        }
                        if (userTitle && /senior\s*member/i.test(userTitle)) {
                            seniorMembers.push({ id: currentId.toString(), username: username || '', minutes: Math.round(diffMin), lastSeen: lastSeenText, hasContent: false });
                        }
                    } catch (e) { /* non-fatal */ }
                    // ======================================================

                    if (joinedTimestamp && lastSeenTimestamp) {
                        const diffMs = lastSeenTimestamp - joinedTimestamp;
                        const diffMinutes = Math.floor(diffMs / (1000 * 60));
                        const hours = Math.floor(diffMinutes / 60);
                        const minutes = diffMinutes % 60;
                        timeDiff = `${hours}h${minutes.toString().padStart(2, '0')}'`;
                    }

                    // Construct message
                    let message = '';

                    if (userTitle) {
                        message += `%cTitle           : %c${userTitle}\n`;
                    }
                    if (joinedText) {
                        message += `%cJoined          : %c${joinedText}\n`;
                    }
                    if (lastSeenText) {
                        message += `%cLast Seen       : %c${lastSeenText}\n`;
                    }
                    if (timeDiff) {
                        message += `%cTime Diff       : %c${timeDiff}\n`;
                    }

                    if (viewingInfo) {
                        message += `%cActivity        : %c${viewingInfo}`;
                    } else {
						message += `%cActivity        : %cNo activity found`;
					}

                    return {
                        username,
                        status: isBanned,
                        message
                    };
                } else {
                    console.warn(`Unexpected response for ID ${currentId}:`, data);
                    return {
                        username: 'Not Found',
                        status: false,
                        message: ''
                    };
                }
            } catch (error) {
                console.error(`Error processing ID ${currentId}:`, error);
                return {
                    username: 'Not Found',
                    status: false,
                    message: ''
                };
            }
        }

        function extractTimestamp(content, type) {
            const regex = new RegExp(`<dt>${type}<\\/dt>\\s*<dd[^>]*>\\s*<time[^>]*data-timestamp="(\\d+)"`, 'i');
            const match = content.match(regex);
            return match ? parseInt(match[1]) * 1000 : null;
        }


        /**
         * Handle a single user
         *
         * @param {string|number} userId - The user ID
         */
        async function processUser(currentId) {
            const isBanned = await checkIfUserBanned(currentId);
			
            if (isBanned.status === true) {
                spamCount++;
                // Added: mark pre-banned user to exclude from new lists
                bannedBeforeSet.add(currentId.toString());
                logMessage(`User %c${isBanned.username}%c had been banned before. `,
                    ['color: red; font-weight: bold;', ''],
					`Link: ${VOZ_BASE_URL}/u/${currentId}/#about`);

                return;
            }
			
			tmpKeyword = '';

            const url = `${VOZ_BASE_URL}/u/${currentId}/about?_xfResponseType=json&_xfWithData=1`;
            try {
                const result = await apiManager.fetchWithErrorHandling(url);
                if (!result.success) {
                    console.error(`Failed to fetch data for ID: ${currentId}`);
                    return;
                }
				// Normalize + strip helper
				const norm = (s) => (s || '')
					.normalize('NFKC')
					.replace(/[\u200B\u200C\u200D\uFEFF]/g, ''); // zero-width

                const data = await result.response.json();
                if (data.status === "ok") {
                    let rawcontent = data.html?.content?.toLowerCase() || "";

                    if (rawcontent.includes('following')) {
                        rawcontent = rawcontent.substring(0, rawcontent.indexOf('following'));
                    } else if (rawcontent.includes('followers')) {
                        rawcontent = rawcontent.substring(0, rawcontent.indexOf('followers'));
                    } else if (rawcontent.includes('trophies')) {
                        rawcontent = rawcontent.substring(0, rawcontent.indexOf('trophies'));
                    }
                    const rawTitle = data.html?.title || "";
                    const title = rawTitle?.toLowerCase() || "";
                    const content = stripHtmlTags(rawcontent);

                    const text1 = "contact direct message send direct message";
                    const text2 = `${title} has not provided any additional information.`;
                    const cleanedContent = content.replace(text1, '').replace(text2, '').trim();

                    let isSpam = false;
                    let matchedKeyword = null;

					const candidateName = norm(rawTitle || title);
					if (spamUsernameRegex.test(candidateName)) {
						matchedKeyword = candidateName.match(spamUsernameRegex)[0];
					}
                    if (cleanedContent) {
                        logMessage(
                            `Processing user : %c${rawTitle}\n${isBanned.message}\n%c` +
							`Profile Link    : %c${VOZ_BASE_URL}/u/${currentId}/#about\n` +
							`HTML content    ↓\n%c${cleanedContent}`,
                            ['color: #17f502; font-weight: bold;',
                            // style groups for message fields
                            'color: gray;', 'color: gold; font-weight: bold;',
                            'color: gray;', 'color: cyan;',
                            'color: gray;', 'color: orange;',
                            'color: gray;', 'color: lightgreen;',
                            'color: gray;', 'color: pink;',
                            // profile link
                            'color: gray;', 'color: orange;',
                            // cleaned content
                            'color: yellow; font-family: monospace;']
							);
						//to review list if user has content In about page
						addToReview(currentId, candidateName);
                        // Check within the content
                        if (spamKeywordRegex.test(cleanedContent)) {
                            matchedKeyword = cleanedContent.match(spamKeywordRegex)[0];
                        }

                        if (!matchedKeyword && websiteRegex.test(cleanedContent)) {
                            let mKeyword = cleanedContent.match(websiteRegex)[1];
                            logMessage(`User %c${rawTitle}%c detected as spammer based on Website %c${mKeyword}%c.\nPlease review and consider to ban this user!`,
                                ['color: red; font-weight: bold; padding: 2px;', '', 'color: red; font-weight: bold; padding: 2px;', 'color: yellow; font-weight: bold; padding: 2px;']);
                            reviewBan.push(`${rawTitle} - ${mKeyword}: ${VOZ_BASE_URL}/u/${currentId}/#about`);
                        }
                    } else {
                        logMessage(
                            `Processing user : %c${rawTitle}\n${isBanned.message}\n%c` +
							`Profile Link    : %c${VOZ_BASE_URL}/u/${currentId}/#about`,
                            ['color: #17f502; font-weight: bold;',
                            // style groups for message fields
                            'color: gray;', 'color: gold; font-weight: bold;',
                            'color: gray;', 'color: cyan;',
                            'color: gray;', 'color: orange;',
                            'color: gray;', 'color: lightgreen;',
                            'color: gray;', 'color: pink;',
                            // profile link
                            'color: gray;', 'color: orange;']);
                    }
					if (matchedKeyword) {
                        logMessage(`User %c${rawTitle}%c detected as spammer based on keyword %c${matchedKeyword}%c.`,
                            ['color: red; font-weight: bold; padding: 2px;', '', 'color: red; font-weight: bold; padding: 2px;', '']);
                        isSpam = true;
                        await spamManager.processSpamUser(currentId, rawTitle, matchedKeyword, extendedKeywords);
                    }
                    // If no spam is detected in the profile, check the recent content
                    if (!isSpam) {
                        if (await spamManager.checkRecentContent(currentId, rawTitle, extendedKeywords)) {
                            await spamManager.processSpamUser(currentId, rawTitle, 'recent_content', extendedKeywords);
                        }
                    }
                }
            } catch (error) {
                // Log the first encountered ID with an error to update the range
                if (!firstErrorId) {
                    firstErrorId = currentId;
                    newRange.latestID = firstErrorId;
                }
                console.error(`Error processing ID: ${currentId}`, error);
            }
        }

        // Update the processed range
        await rangeManager.setLastRange(newRange);

        const sortedSpamList = spamList.sort((a, b) => {
            const aIncludesSupport = a.includes("recent_content") ? 1 : 0;
            const bIncludesSupport = b.includes("recent_content") ? 1 : 0;
            return aIncludesSupport - bIncludesSupport;
        });

        if (sortedSpamList.length > 0) {
			logMessage('%cSpam List:', ['background: #02f55b; color: white; padding: 2px;']);
			sortedSpamList.forEach(item => {
				const [usernamePart, linker] = item.split(": ");
				logMessage(
					`%c${usernamePart}: `,
					[
						'color: red; font-weight: bold;'
					],
					linker
				);
			});
		}

		if (reviewBan.length > 0) {
			logMessage('%cReview Ban List:', ['background: yellow; color: black; padding: 2px;']);
			reviewBan.forEach(item => {
				const [usernamePart, linker] = item.split(": ");
				logMessage(
					`%c${usernamePart}: `,
					[
						'color: yellow; font-weight: bold;'
					],
					linker
				);
			});
		}

        // ===== Added: Build and print custom lists with global uniqueness & priority =====
        try {
            // Build ID sets
            const reviewBanIds = new Set(reviewBan
				.map(x => {
					const m = x.match(/\/u\/(\d+)/);
					return m ? m[1] : null;
				})
				.filter(Boolean)
			);
			const needsReviewIds = new Set(
				(spamList || [])
				.filter(item => item.includes("recent_content"))
				.map(item => (item.match(/\/u\/(\d+)/) || [])[1])
				.filter(Boolean)
				.map(String)
			);


			// Deduplicate candidate arrays by ID (keep first occurrence)
			const uniqActive = new Map();
			for (const item of activeUnder10) {
				if (!uniqActive.has(item.id)) uniqActive.set(item.id, item);
			}
			const uniqSenior = new Map();
			for (const item of seniorMembers) {
				if (!uniqSenior.has(item.id)) uniqSenior.set(item.id, item);
			}

			// Exclude banned (current run + pre-existing)
			const isExcluded = (id) => spamUserIds.has(id) || bannedBeforeSet.has(id);

			// ✅ Priority: ReviewBan > Senior > Active<10'
			const chosenSenior = [];
			for (const item of uniqSenior.values()) {
				if (isExcluded(item.id)) continue;
				if (reviewBanIds.has(item.id) || needsReviewIds.has(item.id)) continue;
				chosenSenior.push(item);
			}

			const chosenActive = [];
			for (const item of uniqActive.values()) {
				if (isExcluded(item.id)) continue;
				if (reviewBanIds.has(item.id) || needsReviewIds.has(item.id)) continue;
				// Exclude anything already in Senior
				if (chosenSenior.find(a => a.id === item.id)) continue;
				chosenActive.push(item);
			}

			// ✅ Sort active members and senior members ascending by minutes (shortest active time first)
			chosenActive.sort((a, b) => (a.minutes ?? 0) - (b.minutes ?? 0));
			chosenSenior.sort((a, b) => (a.minutes ?? 0) - (b.minutes ?? 0));


            // Pretty print
            printUsers("Active time < 10' (minutes)", 'purple', chosenActive);
			printUsers('Senior Members', 'teal', chosenSenior);
        } catch (e) {
            console.warn('Failed to build custom lists:', e);
        }
		// Notify if there are users that need further review
        const matches = sortedSpamList.filter(item => item.includes("recent_content"));
        if ((matches.length + reviewBan.length) > 0) {
            alert(`There are ${matches.length + reviewBan.length} user(s) that need to review ban.`);
        }
		logMessage(`Finished cleaning %c${spamCount}%c spammers!`, ['background: green; color: white; padding: 2px;', '']);
        spamManager.setSpamCount(spamCount);

        const finalResult = {
            status: 'success',
            spamList: sortedSpamList,
            banFails: banFails,
            reviewBan: reviewBan,
            spamCount: spamCount
        };
        return finalResult;
    }

    /**
     * Add a spam cleanup button to the navigation bar
     *
     * @returns {Object} UI elements and update function
     */
    function addSpamCleanerToNavigation() {
        const navList = document.querySelector('.p-nav-list.js-offCanvasNavSource');
        const footerList = document.querySelector("#footer > div > div.p-footer-row > div.p-footer-row-main > ul");
        if (!navList && !footerList) return;

        if (document.getElementById('spam-cleaner-button')) {
            return {
                cleanButton: document.getElementById('spam-cleaner-button'),
                autorunButton: document.getElementById('autorun-button'),
                progressTracker: document.getElementById('voz-spam-cleaner-tracker'),
                updateProgress: function (message, color = 'black') {
                    const progressText = document.querySelector('#voz-spam-cleaner-tracker span');
                    if (progressText) {
                        progressText.textContent = `${message}`;
                        progressText.style.color = color;
                    }
                }
            };
        }

        const navItem = document.createElement('li');
        navItem.className = 'p-navEl';
        const container = document.createElement('div');
        container.className = 'p-navEl-link vn-quick-link';
        container.style.display = 'inline-flex';
        container.style.alignItems = 'left';

        // Create cleanup button
        const cleanButton = document.createElement('button');
        cleanButton.id = 'spam-cleaner-button';
        cleanButton.textContent = 'Clean Now';
        cleanButton.style.cssText = `
        margin-right: 10px;
        color: white;
        border: none;
        padding: 5px 10px;
        border-radius: 5px;
        background-color: #007bff;
        font-size: 12px;
        cursor: pointer;
    `;

        // Create auto-run button
        const autorunButton = document.createElement('button');
        autorunButton.id = 'autorun-button';
        autorunButton.style.cssText = `
        margin-right: 10px;
        color: white;
        border: none;
        padding: 5px 10px;
        border-radius: 5px;
        background-color: #007bff;
        font-size: 12px;
        cursor: pointer;
    `;
        const storedAutorun = storageManager.get(AUTORUN_KEY, 'OFF');
        autorunButton.textContent = storedAutorun === 'OFF' ? `Autorun: ${storedAutorun}` : `Autorun: ${storedAutorun} mins`;

        // Create progress tracker
        const progressTracker = document.createElement('div');
        progressTracker.id = 'voz-spam-cleaner-tracker';
        progressTracker.style.cssText = `
        display: inline-flex;
        align-items: center;
        background-color: #f0f0f0;
        padding: 5px 10px;
        border-radius: 5px;
        font-size: 12px;
    `;
        const progressText = document.createElement('span');
        progressText.textContent = `Spam Cleaner: Idle. Last clean: ${spamManager.getSpamCount()} spammers.`;
        progressTracker.appendChild(progressText);

        // Add elements to the container
        container.appendChild(cleanButton);
        container.appendChild(autorunButton);
        container.appendChild(progressTracker);
        navItem.appendChild(container);

        // Add to the appropriate position based on the device
        if (memberManager.isUserUsingMobile() && footerList) {
            footerList.appendChild(navItem);
        } else if (navList) {
            navList.appendChild(navItem);
        }

        return {
            cleanButton,
            autorunButton,
            progressTracker,
            updateProgress: function (message, color = 'black') {
                progressText.textContent = `${message}`;
                progressText.style.color = color;
            }
        };
    }

    /**
     * Schedule and manage the automatic spam cleanup process
     */
    function scheduleCleanAllSpamer() {
        // Status of the cleanup process
        const state = {
            isRunning: false,
            countdownInterval: null,
            remainingTime: 0
        };

        // Create user interface
        const { cleanButton, autorunButton, progressTracker, updateProgress } = addSpamCleanerToNavigation();

        /**
         * Run the spam cleanup process
         */
        async function runCleanSpamer() {
            if (state.isRunning) {
                logMessage('Clean process is still running. Skipping...');
                updateProgress('Spam Cleaner: Running...', 'blue');
                return;
            }

            let wasCountdownRunning = false;
            if (state.countdownInterval) {
                clearInterval(state.countdownInterval);
                wasCountdownRunning = true;
            }

            try {
                state.isRunning = true;
                updateUIForCleaning(true);
                const result = await cleanAllSpamer(false);

                if (result.status === 'success') {
                    updateProgress(`Cleaned ${result.spamCount} spammers`, 'green');
                    logMessage('Spam cleaning completed', result);
                } else {
                    updateProgress(`Error: ${result.message || 'Unknown error'}`, 'red');
                    console.error('Error during spam cleaning:', result);
                }

                await new Promise(res => setTimeout(res, 2000));
            } catch (error) {
                console.error('Error when cleaning spammer:', error);
                updateProgress(`Error: ${error.message || error}`, 'red');
            } finally {
                updateUIForCleaning(false);
                state.isRunning = false;

                // Restore the countdown if needed
                const storedAutorun = storageManager.get(AUTORUN_KEY, 'OFF');
                if (storedAutorun !== 'OFF' && wasCountdownRunning && state.remainingTime > 0) {
                    startCountdown(state.remainingTime / 60);
                } else if (!wasCountdownRunning || storedAutorun === 'OFF') {
                    updateProgress(`Spam Cleaner: Idle. Last clean: ${spamManager.getSpamCount()} spammers.`);
                }
            }
        }

        /**
         * Update the user interface during the cleanup process
         *
         * @param {boolean} isCleaning - Whether the cleanup is in progress
         */
        function updateUIForCleaning(isCleaning) {
            cleanButton.disabled = isCleaning;
            autorunButton.disabled = isCleaning;
            cleanButton.style.backgroundColor = isCleaning ? '#6c757d' : '#007bff';
            autorunButton.style.backgroundColor = isCleaning ? '#6c757d' : '#007bff';
            if (isCleaning) {
                updateProgress('Spam Cleaner: Running...', 'blue');
            }
        }

        /**
         * Start the countdown for the next cleanup
         *
         * @param {number} minutes - The countdown time in minutes
         */
        function startCountdown(minutes) {
            state.remainingTime = minutes * 60;

            // Clear the current interval if it exists
            if (state.countdownInterval) {
                clearInterval(state.countdownInterval);
            }

            state.countdownInterval = setInterval(() => {
                if (!state.isRunning) {
                    const minutesLeft = Math.floor(state.remainingTime / 60);
                    const seconds = state.remainingTime % 60;
                    updateProgress(`Last clean: ${spamManager.getSpamCount()} spammers. Wait ${minutesLeft}:${seconds.toString().padStart(2, '0')} before next clean...`, '#6494d3');
                }
                if (--state.remainingTime < 0) {
                    clearInterval(state.countdownInterval);
                    state.countdownInterval = null;
                    runCleanSpamer();
                }
            }, 1000);
        }

        /**
         * Toggle auto-cleanup mode
         */
        function toggleAutorun() {
            if (state.isRunning) {
                logMessage('Cannot change autorun settings while cleaning is running.');
                return;
            }

            // Get the current state
            let currentState = storageManager.get(AUTORUN_KEY, 'OFF');
            const currentIndex = autorunStates.indexOf(currentState);

            // Move to the next state
            const nextIndex = (currentIndex + 1) % autorunStates.length;
            const nextState = autorunStates[nextIndex];

            // Save the new state
            storageManager.set(AUTORUN_KEY, nextState);
            autorunButton.textContent = nextState === 'OFF' ? `Autorun: ${nextState}` : `Autorun: ${nextState} mins`;

            // Clear the current countdown if it exists
            if (state.countdownInterval) {
                clearInterval(state.countdownInterval);
                state.countdownInterval = null;
            }

            // Update the status based on the new settings
            if (nextState === 'OFF') {
                updateProgress(`Spam Cleaner: Idle. Last clean: ${spamManager.getSpamCount()} spammers.`);
            } else {
                startCountdown(parseInt(nextState));
            }
        }

        /**
         * Initialize event listeners
         */
        function initialize() {
            // Prevent registering event listeners multiple times
            if (!cleanButton.hasAttribute('data-initialized')) {
                cleanButton.setAttribute('data-initialized', 'true');

                cleanButton.addEventListener('click', async() => {
                    await runCleanSpamer();
                });

                autorunButton.addEventListener('click', toggleAutorun);

                // Restore the auto-run status from the previous session
                const storedAutorun = storageManager.get(AUTORUN_KEY);
                if (storedAutorun && storedAutorun !== 'OFF') {
                    startCountdown(parseInt(storedAutorun));
                }
            }
        }

        // Initialize the schedule
        initialize();
    }

    /**
     * Initialize the script
     */
    async function init() {
        if (window.location.hostname === 'voz.vn') {
            // Request app key if not available
            if (!storageManager.get(IGNORE_LIST_KEY) || !storageManager.get(LATEST_RANGE_KEY)) {
                var ignoreAppKey = prompt("// Enter app key for the ignore list:");
                var rangeAppKey = prompt("// Enter app key for the processing range:");

                if (ignoreAppKey) {
                    storageManager.set(IGNORE_LIST_KEY, ignoreAppKey);
                }

                if (rangeAppKey) {
                    storageManager.set(LATEST_RANGE_KEY, rangeAppKey);
                }
            }

            ignoreList = await ignoreListManager.getIgnoreList() || [];
            compileSpamRegex();  // Initial compile

            initializeBanListeners();

            scheduleCleanAllSpamer();
        }
    }

    if (document.readyState === 'complete') {
        init();
    } else if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        window.addEventListener('load', init);
    }
})();

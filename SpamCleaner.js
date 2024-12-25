// ==UserScript==
// @name         vOz Spam Cleaner
// @namespace    https://github.com/TekMonts/vOz
// @author       TekMonts
// @version      1.8
// @description  Spam cleaning tool for voz.vn
// @match        https://voz.vn/*
// @grant        GM_xmlhttpRequest
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// ==/UserScript==

(function () {
    'use strict';
    var ignoreList = [];
    var spamList = [];
    var banFails = [];
    var spamCount = 0;
    const websiteRegex = /<dt>Website<\/dt>\s*<dd>\s*<a[^>]*>([^<]+)<\/a>/i;
    var spamKeywords = ["moscow", "giải trí", "giai tri", "sòng bài", "song bai", "w88", "indonesia", "online gaming", "entertainment", "market", "india", "philipin", "brazil", "spain", "cạnh tranh", "giavang", "giá vàng", "investment", "terpercaya", "slot", "berkualitas", "telepon", "đầu tư", "tư vấn", "hỗ trợ", "chuyên nghiệp", "chất lượng", "sòng bạc", "song bac", "trò chơi", "tro choi", "đổi thưởng", "doi thuong", "game bài", "game bai", "xóc đĩa", "trực tiếp", "truc tiep", "trực tuyến", "truc tuyen", "bóng đá", "bong da", "đá gà", "da ga", "#trangchu", "cược", "ca cuoc", "casino", "daga", "nhà cái", "nhacai", "merch", "betting", "subre", "choangclub", "cá độ", "ca do", "bắn cá", "ban ca", "gamebai", "gamedoithuong", "rikvip", "taixiu", "tài xỉu", "xocdia", "xoso66", "zomclub", "vin88", "nbet", "vip79", "11bet", "123win", "188bet", "1xbet", "23win", "33win", "388bet", "55win", "777king", "77bet", "77win", "789club", "789win", "79king", "888b", "88bet", "88clb", "8day", "8kbet", "8live", "8xbet", "97win", "98win", "99bet", "99ok", "abc8", "ae88", "alo789", "az888", "banca", "bet365", "bet88", "bj38", "bj88", "bong88", "cacuoc", "cado", "cwin", "da88", "debet", "df99", "ee88", "f88", "fabet", "fcb8", "fi88", "five88", "for88", "fun88", "gk88", "go88", "go99", "good88", "hay88", "hb88", "hi88", "ibet", "jun88", "king88", "kubet", "luck8", "lucky88", "lulu88", "mancl", "may88", "mb66", "mibet", "miso88", "mksport", "mu88", "net8", "nohu", "ok365", "okvip", "one88", "qh88", "red88", "rr88", "sbobet", "sin88", "sky88", "soicau247", "sonclub", "sunvin", "sv88", "ta88", "taipei", "tdtc", "thabet", "thomo", "tk88", "twin68", "vn88", "tylekeo", "typhu88", "uk88", "v9bet", "vip33", "vip66", "fb88", "vip77", "vip99", "win88", "xo88", "bet", "club.", "hitclub", "66.", "88.", "68.", "79.", "365.", "f168", "khám phá", "chia sẻ", "may mắn", "lý tưởng", "phát tài", "ưu hóa", "công cụ", "truy cập", "lưu lượng", "trải nghiệm", "massage", "skincare", "healthcare", "jordan", "quality", "wellness", "lifestyle", "trading", "tuhan", "solution", "marketing", "seo expert", "bangladesh", "united states", "protein", "dudoan", "uy tín", "xổ số", "business", "finland", "rongbachkim", "lô đề"];
    var defaultSpamKeywordsCount = spamKeywords.length;
    const isUserUsingMobile = () => {
        let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (!isMobile) {
            let screenWidth = window.screen.width;
            let screenHeight = window.screen.height;
            isMobile = (screenWidth <= 800 || screenHeight <= 600);
        }
        if (!isMobile) {
            isMobile = (('ontouchstart' in window) || navigator.userAgentData.mobile);
        }
        return isMobile;
    }
    async function getSpamKeywords() {
        if (spamKeywords.length > defaultSpamKeywordsCount) {
            return spamKeywords;
        }
        const url = 'https://raw.githubusercontent.com/bigdargon/hostsVN/refs/heads/master/extensions/gambling/hosts-VN';
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const text = await response.text();
            const lines = text.split('\n');
            const uniqueHosts = new Set(spamKeywords);
            for (let line of lines) {
                line = line.trim();
                if (line.startsWith('0.0.0.0')) {
                    const hostPart = line.split(' ')[1];
                    if (hostPart) {
                        const parts = hostPart.split('.');
                        if (parts.length > 1) {
                            const domain = parts.slice(-2).join('.');
                            uniqueHosts.add(domain);
                        }
                    }
                }
            }
            return Array.from(uniqueHosts);
        } catch (error) {
            console.error(`Failed to load content from ${url}:`, error);
            return spamKeywords;
        }
    }
    async function processSpamUser(userId, username, inputKW) {
        if (ignoreList.includes(userId)) {
            console.log(`User %c${username}%c is ignored.`, 'background: green; color: white; padding: 2px;', '');
            return {};
        }
        const baseUrl = 'https://voz.vn';
        const endpoint = `/spam-cleaner/${userId}`;
        const xfToken = document.querySelector('input[name="_xfToken"]').value;
        const userUrl = `https://voz.vn/u/${userId}/about?_xfResponseType=json&_xfWithData=1`;
        let finalKW = inputKW + '';
        let isSpam = !!finalKW?.trim();
        if (!isSpam) {
            await new Promise(resolve => setTimeout(resolve, 100));
            try {
                const response = await fetch(userUrl, {
                    method: 'GET'
                });
                if (response.ok) {
                    const data = await response.json();
                    const content = data.html?.content?.toLowerCase() || "";
                    spamKeywords.some(keyword => {
                        if (content.includes(keyword)) {
                            isSpam = true;
                            finalKW = keyword;
                            console.log(`User %c${username}%c detected as spammer based on keyword %c${keyword}%c.`, 'color: red; font-weight: bold; padding: 2px;', '', 'color: red; font-weight: bold; padding: 2px;', '');
                            return true;
                        }
                        return false;
                    });
                }
            } catch (error) {
                console.error(`Error checking user page for ${username}:`, error);
            }
        }
        if (!isSpam) {
            console.log(`User %c${username}%c is not a spammer. Skipping ban.`, 'background: green; color: white; padding: 2px;', '');
            ignoreList.push(userId);
            return {};
        }
        const formData = new FormData();
        formData.append('_xfToken', xfToken);
        formData.append('action_threads', '1');
        formData.append('delete_messages', '1');
        formData.append('delete_conversations', '1');
        formData.append('ban_user', '1');
        formData.append('no_redirect', '1');
        formData.append('_xfResponseType', 'json');
        formData.append('_xfWithData', '1');
        formData.append('_xfRequestUri', endpoint);
        try {
            const response = await fetch(`${baseUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'include',
                body: formData
            });
            const data = await response.json();
            if (data.status === 'ok') {
                spamCount++;
                spamList.push(`${username} - ${finalKW}: https://voz.vn/u/${userId}/#about`);
                console.log(`%c${username}: ${data.message}`, 'background: blue; color: white; padding: 2px;');
            } else {
                ignoreList.push(userId);
                banFails.push(`${username} - ${finalKW}: https://voz.vn/u/${userId}/#about`);
                console.log(`%c${username}: ${data.errors ? data.errors[0] : 'Unknown error'}`, 'background: yellow; color: black; padding: 2px');
            }
            return data;
        } catch (error) {
            console.error('Error processing spammer:', error);
            throw error;
        }
    }
    async function findNewestMember(autorun) {
        return new Promise((resolve, reject) => {
            let searchForNewest = false;
            let userId = 0;
            const firstMemberElement = document.querySelector('.listHeap li:first-child a') || Array.from(document.querySelectorAll('dl.pairs.pairs--justified dt')).find(dt => dt.textContent.trim() === 'Latest member')?.closest('dl').querySelector('dd a.username');
            const storedRange = localStorage.getItem('latestRange');
            const latestRange = storedRange ? JSON.parse(storedRange) : null;
            if (firstMemberElement) {
                userId = firstMemberElement.getAttribute('data-user-id');
                console.log(`Newest Member User ID in this page: %c${userId}`, 'background: green; color: white; padding: 2px;');
                if (latestRange && parseInt(userId) <= parseInt(latestRange.latestID)) {
                    searchForNewest = true;
                } else {
                    resolve(userId);
                    return;
                }
            } else {
                searchForNewest = true;
            }
            const userPage = 'https://voz.vn/u/';
            if (firstMemberElement && autorun) {
                console.log('Auto run triggred!');
                if (!isUserUsingMobile()) {
                    location.replace(userPage)
                }
                return userId;
            }
            if (searchForNewest) {
                userId = latestRange.latestID;
                const tab = window.open(userPage, '_blank');
                if (!tab) {
                    console.warn('Failed to open tab');
                    if (!isUserUsingMobile()) {
                        location.replace(userPage)
                    }
                    return userId;
                }
                const checkTabInterval = setInterval(() => {
                    try {
                        if (tab.closed) {
                            clearInterval(checkTabInterval);
                            console.warn('Tab was closed unexpectedly');
                            resolve(userId);
                        }
                        if (tab.document.readyState === 'complete') {
                            const firstMember = tab.document.querySelector('.listHeap li:first-child a');
                            if (firstMember) {
                                userId = firstMember.getAttribute('data-user-id');
                                clearInterval(checkTabInterval);
                                tab.close();
                                console.log(`Newest Member User ID: %c${userId}`, 'background: green; color: white; padding: 2px;');
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
                        tab.close();
                        console.warn('Error accessing the tab: ' + error.message);
                        resolve(userId);
                    }
                }, 1000);
            }
        });
    }
    function calSpamCount(spamCount = -1) {
        if (spamCount > -1) {
            localStorage.setItem('latestCount', spamCount);
        }
        return localStorage.getItem('latestCount') || 0;
    }
    async function checkRecentContent(userId, username) {
        const recentUrl = `https://voz.vn/u/${userId}/recent-content?_xfResponseType=json`;

        try {
            const response = await fetch(recentUrl, {
                method: 'GET'
            });

            if (!response.ok) {
                console.error(`Error fetching recent content for ${username}`);
                return false;
            }

            const data = await response.json();

            if (data.html.content.includes("has not posted any content recently")) {
                return false;
            }

            const content = data.html.content.toLowerCase();
            const titleRegex = /<h3 class="contentRow-title">\s*<a[^>]*>([\s\S]*?)<\/a>/gi;
            const titles = [...content.matchAll(titleRegex)];

            for (const title of titles) {
                const titleText = title[1].replace(/<[^>]+>/g, '').trim();
                if (/(https?:\/\/[^\s<]+)/i.test(titleText)) {
                    console.log(
`User %c${username}%c detected as spammer. Title containing URL: %c${titleText}%c`,
                        'color: red; font-weight: bold; padding: 2px;',
                        '',
                        'color: red; font-weight: bold; padding: 2px;',
                        '');
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.error(`Error checking recent content for ${username}:`, error);
            return false;
        }
    }
    async function cleanAllSpamer(autorun) {
        spamList = [];
        spamCount = 0;
        banFails = [];
        var fromID = 0,
        toID = 0;
        try {
            let maxAllow = await findNewestMember(autorun);
            const storedRange = localStorage.getItem('latestRange');
            let latestRange = storedRange ? JSON.parse(storedRange) : null;
            if (latestRange) {
                fromID = latestRange.latestID - 10;
                toID = Math.min(latestRange.latestID + 1000, maxAllow);
            } else {
                fromID = maxAllow - 1000;
                toID = maxAllow;
            }
            toID = Math.min(toID, maxAllow);
            const newRange = {
                fromID,
                toID,
                latestID: toID
            };
            localStorage.setItem('latestRange', JSON.stringify(newRange));
        } catch (error) {
            console.error('Failed to get the member range to process:', error);
            return {
                status: 'Failed to get the member range to process'
            };
        }
        spamKeywords = await getSpamKeywords();
        console.log(`Process to clean all spamer has ID from %c${fromID}%c to %c${toID}%c.`, 'background: green; color: white; padding: 2px;', '', 'background: green; color: white; padding: 2px;', '');
        for (let currentId = fromID; currentId <= toID; currentId++) {
            const url = `https://voz.vn/u/${currentId}/about?_xfResponseType=json&_xfWithData=1`;
            try {
                const response = await fetch(url, {
                    method: 'GET'
                });
                if (!response.ok) {
                    console.error(`Failed to fetch data for ID: ${currentId}`);
                    continue;
                }
                const data = await response.json();
                if (data.status === "ok") {
                    var content = data.html?.content?.toLowerCase() || "";
                    content = content.includes('following') ? content.substring(0, content.indexOf('following')) : content;
                    var title = data.html?.title?.toLowerCase() || "";
                    var matchedKeyword = spamKeywords.find(keyword => content.includes(keyword) || title.includes(keyword));
                    if (matchedKeyword) {
                        console.log(`User %c${title}%c detected as spammer based on keyword %c${matchedKeyword}%c.`, 'color: red; font-weight: bold; padding: 2px;', '', 'color: red; font-weight: bold; padding: 2px;', '');
                        await processSpamUser(currentId, title, matchedKeyword);
                    } else if (content.match(websiteRegex)) {
                        matchedKeyword = content.match(websiteRegex)[1];
                        console.log(`User %c${title}%c detected as spammer based on keyword %c${matchedKeyword}%c.`, 'color: red; font-weight: bold; padding: 2px;', '', 'color: red; font-weight: bold; padding: 2px;', '');
                        await processSpamUser(currentId, title, matchedKeyword);
                    } else if (await checkRecentContent(currentId, title)) {
                        await processSpamUser(currentId, title, 'http_in_title');
                    }
                }
            } catch (error) {
                console.error(`Error processing ID: ${currentId}`, error);
            }
        }
        console.log(`Finished cleaning %c${spamCount}%c spammers!`, 'background: green; color: white; padding: 2px;', '');
        const finalResult = {
            spamList: spamList,
            banFails: banFails
        };
        console.log(spamList.map(item => {
                const [username, link] = item.split(": ");
                return `%c${username}%c: ${link}`;
            }).join('\n'), ...spamList.flatMap(() => ["color: red; font-weight: bold; padding: 1px;", "color: inherit;"]));
        return finalResult;
    }
    function addSpamCleanerToNavigation() {
        const navList = document.querySelector('.p-nav-list.js-offCanvasNavSource');
        const footerList = document.querySelector("#footer > div > div.p-footer-row > div.p-footer-row-main > ul");
        if (!navList && !footerList)
            return;
        const navItem = document.createElement('li');
        navItem.className = 'p-navEl';
        const container = document.createElement('div');
        container.className = 'p-navEl-link vn-quick-link';
        container.style.display = 'inline-flex';
        container.style.alignItems = 'left';
        const button = document.createElement('button');
        button.id = 'spam-cleaner-button';
        button.textContent = 'Clean Now';
        button.style.cssText = `

    margin-right: 10px; 

    color: white; 

    border: none; 

    padding: 5px 10px; 

    border-radius: 5px; 

    background-color: #007bff; 

    font-size: 12px;

`;
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
        progressText.textContent = `Spam Cleaner: Idle. Last clean: ${calSpamCount()} spammers.`;
        progressTracker.appendChild(progressText);
        container.appendChild(button);
        container.appendChild(progressTracker);
        navItem.appendChild(container);
        if (isUserUsingMobile() && footerList) {
            footerList.appendChild(navItem);
        } else if (navList) {
            navList.appendChild(navItem);
        }
        return {
            button,
            progressTracker,
            updateProgress: function (message, color = 'black') {
                progressText.textContent = `${message}`;
                progressText.style.color = color;
            }
        };
    }
    function scheduleCleanAllSpamer() {
        const state = {
            isRunning: false,
            countdownInterval: null,
            timeoutId: null,
            intervalId: null,
            lastActiveTime: Date.now()
        };

        const INTERVALS = {
            INACTIVITY_CHECK: 5 * 60 * 1000,
            CLEAN_INTERVAL: 10 * 60 * 1000,
            INITIAL_DELAY: 5 * 60 * 1000
        };

        const {
            button,
            progressTracker,
            updateProgress
        } = addSpamCleanerToNavigation();

        function updateLastActiveTime() {
            state.lastActiveTime = Date.now();
        }

        function setupActivityListeners() {
            const events = ['mousemove', 'keydown', 'click'];

            if (isUserUsingMobile()) {
                events.push(
                    'touchstart',
                    'touchmove',
                    'touchend',
                    'scroll',
                    'orientationchange');
            }

            events.forEach(event => {
                document.addEventListener(event, updateLastActiveTime);
            });
        }

        function isUserInactive() {
            const inactiveDuration = Date.now() - state.lastActiveTime;
            return inactiveDuration >= INTERVALS.INACTIVITY_CHECK;
        }

        function clearAllTimers() {
            if (state.countdownInterval)
                clearInterval(state.countdownInterval);
            if (state.timeoutId)
                clearTimeout(state.timeoutId);
            if (state.intervalId)
                clearInterval(state.intervalId);

            state.countdownInterval = null;
            state.timeoutId = null;
            state.intervalId = null;
        }

        async function runCleanSpamer(autorun = true) {
            console.clear();

            if (state.isRunning) {
                console.log('Clean process is still running. Skipping...');
                return;
            }

            if (autorun && !isUserInactive()) {
                const activeTimeAgo = Math.round((Date.now() - state.lastActiveTime) / 1000);
                const remainingTime = Math.round((INTERVALS.CLEAN_INTERVAL / 1000) - activeTimeAgo);
                console.log(`User active recently (${activeTimeAgo}s ago). Skipping clean.`);
				updateProgress(`User active recently (${activeTimeAgo}s ago). Skipping clean...`, 'green');
				await new Promise(res => setTimeout(res, 2000));
				clearAllTimers();
                startCountdown(remainingTime - 2);
                return;
            }

            try {
                state.isRunning = true;
                updateUIForCleaning(true);
                clearAllTimers();

                const result = await cleanAllSpamer(autorun);
                updateProgress(`Cleaned ${spamCount} spammers`, 'green');
                console.log('Spam cleaning completed', result);

                await new Promise(res => setTimeout(res, 2000));
                startCountdown(INTERVALS.CLEAN_INTERVAL / 1000);
            } catch (error) {
                console.error('Error when cleaning spammer:', error);
                updateProgress(`Error: ${error}`, 'red');
            } finally {
                calSpamCount(spamCount);
                updateUIForCleaning(false);
                state.isRunning = false;
            }
        }

        function updateUIForCleaning(isCleaning) {
            button.disabled = isCleaning;
            button.style.backgroundColor = isCleaning ? '#6c757d' : '#007bff';
            if (isCleaning) {
                updateProgress('Spam Cleaner: Running...', 'blue');
            }
        }

        function startCountdown(duration) {
            let remainingTime = duration;

            state.countdownInterval = setInterval(() => {
                const minutes = Math.floor(remainingTime / 60);
                const seconds = remainingTime % 60;

                updateProgress(
`Last clean: ${spamCount} spammers. Wait ${minutes}:${seconds.toString().padStart(2, '0')} before next clean...`,
                    '#6494d3');

                if (--remainingTime < 0) {
                    clearInterval(state.countdownInterval);
                    state.countdownInterval = null;
                    runCleanSpamer();
                }
            }, 1000);
        }

        function startScheduler() {
            clearAllTimers();
            state.intervalId = setInterval(() => runCleanSpamer(), INTERVALS.CLEAN_INTERVAL);
        }

        function initialize() {
            setupActivityListeners();

            button.addEventListener('click', async() => {
                if (state.isRunning) {
                    console.log('Clean process is still running. Skipping...');
                    return;
                }

                clearAllTimers();
                await runCleanSpamer(false);
            });

            state.timeoutId = setTimeout(() => runCleanSpamer(false), INTERVALS.INITIAL_DELAY);
            startScheduler();
        }

        initialize();
    }
    function init() {
        if (window.location.hostname === 'voz.vn') {
            scheduleCleanAllSpamer();
        }
    }
    if (document.readyState === 'complete') {
        init();
    } else {
        window.addEventListener('load', init);
    }
})();

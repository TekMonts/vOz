// ==UserScript==
// @name         vOz Spam Cleaner
// @namespace    https://github.com/TekMonts/TekMonts.github.io
// @author       TekMonts
// @version      1.0
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
    var spamKeywords = ["giải trí", "giai tri", "sòng bài", "song bai",
        "sòng bạc", "song bac", "trò chơi", "tro choi", "đổi thưởng",
        "doi thuong", "game bài", "game bai", "xóc đĩa", "trực tiếp",
        "truc tiep", "trực tuyến", "truc tuyen", "bóng đá", "bong da",
        "đá gà", "da ga", "#trangchu", "cược", "ca cuoc", "casino",
        "nhà cái", "nhacai", "merch", "betting", "subre", "choangclub",
        "cá độ", "ca do", "bắn cá", "ban ca", "gamebai", "gamedoithuong",
        "rikvip", "taixiu", "tài xỉu", "xocdia", "xoso66", "zomclub",
        "vin88", "nbet", "vip79", "11bet", "123win", "188bet", "1xbet",
        "23win", "33win", "388bet", "55win", "777king", "77bet", "77win",
        "789club", "789win", "79king", "888b", "88bet", "88clb", "8day",
        "8kbet", "8live", "8xbet", "97win", "98win", "99bet", "99ok",
        "abc8", "ae88", "alo789", "az888", "banca", "bet365", "bet88",
        "bj38", "bj88", "bong88", "cacuoc", "cado", "cwin", "da88",
        "debet", "df99", "ee88", "f88", "fabet", "fcb8", "fi88",
        "five88", "for88", "fun88", "gamebai", "gamedoithuong", "gk88",
        "go88", "go99", "good88", "hay88", "hb88", "hi88", "ibet",
        "jun88", "king88", "kubet", "luck8", "lucky88", "lulu88",
        "mancl", "may88", "mb66", "mibet", "miso88", "mksport",
        "mu88", "nbet", "net8", "nhacai", "nohu", "ok365", "okvip",
        "one88", "qh88", "red88", "rr88", "sbobet", "sin88", "sky88",
        "soicau247", "sonclub", "sunvin", "sv88", "ta88", "taipei101",
        "taixiu", "tdtc", "thabet", "thomo", "tk88", "twin68",
        "tylekeo", "typhu88", "uk88", "v9bet", "vip33", "vip66",
        "vip77", "vip79", "vip99", "win88", "xo88", "xoso66", "bet",
        "6688", "6868", "club.", "hitclub", "88.", "68.", "79.", "365.", "f168"
    ];
    var defaultSpamKeywordsCount = spamKeywords.length;
    var fullMode = false;
    async function getSpamKeywords() {
        if (!fullMode || spamKeywords.length >= defaultSpamKeywordsCount) {
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

    async function loadJSON(url) {
        try {
            const response = await fetch(url, {
                cache: 'no-store',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'include'
            });
            return response.ok ? await response.json() : {};
        } catch (error) {
            console.error(`Failed to load JSON from ${url}:`, error);
            return {};
        }
    }

    async function processSpamUser(userId, username, directClean = false) {
        if (ignoreList.includes(userId)) {
            console.log(`User %c${username}%c is ignored.`, 'background: green; color: white; padding: 2px;', '');
            return {};
        }

        const baseUrl = 'https://voz.vn';
        const endpoint = `/spam-cleaner/${userId}`;

        const xfToken = document.querySelector('input[name="_xfToken"]').value;

        const userUrl = `https://voz.vn/u/${userId}/about?_xfResponseType=json&_xfWithData=1`;

        let isSpam = directClean;
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
                            console.log(
`User %c${username}%c detected as spammer based on keyword %c${keyword}%c.`,
                                'color: red; font-weight: bold; padding: 2px;',
                                '',
                                'color: red; font-weight: bold; padding: 2px;',
                                '');
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
                spamList.push(`${username}: https://voz.vn/u/${userId}/#about`);
                console.log(`%c${username}: ${data.message}`, 'background: blue; color: white; padding: 2px;');
            } else {
                ignoreList.push(userId);
                banFails.push(`${username}: https://voz.vn/u/${userId}/#about`);
                console.log(`%c${username}: ${data.errors ? data.errors[0] : 'Unknown error'}`, 'background: yellow; color: black; padding: 2px');
            }
            return data;
        } catch (error) {
            console.error('Error processing spammer:', error);
            throw error;
        }
    }

    async function findNewestMember() {
        return new Promise((resolve, reject) => {
            let searchForNewest = false;
            let userId = 0;

            const firstMemberElement =
                document.querySelector('.listHeap li:first-child a') ||
                Array.from(document.querySelectorAll('dl.pairs.pairs--justified dt'))
                .find(dt => dt.textContent.trim() === 'Latest member')
                ?.closest('dl')
                .querySelector('dd a.username');

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

            if (searchForNewest) {
                userId = latestRange.latestID;
                const userPage = 'https://voz.vn/u/';
                const tab = window.open(userPage, '_blank');
                if (!tab) {
                    console.warn('Failed to open tab');
                    location.replace(userPage);
                    return;
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
                                const latestUserId = firstMember.getAttribute('data-user-id');
                                clearInterval(checkTabInterval);
                                tab.close();
                                console.log(`Newest Member User ID: %c${latestUserId}`, 'background: green; color: white; padding: 2px;');
                                resolve(latestUserId);
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

                setTimeout(() => {
                    clearInterval(checkTabInterval);
                    if (!tab.closed) {
                        tab.close();
                    }
                    console.warn('Timeout while loading new tab');
                    resolve(userId);
                }, 10000);
            }
        });
    }

    async function getSpamPrefix(id = null) {
        const prefixes = [];

        if (!id) {
            try {
                id = await findNewestMember();
                id = parseInt(id);
            } catch (error) {
                console.error('Failed to find newest member:', error);
                return prefixes;
            }
        }

        if (isNaN(id) || id <= 0) {
            console.error('Invalid user ID');
            return prefixes;
        }
        spamKeywords = await getSpamKeywords();
        for (let currentId = Math.max(1, id - 100); currentId <= id; currentId++) {
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
                    const content = data.html?.content?.toLowerCase() || "";
                    const title = data.html?.title || "";
                    if (spamKeywords.some(keyword => content.includes(keyword))) {
                        const shortPrefix = title.substring(0, 4);
                        const longPrefix = title.substring(0, 5);

                        if (!prefixes.some(p => p.prefix === shortPrefix)) {
                            prefixes.push({
                                prefix: shortPrefix,
                                expand: longPrefix,
                                keyword: spamKeywords.find(keyword => content.includes(keyword)),
                                link: `${title}: https://voz.vn/u/${currentId}/#about`
                            });
                        }
                    }
                }
            } catch (error) {
                console.error(`Error processing ID: ${currentId}`, error);
            }
        }
        return prefixes;
    }

    async function convertKeywordsToPrefixes(keywords) {
        spamKeywords = await getSpamKeywords();
        return keywords.map(keyword => ({
                prefix: keyword.substring(0, 5),
                expand: keyword,
                keyword: keyword,
                link: ''
            }));
    }

    async function cleanSpamerByUserPrefix(prefixesOrKeywords) {
        const prefixes = Array.isArray(prefixesOrKeywords[0]) || typeof prefixesOrKeywords[0] === 'string'
             ? await convertKeywordsToPrefixes(prefixesOrKeywords)
             : prefixesOrKeywords;

        spamList = [];
        spamCount = 0;

        const prefixResults = [];
        function extractUserInfo(iconHtml) {
            const userIdMatch = iconHtml.match(/data-user-id="(\d+)"/);
            const usernameMatch = iconHtml.match(/title="([^"]+)"/);

            if (userIdMatch && usernameMatch) {
                return {
                    userId: userIdMatch[1],
                    username: usernameMatch[1]
                };
            }
            return null;
        }

        for (const prefixObj of prefixes) {
            let processedPrefixes = [prefixObj.prefix, prefixObj.expand];

            for (const prefix of processedPrefixes) {
                let processingComplete = false;
                let processedUsers = 0;
                let ignoredUsers = 0;
                let spammedUsers = 0;
                let processedUserIds = new Set();
                while (!processingComplete) {
                    try {
                        const url = `https://voz.vn/index.php?members/find&_xfResponseType=json&q=${prefix}`;
                        console.log(`Searching: %c${prefix}%c, Processed: %c${processedUsers}`, 'background: green; color: white; padding: 2px;', '', 'background: green; color: white; padding: 2px;');

                        const json = await loadJSON(url);

                        if (!json.results || json.results.length === 0) {
                            processingComplete = true;
                            break;
                        }

                        console.log(`Found: %c${json.results.length}%c user: %c${json.results.map(result => result?.id).filter(id => id).join(", ")}`, 'background: green; color: white; padding: 2px;', '', 'background: green; color: white; padding: 2px;');

                        let processedThisIteration = 0;

                        for (const result of json.results) {
                            if (result && result.iconHtml) {
                                const userInfo = extractUserInfo(result.iconHtml);
                                if (userInfo && !processedUserIds.has(userInfo.userId)) {
                                    processedUserIds.add(userInfo.userId);

                                    try {
                                        const response = await processSpamUser(userInfo.userId, userInfo.username);
                                        if (response.status === 'ok') {
                                            spammedUsers++;
                                        } else {
                                            ignoredUsers++;
                                        }
                                        processedUsers++;
                                        processedThisIteration++;
                                        await new Promise(resolve => setTimeout(resolve, 100));
                                    } catch (error) {
                                        console.error(`Failed to process user ${userInfo.username}:`, error);
                                        ignoredUsers++;
                                    }
                                }
                            }
                        }

                        if (processedThisIteration === 0 ||
                            (ignoredUsers > processedUsers / 2 && processedUsers > 10)) {
                            processingComplete = true;
                        }
                    } catch (error) {
                        console.error(`Error searching for ${prefix}:`, error);
                        processingComplete = true;
                    }
                }

                prefixResults.push({
                    prefix: prefix,
                    processedUsers: processedUsers,
                    spammedUsers: spammedUsers,
                    ignoredUsers: ignoredUsers
                });
            }
        }

        console.log(`Finished cleaning %c${spamCount}%c spammers!`, 'background: green; color: white; padding: 2px;', '');
        const finalResult = {
            spamList: spamList,
            banFails: banFails,
            prefixResults: prefixResults
        };
        console.log(
            spamList.map(item => {
                const [username, link] = item.split(": ");
                return `%c${username}%c: ${link}`;
            }).join('\n'), ...spamList.flatMap(() => ["color: red; font-weight: bold; padding: 1px;", "color: inherit;"]));
        console.log("Spam prefixes:", prefixes);
        console.log("Result:", finalResult);
        return finalResult;
    }

    var latestID = 0;

    async function cleanAllSpamer(fromID = 0, toID = 0) {
        spamList = [];
        spamCount = 0;
        banFails = [];
        try {
            let maxAllow = await findNewestMember();
            const storedRange = localStorage.getItem('latestRange');
            let latestRange = storedRange ? JSON.parse(storedRange) : null;
            if (fromID !== 0 && toID !== 0) {
                const newRange = {
                    fromID,
                    toID,
                    latestID: toID
                };
                localStorage.setItem('latestRange', JSON.stringify(newRange));
            }

            if (fromID === 0 && toID === 0) {
                if (latestRange) {
                    fromID = latestRange.latestID;
                    toID = Math.min(latestRange.latestID + 1000, maxAllow);
                } else {
                    fromID = 1;
                    toID = maxAllow;
                }
            }

            if (fromID !== 0 && toID === 0) {
                if (latestRange) {
                    if (fromID < latestRange.latestID) {
                        toID = latestRange.latestID;
                    } else {
                        toID = Math.min(fromID + 1000, maxAllow);
                    }
                } else {
                    toID = Math.min(fromID + 1000, maxAllow);
                }
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
        console.log(
`Process to clean all spamer has ID from %c${fromID}%c to %c${toID}%c.`,
            'background: green; color: white; padding: 2px;',
            '',
            'background: green; color: white; padding: 2px;',
            '');
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
                        console.log(
`User %c${title}%c detected as spammer based on keyword %c${matchedKeyword}%c.`,
                            'color: red; font-weight: bold; padding: 2px;',
                            '',
                            'color: red; font-weight: bold; padding: 2px;',
                            '');
                        await processSpamUser(currentId, title, true);
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
        console.log(
            spamList.map(item => {
                const [username, link] = item.split(": ");
                return `%c${username}%c: ${link}`;
            }).join('\n'), ...spamList.flatMap(() => ["color: red; font-weight: bold; padding: 1px;", "color: inherit;"]));
        return finalResult;
    }

    function addSpamCleanerToNavigation() {
        const navList = document.querySelector('.p-nav-list.js-offCanvasNavSource');
        const footerList = document.querySelector("#footer > div > div.p-footer-row > div.p-footer-row-main > ul");
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
        button.textContent = 'Clean Spamer Now';
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
        progressText.textContent = 'Spam Cleaner: Idle';
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
                progressText.textContent = `Spam Cleaner: ${message}`;
                progressText.style.color = color;
            }
        };
    }

    function scheduleCleanAllSpamer() {
        let isRunning = false;
        let countdownInterval = null;

        const {
            button,
            progressTracker,
            updateProgress
        } = addSpamCleanerToNavigation();

        async function runCleanSpamer() {
            console.clear();
            if (isRunning) {
                console.log('Clean process is still running. Skipping...');
                return;
            }

            try {
                isRunning = true;
                button.disabled = true;
                button.style.backgroundColor = '#6c757d';
                updateProgress('Running...', 'blue');

                if (countdownInterval) {
                    clearInterval(countdownInterval);
                    countdownInterval = null;
                }

                const result = await cleanAllSpamer();

                updateProgress(`Cleaned ${result.spamList.length} spammers`, 'green');
                console.log('Spam cleaning completed', result);

                startCountdown(30 * 60);

            } catch (error) {
                console.error('Error when cleaning spammer:', error);
                updateProgress(`Error: ${error}`, 'red');
            } finally {
                isRunning = false;
                button.disabled = false;
                button.style.backgroundColor = '#007bff';
            }
        }

        function startCountdown(duration) {
            let remainingTime = duration;

            countdownInterval = setInterval(() => {
                const minutes = Math.floor(remainingTime / 60);
                const seconds = remainingTime % 60;
                updateProgress(`Wait ${minutes}:${seconds.toString().padStart(2, '0')} before next run...`);

                remainingTime--;

                if (remainingTime < 0) {
                    clearInterval(countdownInterval);
                    countdownInterval = null;
                    updateProgress('Idle');
                }
            }, 1000);
        }

        button.addEventListener('click', runCleanSpamer);

        setTimeout(runCleanSpamer, 1 * 60 * 1000);

        setInterval(runCleanSpamer, 30 * 60 * 1000);
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

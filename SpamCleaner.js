// ==UserScript==
// @name         vOz Spam Cleaner
// @namespace    https://github.com/TekMonts/vOz
// @author       TekMonts
// @version      3.6
// @description  Spam cleaning tool for voz.vn
// @match        https://voz.vn/*
// @grant        GM_xmlhttpRequest
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// ==/UserScript==

/**
 * vOz Spam Cleaner - Công cụ tự động phát hiện và xử lý người dùng spam trên diễn đàn voz.vn
 * 
 * Script này hoạt động bằng cách:
 * 1. Quét các thành viên mới
 * 2. Kiểm tra nội dung hồ sơ và bài viết gần đây
 * 3. So sánh với danh sách từ khóa spam
 * 4. Tự động cấm người dùng bị phát hiện là spam
 */
(function () {
    'use strict';
    
    // === CONSTANTS & VARIABLES ===
    
    // Khóa lưu trữ cục bộ cho danh sách bỏ qua và phạm vi xử lý
    const IGNORE_LIST_KEY = 'voz_ignore_list';
    const LATEST_RANGE_KEY = 'voz_latest_range';
    const LATEST_COUNT_KEY = 'latestCount';
    const AUTORUN_KEY = 'vozAutorun';
    const API_BASE_URL = 'https://keyvalue.immanuel.co/api/KeyVal';
    const VOZ_BASE_URL = 'https://voz.vn';
    
    // Giới hạn kích thước cho danh sách bỏ qua (ký tự)
    const IGNORE_LIST_SIZE_LIMIT = 200;
    
    // Danh sách để theo dõi người dùng spam và trạng thái xử lý
    let spamList = [];      // Danh sách người dùng đã bị xử lý là spam
    let ignoreList = [];    // Danh sách người dùng được bỏ qua
    let banFails = [];      // Danh sách người dùng không thể cấm
    let reviewBan = [];     // Danh sách người dùng cần xem xét thêm
    let spamCount = 0;      // Số lượng spam đã xử lý
    
    // Biểu thức chính quy để phát hiện website trong nội dung
    const websiteRegex = /website\s+([^\s]+)/i;
    const urlRegex = /\bhttps?:\/\/[^\s<]+/i;
    
    // Danh sách từ khóa spam và tên người dùng spam
    const spamKeywords = ["keonhacai", "sunwin", "số đề", "finance", "moscow", "bongda", "giải trí", "giai tri", "sòng bài", "song bai", "w88", "indonesia", "online gaming", "entertainment", "market", "india", "philipin", "brazil", "spain", "giavang", "giá vàng", "investment", "terpercaya", "slot", "berkualitas", "telepon", "đầu tư", "fishing game", "game", "sòng bạc", "song bac", "trò chơi", "đánh bạc", "tro choi", "đổi thưởng", "doi thuong", "game bài", "game bai", "xóc đĩa", "bóng đá", "bong da", "đá gà", "da ga", "#trangchu", "cược", "ca cuoc", "casino", "daga", "nhà cái", "nhacai", "merch", "betting", "subre", "cá độ", "ca do", "bắn cá", "ban ca", "gamebai", "gamedoithuong", "rikvip", "taixiu", "tài xỉu", "xocdia", "xoso66", "zomclub", "vin88", "nbet", "vip79", "11bet", "123win", "188bet", "1xbet", "23win", "33win", "388bet", "55win", "777king", "77bet", "77win", "789club", "789win", "79king", "888b", "88bet", "88clb", "8day", "8kbet", "8live", "8xbet", "97win", "98win", "99bet", "99ok", "abc8", "ae88", "alo789", "az888", "banca", "bet365", "bet88", "bj38", "bj88", "bong88", "cacuoc", "cado", "cwin", "da88", "debet", "df99", "ee88", "f88", "fabet", "fcb8", "fi88", "five88", "for88", "fun88", "gk88", "go88", "go99", "good88", "hay88", "hb88", "hi88", "ibet", "jun88", "king88", "kubet", "luck8", "lucky88", "lulu88", "mancl", "may88", "mb66", "mibet", "miso88", "mksport", "mu88", "net8", "nohu", "ok365", "okvip", "one88", "qh88", "red88", "rr88", "sbobet", "sin88", "sky88", "soicau247", "sonclub", "sunvin", "sv88", "ta88", "taipei", "tdtc", "thabet", "thomo", "tk88", "twin68", "vn88", "tylekeo", "typhu88", "uk88", "v9bet", "vip33", "vip66", "fb88", "vip77", "vip99", "win88", "xo88", "bet", "club.", "hitclub", "66.", "88.", "68.", "79.", "365.", "f168", "phát tài", "massage", "skincare", "healthcare", "jordan", "quality", "wellness", "lifestyle", "trading", "tuhan", "solution", "marketing", "seo expert", "bangladesh", "united states", "protein", "dudoan", "xổ số", "business", "finland", "rongbachkim", "lô đề", "gumm", "france", "dinogame", "free", "trang_chu", "hastag", "reserva777", "internacional", "international", "ga6789", "opportunity", "reward", "rate"];
    const spamUserName = ["tinyfish", "choangclub", "sunwin", "rr88", "w88", "gamebai", "gamedoithuong", "trangchu", "rr88", "8xbet", "rongbachkim", "dinogame", "gumm", "nhacai", "cakhia", "merch", "sunvin", "rikvip", "taixiu", "xocdia", "xoso66", "zomclub", "vin88", "nbet", "vip79", "11bet", "123win", "188bet", "1xbet", "23win", "33win", "388bet", "55win", "777king", "77bet", "77win", "789club", "789win", "79king", "888b", "88bet", "88clb", "8day", "8kbet", "8live", "8xbet", "97win", "98win", "99bet", "99ok", "abc8", "ae88", "alo789", "az888", "banca", "bet365", "bet88", "bj38", "bj88", "bong88", "cacuoc", "cado", "cwin", "da88", "debet", "df99", "ee88", "f88", "fabet", "fcb8", "fi88", "five88", "for88", "fun88", "gk88", "go88", "go99", "good88", "hay88", "hb88", "hi88", "ibet", "jun88", "king88", "kubet", "luck8", "lucky88", "lulu88", "mancl", "may88", "mb66", "mibet", "miso88", "mksport", "mu88", "net8", "nohu", "ok365", "okvip", "one88", "qh88", "red88", "sbobet", "sin88", "sky88", "soicau247", "sonclub", "sunvin", "sv88", "ta88", "taipei", "tdtc", "tcdt", "thabet", "thomo", "tk88", "twin68", "vn88", "tylekeo", "typhu88", "uk88", "v9bet", "vip33", "vip66", "fb88", "vip77", "vip99", "win88", "xo88", "f168", "duthuong", "trochoi", "xoilac", "vebo", "reserva777", "ga6789", "finance", "casino"];
    
    // Lưu số lượng từ khóa mặc định để kiểm tra khi cập nhật
    const defaultSpamKeywordsCount = spamKeywords.length;
    
    // Phần tử tạm thời để xử lý HTML
    const tempDiv = document.createElement('div');
    
    // Cấu hình tự động chạy
    const autorunStates = ['OFF', '5', '15', '30'];

    /**
     * Trình quản lý lưu trữ cục bộ với xử lý lỗi tích hợp
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
     * Trình quản lý API với xử lý lỗi tích hợp
     */
    const apiManager = {
        /**
         * Gửi yêu cầu fetch với xử lý lỗi
         * 
         * @param {string} url - URL yêu cầu
         * @param {Object} options - Tùy chọn fetch
         * @returns {Promise<Object>} Kết quả yêu cầu
         */
        async fetchWithErrorHandling(url, options = {}) {
            try {
                const response = await fetch(url, options);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP error ${response.status}: ${response.statusText} - ${errorText}`);
                }
                
                return { success: true, response };
            } catch (error) {
                console.error(`API request failed: ${error.message}`);
                return { success: false, error };
            }
        },
        
        /**
         * Lấy giá trị từ API keyvalue
         * 
         * @param {string} appKey - Khóa ứng dụng
         * @param {string} dataKey - Khóa dữ liệu
         * @param {*} defaultValue - Giá trị mặc định nếu có lỗi
         * @returns {Promise<*>} Dữ liệu từ API
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
         * Cập nhật giá trị lên API keyvalue
         * 
         * @param {string} appKey - Khóa ứng dụng
         * @param {string} dataKey - Khóa dữ liệu
         * @param {*} value - Giá trị cần cập nhật
         * @returns {Promise<boolean>} Kết quả cập nhật
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
     * Trình quản lý danh sách bỏ qua
     */
    const ignoreListManager = {
        /**
         * Lấy danh sách người dùng bị bỏ qua từ API
         * 
         * @returns {Promise<Array>} Mảng chứa ID người dùng bị bỏ qua
         */
        async getIgnoreList() {
            const appKey = storageManager.get(IGNORE_LIST_KEY);
            if (!appKey) return [];
            
            const list = await apiManager.getValue(appKey, 'data', []);
            return Array.isArray(list) ? list : [];
        },
        
        /**
         * Cập nhật danh sách người dùng bị bỏ qua lên API
         * 
         * @param {Array} list - Mảng chứa ID người dùng bị bỏ qua
         * @returns {Promise<boolean>} Kết quả cập nhật
         */
        async setIgnoreList(list) {
            if (!Array.isArray(list)) {
                list = [];
            }
            
            const appKey = storageManager.get(IGNORE_LIST_KEY);
            if (!appKey) return false;
            
            let jsonStr = JSON.stringify(list);
            
            // Giới hạn kích thước danh sách để tránh vượt quá giới hạn API
            while (jsonStr.length > IGNORE_LIST_SIZE_LIMIT && list.length > 0) {
                list.shift(); // Loại bỏ phần tử đầu tiên nếu danh sách quá lớn
                jsonStr = JSON.stringify(list);
            }
            
            return await apiManager.updateValue(appKey, 'data', list);
        },
        
        /**
         * Thêm người dùng vào danh sách bỏ qua
         * 
         * @param {string|number} userId - ID người dùng cần thêm vào danh sách bỏ qua
         * @returns {Promise<boolean>} Kết quả thêm
         */
        async addToIgnoreList(userId) {
            try {
                // Đảm bảo userId là chuỗi
                const userIdStr = userId.toString();
                
                // Lấy danh sách hiện tại
                const currentList = await this.getIgnoreList();
                
                // Kiểm tra nếu đã tồn tại
                if (currentList.includes(userIdStr)) {
                    return true;
                }
                
                // Thêm vào danh sách và cập nhật
                currentList.push(userIdStr);
                return await this.setIgnoreList(currentList);
            } catch (error) {
                console.error(`Error adding ${userId} to ignore list:`, error);
                return false;
            }
        }
    };

    /**
     * Trình quản lý phạm vi xử lý
     */
    const rangeManager = {
        /**
         * Lấy phạm vi ID người dùng đã xử lý gần đây từ API
         * 
         * @returns {Promise<Object|null>} Đối tượng chứa thông tin phạm vi hoặc null nếu có lỗi
         */
        async getLastRange() {
            const appKey = storageManager.get(LATEST_RANGE_KEY);
            if (!appKey) return null;
            
            const rangeArray = await apiManager.getValue(appKey, 'data', null);
            
            if (Array.isArray(rangeArray) && rangeArray.length >= 3) {
                return {
                    fromID: parseInt(rangeArray[0]),
                    toID: parseInt(rangeArray[1]),
                    latestID: parseInt(rangeArray[2])
                };
            }
            
            return null;
        },
        
        /**
         * Cập nhật phạm vi ID người dùng đã xử lý lên API
         * 
         * @param {Object} range - Đối tượng chứa thông tin phạm vi (fromID, toID, latestID)
         * @returns {Promise<boolean>} Kết quả cập nhật
         */
        async setLastRange(range) {
            const appKey = storageManager.get(LATEST_RANGE_KEY);
            if (!appKey) return false;
            
            const rangeArray = [range.fromID, range.toID, range.latestID];
            return await apiManager.updateValue(appKey, 'data', rangeArray);
        }
    };

    /**
     * Trình quản lý spam
     */
    const spamManager = {
        /**
         * Quản lý số lượng spam đã xử lý
         * 
         * @param {number} count - Số lượng spam mới (nếu cần cập nhật)
         * @returns {number} Số lượng spam hiện tại
         */
        getSpamCount() {
            return parseInt(storageManager.get(LATEST_COUNT_KEY, '0'));
        },
        
        /**
         * Cập nhật số lượng spam đã xử lý
         * 
         * @param {number} count - Số lượng spam mới
         * @returns {boolean} Kết quả cập nhật
         */
        setSpamCount(count) {
            return storageManager.set(LATEST_COUNT_KEY, count.toString());
        },
        
        /**
         * Lấy danh sách từ khóa spam từ nguồn bên ngoài và cập nhật danh sách hiện tại
         * 
         * @returns {Promise<Array>} Danh sách từ khóa spam đã cập nhật
         */
        async getSpamKeywords() {
            // Nếu danh sách đã được cập nhật trước đó, trả về danh sách hiện tại
            if (this.extendedKeywords && this.extendedKeywords.length > defaultSpamKeywordsCount) {
                return this.extendedKeywords;
            }
            
            // URL của danh sách tên miền cờ bạc từ dự án hostsVN
            const url = 'https://raw.githubusercontent.com/bigdargon/hostsVN/refs/heads/master/extensions/gambling/hosts-VN';
            try {
                const result = await apiManager.fetchWithErrorHandling(url);
                
                if (!result.success) {
                    this.extendedKeywords = [...spamKeywords];
                    return this.extendedKeywords;
                }
                
                const text = await result.response.text();
                const lines = text.split('\n');
                const uniqueHosts = new Set(spamKeywords);
                
                // Trích xuất tên miền từ danh sách hosts
                for (let line of lines) {
                    line = line.trim();
                    if (line.startsWith('0.0.0.0')) {
                        const hostPart = line.split(' ')[1];
                        if (hostPart) {
                            const parts = hostPart.split('.');
                            if (parts.length > 1) {
                                // Lấy tên miền cấp 2 (ví dụ: example.com từ sub.example.com)
                                const domain = parts.slice(-2).join('.');
                                uniqueHosts.add(domain);
                            }
                        }
                    }
                }
                
                this.extendedKeywords = Array.from(uniqueHosts);
                return this.extendedKeywords;
            } catch (error) {
                console.error(`Failed to load content from ${url}:`, error);
                this.extendedKeywords = [...spamKeywords];
                return this.extendedKeywords;
            }
        },
        
        /**
         * Kiểm tra nội dung gần đây của người dùng để phát hiện spam
         * 
         * @param {string|number} userId - ID của người dùng
         * @param {string} username - Tên người dùng
         * @param {Array} keywords - Danh sách từ khóa spam
         * @returns {Promise<boolean>} true nếu phát hiện spam, false nếu không
         */
        async checkRecentContent(userId, username, keywords) {
            const recentUrl = `${VOZ_BASE_URL}/u/${userId}/recent-content?_xfResponseType=json`;
            
            const result = await apiManager.fetchWithErrorHandling(recentUrl);
            if (!result.success) {
                return false;
            }
            
            try {
                const data = await result.response.json();
                
                // Kiểm tra nếu người dùng không có nội dung gần đây
                if (data.html.content.includes("has not posted any content recently")) {
                    return false;
                }
                
                const content = data.html.content.toLowerCase();
    
                // Biểu thức chính quy để trích xuất nội dung bài viết
                const contentRegex = /<li[^>]*?>[\s\S]*?<h3[^>]*?>\s*<a[^>]*?>((?:<span[^>]*?>[^<]*?<\/span>\s*)*)(.*?)<\/a>[\s\S]*?<li>([^<]+)<\/li>/gi;
                const matches = [...content.matchAll(contentRegex)];
    
                // Kiểm tra từng bài viết
                for (const match of matches) {
                    const titleText = match[2].replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, '').trim();
                    const contentType = match[3].trim().toLowerCase();
                    
                    console.log(`%c${username}%c - %c${contentType}: %c${titleText}`, 'color: #17f502; font-weight: bold; padding: 2px;', '',
                        'color: #02c4f5; font-weight: bold; padding: 2px;',
                        'color: yellow; font-weight: bold; padding: 2px;');
                    
                    // Bỏ qua các bài viết thông thường
                    if (contentType.includes('post #')) {
                        continue;
                    }
    
                    // Kiểm tra bài đăng hồ sơ và chủ đề
                    if (contentType === 'profile post' || contentType === 'thread') {
                        // Kiểm tra URL trong tiêu đề
                        if (urlRegex.test(titleText)) {
                            console.log(`User %c${username}%c detected as spammer. Title contains URL: %c${titleText}%c`,
                                'color: red; font-weight: bold; padding: 2px;', '',
                                'color: red; font-weight: bold; padding: 2px;', '');
                            return true;
                        }
                        
                        // Kiểm tra từ khóa spam trong tiêu đề
                        for (const keyword of keywords) {
                            if (titleText.includes(keyword)) {
                                console.log(`User %c${username}%c detected as spammer. Title contains keyword: %c${keyword}%c`,
                                    'color: red; font-weight: bold; padding: 2px;', '',
                                    'color: red; font-weight: bold; padding: 2px;', '');
                                return true;
                            }
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
         * Xử lý người dùng bị phát hiện là spam
         * 
         * @param {string|number} userId - ID của người dùng
         * @param {string} username - Tên người dùng
         * @param {string} inputKW - Từ khóa spam đã phát hiện (nếu có)
         * @param {Array} keywords - Danh sách từ khóa spam
         * @returns {Promise<Object>} Kết quả xử lý
         */
        async processSpamUser(userId, username, inputKW, keywords) {
            const userIdStr = userId.toString();
            
            // Kiểm tra xem người dùng có trong danh sách bỏ qua không
            const ignoreArray = await ignoreListManager.getIgnoreList();
            
            if (ignoreArray.includes(userIdStr)) {
                console.log(`User %c${username}%c with id %c${userId}%c is ignored.`,
                    'background: green; color: white; padding: 2px;',
                    '',
                    'background: green; color: white; padding: 2px;',
                    '');
                return { status: 'ignored' };
            }
            
            // Chuẩn bị URL và token cho yêu cầu
            const endpoint = `/spam-cleaner/${userId}`;
            const xfTokenElement = document.querySelector('input[name="_xfToken"]');
            
            if (!xfTokenElement) {
                console.error('XF Token not found. User might not be logged in or have permission.');
                return { status: 'error', message: 'XF Token not found' };
            }
            
            const xfToken = xfTokenElement.value;
            const userUrl = `${VOZ_BASE_URL}/u/${userId}/about?_xfResponseType=json&_xfWithData=1`;
            
            let finalKW = inputKW || '';
            let isSpam = !!finalKW?.trim();
            
            // Nếu không có từ khóa spam đầu vào, kiểm tra trang người dùng
            if (!isSpam) {
                await new Promise(resolve => setTimeout(resolve, 100));
                
                const result = await apiManager.fetchWithErrorHandling(userUrl);
                if (result.success) {
                    const data = await result.response.json();
                    const content = data.html?.content?.toLowerCase() || "";
                    
                    // Kiểm tra từ khóa spam trong nội dung
                    for (const keyword of keywords) {
                        if (content.includes(keyword)) {
                            isSpam = true;
                            finalKW = keyword;
                            console.log(`User %c${username}%c detected as spammer based on keyword %c${keyword}%c.`, 
                                'color: red; font-weight: bold; padding: 2px;', '', 
                                'color: red; font-weight: bold; padding: 2px;', '');
                            break;
                        }
                    }
                }
            }
            
            // Nếu không phải là spam, thêm vào danh sách bỏ qua và bỏ qua
            if (!isSpam) {
                console.log(`User %c${username}%c is not a spammer. Skipping ban.`, 
                    'background: green; color: white; padding: 2px;', '');
                await ignoreListManager.addToIgnoreList(userId);
                return { status: 'not_spam' };
            }
            
            // Xác định cài đặt xóa dữ liệu dựa trên loại spam
            const shouldDelData = finalKW === 'recent_content' ? '0' : '1';
            const urlSubfix = finalKW === 'recent_content' ? 'recent-content' : 'about';
            
            // Thêm vào danh sách xem xét nếu từ khóa chứa URL
            if (finalKW.includes("http")) {
                reviewBan.push(`${username} - ${finalKW}: ${VOZ_BASE_URL}/u/${userId}/#about`);
            }
            
            // Chuẩn bị dữ liệu biểu mẫu để gửi yêu cầu cấm
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
                // Gửi yêu cầu cấm người dùng
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
                    console.log(`%c${username}: Ban failed`, 'background: yellow; color: black; padding: 2px');
                    return { status: 'ban_failed', error: result.error };
                }
                
                const data = await result.response.json();
                
                // Xử lý kết quả
                if (data.status === 'ok') {
                    spamCount++;
                    spamList.push(`${username} - ${finalKW}: ${VOZ_BASE_URL}/u/${userId}/#${urlSubfix}`);
                    console.log(`%c${username}: ${data.message}`, 'background: #02f55b; color: white; padding: 2px;');
                    return { status: 'banned', message: data.message };
                } else {
                    await ignoreListManager.addToIgnoreList(userId);
                    banFails.push(`${username} - ${finalKW}: ${VOZ_BASE_URL}/u/${userId}/#${urlSubfix}`);
                    console.log(`%c${username}: ${data.errors ? data.errors[0] : 'Unknown error'}`, 
                        'background: yellow; color: black; padding: 2px');
                    return { status: 'ban_failed', errors: data.errors };
                }
            } catch (error) {
                console.error('Error processing spammer:', error);
                return { status: 'error', message: error.message };
            }
        }
    };

    /**
     * Trình quản lý thành viên
     */
    const memberManager = {
        /**
         * Kiểm tra xem người dùng có đang sử dụng thiết bị di động hay không
         * 
         * @returns {boolean} true nếu người dùng đang sử dụng thiết bị di động
         */
        isUserUsingMobile() {
            // Kiểm tra dựa trên User-Agent
            let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            // Kiểm tra dựa trên kích thước màn hình
            if (!isMobile) {
                let screenWidth = window.screen.width;
                let screenHeight = window.screen.height;
                isMobile = (screenWidth <= 800 || screenHeight <= 600);
            }
            
            // Kiểm tra dựa trên tính năng cảm ứng
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
         * Tìm ID của thành viên mới nhất
         * 
         * @param {boolean} autorun - Có tự động chuyển hướng không
         * @returns {Promise<number|string>} ID của thành viên mới nhất
         */
        async findNewestMember(autorun) {
            let searchForNewest = false;
            let userId = 0;
            
            // Tìm phần tử chứa thông tin thành viên mới nhất trong trang hiện tại
            const firstMemberElement = document.querySelector('.listHeap li:first-child a') ||
                Array.from(document.querySelectorAll('dl.pairs.pairs--justified dt'))
                .find(dt => dt.textContent.trim() === 'Latest member')
                ?.closest('dl').querySelector('dd a.username');
    
            // Lấy phạm vi xử lý gần đây
            let latestRange = await rangeManager.getLastRange();
    
            // Xử lý khi tìm thấy phần tử thành viên mới nhất
            if (firstMemberElement) {
                userId = firstMemberElement.getAttribute('data-user-id');
                console.log(`Newest Member User ID in this page: %c${userId}`, 'background: green; color: white; padding: 2px;');
                
                // Nếu ID nhỏ hơn hoặc bằng ID đã xử lý gần đây, cần tìm thêm
                if (latestRange && parseInt(userId) <= parseInt(latestRange.latestID)) {
                    searchForNewest = true;
                } else {
                    return userId;
                }
            } else {
                searchForNewest = true;
            }
    
            const userPage = `${VOZ_BASE_URL}/u/`;
            
            // Xử lý khi chế độ tự động chạy được kích hoạt
            if (firstMemberElement && autorun) {
                console.log('Auto run triggred!');
                if (!this.isUserUsingMobile()) {
                    location.replace(userPage);
                }
                return userId;
            }
    
            // Tìm kiếm thành viên mới nhất bằng cách mở tab mới
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
    
                    // Sử dụng Promise để đợi kết quả từ tab mới
                    return new Promise((resolve) => {
                        const checkTabInterval = setInterval(() => {
                            try {
                                // Kiểm tra nếu tab đã đóng
                                if (tab.closed) {
                                    clearInterval(checkTabInterval);
                                    console.warn('Tab was closed unexpectedly');
                                    resolve(userId);
                                    return;
                                }
                                
                                // Kiểm tra khi trang đã tải xong
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
                                try {
                                    tab.close();
                                } catch (e) {
                                    // Ignore errors when closing tab
                                }
                                console.warn('Error accessing the tab: ' + error.message);
                                resolve(userId);
                            }
                        }, 1000);
                        
                        // Đặt timeout để tránh treo
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
     * Loại bỏ thẻ HTML từ chuỗi
     * 
     * @param {string} html - Chuỗi HTML cần xử lý
     * @returns {string} Chuỗi văn bản đã được xử lý
     */
    function stripHtmlTags(html) {
        if (!html) return '';
        
        tempDiv.innerHTML = html;
        let text = tempDiv.textContent || tempDiv.innerText || '';
        text = text.replace(/\s+/g, ' ').trim();
        return text;
    }

    /**
     * Thiết lập trình lắng nghe cho các biểu mẫu gỡ cấm
     * Khi người dùng được gỡ cấm, tự động thêm vào danh sách bỏ qua
     */
    function setupLiftBanListeners() {
        const liftBanForms = document.querySelectorAll('form[action*="/ban/lift"]');

        liftBanForms.forEach(form => {
            // Trích xuất userId từ URL hành động của biểu mẫu
            const userId = form.action.match(/\/u\/[^.]+\.(\d+)\/ban\/lift/)?.[1];

            if (userId) {
                const submitButton = form.querySelector('button[type="submit"]');
                if (submitButton && !submitButton.hasAttribute('data-voz-listener')) {
                    submitButton.setAttribute('data-voz-listener', 'true');
                    submitButton.addEventListener('click', async function (e) {
                        try {
                            await ignoreListManager.addToIgnoreList(userId);
                            console.log(`Added ${userId} to ignore list after lift ban`);
                        } catch (error) {
                            console.error(`Error adding ${userId} to ignore list:`, error);
                        }
                    });
                }
            }
        });
    }

    /**
     * Khởi tạo trình quan sát DOM để theo dõi các thay đổi và thiết lập trình lắng nghe
     */
    function initialize() {
        // Tạo MutationObserver để theo dõi các thay đổi DOM
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length) {
                    setupLiftBanListeners();
                }
            });
        });

        // Cấu hình và bắt đầu quan sát
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Thiết lập trình lắng nghe ban đầu
        setupLiftBanListeners();
    }

    /**
     * Dọn dẹp tất cả người dùng spam trong một phạm vi ID
     * 
     * @param {boolean} autorun - Có tự động chuyển hướng không
     * @returns {Promise<Object>} Kết quả dọn dẹp
     */
    async function cleanAllSpamer(autorun) {
        console.clear();
        spamList = [];
        spamCount = 0;
        banFails = [];
        reviewBan = [];
        
        let fromID = 0;
        let toID = 0;
        let newRange = {};
        
        try {
            // Tìm ID thành viên mới nhất và xác định phạm vi xử lý
            let maxAllow = await memberManager.findNewestMember(autorun);
            let latestRange = await rangeManager.getLastRange();
            
            // Xác định phạm vi ID cần xử lý
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
        
        // Cập nhật danh sách từ khóa spam
        const extendedKeywords = await spamManager.getSpamKeywords();
        console.log(`Process to clean all spamer has ID from %c${fromID}%c to %c${toID}%c.`, 
            'background: green; color: white; padding: 2px;', '', 
            'background: green; color: white; padding: 2px;', '');

        let firstErrorId = null;
        const batchSize = 5; // Số lượng yêu cầu đồng thời
        const delay = 200; // Độ trễ giữa các lô (ms)
        
        // Xử lý theo lô để tránh quá tải
        for (let startId = fromID; startId <= toID; startId += batchSize) {
            const endId = Math.min(startId + batchSize - 1, toID);
            const processingPromises = [];
            
            // Tạo các promise cho mỗi ID trong lô
            for (let currentId = startId; currentId <= endId; currentId++) {
                processingPromises.push(processUser(currentId));
            }
            
            // Đợi tất cả các promise trong lô hoàn thành
            await Promise.all(processingPromises);
            
            // Thêm độ trễ giữa các lô
            if (endId < toID) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        // Hàm xử lý một người dùng
        async function processUser(currentId) {
            const url = `${VOZ_BASE_URL}/u/${currentId}/about?_xfResponseType=json&_xfWithData=1`;
            try {
                const result = await apiManager.fetchWithErrorHandling(url);
                if (!result.success) {
                    console.error(`Failed to fetch data for ID: ${currentId}`);
                    return;
                }
                
                const data = await result.response.json();
                if (data.status === "ok") {
                    // Trích xuất và xử lý nội dung hồ sơ
                    let rawcontent = data.html?.content?.toLowerCase() || "";
                    
                    // Cắt bỏ phần không liên quan
                    if (rawcontent.includes('following')) {
                        rawcontent = rawcontent.substring(0, rawcontent.indexOf('following'));
                    } else if (rawcontent.includes('followers')) {
                        rawcontent = rawcontent.substring(0, rawcontent.indexOf('followers'));
                    } else if (rawcontent.includes('trophies')) {
                        rawcontent = rawcontent.substring(0, rawcontent.indexOf('trophies'));
                    }
                    
                    const title = data.html?.title?.toLowerCase() || "";
                    const content = stripHtmlTags(rawcontent);
                    
                    // Loại bỏ nội dung không liên quan
                    const text1 = "contact direct message send direct message";
                    const text2 = `${title} has not provided any additional information.`;
                    const cleanedContent = content.replace(text1, '').replace(text2, '').trim();
                    
                    let isSpam = false;
                    let matchedKeyword = null;
                    
                    if (cleanedContent) {
                        console.log(`Processing user: %c${title}%c -  ${VOZ_BASE_URL}/u/${currentId}/#about\n%c${cleanedContent}`,
                            'color: #17f502; font-weight: bold; padding: 2px;',
                            '',
                            'color: yellow; font-weight: bold; padding: 2px;');
                        
                        // Kiểm tra từ khóa spam trong tên người dùng
                        matchedKeyword = spamUserName.find(keyword => title.includes(keyword));
                        
                        // Nếu không tìm thấy trong tên, kiểm tra trong nội dung
                        if (!matchedKeyword) {
                            matchedKeyword = extendedKeywords.find(keyword => cleanedContent.includes(keyword));
                        }
                        
                        if (matchedKeyword) {
                            console.log(`User %c${title}%c detected as spammer based on keyword %c${matchedKeyword}%c.`, 
                                'color: red; font-weight: bold; padding: 2px;', '', 
                                'color: red; font-weight: bold; padding: 2px;', '');
                            isSpam = true;
                            await spamManager.processSpamUser(currentId, title, matchedKeyword, extendedKeywords);
                        } else if (websiteRegex.test(cleanedContent)) {
                            // Kiểm tra website trong nội dung
                            matchedKeyword = cleanedContent.match(websiteRegex)[1];
                            console.log(`User %c${title}%c detected as spammer based on Website %c${matchedKeyword}%c.\nPlease review and consider to ban this user!`, 
                                'color: red; font-weight: bold; padding: 2px;', '', 
                                'color: red; font-weight: bold; padding: 2px;', 
                                'color: yellow; font-weight: bold; padding: 2px;');
                            isSpam = true;
                            reviewBan.push(`${title} - ${matchedKeyword}: ${VOZ_BASE_URL}/u/${currentId}/#about`);
                        }
                    } else {
                        console.log(`Processing user: %c${title}%c - ${VOZ_BASE_URL}/u/${currentId}`,
                            'color: #17f502; font-weight: bold; padding: 2px;',
                            '');
                    }
                    
                    // Nếu không phát hiện spam trong hồ sơ, kiểm tra nội dung gần đây
                    if (!isSpam) {
                        if (await spamManager.checkRecentContent(currentId, title, extendedKeywords)) {
                            await spamManager.processSpamUser(currentId, title, 'recent_content', extendedKeywords);
                        }
                    }
                }
            } catch (error) {
                // Ghi nhận ID đầu tiên gặp lỗi để cập nhật phạm vi
                if (!firstErrorId) {
                    firstErrorId = currentId;
                    newRange.latestID = firstErrorId;
                }
                console.error(`Error processing ID: ${currentId}`, error);
            }
        }
        
        console.log(`Finished cleaning %c${spamCount}%c spammers!`, 'background: green; color: white; padding: 2px;', '');
        
        // Cập nhật phạm vi đã xử lý
        await rangeManager.setLastRange(newRange);
        
        // Sắp xếp danh sách spam
        const sortedSpamList = spamList.sort((a, b) => {
            const aIncludesSupport = a.includes("recent_content") ? 1 : 0;
            const bIncludesSupport = b.includes("recent_content") ? 1 : 0;
            return aIncludesSupport - bIncludesSupport;
        });
        
        // Hiển thị danh sách người dùng đã xử lý
        if (sortedSpamList.length > 0) {
            console.log(sortedSpamList.map(item => {
                    const [username, link] = item.split(": ");
                    return `%c${username}%c: ${link}`;
                }).join('\n'), ...sortedSpamList.flatMap(() => ["color: red; font-weight: bold; padding: 1px;", "color: inherit;"]));
        }
        
        // Hiển thị danh sách người dùng cần xem xét
        if (reviewBan.length > 0) {
            console.log(reviewBan.map(item => {
                    const [username, link] = item.split(": ");
                    return `%c${username}%c: ${link}`;
                }).join('\n'), ...reviewBan.flatMap(() => ["color: yellow; font-weight: bold; padding: 1px;", "color: inherit;"]));
        }
        
        // Thông báo nếu có người dùng cần xem xét
        const matches = sortedSpamList.filter(item => item.includes("recent_content"));
        if ((matches.length + reviewBan.length) > 0) {
            alert(`There are ${matches.length + reviewBan.length} user(s) that need to review ban.`);
        }
        
        // Cập nhật số lượng spam
        spamManager.setSpamCount(spamCount);
        
        // Trả về kết quả
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
     * Thêm nút dọn dẹp spam vào thanh điều hướng
     * 
     * @returns {Object} Các phần tử giao diện người dùng và hàm cập nhật
     */
    function addSpamCleanerToNavigation() {
        // Tìm vị trí để thêm nút
        const navList = document.querySelector('.p-nav-list.js-offCanvasNavSource');
        const footerList = document.querySelector("#footer > div > div.p-footer-row > div.p-footer-row-main > ul");
        if (!navList && !footerList)
            return;

        // Kiểm tra xem nút đã tồn tại chưa
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

        // Tạo phần tử danh sách
        const navItem = document.createElement('li');
        navItem.className = 'p-navEl';
        const container = document.createElement('div');
        container.className = 'p-navEl-link vn-quick-link';
        container.style.display = 'inline-flex';
        container.style.alignItems = 'left';

        // Tạo nút dọn dẹp
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

        // Tạo nút tự động chạy
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

        // Tạo bộ theo dõi tiến trình
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

        // Thêm các phần tử vào container
        container.appendChild(cleanButton);
        container.appendChild(autorunButton);
        container.appendChild(progressTracker);
        navItem.appendChild(container);

        // Thêm vào vị trí phù hợp dựa trên thiết bị
        if (memberManager.isUserUsingMobile() && footerList) {
            footerList.appendChild(navItem);
        } else if (navList) {
            navList.appendChild(navItem);
        }

        // Trả về các phần tử và hàm cập nhật
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
     * Lập lịch và quản lý quá trình dọn dẹp spam tự động
     */
    function scheduleCleanAllSpamer() {
        // Trạng thái của quá trình dọn dẹp
        const state = {
            isRunning: false,
            countdownInterval: null,
            remainingTime: 0
        };

        // Tạo giao diện người dùng
        const {
            cleanButton,
            autorunButton,
            progressTracker,
            updateProgress
        } = addSpamCleanerToNavigation();

        /**
         * Chạy quá trình dọn dẹp spam
         */
        async function runCleanSpamer() {
            if (state.isRunning) {
                console.log('Clean process is still running. Skipping...');
                updateProgress('Spam Cleaner: Running...', 'blue');
                return;
            }

            let wasCountdownRunning = false;
            if (state.countdownInterval) {
                clearInterval(state.countdownInterval);
                wasCountdownRunning = true;
            }

            try {
                // Bắt đầu quá trình dọn dẹp
                state.isRunning = true;
                updateUIForCleaning(true);
                const result = await cleanAllSpamer(false);
                
                if (result.status === 'success') {
                    updateProgress(`Cleaned ${result.spamCount} spammers`, 'green');
                    console.log('Spam cleaning completed', result);
                } else {
                    updateProgress(`Error: ${result.message || 'Unknown error'}`, 'red');
                    console.error('Error during spam cleaning:', result);
                }
                
                await new Promise(res => setTimeout(res, 2000));
            } catch (error) {
                console.error('Error when cleaning spammer:', error);
                updateProgress(`Error: ${error.message || error}`, 'red');
            } finally {
                // Cập nhật trạng thái sau khi hoàn thành
                updateUIForCleaning(false);
                state.isRunning = false;

                // Khôi phục đếm ngược nếu cần
                const storedAutorun = storageManager.get(AUTORUN_KEY, 'OFF');
                if (storedAutorun !== 'OFF' && wasCountdownRunning && state.remainingTime > 0) {
                    startCountdown(state.remainingTime / 60);
                } else if (!wasCountdownRunning || storedAutorun === 'OFF') {
                    updateProgress(`Spam Cleaner: Idle. Last clean: ${spamManager.getSpamCount()} spammers.`);
                }
            }
        }

        /**
         * Cập nhật giao diện người dùng trong quá trình dọn dẹp
         * 
         * @param {boolean} isCleaning - Đang trong quá trình dọn dẹp hay không
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
         * Bắt đầu đếm ngược cho lần dọn dẹp tiếp theo
         * 
         * @param {number} minutes - Số phút đếm ngược
         */
        function startCountdown(minutes) {
            state.remainingTime = minutes * 60;
            
            // Xóa interval hiện tại nếu có
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
         * Bật/tắt chế độ tự động dọn dẹp
         */
        function toggleAutorun() {
            if (state.isRunning) {
                console.log('Cannot change autorun settings while cleaning is running.');
                return;
            }
            
            // Lấy trạng thái hiện tại
            let currentState = storageManager.get(AUTORUN_KEY, 'OFF');
            const currentIndex = autorunStates.indexOf(currentState);
            
            // Chuyển sang trạng thái tiếp theo
            const nextIndex = (currentIndex + 1) % autorunStates.length;
            const nextState = autorunStates[nextIndex];

            // Lưu trạng thái mới
            storageManager.set(AUTORUN_KEY, nextState);
            autorunButton.textContent = nextState === 'OFF' ? `Autorun: ${nextState}` : `Autorun: ${nextState} mins`;

            // Xóa đếm ngược hiện tại nếu có
            if (state.countdownInterval) {
                clearInterval(state.countdownInterval);
                state.countdownInterval = null;
            }

            // Cập nhật trạng thái dựa trên cài đặt mới
            if (nextState === 'OFF') {
                updateProgress(`Spam Cleaner: Idle. Last clean: ${spamManager.getSpamCount()} spammers.`);
            } else {
                startCountdown(parseInt(nextState));
            }
        }

        /**
         * Khởi tạo các trình lắng nghe sự kiện
         */
        function initialize() {
            // Tránh đăng ký trình lắng nghe nhiều lần
            if (!cleanButton.hasAttribute('data-initialized')) {
                cleanButton.setAttribute('data-initialized', 'true');
                
                cleanButton.addEventListener('click', async() => {
                    await runCleanSpamer();
                });
    
                autorunButton.addEventListener('click', toggleAutorun);
    
                // Khôi phục trạng thái tự động chạy từ lần trước
                const storedAutorun = storageManager.get(AUTORUN_KEY);
                if (storedAutorun && storedAutorun !== 'OFF') {
                    startCountdown(parseInt(storedAutorun));
                }
            }
        }

        // Khởi tạo lịch trình
        initialize();
    }

    /**
     * Khởi tạo script
     */
    function init() {
        if (window.location.hostname === 'voz.vn') {
            // Yêu cầu app key nếu chưa có
            if (!storageManager.get(IGNORE_LIST_KEY) || !storageManager.get(LATEST_RANGE_KEY)) {
                var ignoreAppKey = prompt("Nhập app key cho danh sách bỏ qua:");
                var rangeAppKey = prompt("Nhập app key cho phạm vi xử lý cuối cùng:");
                
                if (ignoreAppKey) {
                    storageManager.set(IGNORE_LIST_KEY, ignoreAppKey);
                }
                
                if (rangeAppKey) {
                    storageManager.set(LATEST_RANGE_KEY, rangeAppKey);
                }
            }
            
            // Lấy danh sách bỏ qua
            ignoreListManager.getIgnoreList().then(list => {
                ignoreList = list;
            });
            
            // Lập lịch dọn dẹp spam
            scheduleCleanAllSpamer();
        }
    }

    // Khởi tạo script dựa trên trạng thái tải trang
    if (document.readyState === 'complete') {
        init();
    } else if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        window.addEventListener('load', init);
    }
})();

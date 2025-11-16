/**
 * Popup script for Focus Extension
 * Handles UI interactions and settings management
 */

const youtubeHideShortsToggle = document.getElementById('youtube-hide-shorts-toggle');
const youtubeSearchOnlyToggle = document.getElementById('youtube-search-only-toggle');
const instagramToggle = document.getElementById('instagram-toggle');
const usernameInput = document.getElementById('username-input');
const addUsernameBtn = document.getElementById('add-username-btn');
const usernameList = document.getElementById('username-list');
const urlInput = document.getElementById('url-input');
const addUrlBtn = document.getElementById('add-url-btn');
const urlList = document.getElementById('url-list');
const USERNAME_WHITELIST_KEY = 'instagramStoryWhitelist';
const URL_BLOCKLIST_KEY = 'urlBlocklist';
const LOCK_STATE_KEY = 'extensionLocked';
const FRIEND_EMAIL_KEY = 'friendEmail';
const PASSKEY_KEY = 'passkey';
const UNLOCK_PASSWORD = '676767';
const SERVER_URL = 'http://localhost:3000'; // Change to your deployed server URL

let usernameWhitelist = [];
let urlBlocklist = [];
let isLocked = false;
let friendEmail = '';
let currentPasskey = '';
let pendingRemoveAction = null; // Store the function to execute after password verification

// Lock UI elements
const lockSection = document.getElementById('lock-section');
const lockStatus = document.getElementById('lock-status');
const lockControls = document.getElementById('lock-controls');
const unlockControls = document.getElementById('unlock-controls');
const friendEmailInput = document.getElementById('friend-email-input');
const lockBtn = document.getElementById('lock-btn');
const unlockPasskeyInput = document.getElementById('unlock-passkey-input');
const unlockBtn = document.getElementById('unlock-btn');

// Load current settings
browser.runtime.sendMessage({ action: 'getSettings' }).then(settings => {
    youtubeHideShortsToggle.checked = settings.youtubeHideShorts || false;
    youtubeSearchOnlyToggle.checked = settings.youtubeSearchOnly || false;
    instagramToggle.checked = settings.instagramFeedEnabled;
    usernameWhitelist = settings.instagramStoryWhitelist || [];
    urlBlocklist = settings.urlBlocklist || [];
    isLocked = settings.extensionLocked || false;
    friendEmail = settings.friendEmail || '';
    currentPasskey = settings.passkey || '';
    
    renderUsernameList();
    renderUrlList();
    updateLockUI();
});

// Handle YouTube Hide Shorts toggle
youtubeHideShortsToggle.addEventListener('change', (e) => {
    // If locked, prevent disabling (turning off)
    if (isLocked && !e.target.checked) {
        e.target.checked = true;
        alert('Extension is locked. Unlock first to change settings.');
        return;
    }
    
    browser.runtime.sendMessage({
        action: 'toggleSetting',
        key: 'youtubeHideShorts',
        value: e.target.checked
    }).then(() => {
        // Reload YouTube tabs to apply changes
        browser.tabs.query({ url: '*://*.youtube.com/*' }).then(tabs => {
            tabs.forEach(tab => {
                browser.tabs.reload(tab.id);
            });
        });
    });
});

// Handle YouTube Search Only toggle
youtubeSearchOnlyToggle.addEventListener('change', (e) => {
    // If locked, prevent disabling (turning off)
    if (isLocked && !e.target.checked) {
        e.target.checked = true;
        alert('Extension is locked. Unlock first to change settings.');
        return;
    }
    
    browser.runtime.sendMessage({
        action: 'toggleSetting',
        key: 'youtubeSearchOnly',
        value: e.target.checked
    }).then(() => {
        // If search only is enabled, also enable hide shorts
        if (e.target.checked && !youtubeHideShortsToggle.checked) {
            youtubeHideShortsToggle.checked = true;
            browser.runtime.sendMessage({
                action: 'toggleSetting',
                key: 'youtubeHideShorts',
                value: true
            });
        }
        // Reload YouTube tabs to apply changes
        browser.tabs.query({ url: '*://*.youtube.com/*' }).then(tabs => {
            tabs.forEach(tab => {
                browser.tabs.reload(tab.id);
            });
        });
    });
});

// Handle Instagram toggle
instagramToggle.addEventListener('change', (e) => {
    // If locked, prevent disabling
    if (isLocked && !e.target.checked) {
        e.target.checked = true;
        alert('Extension is locked. Unlock first to change settings.');
        return;
    }
    
    const isEnabled = e.target.checked;
    
    // If disabling (turning off), require password
    if (!isEnabled) {
        // Revert the toggle immediately (will be set back if password is correct)
        e.target.checked = true;
        
        // Store the action to disable the toggle
        pendingRemoveAction = () => {
            browser.runtime.sendMessage({
                action: 'toggleSetting',
                key: 'instagramFeedEnabled',
                value: false
            }).then(() => {
                // Reload Instagram tabs to apply changes
                browser.tabs.query({ url: '*://*.instagram.com/*' }).then(tabs => {
                    tabs.forEach(tab => {
                        browser.tabs.reload(tab.id);
                    });
                });
            });
            // Update the toggle state
            instagramToggle.checked = false;
        };
        
        // Show password prompt
        showPasswordModal();
    } else {
        // Enabling doesn't require password - proceed normally
        browser.runtime.sendMessage({
            action: 'toggleSetting',
            key: 'instagramFeedEnabled',
            value: true
        }).then(() => {
            // Reload Instagram tabs to apply changes
            browser.tabs.query({ url: '*://*.instagram.com/*' }).then(tabs => {
                tabs.forEach(tab => {
                    browser.tabs.reload(tab.id);
                });
            });
        });
    }
});

// Handle adding username
function addUsername() {
    // Locking doesn't prevent adding, only removing
    const username = usernameInput.value.trim().toLowerCase();
    if (!username) return;
    
    // Remove @ if present
    const cleanUsername = username.replace(/^@/, '');
    
    if (cleanUsername && !usernameWhitelist.includes(cleanUsername)) {
        usernameWhitelist.push(cleanUsername);
        saveWhitelist();
        usernameInput.value = '';
        renderUsernameList();
    }
}

addUsernameBtn.addEventListener('click', addUsername);
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addUsername();
    }
});

// Handle removing username (requires password or unlock)
function removeUsername(username) {
    // If locked, prevent removal
    if (isLocked) {
        alert('Extension is locked. Unlock first to remove items.');
        return;
    }
    
    // Store the removal action
    pendingRemoveAction = () => {
        usernameWhitelist = usernameWhitelist.filter(u => u !== username);
        saveWhitelist();
        renderUsernameList();
    };
    
    // Show password prompt
    showPasswordModal();
}

// Render username list
function renderUsernameList() {
    usernameList.innerHTML = '';
    
    if (usernameWhitelist.length === 0) {
        return; // Empty state handled by CSS
    }
    
    usernameWhitelist.forEach(username => {
        const item = document.createElement('div');
        item.className = 'username-item';
        item.innerHTML = `
            <span>@${username}</span>
            <button class="remove-btn" data-username="${username}">Remove</button>
        `;
        
        const removeBtn = item.querySelector('.remove-btn');
        removeBtn.addEventListener('click', () => {
            removeUsername(username);
        });
        
        usernameList.appendChild(item);
    });
}

// Save whitelist to storage
function saveWhitelist() {
    browser.runtime.sendMessage({
        action: 'toggleSetting',
        key: USERNAME_WHITELIST_KEY,
        value: usernameWhitelist
    }).then(() => {
        // Reload Instagram tabs to apply changes
        browser.tabs.query({ url: '*://*.instagram.com/*' }).then(tabs => {
            tabs.forEach(tab => {
                browser.tabs.reload(tab.id);
            });
        });
    });
}

// Handle adding URL to blocklist
function addUrl() {
    // Locking doesn't prevent adding, only removing
    let url = urlInput.value.trim();
    if (!url) return;
    
    // Normalize URL
    url = url.toLowerCase();
    
    // Remove protocol if present
    url = url.replace(/^https?:\/\//, '');
    
    // Remove trailing slash
    url = url.replace(/\/$/, '');
    
    // Remove www. prefix
    url = url.replace(/^www\./, '');
    
    if (url && !urlBlocklist.includes(url)) {
        urlBlocklist.push(url);
        saveBlocklist();
        urlInput.value = '';
        renderUrlList();
    }
}

addUrlBtn.addEventListener('click', addUrl);
urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addUrl();
    }
});

// Handle removing URL from blocklist (requires password or unlock)
function removeUrl(url) {
    // If locked, prevent removal
    if (isLocked) {
        alert('Extension is locked. Unlock first to remove items.');
        return;
    }
    
    // Store the removal action
    pendingRemoveAction = () => {
        urlBlocklist = urlBlocklist.filter(u => u !== url);
        saveBlocklist();
        renderUrlList();
    };
    
    // Show password prompt
    showPasswordModal();
}

// Render URL list
function renderUrlList() {
    urlList.innerHTML = '';
    
    if (urlBlocklist.length === 0) {
        return; // Empty state handled by CSS
    }
    
    urlBlocklist.forEach(url => {
        const item = document.createElement('div');
        item.className = 'url-item';
        item.innerHTML = `
            <span>${url}</span>
            <button class="remove-btn" data-url="${url}">Remove</button>
        `;
        
        const removeBtn = item.querySelector('.remove-btn');
        removeBtn.addEventListener('click', () => {
            removeUrl(url);
        });
        
        urlList.appendChild(item);
    });
}

// Save blocklist to storage
function saveBlocklist() {
    browser.runtime.sendMessage({
        action: 'toggleSetting',
        key: URL_BLOCKLIST_KEY,
        value: urlBlocklist
    }).then(() => {
        // Reload all tabs to apply changes
        browser.tabs.query({}).then(tabs => {
            tabs.forEach(tab => {
                if (tab.url && tab.url.startsWith('http')) {
                    browser.tabs.reload(tab.id);
                }
            });
        });
    });
}

// Password Modal Functions
const passwordModal = document.getElementById('password-modal');
const passwordInput = document.getElementById('password-input');
const passwordSubmitBtn = document.getElementById('password-submit-btn');
const passwordCancelBtn = document.getElementById('password-cancel-btn');
const passwordError = document.getElementById('password-error');

function showPasswordModal() {
    passwordModal.classList.add('show');
    passwordInput.value = '';
    passwordError.classList.remove('show');
    passwordError.textContent = '';
    passwordInput.focus();
}

function hidePasswordModal() {
    passwordModal.classList.remove('show');
    passwordInput.value = '';
    passwordError.classList.remove('show');
    passwordError.textContent = '';
    pendingRemoveAction = null;
}

function verifyPassword() {
    const enteredPassword = passwordInput.value.trim();
    
    // Check admin password or passkey
    if (enteredPassword === UNLOCK_PASSWORD || enteredPassword === currentPasskey) {
        // Password correct - execute pending action
        if (pendingRemoveAction) {
            pendingRemoveAction();
        }
        hidePasswordModal();
    } else {
        // Password incorrect
        passwordError.textContent = 'Incorrect password';
        passwordError.classList.add('show');
        passwordInput.value = '';
        passwordInput.focus();
    }
}

// Lock/Unlock Functions
function generatePasskey() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function lockExtension() {
    const email = friendEmailInput.value.trim();
    if (!email) {
        alert('Please enter a friend\'s email address');
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert('Please enter a valid email address');
        return;
    }
    
    // Generate 6-digit passkey
    const passkey = generatePasskey();
    
    // Send email via server
    try {
        const response = await fetch(`${SERVER_URL}/send-passkey`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email,
                passkey: passkey
            })
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to send email');
        }
        
        // Save lock state
        isLocked = true;
        friendEmail = email;
        currentPasskey = passkey;
        
        await browser.runtime.sendMessage({
            action: 'toggleSetting',
            key: LOCK_STATE_KEY,
            value: true
        });
        await browser.runtime.sendMessage({
            action: 'toggleSetting',
            key: FRIEND_EMAIL_KEY,
            value: email
        });
        await browser.runtime.sendMessage({
            action: 'toggleSetting',
            key: PASSKEY_KEY,
            value: passkey
        });
        
        friendEmailInput.value = '';
        updateLockUI();
        alert(`Extension locked! Passkey sent to ${email}`);
    } catch (error) {
        console.error('Error locking extension:', error);
        alert(`Failed to send email: ${error.message}`);
    }
}

async function unlockExtension() {
    const enteredPasskey = unlockPasskeyInput.value.trim();
    
    if (!enteredPasskey) {
        alert('Please enter the passkey');
        return;
    }
    
    // Check admin password or passkey
    if (enteredPasskey === UNLOCK_PASSWORD || enteredPasskey === currentPasskey) {
        // Unlock extension
        isLocked = false;
        currentPasskey = '';
        
        await browser.runtime.sendMessage({
            action: 'toggleSetting',
            key: LOCK_STATE_KEY,
            value: false
        });
        await browser.runtime.sendMessage({
            action: 'toggleSetting',
            key: PASSKEY_KEY,
            value: ''
        });
        
        unlockPasskeyInput.value = '';
        updateLockUI();
        alert('Extension unlocked!');
    } else {
        alert('Incorrect passkey');
        unlockPasskeyInput.value = '';
        unlockPasskeyInput.focus();
    }
}

function updateLockUI() {
    if (isLocked) {
        lockStatus.textContent = `🔒 Locked - Passkey sent to ${friendEmail}`;
        lockStatus.style.color = '#f44336';
        lockControls.style.display = 'none';
        unlockControls.style.display = 'block';
        
        // Disable all unlock actions
        disableUnlockActions();
        
        // Disable toggles from being turned off
        disableToggles();
    } else {
        lockStatus.textContent = '🔓 Unlocked';
        lockStatus.style.color = '#4CAF50';
        lockControls.style.display = 'block';
        unlockControls.style.display = 'none';
        
        // Enable all unlock actions
        enableUnlockActions();
        
        // Enable toggles
        enableToggles();
    }
}

function disableUnlockActions() {
    // Disable remove buttons
    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
    });
}

function enableUnlockActions() {
    // Enable remove buttons
    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    });
}

function disableToggles() {
    // Disable toggles from being turned off (but allow turning on)
    // The event listeners will handle preventing turn-off
    youtubeHideShortsToggle.style.opacity = '0.7';
    youtubeSearchOnlyToggle.style.opacity = '0.7';
    instagramToggle.style.opacity = '0.7';
}

function enableToggles() {
    // Enable toggles fully
    youtubeHideShortsToggle.style.opacity = '1';
    youtubeSearchOnlyToggle.style.opacity = '1';
    instagramToggle.style.opacity = '1';
}

// Lock/Unlock event listeners
lockBtn.addEventListener('click', lockExtension);
unlockBtn.addEventListener('click', unlockExtension);

friendEmailInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        lockExtension();
    }
});

unlockPasskeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        unlockExtension();
    }
});

// Only allow numbers in passkey input
unlockPasskeyInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '');
});

// Password modal event listeners
passwordSubmitBtn.addEventListener('click', verifyPassword);
passwordCancelBtn.addEventListener('click', hidePasswordModal);

passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        verifyPassword();
    }
});

// Close modal when clicking outside
passwordModal.addEventListener('click', (e) => {
    if (e.target === passwordModal) {
        hidePasswordModal();
    }
});

/**
 * Background script for Focus Extension
 * Manages settings storage and communication
 */

// Default settings
const DEFAULT_SETTINGS = {
    youtubeHideShorts: false,
    youtubeSearchOnly: false,
    instagramFeedEnabled: true,
    instagramStoryWhitelist: [],
    urlBlocklist: [],
    extensionLocked: false,
    friendEmail: '',
    passkey: ''
};

// Initialize settings on install
browser.runtime.onInstalled.addListener(() => {
    browser.storage.local.get(['youtubeHideShorts', 'youtubeSearchOnly', 'instagramFeedEnabled', 'instagramStoryWhitelist', 'urlBlocklist', 'extensionLocked', 'friendEmail', 'passkey']).then(result => {
        const settings = { ...DEFAULT_SETTINGS, ...result };
        browser.storage.local.set(settings);
    });
});

// Handle messages from content scripts and popup
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getSettings') {
        browser.storage.local.get(['youtubeHideShorts', 'youtubeSearchOnly', 'instagramFeedEnabled', 'instagramStoryWhitelist', 'urlBlocklist', 'extensionLocked', 'friendEmail', 'passkey'])
            .then(settings => {
                sendResponse({
                    youtubeHideShorts: settings.youtubeHideShorts === true,
                    youtubeSearchOnly: settings.youtubeSearchOnly === true,
                    instagramFeedEnabled: settings.instagramFeedEnabled !== false,
                    instagramStoryWhitelist: settings.instagramStoryWhitelist || [],
                    urlBlocklist: settings.urlBlocklist || [],
                    extensionLocked: settings.extensionLocked === true,
                    friendEmail: settings.friendEmail || '',
                    passkey: settings.passkey || ''
                });
            });
        return true; // Keep channel open for async response
    }

    if (request.action === 'toggleSetting') {
        const { key, value } = request;
        browser.storage.local.set({ [key]: value }).then(() => {
            sendResponse({ success: true });
        });
        return true;
    }
});

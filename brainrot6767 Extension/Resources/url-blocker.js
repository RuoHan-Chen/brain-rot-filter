/**
 * URL Blocker Content Script
 * Blocks all content on URLs that are in the blocklist
 */

(function() {
    'use strict';

    const BLOCKLIST_KEY = 'urlBlocklist';
    let urlBlocklist = [];
    let isBlocked = false;

    /**
     * Check if current URL matches any blocked URL pattern
     */
    function checkIfBlocked() {
        const currentUrl = window.location.href;
        const currentHost = window.location.hostname;
        const currentPath = window.location.pathname;

        return urlBlocklist.some(blockedUrl => {
            try {
                // If it's a full URL, check if current URL starts with it
                if (blockedUrl.startsWith('http://') || blockedUrl.startsWith('https://')) {
                    return currentUrl.startsWith(blockedUrl) || currentUrl.includes(blockedUrl);
                }
                
                // If it's just a hostname or domain (no path), check hostname
                if (blockedUrl.includes('.') && !blockedUrl.includes('/')) {
                    return currentHost === blockedUrl || currentHost.endsWith('.' + blockedUrl);
                }
                
                // If it's a path pattern, check pathname
                if (blockedUrl.startsWith('/')) {
                    return currentPath.startsWith(blockedUrl);
                }
                
                // Default: check if URL contains the blocked string
                return currentUrl.includes(blockedUrl);
            } catch (e) {
                console.debug('URL blocker: Error checking URL:', e);
                return false;
            }
        });
    }

    /**
     * Block all content on the page
     */
    function blockPage() {
        if (isBlocked) return;
        isBlocked = true;

        try {
            // Hide body content
            if (document.body) {
                document.body.style.display = 'none';
            }

            // Create a blocking overlay
            const overlay = document.createElement('div');
            overlay.id = 'focus-filter-block-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: #1a1a1a;
                color: #ffffff;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 999999;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                text-align: center;
                padding: 20px;
                box-sizing: border-box;
            `;

            overlay.innerHTML = `
                <div style="max-width: 500px;">
                    <h1 style="font-size: 32px; margin: 0 0 16px 0; color: #ffffff;">🚫 Blocked</h1>
                    <p style="font-size: 18px; margin: 0 0 24px 0; color: #cccccc; line-height: 1.5;">
                        This website has been blocked by Focus Filter.
                    </p>
                    <p style="font-size: 14px; margin: 0; color: #888888;">
                        To unblock, remove this URL from the blocklist in the extension settings.
                    </p>
                </div>
            `;

            document.documentElement.appendChild(overlay);
        } catch (e) {
            console.debug('URL blocker: Error blocking page:', e);
        }
    }

    /**
     * Initialize the blocker
     */
    function init() {
        // Load blocklist from storage
        if (typeof browser !== 'undefined' && browser.storage) {
            browser.storage.local.get([BLOCKLIST_KEY]).then(result => {
                urlBlocklist = result[BLOCKLIST_KEY] || [];
                
                if (checkIfBlocked()) {
                    blockPage();
                }
            }).catch(() => {
                urlBlocklist = [];
            });

            // Listen for blocklist changes
            browser.storage.onChanged.addListener((changes, areaName) => {
                if (areaName === 'local' && changes[BLOCKLIST_KEY]) {
                    urlBlocklist = changes[BLOCKLIST_KEY].newValue || [];
                    
                    // Reload page if block status changed
                    const wasBlocked = isBlocked;
                    const nowBlocked = checkIfBlocked();
                    
                    if (nowBlocked && !wasBlocked) {
                        blockPage();
                    } else if (!nowBlocked && wasBlocked) {
                        // Unblock by reloading
                        window.location.reload();
                    }
                }
            });
        } else {
            // Fallback if browser API not available
            urlBlocklist = [];
        }
    }

    // Start when script loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();


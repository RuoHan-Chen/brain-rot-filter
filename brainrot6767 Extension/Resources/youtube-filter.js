/**
 * YouTube Filter
 * Supports two modes:
 * 1. Hide Shorts only
 * 2. Hide Shorts and videos (search bar only)
 */

(function() {
    'use strict';

    const HIDE_SHORTS_KEY = 'youtubeHideShorts';
    const SEARCH_ONLY_KEY = 'youtubeSearchOnly';
    let hideShortsEnabled = false;
    let searchOnlyEnabled = false;
    let observer = null;
    let urlObserver = null;
    let contentObserver = null;
    let hideInterval = null;
    let periodicInterval = null;

    /**
     * Check if we're on a page that should not be filtered (search results or watch pages)
     */
    function shouldSkipFiltering() {
        const path = window.location.pathname;
        const searchParams = window.location.search;
        
        // Don't filter on search results pages
        if (path === '/results' || path.includes('/results')) {
            return true;
        }
        
        // Don't filter on watch pages (video pages)
        if (path === '/watch' || path.includes('/watch')) {
            return true;
        }
        
        // Also check for search_query parameter
        if (searchParams.includes('search_query=')) {
            return true;
        }
        
        // Also check for watch v parameter
        if (searchParams.includes('v=')) {
            return true;
        }
        
        return false;
    }

    /**
     * Check if element is part of the search box
     */
    function isSearchElement(element) {
        if (!element) return false;
        
        // Check if it's the search box itself or inside it
        if (element.closest('yt-searchbox') || 
            element.closest('#center') ||
            element.matches('yt-searchbox') ||
            element.matches('#center')) {
            return true;
        }
        
        // Check for search form/input
        if (element.matches('form[action="/results"]') ||
            element.matches('input[name="search_query"]') ||
            element.closest('form[action="/results"]')) {
            return true;
        }
        
        return false;
    }

    /**
     * Hide YouTube Shorts
     */
    function hideShorts() {
        if (!hideShortsEnabled && !searchOnlyEnabled) return;
        
        // Skip filtering on search results pages
        if (shouldSkipFiltering()) return;

        const SHORTS_SELECTORS = [
            'ytd-reel-shelf-renderer',
            'ytd-rich-shelf-renderer[is-shorts]',
            'a[href*="/shorts/"]',
            'a[href^="/shorts"]',
            'ytd-guide-entry-renderer a[href*="/shorts/"]',
            'ytd-mini-guide-entry-renderer a[href*="/shorts/"]',
            'ytd-video-renderer[is-shorts]',
            'ytd-grid-video-renderer[is-shorts]',
            'ytd-compact-video-renderer[is-shorts]',
            'ytd-rich-section-renderer ytd-reel-shelf-renderer',
            'ytd-watch-next-secondary-results-renderer ytd-reel-shelf-renderer',
            'ytd-tab-renderer a[href*="/shorts"]',
        ];

        SHORTS_SELECTORS.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    if (el.offsetParent === null) return; // Already hidden
                    
                    let targetToHide = null;
                    
                    if (el.tagName === 'YTD-REEL-SHELF-RENDERER' || 
                        (el.tagName === 'YTD-RICH-SHELF-RENDERER' && el.hasAttribute('is-shorts'))) {
                        targetToHide = el;
                    } else if (el.tagName === 'A' || el.querySelector('a[href*="/shorts"]')) {
                        targetToHide = el.closest('ytd-guide-entry-renderer') ||
                                      el.closest('ytd-mini-guide-entry-renderer') ||
                                      el.closest('ytd-video-renderer') ||
                                      el.closest('ytd-grid-video-renderer') ||
                                      el.closest('ytd-compact-video-renderer') ||
                                      el.closest('ytd-reel-shelf-renderer') ||
                                      el.closest('ytd-rich-section-renderer') ||
                                      el.parentElement;
                    } else {
                        targetToHide = el.closest('ytd-reel-shelf-renderer') ||
                                      el.closest('ytd-rich-shelf-renderer') ||
                                      el;
                    }
                    
                    if (targetToHide && targetToHide.offsetParent !== null) {
                        targetToHide.style.display = 'none';
                        targetToHide.setAttribute('data-youtube-shorts-hidden', 'true');
                    }
                });
            } catch (e) {
                console.debug('YouTube filter selector error:', selector, e);
            }
        });

        // Find all links with /shorts/ in href
        try {
            const allLinks = document.querySelectorAll('a[href]');
            allLinks.forEach(link => {
                const href = link.getAttribute('href');
                if (href && (href.includes('/shorts/') || href.includes('/shorts'))) {
                    const parent = link.closest('ytd-guide-entry-renderer') ||
                                  link.closest('ytd-mini-guide-entry-renderer') ||
                                  link.closest('ytd-video-renderer') ||
                                  link.closest('ytd-grid-video-renderer') ||
                                  link.closest('ytd-compact-video-renderer') ||
                                  link.closest('ytd-reel-shelf-renderer');
                    
                    if (parent && parent.offsetParent !== null && !parent.hasAttribute('data-youtube-shorts-hidden')) {
                        parent.style.display = 'none';
                        parent.setAttribute('data-youtube-shorts-hidden', 'true');
                    }
                }
            });
        } catch (e) {
            console.debug('YouTube filter link check error:', e);
        }

        // Find all reel shelf renderers
        try {
            const reelShelves = document.querySelectorAll('ytd-reel-shelf-renderer');
            reelShelves.forEach(shelf => {
                if (shelf.offsetParent !== null && !shelf.hasAttribute('data-youtube-shorts-hidden')) {
                    shelf.style.display = 'none';
                    shelf.setAttribute('data-youtube-shorts-hidden', 'true');
                }
            });
        } catch (e) {
            console.debug('YouTube filter shelf check error:', e);
        }
    }

    /**
     * Remove all children from #content except #masthead-container
     * This function safely removes direct children of #content that are not the masthead
     */
    function removeContentChildren() {
        if (!searchOnlyEnabled || !document.body) return;
        
        // Skip filtering on search results pages
        if (shouldSkipFiltering()) return;

        try {
            const contentElement = document.querySelector('#content');
            if (!contentElement) {
                return; // #content doesn't exist yet, safe to return
            }

            // Get all direct children of #content
            const children = Array.from(contentElement.children);
            
            // Remove each child that is not #masthead-container
            children.forEach(child => {
                if (child.id !== 'masthead-container') {
                    try {
                        child.remove();
                    } catch (e) {
                        // If remove() fails, try hiding as fallback
                        console.debug('YouTube filter: Could not remove child, hiding instead:', e);
                        child.style.display = 'none';
                    }
                }
            });
        } catch (e) {
            console.debug('YouTube filter: Error in removeContentChildren:', e);
        }
    }

    /**
     * Hide everything except search bar
     */
    function hideEverything() {
        if (!searchOnlyEnabled || !document.body) return;

        // Remove all children from #content except #masthead-container
        removeContentChildren();
    }

    /**
     * Apply filters based on current settings
     */
    function applyFilters() {
        // Skip all filtering on search results pages
        if (shouldSkipFiltering()) {
            // Restore any previously hidden elements
            document.querySelectorAll('[data-youtube-shorts-hidden], [data-youtube-hidden]').forEach(el => {
                el.style.display = '';
                el.removeAttribute('data-youtube-shorts-hidden');
                el.removeAttribute('data-youtube-hidden');
            });
            return;
        }
        
        if (searchOnlyEnabled) {
            hideEverything();
        }
        if (hideShortsEnabled || searchOnlyEnabled) {
            hideShorts();
        }
    }

    /**
     * Initialize the filter
     */
    function init() {
        // Load settings
        if (typeof browser !== 'undefined' && browser.storage) {
            browser.storage.local.get([HIDE_SHORTS_KEY, SEARCH_ONLY_KEY]).then(result => {
                hideShortsEnabled = result[HIDE_SHORTS_KEY] === true;
                searchOnlyEnabled = result[SEARCH_ONLY_KEY] === true;
                startFiltering();
            }).catch(() => {
                hideShortsEnabled = false;
                searchOnlyEnabled = false;
                startFiltering();
            });
        } else {
            hideShortsEnabled = false;
            searchOnlyEnabled = false;
            startFiltering();
        }

        // Listen for settings changes
        if (typeof browser !== 'undefined' && browser.storage) {
            browser.storage.onChanged.addListener((changes, areaName) => {
                if (areaName === 'local') {
                    if (changes[HIDE_SHORTS_KEY]) {
                        hideShortsEnabled = changes[HIDE_SHORTS_KEY].newValue === true;
                    }
                    if (changes[SEARCH_ONLY_KEY]) {
                        searchOnlyEnabled = changes[SEARCH_ONLY_KEY].newValue === true;
                    }
                    // Reset hidden markers and reapply
                    document.querySelectorAll('[data-youtube-shorts-hidden], [data-youtube-hidden]').forEach(el => {
                        el.style.display = '';
                        el.removeAttribute('data-youtube-shorts-hidden');
                        el.removeAttribute('data-youtube-hidden');
                    });
                    startFiltering();
                }
            });
        }
    }

    /**
     * Start filtering with MutationObserver
     */
    function startFiltering() {
        // Wait for body to be available
        function waitForBody(callback) {
            if (document.body) {
                callback();
            } else {
                setTimeout(() => waitForBody(callback), 100);
            }
        }

        waitForBody(() => {
            // Initial apply with multiple attempts
            applyFilters();
            setTimeout(applyFilters, 300);
            setTimeout(applyFilters, 800);
            setTimeout(applyFilters, 1500);
            setTimeout(applyFilters, 2500);

            // Set up MutationObserver specifically for #content to watch for new children
            function setupContentObserver() {
                const contentElement = document.querySelector('#content');
                if (contentElement) {
                    // Disconnect existing observer if any
                    if (contentObserver) {
                        contentObserver.disconnect();
                    }

                    // Create observer for #content children changes
                    contentObserver = new MutationObserver((mutations) => {
                        // Check if any children were added
                        const hasNewChildren = mutations.some(mutation => 
                            mutation.addedNodes.length > 0
                        );
                        
                        if (hasNewChildren && searchOnlyEnabled) {
                            // Remove new children that aren't masthead-container
                            removeContentChildren();
                        }
                    });

                    // Observe only direct children of #content
                    contentObserver.observe(contentElement, {
                        childList: true,
                        subtree: false // Only watch direct children
                    });
                } else {
                    // #content doesn't exist yet, try again later
                    setTimeout(setupContentObserver, 500);
                }
            }

            // Set up the content observer
            setupContentObserver();

            // Set up MutationObserver for dynamically loaded content (for Shorts filtering)
            if (observer) {
                observer.disconnect();
            }

            observer = new MutationObserver((mutations) => {
                clearTimeout(hideInterval);
                hideInterval = setTimeout(applyFilters, 100);
            });

            if (document.body) {
                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: false
                });
            }

            // Handle navigation (YouTube is a SPA)
            let lastUrl = location.href;
            urlObserver = new MutationObserver(() => {
                const url = location.href;
                if (url !== lastUrl) {
                    lastUrl = url;
                    // Reset hidden markers on navigation
                    document.querySelectorAll('[data-youtube-shorts-hidden], [data-youtube-hidden]').forEach(el => {
                        el.style.display = '';
                        el.removeAttribute('data-youtube-shorts-hidden');
                        el.removeAttribute('data-youtube-hidden');
                    });
                    // Re-setup content observer after navigation
                    setTimeout(() => {
                        const contentElement = document.querySelector('#content');
                        if (contentElement && contentObserver) {
                            contentObserver.disconnect();
                            contentObserver.observe(contentElement, {
                                childList: true,
                                subtree: false
                            });
                        }
                    }, 200);
                    setTimeout(applyFilters, 200);
                    setTimeout(applyFilters, 600);
                    setTimeout(applyFilters, 1200);
                }
            });

            urlObserver.observe(document, { 
                subtree: true, 
                childList: true,
                attributes: true,
                attributeFilter: ['href']
            });

            // Periodic check as backup
            periodicInterval = setInterval(() => {
                if (hideShortsEnabled || searchOnlyEnabled) {
                    applyFilters();
                }
            }, 2000);
        });
    }

    /**
     * Stop filtering
     */
    function stopFiltering() {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        if (urlObserver) {
            urlObserver.disconnect();
            urlObserver = null;
        }
        if (contentObserver) {
            contentObserver.disconnect();
            contentObserver = null;
        }
        if (hideInterval) {
            clearTimeout(hideInterval);
            hideInterval = null;
        }
        if (periodicInterval) {
            clearInterval(periodicInterval);
            periodicInterval = null;
        }
        // Restore hidden elements
        document.querySelectorAll('[data-youtube-shorts-hidden], [data-youtube-hidden]').forEach(el => {
            el.style.display = '';
            el.removeAttribute('data-youtube-shorts-hidden');
            el.removeAttribute('data-youtube-hidden');
        });
    }

    // Start when script loads
    init();
})();

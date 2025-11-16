/**
 * Instagram Story Tray Filter
 * Shows only the story tray, filtered by username whitelist
 */

(function() {
    'use strict';

    const STORAGE_KEY = 'instagramFeedEnabled';
    const USERNAME_WHITELIST_KEY = 'instagramStoryWhitelist';
    let isEnabled = true;
    let usernameWhitelist = [];
    let storyObserver = null;
    let observer = null;
    let urlObserver = null;
    let hideInterval = null;
    let periodicInterval = null;

    /**
     * Check if element should be preserved (story tray, search sidebar, messages sidebar)
     */
    function shouldPreserveElement(element) {
        if (!element) return false;
        
        // Check if it's the story tray container
        if (element.getAttribute('data-pagelet') === 'story_tray' ||
            element.closest('[data-pagelet="story_tray"]')) {
            return true;
        }
        
        // Check if it's the search sidebar
        const searchLink = element.querySelector('a[aria-label*="Search"]') ||
                          element.closest('a[aria-label*="Search"]') ||
                          (element.tagName === 'A' && element.getAttribute('aria-label')?.includes('Search')) ||
                          (element.textContent?.trim() === 'Search' && element.closest('nav'));
        if (searchLink) {
            return true;
        }
        
        // Check if it's the messages sidebar
        const messagesLink = element.querySelector('a[href*="/direct/inbox"]') ||
                            element.closest('a[href*="/direct/inbox"]') ||
                            element.querySelector('a[aria-label*="Direct messaging"]') ||
                            element.closest('a[aria-label*="Direct messaging"]') ||
                            (element.tagName === 'A' && (element.getAttribute('href')?.includes('/direct/inbox') || element.getAttribute('aria-label')?.includes('Direct messaging'))) ||
                            (element.textContent?.trim() === 'Messages' && element.closest('nav'));
        if (messagesLink) {
            return true;
        }
        
        // Check if it's inside a navigation sidebar that contains search or messages
        const nav = element.closest('nav');
        if (nav) {
            const hasSearch = nav.querySelector('a[aria-label*="Search"]') || nav.textContent?.includes('Search');
            const hasMessages = nav.querySelector('a[href*="/direct/inbox"]') || nav.querySelector('a[aria-label*="Direct messaging"]') || nav.textContent?.includes('Messages');
            if (hasSearch || hasMessages) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Filter stories by removing all except those in the username whitelist
     * This function finds all <li class="_acaz"> elements inside <ul class="_acay">
     * and removes any that don't match a username in the whitelist
     */
    function filterStoriesByUsername() {
        // Only filter stories when the main toggle is enabled
        if (!isEnabled) {
            return;
        }
        
        // Skip story filtering on direct inbox page
        if (shouldSkipFiltering()) {
            return;
        }

        try {
            // If whitelist is empty, don't filter (show all stories)
            if (usernameWhitelist.length === 0) {
                return;
            }

            // Find the story list container
            const storyList = document.querySelector('ul._acay');
            if (!storyList) {
                return; // Story list doesn't exist yet
            }

            // Find all story items (li elements with class _acaz)
            const storyItems = storyList.querySelectorAll('li._acaz');
            
            storyItems.forEach(storyItem => {
                // Find the div with aria-label containing "Story by"
                const storyDiv = storyItem.querySelector('div[aria-label*="Story by"]');
                
                if (storyDiv) {
                    const ariaLabel = storyDiv.getAttribute('aria-label');
                    if (ariaLabel) {
                        // Extract username using regex: "Story by USERNAME, ..."
                        const match = ariaLabel.match(/Story by ([^,]+)/);
                        
                        if (match && match[1]) {
                            const username = match[1].trim().toLowerCase();
                            
                            // Check if username is in the whitelist
                            const isWhitelisted = usernameWhitelist.some(whitelisted => 
                                username === whitelisted.toLowerCase()
                            );
                            
                            // If username is NOT in whitelist, remove the entire <li>
                            if (!isWhitelisted) {
                                try {
                                    storyItem.remove();
                                } catch (e) {
                                    // If remove() fails, hide as fallback
                                    console.debug('Instagram filter: Could not remove story, hiding instead:', e);
                                    storyItem.style.display = 'none';
                                }
                            }
                        } else {
                            // Couldn't extract username, remove to be safe
                            try {
                                storyItem.remove();
                            } catch (e) {
                                storyItem.style.display = 'none';
                            }
                        }
                    } else {
                        // No aria-label, remove to be safe
                        try {
                            storyItem.remove();
                        } catch (e) {
                            storyItem.style.display = 'none';
                        }
                    }
                }
            });
        } catch (e) {
            console.debug('Instagram filter: Error in filterStoriesByUsername:', e);
        }
    }

    /**
     * Get username from story element
     */
    function getStoryUsername(storyElement) {
        try {
            // Method 1: Extract from aria-label (format: "Story by username, not seen")
            const ariaLabel = storyElement.getAttribute('aria-label') || 
                            storyElement.querySelector('[aria-label]')?.getAttribute('aria-label');
            if (ariaLabel) {
                // Match "Story by username" pattern
                const match = ariaLabel.match(/Story by ([^,]+)/);
                if (match && match[1]) {
                    return match[1].trim().toLowerCase();
                }
            }
            
            // Method 2: Extract from text content (username span)
            const usernameSpan = storyElement.querySelector('span.x1lliihq.x193iq5w.x6ikm8r.x10wlt62.xlyipyv.xuxw1ft');
            if (usernameSpan) {
                const username = usernameSpan.textContent.trim();
                if (username) {
                    return username.toLowerCase();
                }
            }
            
            // Method 3: Try to find username in any span with text
            const spans = storyElement.querySelectorAll('span');
            for (const span of spans) {
                const text = span.textContent.trim();
                // Check if it looks like a username (alphanumeric, dots, underscores)
                if (text && /^[a-zA-Z0-9._]+$/.test(text) && text.length > 0 && text.length < 31) {
                    return text.toLowerCase();
                }
            }
        } catch (e) {
            console.debug('Error getting story username:', e);
        }
        return null;
    }

    /**
     * Check if story should be shown (is in whitelist)
     */
    function shouldShowStory(storyElement) {
        // If filtering is disabled, show all stories
        if (!isEnabled) {
            return true;
        }
        
        // Show all if whitelist isn't set yet
        if (usernameWhitelist.length === 0) {
            return true;
        }
        
        const username = getStoryUsername(storyElement);
        if (!username) return false;
        
        return usernameWhitelist.some(whitelisted => 
            username === whitelisted.toLowerCase()
        );
    }

    /**
     * Check if we're on a path that should not be filtered
     */
    function shouldSkipFiltering() {
        const path = window.location.pathname;
        // Don't filter on direct inbox/messages page
        if (path.includes('/direct/inbox') || path.includes('/direct/')) {
            return true;
        }
        return false;
    }

    /**
     * Hide elements with the specific classes that contain the main feed content
     */
    function hideMainFeedContent() {
        if (shouldSkipFiltering()) return;
        
        try {
            const storyTray = document.querySelector('[data-pagelet="story_tray"]');
            
            // Target class 1: "x1dr59a3 x13vifvy x7vhb2i x6bx242"
            const class1Classes = ['x1dr59a3', 'x13vifvy', 'x7vhb2i', 'x6bx242'];
            
            // Target class 2: "html-div xdj266r x14z9mp xat24cr x1lziwak xexx8yu xyri2b x18d9i69 x1c1uobl x9f619 xjbqb8w x78zum5 x15mokao x1ga7v0g x16uus16 xbiv7yw x1uhb9sk x1plvlek xryxfnj x1c4vz4f x2lah0s xdt5ytf xqjyukv x6s0dn4 x1oa3qoh x1nhvcw1"
            const class2Classes = ['html-div', 'xdj266r', 'x14z9mp', 'xat24cr', 'x1lziwak', 'xexx8yu', 'xyri2b', 'x18d9i69', 'x1c1uobl', 'x9f619', 'xjbqb8w', 'x78zum5', 'x15mokao', 'x1ga7v0g', 'x16uus16', 'xbiv7yw', 'x1uhb9sk', 'x1plvlek', 'xryxfnj', 'x1c4vz4f', 'x2lah0s', 'xdt5ytf', 'xqjyukv', 'x6s0dn4', 'x1oa3qoh', 'x1nhvcw1'];
            
            // Target class 3 (footer): "x1qjc9v5 x9f619 x78zum5 xdt5ytf x2lah0s xk390pu xdj266r x14z9mp xat24cr x1lziwak x1h3rv7z xexx8yu x18d9i69 x1n2onr6 x11njtxf xv54qhq xf7dkkf xvbhtw8"
            const class3Classes = ['x1qjc9v5', 'x9f619', 'x78zum5', 'xdt5ytf', 'x2lah0s', 'xk390pu', 'xdj266r', 'x14z9mp', 'xat24cr', 'x1lziwak', 'x1h3rv7z', 'xexx8yu', 'x18d9i69', 'x1n2onr6', 'x11njtxf', 'xv54qhq', 'xf7dkkf', 'xvbhtw8'];
            
            const allDivs = document.querySelectorAll('div');
            
            allDivs.forEach(div => {
                // Skip if this div contains or is the story tray
                if (storyTray && (div === storyTray || div.contains(storyTray))) {
                    return;
                }
                
                const classList = div.className || '';
                
                // Check for class 1: all classes must be present
                const hasClass1 = class1Classes.every(cls => classList.includes(cls));
                
                // Check for class 2: all classes must be present
                const hasClass2 = class2Classes.every(cls => classList.includes(cls));
                
                // Check for class 3 (footer): all classes must be present
                const hasClass3 = class3Classes.every(cls => classList.includes(cls));
                
                if ((hasClass1 || hasClass2 || hasClass3) && div.offsetParent !== null) {
                    div.style.display = 'none';
                    div.setAttribute('data-instagram-hidden', 'true');
                }
            });
        } catch (e) {
            console.debug('Instagram filter: Error hiding main feed content:', e);
        }
    }

    /**
     * Hide everything except the story tray (filtered by whitelist)
     * Only hides specific classes, preserves story tray and its ancestors
     */
    function hideEverything() {
        if (!isEnabled || !document.body) return;

        // Skip filtering on direct inbox page
        if (shouldSkipFiltering()) {
            return;
        }

        // Find the story tray container first
        const storyTray = document.querySelector('[data-pagelet="story_tray"]');

        // Hide main feed content with specific classes only
        hideMainFeedContent();

        // Preserve navigation sidebar with search and messages
        const nav = document.querySelector('nav[role="navigation"]');
        if (nav) {
            // Keep the nav visible if it has search or messages
            const hasSearch = nav.querySelector('a[aria-label*="Search"]') || nav.textContent?.includes('Search');
            const hasMessages = nav.querySelector('a[href*="/direct/inbox"]') || nav.querySelector('a[aria-label*="Direct messaging"]') || nav.textContent?.includes('Messages');
            
            if (hasSearch || hasMessages) {
                // Keep nav visible, but hide other nav items
                const navLinks = nav.querySelectorAll('a');
                navLinks.forEach(link => {
                    const isSearch = link.getAttribute('aria-label')?.includes('Search') || link.textContent?.trim() === 'Search';
                    const isMessages = link.getAttribute('href')?.includes('/direct/inbox') || 
                                     link.getAttribute('aria-label')?.includes('Direct messaging') ||
                                     link.textContent?.trim() === 'Messages';
                    
                    if (!isSearch && !isMessages) {
                        // Hide other nav items
                        const navItem = link.closest('div[class*="x1n2onr6"]') || link.parentElement;
                        if (navItem && navItem !== nav) {
                            navItem.style.display = 'none';
                            navItem.setAttribute('data-instagram-hidden', 'true');
                        }
                    } else {
                        // Ensure search and messages are visible
                        link.style.display = '';
                        link.removeAttribute('data-instagram-hidden');
                        const navItem = link.closest('div[class*="x1n2onr6"]') || link.parentElement;
                        if (navItem) {
                            navItem.style.display = '';
                            navItem.removeAttribute('data-instagram-hidden');
                        }
                    }
                });
            }
        }

        // Filter stories within the story tray
        filterStoriesByUsername();
        
        // Apply whitelist-based filtering if whitelist is configured
        if (storyTray) {
            // Make sure story tray and its ancestors are visible
            storyTray.style.display = '';
            storyTray.removeAttribute('data-instagram-hidden');
            
            // Ensure all ancestors of story tray are visible
            let parent = storyTray.parentElement;
            while (parent && parent !== document.body) {
                parent.style.display = '';
                parent.removeAttribute('data-instagram-hidden');
                parent = parent.parentElement;
            }
            
            // Find all story items (li elements in the story tray)
            const storyItems = storyTray.querySelectorAll('li._acaz, li[style*="translateX"]');
            storyItems.forEach(storyItem => {
                // Find the story button/div within the li
                const storyButton = storyItem.querySelector('[role="button"][aria-label*="Story by"]') ||
                                  storyItem.querySelector('div[aria-label*="Story by"]');
                
                if (storyButton) {
                    if (shouldShowStory(storyButton)) {
                        // Show whitelisted stories
                        storyItem.style.display = '';
                        storyItem.removeAttribute('data-instagram-hidden');
                        storyButton.style.display = '';
                        storyButton.removeAttribute('data-instagram-hidden');
                    } else {
                        // Hide non-whitelisted stories
                        storyItem.style.display = 'none';
                        storyItem.setAttribute('data-instagram-hidden', 'true');
                    }
                }
            });

            // Also filter any story buttons directly
            const storyButtons = storyTray.querySelectorAll('[role="button"][aria-label*="Story by"]');
            storyButtons.forEach(button => {
                const parentLi = button.closest('li');
                if (parentLi) {
                    if (shouldShowStory(button)) {
                        parentLi.style.display = '';
                        parentLi.removeAttribute('data-instagram-hidden');
                    } else {
                        parentLi.style.display = 'none';
                        parentLi.setAttribute('data-instagram-hidden', 'true');
                    }
                }
            });
        }
    }

    /**
     * Initialize the filter
     */
    function init() {
        // Load settings and whitelist
        if (typeof browser !== 'undefined' && browser.storage) {
            browser.storage.local.get([STORAGE_KEY, USERNAME_WHITELIST_KEY]).then(result => {
                isEnabled = result[STORAGE_KEY] !== false;
                usernameWhitelist = result[USERNAME_WHITELIST_KEY] || [];
                startFiltering();
            }).catch(() => {
                isEnabled = true;
                usernameWhitelist = [];
                startFiltering();
            });
        } else {
            isEnabled = true;
            usernameWhitelist = [];
            startFiltering();
        }

        // Listen for settings changes
        if (typeof browser !== 'undefined' && browser.storage) {
            browser.storage.onChanged.addListener((changes, areaName) => {
                if (areaName === 'local') {
                    if (changes[STORAGE_KEY]) {
                        isEnabled = changes[STORAGE_KEY].newValue !== false;
                        if (isEnabled) {
                            startFiltering();
                        } else {
                            stopFiltering();
                        }
                    }
                    if (changes[USERNAME_WHITELIST_KEY]) {
                        usernameWhitelist = changes[USERNAME_WHITELIST_KEY].newValue || [];
                        if (isEnabled) {
                            hideEverything();
                        }
                    }
                }
            });
        }
    }

    /**
     * Start filtering with MutationObserver
     */
    function startFiltering() {
        if (!isEnabled) return;

        function waitForBody(callback) {
            if (document.body) {
                callback();
            } else {
                setTimeout(() => waitForBody(callback), 100);
            }
        }

        waitForBody(() => {
            // Initial filter with multiple attempts
            hideMainFeedContent();
            filterStoriesByUsername();
            hideEverything();
            setTimeout(() => {
                hideMainFeedContent();
                filterStoriesByUsername();
                hideEverything();
            }, 500);
            setTimeout(() => {
                hideMainFeedContent();
                filterStoriesByUsername();
                hideEverything();
            }, 1000);
            setTimeout(() => {
                hideMainFeedContent();
                filterStoriesByUsername();
                hideEverything();
            }, 2000);

            // Set up MutationObserver
            if (observer) {
                observer.disconnect();
            }

            observer = new MutationObserver((mutations) => {
                clearTimeout(hideInterval);
                hideInterval = setTimeout(() => {
                    hideMainFeedContent();
                    filterStoriesByUsername();
                    hideEverything();
                }, 100);
            });

            if (document.body) {
                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: false
                });
            }

            // Set up MutationObserver specifically for story list to watch for new stories
            function setupStoryObserver() {
                const storyList = document.querySelector('ul._acay');
                if (storyList) {
                    // Disconnect existing observer if any
                    if (storyObserver) {
                        storyObserver.disconnect();
                    }

                    // Create observer for story list children changes
                    storyObserver = new MutationObserver((mutations) => {
                        // Check if any new story items were added
                        const hasNewStories = mutations.some(mutation => 
                            mutation.addedNodes.length > 0 &&
                            Array.from(mutation.addedNodes).some(node => 
                                node.nodeType === Node.ELEMENT_NODE && 
                                (node.classList?.contains('_acaz') || node.tagName === 'LI')
                            )
                        );
                        
                        if (hasNewStories) {
                            // Filter new stories immediately
                            filterStoriesByUsername();
                        }
                    });

                    // Observe only direct children of the story list
                    storyObserver.observe(storyList, {
                        childList: true,
                        subtree: false // Only watch direct children (li elements)
                    });
                } else {
                    // Story list doesn't exist yet, try again later
                    setTimeout(setupStoryObserver, 500);
                }
            }

            // Set up the story observer
            setupStoryObserver();

            // Handle navigation (Instagram is a SPA)
            let lastUrl = location.href;
            urlObserver = new MutationObserver(() => {
                const url = location.href;
                if (url !== lastUrl) {
                    lastUrl = url;
                    document.querySelectorAll('[data-instagram-hidden]').forEach(el => {
                        el.removeAttribute('data-instagram-hidden');
                    });
                    // Re-setup story observer after navigation
                    setTimeout(() => {
                        const storyList = document.querySelector('ul._acay');
                        if (storyList && storyObserver) {
                            storyObserver.disconnect();
                            storyObserver.observe(storyList, {
                                childList: true,
                                subtree: false
                            });
                        }
                    }, 200);
                    setTimeout(() => {
                        hideMainFeedContent();
                        filterStoriesByUsername();
                        hideEverything();
                    }, 500);
                    setTimeout(() => {
                        hideMainFeedContent();
                        filterStoriesByUsername();
                        hideEverything();
                    }, 1200);
                }
            });

            urlObserver.observe(document, { 
                subtree: true, 
                childList: true,
                attributes: true,
                attributeFilter: ['href']
            });

            // Periodic check
            periodicInterval = setInterval(() => {
                if (isEnabled) {
                    hideMainFeedContent();
                    filterStoriesByUsername();
                    hideEverything();
                }
            }, 3000);
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
        if (storyObserver) {
            storyObserver.disconnect();
            storyObserver = null;
        }
        if (urlObserver) {
            urlObserver.disconnect();
            urlObserver = null;
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
        document.querySelectorAll('[data-instagram-hidden]').forEach(el => {
            el.style.display = '';
            el.removeAttribute('data-instagram-hidden');
        });
    }

    // Start when script loads
    init();
})();

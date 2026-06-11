// Unified Auto-Refresh System for MediForge
// DISABLED: This script was causing endless refresh loops on mobile
// It replaces all the conflicting cache busting scripts with one unified solution
// Enhanced for mobile browsers with aggressive cache busting strategies

console.log('🔄 Unified Auto-Refresh System DISABLED to prevent mobile refresh loops');

// DISABLED: Don't execute any of the code below
return;

(function() {
    'use strict';
    
    // Configuration
    const CONFIG = {
        // Current version - update this when you make changes
        CURRENT_VERSION: '20251022120000',
        
        // Old versions that should trigger refresh
        OLD_VERSIONS: [
            'v=20251019043800',
            'v=20251019050000', 
            'v=20251022040000',
            'v=202510220113110113111311',
            'v=1'
        ],
        
        // Refresh intervals (in milliseconds) - more aggressive for mobile
        DESKTOP_CHECK_INTERVAL: 10000,  // 10 seconds
        MOBILE_CHECK_INTERVAL: 3000,    // 3 seconds for mobile (more aggressive)
        
        // Maximum refresh attempts to prevent infinite loops
        MAX_REFRESH_ATTEMPTS: 5,  // Increased for mobile
        
        // Mobile-specific settings
        MOBILE_AGGRESSIVE_MODE: true,
        MOBILE_CACHE_CLEAR_INTERVAL: 2000,  // Clear cache every 2 seconds on mobile
        MOBILE_FORCE_RELOAD_DELAY: 1000     // Delay before force reload on mobile
    };
    
    // Utility functions
    function isMobileDevice() {
        return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    
    function isIOSDevice() {
        return /iPhone|iPad|iPod/i.test(navigator.userAgent);
    }
    
    function isAndroidDevice() {
        return /Android/i.test(navigator.userAgent);
    }
    
    function getQueryParam(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }
    
    function getRefreshAttempts() {
        return parseInt(getQueryParam('refreshAttempts') || '0');
    }
    
    function incrementRefreshAttempts() {
        const current = getRefreshAttempts();
        const url = new URL(window.location);
        url.searchParams.set('refreshAttempts', (current + 1).toString());
        return url.toString();
    }
    
    // Mobile-specific cache clearing
    function clearMobileCache() {
        console.log('📱 Clearing mobile cache aggressively...');
        
        // Clear all possible caches
        if ('caches' in window) {
            caches.keys().then(function(cacheNames) {
                cacheNames.forEach(function(cacheName) {
                    console.log('🗑️ Mobile: Clearing cache:', cacheName);
                    caches.delete(cacheName);
                });
            });
        }
        
        // Clear localStorage with mobile-specific keys
        const keysToRemove = [
            'ehrAppVersion', 'autoRefreshVersion', 'universalAutoRefreshVersion',
            'mobileCacheNotificationShown', 'appVersion', 'mobileCacheRefresh',
            'ehrAppCache', 'mobileAppCache', 'browserCache'
        ];
        
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });
        
        // Clear sessionStorage completely
        sessionStorage.clear();
        
        // For iOS Safari, try to clear webkit cache
        if (isIOSDevice()) {
            try {
                // Force iOS Safari to clear cache
                if (window.webkit && window.webkit.messageHandlers) {
                    console.log('🍎 iOS: Attempting webkit cache clear');
                }
            } catch (e) {
                console.log('🍎 iOS: Webkit cache clear failed:', e);
            }
        }
        
        // For Android Chrome, try to clear cache
        if (isAndroidDevice()) {
            try {
                // Force Android Chrome to clear cache
                if (navigator.serviceWorker) {
                    navigator.serviceWorker.getRegistrations().then(function(registrations) {
                        registrations.forEach(function(registration) {
                            registration.unregister();
                            console.log('🤖 Android: Unregistered service worker');
                        });
                    });
                }
            } catch (e) {
                console.log('🤖 Android: Service worker unregister failed:', e);
            }
        }
    }
    
    // Check if refresh is needed
    function shouldRefresh() {
        console.log('🔍 Checking if refresh is needed...');
        
        // Check if we've exceeded max refresh attempts
        if (getRefreshAttempts() >= CONFIG.MAX_REFRESH_ATTEMPTS) {
            console.log('🛑 Max refresh attempts reached, stopping to prevent infinite loop');
            // Stop all periodic checks
            if (window.refreshIntervalId) {
                clearInterval(window.refreshIntervalId);
                window.refreshIntervalId = null;
            }
            if (window.mobileCacheIntervalId) {
                clearInterval(window.mobileCacheIntervalId);
                window.mobileCacheIntervalId = null;
            }
            return false;
        }
        
        // Check localStorage version
        const storedVersion = localStorage.getItem('ehrAppVersion');
        if (storedVersion !== CONFIG.CURRENT_VERSION) {
            console.log('🔄 Version mismatch detected:', storedVersion, 'vs', CONFIG.CURRENT_VERSION);
            return true;
        }
        
        // Check for old script versions in the page
        const scripts = document.querySelectorAll('script[src*="v="]');
        for (const script of scripts) {
            const src = script.src;
            for (const oldVersion of CONFIG.OLD_VERSIONS) {
                if (src.includes(oldVersion)) {
                    console.log('🔄 Old script version detected:', src);
                    return true;
                }
            }
        }
        
        // Check URL parameters for old versions
        const urlVersion = getQueryParam('v');
        if (urlVersion) {
            for (const oldVersion of CONFIG.OLD_VERSIONS) {
                if (urlVersion.includes(oldVersion.replace('v=', ''))) {
                    console.log('🔄 Old URL version detected:', urlVersion);
                    return true;
                }
            }
        }
        
        // Check for missing critical functionality
        if (typeof window.supabaseClient === 'undefined') {
            console.log('🔄 Supabase client missing - refresh needed');
            return true;
        }
        
        console.log('✅ No refresh needed');
        return false;
    }
    
    // Perform hard refresh with cache clearing
    function performHardRefresh() {
        console.log('🔄 Performing unified hard refresh...');
        
        // Use mobile-specific cache clearing if on mobile
        if (isMobileDevice()) {
            clearMobileCache();
        } else {
            // Desktop cache clearing
            if ('caches' in window) {
                caches.keys().then(function(cacheNames) {
                    cacheNames.forEach(function(cacheName) {
                        console.log('🗑️ Clearing cache:', cacheName);
                        caches.delete(cacheName);
                    });
                });
            }
            
            // Clear localStorage versions
            localStorage.removeItem('ehrAppVersion');
            localStorage.removeItem('autoRefreshVersion');
            localStorage.removeItem('universalAutoRefreshVersion');
            localStorage.removeItem('mobileCacheNotificationShown');
            
            // Clear sessionStorage
            sessionStorage.clear();
        }
        
        // Set new version
        localStorage.setItem('ehrAppVersion', CONFIG.CURRENT_VERSION);
        
        // Create new URL with aggressive cache busting parameters
        const url = new URL(window.location);
        url.searchParams.set('v', CONFIG.CURRENT_VERSION);
        url.searchParams.set('cb', Date.now());
        url.searchParams.set('refresh', 'auto');
        url.searchParams.set('t', Date.now());
        url.searchParams.set('cache', 'bust');
        url.searchParams.set('mobile', isMobileDevice() ? '1' : '0');
        
        // Add mobile-specific parameters
        if (isMobileDevice()) {
            url.searchParams.set('force', '1');
            url.searchParams.set('nocache', '1');
            url.searchParams.set('timestamp', Date.now());
        }
        
        // Increment refresh attempts
        const newUrl = incrementRefreshAttempts();
        const finalUrl = new URL(newUrl);
        finalUrl.searchParams.set('v', CONFIG.CURRENT_VERSION);
        finalUrl.searchParams.set('cb', Date.now());
        finalUrl.searchParams.set('refresh', 'auto');
        finalUrl.searchParams.set('t', Date.now());
        finalUrl.searchParams.set('cache', 'bust');
        finalUrl.searchParams.set('mobile', isMobileDevice() ? '1' : '0');
        
        if (isMobileDevice()) {
            finalUrl.searchParams.set('force', '1');
            finalUrl.searchParams.set('nocache', '1');
            finalUrl.searchParams.set('timestamp', Date.now());
        }
        
        console.log('🔄 Redirecting to:', finalUrl.toString());
        
        // Use different strategies for mobile vs desktop
        if (isMobileDevice()) {
            // For mobile, use multiple strategies
            setTimeout(() => {
                // Try location.replace first
                window.location.replace(finalUrl.toString());
            }, CONFIG.MOBILE_FORCE_RELOAD_DELAY);
            
            // Backup strategy for mobile
            setTimeout(() => {
                if (window.location.href === finalUrl.toString()) {
                    console.log('📱 Mobile: Backup refresh strategy');
                    window.location.href = finalUrl.toString();
                }
            }, CONFIG.MOBILE_FORCE_RELOAD_DELAY + 500);
        } else {
            // Desktop: use location.replace
            window.location.replace(finalUrl.toString());
        }
    }
    
    // Show refresh notification
    function showRefreshNotification() {
        // Don't show if already shown
        if (document.getElementById('unified-refresh-notification')) {
            return;
        }
        
        console.log('🔄 Showing unified refresh notification');
        
        const notification = document.createElement('div');
        notification.id = 'unified-refresh-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 350px;
            font-size: 14px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            animation: slideInFromRight 0.5s ease-out;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                <span style="font-size: 20px; margin-right: 10px;">🔄</span>
                <strong>Updating App</strong>
            </div>
            <div style="margin-bottom: 15px; line-height: 1.5;">
                Loading the latest version for optimal performance and security.
            </div>
            <div style="display: flex; justify-content: center;">
                <div style="width: 30px; height: 30px; border: 3px solid rgba(255,255,255,0.3); border-top: 3px solid white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Add CSS animations
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes slideInFromRight {
                from { opacity: 0; transform: translateX(100%); }
                to { opacity: 1; transform: translateX(0); }
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Start the auto-refresh system
    function startAutoRefresh() {
        const interval = isMobileDevice() ? CONFIG.MOBILE_CHECK_INTERVAL : CONFIG.DESKTOP_CHECK_INTERVAL;
        
        console.log(`🔄 Unified auto-refresh started - checking every ${interval/1000} seconds`);
        
        // Store interval ID so we can clear it later
        window.refreshIntervalId = setInterval(() => {
            if (shouldRefresh()) {
                showRefreshNotification();
                setTimeout(performHardRefresh, 2000); // Wait 2 seconds to show notification
            }
        }, interval);
        
        // Mobile-specific: continuous cache clearing
        if (isMobileDevice() && CONFIG.MOBILE_AGGRESSIVE_MODE) {
            console.log('📱 Mobile: Starting aggressive cache clearing');
            window.mobileCacheIntervalId = setInterval(() => {
                console.log('📱 Mobile: Periodic cache clearing...');
                clearMobileCache();
            }, CONFIG.MOBILE_CACHE_CLEAR_INTERVAL);
        }
    }
    
    // Reset refresh attempts (call this when you want to allow refreshes again)
    function resetRefreshAttempts() {
        console.log('🔄 Resetting refresh attempts');
        const url = new URL(window.location);
        url.searchParams.delete('refreshAttempts');
        url.searchParams.set('reset', 'true');
        window.location.replace(url.toString());
    }
    
    // Initialize the system
    function initialize() {
        console.log('🔄 Initializing unified auto-refresh system...');
        
        // Check immediately on load
        if (shouldRefresh()) {
            console.log('🔄 Immediate refresh needed');
            showRefreshNotification();
            setTimeout(performHardRefresh, 2000);
        } else {
            console.log('✅ No immediate refresh needed, starting periodic checks');
            startAutoRefresh();
        }
    }
    
    // Event listeners for additional triggers
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden && shouldRefresh()) {
            console.log('🔄 Tab became visible, checking for refresh');
            showRefreshNotification();
            setTimeout(performHardRefresh, 2000);
        }
    });
    
    window.addEventListener('focus', function() {
        if (shouldRefresh()) {
            console.log('🔄 Window focused, checking for refresh');
            showRefreshNotification();
            setTimeout(performHardRefresh, 2000);
        }
    });
    
    // Mobile-specific event listeners
    if (isMobileDevice()) {
        // Touch events for mobile
        document.addEventListener('touchstart', function() {
            if (shouldRefresh()) {
                console.log('📱 Mobile: Touch detected, checking for refresh');
                showRefreshNotification();
                setTimeout(performHardRefresh, 1000);
            }
        });
        
        // Orientation change for mobile
        window.addEventListener('orientationchange', function() {
            console.log('📱 Mobile: Orientation changed, checking for refresh');
            setTimeout(() => {
                if (shouldRefresh()) {
                    showRefreshNotification();
                    setTimeout(performHardRefresh, 1000);
                }
            }, 500);
        });
        
        // Page show event for mobile (when returning from background)
        window.addEventListener('pageshow', function(event) {
            if (event.persisted) {
                console.log('📱 Mobile: Page restored from cache, forcing refresh');
                showRefreshNotification();
                setTimeout(performHardRefresh, 1000);
            }
        });
        
        // Online/offline events for mobile
        window.addEventListener('online', function() {
            console.log('📱 Mobile: Back online, checking for refresh');
            if (shouldRefresh()) {
                showRefreshNotification();
                setTimeout(performHardRefresh, 1000);
            }
        });
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
    // Also check on window load
    window.addEventListener('load', function() {
        setTimeout(() => {
            if (shouldRefresh()) {
                console.log('🔄 Window loaded, checking for refresh');
                showRefreshNotification();
                setTimeout(performHardRefresh, 2000);
            }
        }, 1000);
    });
    
})();

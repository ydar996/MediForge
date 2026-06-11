// Simple Auto-Refresh System for MediForge
// This is a simplified version that won't cause infinite loops
// It only refreshes once when needed, then stops

console.log('🔄 Simple Auto-Refresh System loaded');

(function() {
    'use strict';
    
    // Configuration
    const CONFIG = {
        CURRENT_VERSION: '20251022120000',
        // Only list known bad *app* cache-bust query strings. Do NOT use 'v=1' — many data
        // files legitimately use ?v=1; src.includes('v=1') also false-positives on ?v=10, etc.
        OLD_VERSIONS: [
            'v=20251019043800',
            'v=20251019050000',
            'v=20251022040000',
            'v=202510220113110113111311'
        ]
    };
    
    // Check if mobile device
    function isMobileDevice() {
        return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    
    // Check if we're in a refresh loop
    function isInRefreshLoop() {
        const refreshAttempts = parseInt(new URLSearchParams(window.location.search).get('refreshAttempts') || '0');
        return refreshAttempts >= 3; // Stop after 3 attempts
    }
    
    // Show manual refresh option when auto-refresh fails
    function showManualRefreshOption() {
        if (document.getElementById('manual-refresh-option')) return;
        
        console.log('🔄 Auto-refresh failed, showing manual option');
        
        const notification = document.createElement('div');
        notification.id = 'manual-refresh-option';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 350px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            animation: slideInFromRight 0.5s ease-out;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                <span style="font-size: 20px; margin-right: 10px;">⚠️</span>
                <strong>Update Required</strong>
            </div>
            <div style="margin-bottom: 15px; line-height: 1.5;">
                Auto-refresh failed. Please manually refresh to get the latest version.
            </div>
            <div style="display: flex; gap: 10px;">
                <button onclick="forceManualRefresh()" style="
                    background: white;
                    color: #ff6b6b;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 6px;
                    font-weight: 600;
                    cursor: pointer;
                    font-size: 14px;
                ">Refresh Now</button>
                <button onclick="dismissManualRefresh()" style="
                    background: rgba(255,255,255,0.2);
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                ">Dismiss</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Add CSS animation
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes slideInFromRight {
                from { opacity: 0; transform: translateX(100%); }
                to { opacity: 1; transform: translateX(0); }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Force manual refresh
    function forceManualRefresh() {
        console.log('🔄 User requested manual refresh');
        
        // Clear all cache aggressively
        if ('caches' in window) {
            caches.keys().then(function(cacheNames) {
                cacheNames.forEach(function(cacheName) {
                    caches.delete(cacheName);
                });
            });
        }
        
        // Clear all localStorage
        localStorage.clear();
        sessionStorage.clear();
        
        // Force refresh with cache busting
        const url = new URL(window.location);
        url.searchParams.delete('refreshAttempts'); // Reset attempts
        url.searchParams.set('v', CONFIG.CURRENT_VERSION);
        url.searchParams.set('cb', Date.now());
        url.searchParams.set('manual', 'true');
        url.searchParams.set('force', 'true');
        
        console.log('🔄 Manual refresh redirecting to:', url.toString());
        window.location.href = url.toString();
    }
    
    // Dismiss manual refresh option
    function dismissManualRefresh() {
        const notification = document.getElementById('manual-refresh-option');
        if (notification) {
            notification.style.animation = 'slideInFromRight 0.5s ease-out reverse';
            setTimeout(() => {
                notification.remove();
            }, 500);
        }
    }
    
    // Make functions global for button onclick
    window.forceManualRefresh = forceManualRefresh;
    window.dismissManualRefresh = dismissManualRefresh;
    
    // Check if refresh is needed (ignoring loop state)
    function shouldRefreshIgnoringLoop() {
        console.log('🔍 Checking if refresh is needed (ignoring loop state)...');
        
        // Check localStorage version
        const storedVersion = localStorage.getItem('ehrAppVersion');
        if (storedVersion !== CONFIG.CURRENT_VERSION) {
            console.log('🔄 Version mismatch:', storedVersion, 'vs', CONFIG.CURRENT_VERSION);
            return true;
        }
        
        // Check for old script versions
        const scripts = document.querySelectorAll('script[src*="v="]');
        for (const script of scripts) {
            const src = script.src;
            for (const oldVersion of CONFIG.OLD_VERSIONS) {
                if (src.includes(oldVersion)) {
                    console.log('🔄 Old script detected:', src);
                    return true;
                }
            }
        }
        
        console.log('✅ No refresh needed');
        return false;
    }
    
    // Check if refresh is needed
    function shouldRefresh() {
        console.log('🔍 Simple refresh check...');
        
        // Don't refresh if we're in a loop
        if (isInRefreshLoop()) {
            console.log('🛑 In refresh loop, stopping checks');
            return false;
        }
        
        return shouldRefreshIgnoringLoop();
    }
    
    // Mobile-specific cache clearing
    function clearMobileCache() {
        console.log('📱 Clearing mobile cache...');
        
        // Clear all caches
        if ('caches' in window) {
            caches.keys().then(function(cacheNames) {
                cacheNames.forEach(function(cacheName) {
                    caches.delete(cacheName);
                });
            });
        }
        
        // Clear mobile-specific localStorage keys
        const keysToRemove = [
            'ehrAppVersion', 'autoRefreshVersion', 'universalAutoRefreshVersion',
            'mobileCacheNotificationShown', 'appVersion', 'mobileCacheRefresh',
            'ehrAppCache', 'mobileAppCache', 'browserCache'
        ];
        
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });
        
        // Clear sessionStorage
        sessionStorage.clear();
        
        // For iOS Safari, try to clear webkit cache
        if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            try {
                if (window.webkit && window.webkit.messageHandlers) {
                    console.log('🍎 iOS: Attempting webkit cache clear');
                }
            } catch (e) {
                console.log('🍎 iOS: Webkit cache clear failed:', e);
            }
        }
        
        // For Android Chrome, try to clear cache
        if (/Android/i.test(navigator.userAgent)) {
            try {
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
    
    // Perform single refresh
    function performRefresh() {
        console.log('🔄 Performing single refresh...');
        
        // Use mobile-specific cache clearing if on mobile
        if (isMobileDevice()) {
            clearMobileCache();
        } else {
            // Desktop cache clearing
            if ('caches' in window) {
                caches.keys().then(function(cacheNames) {
                    cacheNames.forEach(function(cacheName) {
                        caches.delete(cacheName);
                    });
                });
            }
            
            // Clear localStorage
            localStorage.removeItem('ehrAppVersion');
            localStorage.removeItem('autoRefreshVersion');
            localStorage.removeItem('universalAutoRefreshVersion');
        }
        
        // Set new version
        localStorage.setItem('ehrAppVersion', CONFIG.CURRENT_VERSION);
        
        // Create new URL with mobile-specific parameters
        const url = new URL(window.location);
        const refreshAttempts = parseInt(url.searchParams.get('refreshAttempts') || '0');
        url.searchParams.set('refreshAttempts', (refreshAttempts + 1).toString());
        url.searchParams.set('v', CONFIG.CURRENT_VERSION);
        url.searchParams.set('cb', Date.now());
        
        // Add mobile-specific parameters
        if (isMobileDevice()) {
            url.searchParams.set('mobile', '1');
            url.searchParams.set('force', '1');
            url.searchParams.set('nocache', '1');
            url.searchParams.set('timestamp', Date.now());
        }
        
        console.log('🔄 Redirecting to:', url.toString());
        
        // Use different strategies for mobile vs desktop
        if (isMobileDevice()) {
            // For mobile, use location.href for better compatibility
            window.location.href = url.toString();
        } else {
            // Desktop: use location.replace
            window.location.replace(url.toString());
        }
    }
    
    // Show notification
    function showNotification() {
        if (document.getElementById('simple-refresh-notification')) return;
        
        const notification = document.createElement('div');
        notification.id = 'simple-refresh-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        notification.innerHTML = '🔄 Updating to latest version...';
        document.body.appendChild(notification);
    }
    
    // Initialize
    function initialize() {
        console.log('🔄 Simple auto-refresh initialized');
        
        // Check if we're in a refresh loop (auto-refresh failed)
        if (isInRefreshLoop()) {
            console.log('🛑 Auto-refresh failed after 3 attempts');
            
            // Check if we still need a refresh (ignoring loop state)
            if (shouldRefreshIgnoringLoop()) {
                console.log('🔄 Still need refresh, showing manual option');
                showManualRefreshOption();
            } else {
                console.log('✅ No refresh needed, system is up to date');
            }
            return;
        }
        
        // Check once on load
        if (shouldRefresh()) {
            console.log('🔄 Refresh needed, showing notification');
            showNotification();
            setTimeout(performRefresh, 2000);
        } else {
            console.log('✅ No refresh needed');
        }
        
        // Mobile-specific event listeners
        if (isMobileDevice()) {
            console.log('📱 Mobile device detected - setting up mobile-specific listeners');
            
            // Touch events for mobile
            document.addEventListener('touchstart', function() {
                if (shouldRefresh()) {
                    console.log('📱 Mobile: Touch detected, checking for refresh');
                    showNotification();
                    setTimeout(performRefresh, 1000);
                }
            });
            
            // Orientation change for mobile
            window.addEventListener('orientationchange', function() {
                console.log('📱 Mobile: Orientation changed, checking for refresh');
                setTimeout(() => {
                    if (shouldRefresh()) {
                        showNotification();
                        setTimeout(performRefresh, 1000);
                    }
                }, 500);
            });
            
            // Page show event for mobile (when returning from background)
            window.addEventListener('pageshow', function(event) {
                if (event.persisted) {
                    console.log('📱 Mobile: Page restored from cache, forcing refresh');
                    showNotification();
                    setTimeout(performRefresh, 1000);
                }
            });
            
            // Online/offline events for mobile
            window.addEventListener('online', function() {
                console.log('📱 Mobile: Back online, checking for refresh');
                if (shouldRefresh()) {
                    showNotification();
                    setTimeout(performRefresh, 1000);
                }
            });
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
})();

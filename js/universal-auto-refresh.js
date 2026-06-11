// js/universal-auto-refresh.js - Smart refresh with loop prevention
console.log('🔄 Universal auto refresh loaded with smart loop prevention');

(function() {
    const SCRIPT_VERSION = '20251022080000'; // Update this to force refresh
    const REFRESH_INTERVAL = 30000; // 30 seconds
    const MOBILE_REFRESH_INTERVAL = 15000; // 15 seconds for mobile
    const CHECK_INTERVAL = 5000; // Check every 5 seconds
    
    function isMobileDevice() {
        return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    
    function getQueryParam(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }
    
    function shouldForceRefresh() {
        // LOOP PREVENTION: Check if we're already in a refresh cycle
        const lastRefresh = localStorage.getItem('lastUniversalRefresh');
        const now = Date.now();
        if (lastRefresh && (now - parseInt(lastRefresh)) < 10000) { // 10 seconds cooldown
            console.log('🔄 Refresh cooldown active - preventing loop');
            return false;
        }
        
        // Check if this is a new version
        const lastVersion = localStorage.getItem('universalAutoRefreshVersion');
        if (lastVersion !== SCRIPT_VERSION) {
            console.log('🔄 New universal version detected, forcing refresh');
            localStorage.setItem('universalAutoRefreshVersion', SCRIPT_VERSION);
            localStorage.setItem('lastUniversalRefresh', now.toString());
            return true;
        }
        
        // Check if URL has old version parameters
        const urlVersion = getQueryParam('v');
        if (urlVersion && (urlVersion.includes('20251019043800') || urlVersion.includes('20251019050000'))) {
            console.log('🔄 Old version parameter detected, forcing refresh');
            return true;
        }
        
        // Check if localStorage has old version
        const storedVersion = localStorage.getItem('ehrAppVersion');
        if (storedVersion && (storedVersion.includes('20251019043800') || storedVersion.includes('20251019050000'))) {
            console.log('🔄 Old localStorage version detected, forcing refresh');
            return true;
        }
        
        // Check for old script versions in the page
        const scripts = document.querySelectorAll('script[src*="v="]');
        for (let script of scripts) {
            const src = script.src;
            if (src.includes('v=20251019043800') || src.includes('v=20251019050000')) {
                console.log('🔄 Old script version detected:', src);
                return true;
            }
        }
        
        return false;
    }
    
    function performHardRefresh() {
        console.log('🔄 Performing universal hard refresh...');
        
        // Set refresh timestamp to prevent loops
        localStorage.setItem('lastUniversalRefresh', Date.now().toString());
        
        // Clear all caches
        if ('caches' in window) {
            caches.keys().then(function(names) {
                names.forEach(function(name) {
                    caches.delete(name);
                });
            });
        }
        
        // Clear localStorage versions
        localStorage.removeItem('ehrAppVersion');
        localStorage.removeItem('universalAutoRefreshVersion');
        localStorage.removeItem('autoRefreshVersion');
        
        // Force refresh with cache busting
        const url = new URL(window.location);
        url.searchParams.set('v', SCRIPT_VERSION);
        url.searchParams.set('cb', Date.now());
        url.searchParams.set('refresh', 'auto');
        
        console.log('🔄 Universal redirect to:', url.toString());
        window.location.href = url.toString();
    }
    
    function showRefreshNotification() {
        // Only show if not already shown
        if (document.getElementById('universal-refresh-notification')) {
            return;
        }
        
        console.log('🔄 Showing universal refresh notification');
        
        const notification = document.createElement('div');
        notification.id = 'universal-refresh-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10001;
            max-width: 300px;
            font-size: 14px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            flex-direction: column;
            gap: 10px;
            animation: universalSlideIn 0.5s ease-out;
        `;
        
        notification.innerHTML = `
            <strong>🔄 Universal Auto-Refresh</strong>
            <span>Loading latest version for optimal performance</span>
            <div style="display: flex; justify-content: center;">
                <div style="width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid white; border-radius: 50%; animation: universalSpin 1s linear infinite;"></div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Add CSS animations
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes universalSlideIn {
                from { opacity: 0; transform: translateX(100%); }
                to { opacity: 1; transform: translateX(0); }
            }
            @keyframes universalSpin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
    
    function startUniversalAutoRefresh() {
        const interval = isMobileDevice() ? MOBILE_REFRESH_INTERVAL : REFRESH_INTERVAL;
        
        console.log(`🔄 Universal auto refresh started - checking every ${interval/1000} seconds`);
        
        setInterval(() => {
            if (shouldForceRefresh()) {
                showRefreshNotification();
                setTimeout(performHardRefresh, 2000); // Wait 2 seconds to show notification
            }
        }, interval);
    }
    
    function startContinuousChecking() {
        console.log('🔄 Starting continuous version checking...');
        
        setInterval(() => {
            if (shouldForceRefresh()) {
                console.log('🔄 Continuous check detected refresh needed');
                showRefreshNotification();
                setTimeout(performHardRefresh, 1000); // Quick refresh for continuous check
            }
        }, CHECK_INTERVAL);
    }
    
    // Check immediately on load
    if (shouldForceRefresh()) {
        console.log('🔄 Immediate universal refresh needed');
        showRefreshNotification();
        setTimeout(performHardRefresh, 2000);
    } else {
        // Start both periodic checking and continuous checking
        startUniversalAutoRefresh();
        startContinuousChecking();
    }
    
    // Also check on visibility change (when user returns to tab)
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden && shouldForceRefresh()) {
            console.log('🔄 Tab became visible, checking for universal refresh');
            showRefreshNotification();
            setTimeout(performHardRefresh, 2000);
        }
    });
    
    // Check on focus (when user clicks on window)
    window.addEventListener('focus', function() {
        if (shouldForceRefresh()) {
            console.log('🔄 Window focused, checking for universal refresh');
            showRefreshNotification();
            setTimeout(performHardRefresh, 2000);
        }
    });
    
    // Check on page load completion
    window.addEventListener('load', function() {
        setTimeout(() => {
            if (shouldForceRefresh()) {
                console.log('🔄 Page load complete, checking for universal refresh');
                showRefreshNotification();
                setTimeout(performHardRefresh, 2000);
            }
        }, 1000);
    });
    
    // Check on DOM content loaded
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(() => {
            if (shouldForceRefresh()) {
                console.log('🔄 DOM loaded, checking for universal refresh');
                showRefreshNotification();
                setTimeout(performHardRefresh, 2000);
            }
        }, 500);
    });
    
})();

// js/auto-hard-refresh.js
// DISABLED: Auto hard refresh for mobile browsers - was causing endless loops
console.log('🔄 Auto hard refresh DISABLED to prevent mobile refresh loops');

// DISABLED: Don't execute any of the code below
return;

(function() {
    const SCRIPT_VERSION = '20251022080000'; // Update this to force refresh
    const REFRESH_INTERVAL = 5000; // 5 seconds
    const MOBILE_REFRESH_INTERVAL = 3000; // 3 seconds for mobile
    
    function isMobileDevice() {
        return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    
    function getQueryParam(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }
    
    function shouldForceRefresh() {
        console.log('🔍 Checking if refresh is needed...');
        
        // Check if this is a new version
        const lastVersion = localStorage.getItem('autoRefreshVersion');
        console.log('🔍 Last version:', lastVersion, 'Current version:', SCRIPT_VERSION);
        if (lastVersion !== SCRIPT_VERSION) {
            console.log('🔄 New version detected, forcing refresh');
            localStorage.setItem('autoRefreshVersion', SCRIPT_VERSION);
            return true;
        }
        
        // Check if URL has old version parameters
        const urlVersion = getQueryParam('v');
        console.log('🔍 URL version:', urlVersion);
        if (urlVersion && (urlVersion.includes('20251019043800') || urlVersion.includes('20251019050000') || urlVersion.includes('20251022040000'))) {
            console.log('🔄 Old version parameter detected, forcing refresh');
            return true;
        }
        
        // Check if localStorage has old version
        const storedVersion = localStorage.getItem('mediforgeAppVersion');
        console.log('🔍 Stored version:', storedVersion);
        if (storedVersion && (storedVersion.includes('20251019043800') || storedVersion.includes('20251019050000') || storedVersion.includes('20251022040000'))) {
            console.log('🔄 Old localStorage version detected, forcing refresh');
            return true;
        }
        
        // Check for old script versions in the page
        const scripts = document.querySelectorAll('script[src*="v="]');
        console.log('🔍 Found', scripts.length, 'scripts with version parameters');
        for (let script of scripts) {
            const src = script.src;
            console.log('🔍 Script src:', src);
            if (src.includes('v=20251019043800') || src.includes('v=20251019050000') || src.includes('v=20251022040000') || src.includes('v=1')) {
                console.log('🔄 Old script version detected:', src);
                return true;
            }
        }
        
        // Check for specific old versions we know are problematic
        if (document.querySelector('script[src*="v=20251022040000"]') || 
            document.querySelector('script[src*="v=202510220113110113111311"]') ||
            document.querySelector('script[src*="v=1"]')) {
            console.log('🔄 Old script versions detected in DOM');
            return true;
        }
        
        console.log('🔍 No refresh needed');
        return false;
    }
    
    function performHardRefresh() {
        console.log('🔄 Performing AGGRESSIVE hard refresh...');
        
        // Clear all caches aggressively
        if ('caches' in window) {
            caches.keys().then(function(names) {
                names.forEach(function(name) {
                    caches.delete(name);
                });
            });
        }
        
        // Clear all localStorage versions
        localStorage.removeItem('mediforgeAppVersion');
        localStorage.removeItem('autoRefreshVersion');
        localStorage.removeItem('universalAutoRefreshVersion');
        
        // Clear sessionStorage
        sessionStorage.clear();
        
        // Force refresh with multiple cache busting parameters
        const url = new URL(window.location);
        url.searchParams.set('v', SCRIPT_VERSION);
        url.searchParams.set('cb', Date.now());
        url.searchParams.set('refresh', 'auto');
        url.searchParams.set('cache', 'bust');
        url.searchParams.set('t', Date.now());
        
        console.log('🔄 AGGRESSIVE redirect to:', url.toString());
        
        // Use location.replace for more aggressive refresh
        window.location.replace(url.toString());
    }
    
    function showRefreshNotification() {
        // Only show if not already shown
        if (document.getElementById('auto-refresh-notification')) {
            return;
        }
        
        console.log('🔄 Showing refresh notification');
        
        // Wait for document.body to be ready
        function addNotification() {
            if (document.body) {
                const notification = document.createElement('div');
                notification.id = 'auto-refresh-notification';
                notification.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
                    color: white;
                    padding: 15px 20px;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    z-index: 10000;
                    max-width: 300px;
                    font-size: 14px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    animation: slideIn 0.5s ease-out;
                `;
                
                notification.innerHTML = `
                    <strong>🔄 Auto-Refreshing...</strong>
                    <span>Loading latest version for better performance</span>
                    <div style="display: flex; justify-content: center;">
                        <div style="width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    </div>
                `;
                
                document.body.appendChild(notification);
            } else {
                // If body not ready, try again in 100ms
                setTimeout(addNotification, 100);
            }
        }
        
        addNotification();
        
        // Add CSS animations
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes slideIn {
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
    
    function startAutoRefresh() {
        const interval = isMobileDevice() ? MOBILE_REFRESH_INTERVAL : REFRESH_INTERVAL;
        
        console.log(`🔄 Auto refresh started - checking every ${interval/1000} seconds`);
        
        setInterval(() => {
            if (shouldForceRefresh()) {
                showRefreshNotification();
                setTimeout(performHardRefresh, 2000); // Wait 2 seconds to show notification
            }
        }, interval);
    }
    
    // Check immediately on load
    console.log('🔄 Auto refresh script loaded, checking immediately...');
    
    // Check if we're already in a refresh loop
    const urlParams = new URLSearchParams(window.location.search);
    const refreshCount = parseInt(urlParams.get('refreshCount') || '0');
    
    if (refreshCount >= 3) {
        console.log('🔄 Too many refreshes, stopping to prevent infinite loop');
        return;
    }
    
    // Check for specific old versions we know are problematic
    const hasOldVersions = document.querySelector('script[src*="v=20251022040000"]') || 
                          document.querySelector('script[src*="v=202510220113110113111311"]') ||
                          document.querySelector('script[src*="v=1"]');
    
    if (hasOldVersions) {
        console.log('🔄 OLD VERSIONS DETECTED - FORCING IMMEDIATE REFRESH (attempt', refreshCount + 1, ')');
        showRefreshNotification();
        setTimeout(() => {
            const url = new URL(window.location);
            url.searchParams.set('refreshCount', (refreshCount + 1).toString());
            url.searchParams.set('v', SCRIPT_VERSION);
            url.searchParams.set('cb', Date.now());
            console.log('🔄 Redirecting to:', url.toString());
            window.location.replace(url.toString());
        }, 1000);
    } else if (shouldForceRefresh()) {
        console.log('🔄 Immediate refresh needed');
        showRefreshNotification();
        setTimeout(performHardRefresh, 1000);
    } else {
        console.log('🔄 No immediate refresh needed, starting periodic checks');
        // Start periodic checking
        startAutoRefresh();
    }
    
    // Also check on visibility change (when user returns to tab)
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden && shouldForceRefresh()) {
            console.log('🔄 Tab became visible, checking for refresh');
            showRefreshNotification();
            setTimeout(performHardRefresh, 2000);
        }
    });
    
    // Check on focus (when user clicks on window)
    window.addEventListener('focus', function() {
        if (shouldForceRefresh()) {
            console.log('🔄 Window focused, checking for refresh');
            showRefreshNotification();
            setTimeout(performHardRefresh, 2000);
        }
    });
    
})();

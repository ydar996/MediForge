// js/force-fresh-load.js - Aggressive cache busting that actually works
console.log('🔄 Force fresh load script loaded');

(function() {
    const CURRENT_VERSION = '20251022090000';
    
    function isOldVersion() {
        // Check for old script versions in the page
        const scripts = document.querySelectorAll('script[src*="v="]');
        for (let script of scripts) {
            const src = script.src;
            if (src.includes('v=20251019043800') || 
                src.includes('v=20251019050000') || 
                src.includes('v=20251022040000') ||
                src.includes('v=202510220113110113111311')) {
                console.log('🔄 OLD VERSION DETECTED:', src);
                return true;
            }
        }
        return false;
    }
    
    function forceFreshLoad() {
        console.log('🔄 FORCING FRESH LOAD - clearing all caches...');
        
        // Clear all possible caches
        if ('caches' in window) {
            caches.keys().then(names => {
                names.forEach(name => caches.delete(name));
            });
        }
        
        // Clear localStorage versions
        localStorage.removeItem('mediforgeAppVersion');
        localStorage.removeItem('autoRefreshVersion');
        localStorage.removeItem('universalAutoRefreshVersion');
        
        // Force reload with fresh parameters
        const url = new URL(window.location);
        url.searchParams.set('v', CURRENT_VERSION);
        url.searchParams.set('t', Date.now());
        url.searchParams.set('fresh', 'true');
        
        console.log('🔄 Redirecting to fresh version:', url.toString());
        window.location.replace(url.toString());
    }
    
    // Check immediately on load
    if (isOldVersion()) {
        console.log('🔄 OLD VERSIONS DETECTED - FORCING FRESH LOAD');
        setTimeout(forceFreshLoad, 100);
    } else {
        console.log('✅ Current version detected - no refresh needed');
    }
    
})();




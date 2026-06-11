// Performance Optimization Script for MediForge
// Purpose: Optimize app-wide performance with caching, lazy loading, and resource optimization

const PERFORMANCE_CONFIG = {
    // Cache settings
    cacheVersion: 'v1.0',
    maxCacheSize: 50 * 1024 * 1024, // 50MB
    
    // Lazy loading settings
    lazyLoadThreshold: 100, // pixels from viewport
    lazyLoadDelay: 100, // ms delay for batch loading
    
    // Resource optimization
    imageOptimization: true,
    scriptOptimization: true,
    cssOptimization: true
};

class PerformanceOptimizer {
    constructor() {
        this.cache = new Map();
        this.observers = new Map();
        this.loadedResources = new Set();
        this.init();
    }

    init() {
        console.log('🚀 Performance Optimizer initialized');
        this.setupLazyLoading();
        this.optimizeImages();
        this.preloadCriticalResources();
        this.setupResourceCaching();
        this.optimizeSupabaseQueries();
    }

    // Lazy loading for non-critical resources
    setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            const lazyObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.loadResource(entry.target);
                        lazyObserver.unobserve(entry.target);
                    }
                });
            }, {
                rootMargin: `${PERFORMANCE_CONFIG.lazyLoadThreshold}px`
            });

            // Observe elements with data-lazy attribute
            document.querySelectorAll('[data-lazy]').forEach(el => {
                lazyObserver.observe(el);
            });
        }
    }

    // Optimize images
    optimizeImages() {
        if (!PERFORMANCE_CONFIG.imageOptimization) return;

        const images = document.querySelectorAll('img');
        images.forEach(img => {
            // Add loading="lazy" for images below the fold
            if (!img.hasAttribute('loading')) {
                img.setAttribute('loading', 'lazy');
            }
            
            // Add decoding="async" for better performance
            if (!img.hasAttribute('decoding')) {
                img.setAttribute('decoding', 'async');
            }
        });
    }

    // Preload critical resources
    preloadCriticalResources() {
        const criticalResources = [
            '/css/styles.css',
            '/js/main.js',
            '/js/supabase-client.js'
        ];

        criticalResources.forEach(resource => {
            if (!this.loadedResources.has(resource)) {
                this.preloadResource(resource);
            }
        });
    }

    preloadResource(href) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = href;
        link.as = href.endsWith('.css') ? 'style' : 'script';
        document.head.appendChild(link);
        this.loadedResources.add(href);
    }

    // Resource caching
    setupResourceCaching() {
        // Cache frequently accessed data
        this.cache.set('user', JSON.parse(localStorage.getItem('user') || '{}'));
        this.cache.set('organizations', JSON.parse(localStorage.getItem('organizations') || '{}'));
    }

    // Optimize Supabase queries
    optimizeSupabaseQueries() {
        // Debounce frequent queries
        this.debounceQueries();
        
        // Cache query results
        this.cacheQueryResults();
    }

    debounceQueries() {
        const debouncedQueries = new Map();
        
        // Override common query functions with debounced versions
        if (typeof supabaseClient !== 'undefined') {
            const originalFrom = supabaseClient.from.bind(supabaseClient);
            supabaseClient.from = (table) => {
                const query = originalFrom(table);
                return this.createDebouncedQuery(query, table);
            };
        }
    }

    createDebouncedQuery(query, table) {
        const cacheKey = `query_${table}`;
        const debouncedSelect = this.debounce(query.select.bind(query), 300);
        const debouncedInsert = this.debounce(query.insert.bind(query), 100);
        const debouncedUpdate = this.debounce(query.update.bind(query), 100);
        const debouncedDelete = this.debounce(query.delete.bind(query), 100);

        return {
            ...query,
            select: (...args) => {
                const result = debouncedSelect(...args);
                return this.cacheQueryResult(cacheKey, result);
            },
            insert: debouncedInsert,
            update: debouncedUpdate,
            delete: debouncedDelete
        };
    }

    cacheQueryResult(key, query) {
        return query.then(result => {
            if (result.data && !result.error) {
                this.cache.set(key, {
                    data: result.data,
                    timestamp: Date.now()
                });
            }
            return result;
        });
    }

    // Utility functions
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    loadResource(element) {
        const resource = element.dataset.lazy;
        if (resource && !this.loadedResources.has(resource)) {
            // Load the resource
            if (resource.endsWith('.js')) {
                this.loadScript(resource);
            } else if (resource.endsWith('.css')) {
                this.loadCSS(resource);
            }
            this.loadedResources.add(resource);
        }
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    loadCSS(href) {
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = resolve;
            link.onerror = reject;
            document.head.appendChild(link);
        });
    }

    // Performance monitoring
    measurePerformance() {
        if ('performance' in window) {
            const navigation = performance.getEntriesByType('navigation')[0];
            const paint = performance.getEntriesByType('paint');
            
            const metrics = {
                domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
                loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
                firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
                firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0
            };

            console.log('📊 Performance Metrics:', metrics);
            return metrics;
        }
        return null;
    }

    // Cleanup old cache entries
    cleanupCache() {
        const now = Date.now();
        const maxAge = 5 * 60 * 1000; // 5 minutes

        for (const [key, value] of this.cache.entries()) {
            if (value.timestamp && (now - value.timestamp) > maxAge) {
                this.cache.delete(key);
            }
        }
    }
}

// Initialize performance optimizer when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.performanceOptimizer = new PerformanceOptimizer();
    
    // Measure performance after page load
    window.addEventListener('load', () => {
        setTimeout(() => {
            window.performanceOptimizer.measurePerformance();
        }, 1000);
    });
});

// Export for use in other scripts
window.PerformanceOptimizer = PerformanceOptimizer;







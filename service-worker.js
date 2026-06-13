// Purpose: Root-scoped service worker with absolute paths to avoid cache addAll failures
// TRACE LOG: Service worker updated to v=200 for mobile consistency
const CACHE_NAME = "mediforge-cache-v20260613160000";
const STATIC_CACHE = "mediforge-static-v20260613160000";
const DYNAMIC_CACHE = "mediforge-dynamic-v20260613160000";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/login.html",
  "/dashboard.html",
  "/favicon.svg",
  "/platform-login.html",
  "/platform-dashboard.html",
  "/manage-clinics.html",
  "/clinic-details.html",
  "/platform-analytics.html",
  "/healthcare-staff.html",
  "/platform-audit-log.html",
  "/register-clinic.html",
  "/platform-settings.html",
  "/platform-subscriptions.html",
  "/revenue-analytics.html",
  "/disease-analytics.html",
  "/manage-subscription.html",
  "/patients.html",
  "/add-patient.html",
  "/patient-details.html",
  "/patient-encounters.html",
  "/patient-documents.html",
  "/clinical-note.html",
  "/appointments.html",
  "/add-appointment.html",
  "/reports.html",
  "/schedule.html",
  "/edit-profile.html",
  "/register.html",
  "/preventive-gaps.html",
  "/edit-patient.html",
  "/deleted-patients.html",
  "/set-clinic-schedule.html",
  "/vital-signs-analysis.html",
  "/discharge-summary.html",
  "/prescription.html",
  "/audit-log.html",
  "/data-import-export.html",
  "/css/styles.css",
  "/css/mobile.css",
  "/css/billing-tables.css",
  "/manifest.json",
  "/IMPLEMENTATION-SUMMARY.md",
  "/js/main.js",
  "/js/auth.js",
  "/js/patients-fixed.js",
  "/js/appointments.js",
  "/js/reports.js",
  "/js/preventive.js",
  "/js/icd-config.js",
  "/js/icd10ca.js",
  "/js/icd11.js",
  "/js/icd-selector.js",
  "/js/prescriptions.js",
  "/js/table-alignment-fix.js",
  "/js/backup.js",
  "/js/security.js",
  "/js/platform-admin.js",
  "/js/interoperability.js",
  "/js/performance.js",
  "/js/accessibility.js",
  "/js/billing.js",
  "/js/pricing.js",
  "/js/payments.js",
  "/js/cash-register.js",
  "/js/billing-reports.js",
  "/js/currency-converter.js",
  "/js/org-migration.js",
  "/js/countries-data.js",
  "/js/phone-migration.js",
  "/js/phone-input.js",
  "/js/subscription-migration.js",
  "/js/payment-methods.js",
  "/js/paystack-integration.js",
  "/js/platform-readonly.js",
  "/billing-dashboard.html",
  "/quick-checkout.html",
  "/invoices.html",
  "/invoice-details.html",
  "/payments.html",
  "/cash-register.html",
  "/pricing-catalog.html",
  "/billing-reports.html",
  "/collect-payment.html",
  "/configure-services.html",
  "/edit-invoice.html",
  "/billing-permissions.html",
  "/todays-revenue.html",
  "/data/african-billing-config.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Add assets one by one to handle failures gracefully
        return Promise.allSettled(
          ASSETS_TO_CACHE.map(url => 
            cache.add(url).catch(err => {
              console.log(`Failed to cache ${url}:`, err);
              return null; // Don't fail the entire operation
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const { request } = event;
  
  // Skip cache for requests with version parameters (cache-busting)
  if (request.url.includes('?v=')) {
    event.respondWith(fetch(request));
    return;
  }
  
  event.respondWith(
    caches.match(request).then(cached => {
      return cached || fetch(request).then(response => {
        return response;
      }).catch(() => cached);
    })
  );
});



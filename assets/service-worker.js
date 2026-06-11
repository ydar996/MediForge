// Purpose: Caches pages for offline use. Register in main.js.
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open("mediforge-cache").then(cache => {
      return cache.addAll([
        "/", "index.html", "login.html", "dashboard.html", "patients.html", "add-patient.html",
        "patient-details.html", "appointments.html", "add-appointment.html", "reports.html", "schedule.html",
        "edit-profile.html", "register.html", "preventive-gaps.html", "edit-patient.html", "deleted-patients.html",
        "css/styles.css", "js/main.js", "js/auth.js", "js/patients.js", "js/appointments.js", "js/reports.js", "js/preventive.js"
      ]);
    })
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);  // Use cache if offline
    })
  );
});

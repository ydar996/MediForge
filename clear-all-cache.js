/**
 * CLEAR ALL CACHE - Complete Cache Clearing Script
 * 
 * This script clears:
 * - Service Workers
 * - Browser Cache (caches API)
 * - localStorage
 * - sessionStorage
 * - IndexedDB (if needed)
 * 
 * To use: Call window.clearAllCache() in the browser console
 * DO NOT auto-run - this will clear user sessions!
 */

window.clearAllCache = function clearAllCache() {
  console.log('🧹 Starting complete cache clear...\n');
  
  let cleared = {
    serviceWorkers: 0,
    caches: 0,
    localStorage: false,
    sessionStorage: false,
    indexedDB: false
  };
  
  // 1. Unregister all service workers
  console.log('1️⃣ Unregistering service workers...');
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    cleared.serviceWorkers = registrations.length;
    for(let registration of registrations) {
      registration.unregister().then(function(success) {
        if (success) {
          console.log(`   ✅ Unregistered: ${registration.scope}`);
        }
      });
    }
    console.log(`   ✅ Unregistered ${registrations.length} service worker(s)\n`);
  }).catch(function(error) {
    console.error('   ❌ Error unregistering service workers:', error);
  });
  
  // 2. Clear all caches
  console.log('2️⃣ Clearing all caches...');
  caches.keys().then(function(names) {
    cleared.caches = names.length;
    for (let name of names) {
      caches.delete(name).then(function(success) {
        if (success) {
          console.log(`   ✅ Deleted cache: ${name}`);
        }
      });
    }
    console.log(`   ✅ Deleted ${names.length} cache(s)\n`);
  }).catch(function(error) {
    console.error('   ❌ Error clearing caches:', error);
  });
  
  // 3. Clear localStorage
  console.log('3️⃣ Clearing localStorage...');
  try {
    const localStorageKeys = Object.keys(localStorage);
    localStorage.clear();
    cleared.localStorage = true;
    console.log(`   ✅ Cleared ${localStorageKeys.length} localStorage item(s)\n`);
  } catch (error) {
    console.error('   ❌ Error clearing localStorage:', error);
  }
  
  // 4. Clear sessionStorage
  console.log('4️⃣ Clearing sessionStorage...');
  try {
    const sessionStorageKeys = Object.keys(sessionStorage);
    sessionStorage.clear();
    cleared.sessionStorage = true;
    console.log(`   ✅ Cleared ${sessionStorageKeys.length} sessionStorage item(s)\n`);
  } catch (error) {
    console.error('   ❌ Error clearing sessionStorage:', error);
  }
  
  // 5. Clear IndexedDB (if available)
  console.log('5️⃣ Clearing IndexedDB...');
  if ('indexedDB' in window) {
    // Note: IndexedDB deleteDatabase returns IDBOpenDBRequest, not a Promise
    indexedDB.databases().then(function(databases) {
      cleared.indexedDB = databases.length;
      let deletedCount = 0;
      databases.forEach(function(db) {
        const deleteRequest = indexedDB.deleteDatabase(db.name);
        deleteRequest.onsuccess = function() {
          deletedCount++;
          console.log(`   ✅ Deleted IndexedDB: ${db.name}`);
          if (deletedCount === databases.length) {
            console.log(`   ✅ Deleted ${databases.length} IndexedDB database(s)\n`);
          }
        };
        deleteRequest.onerror = function(error) {
          console.error(`   ❌ Error deleting IndexedDB ${db.name}:`, error);
        };
      });
      if (databases.length === 0) {
        console.log(`   ✅ No IndexedDB databases to delete\n`);
      }
    }).catch(function(error) {
      console.error('   ❌ Error clearing IndexedDB:', error);
    });
  } else {
    console.log('   ⚠️  IndexedDB not available\n');
  }
  
  // Summary
  setTimeout(function() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ CACHE CLEAR COMPLETE');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('Summary:');
    console.log(`   Service Workers: ${cleared.serviceWorkers} unregistered`);
    console.log(`   Caches: ${cleared.caches} deleted`);
    console.log(`   localStorage: ${cleared.localStorage ? '✅ Cleared' : '❌ Failed'}`);
    console.log(`   sessionStorage: ${cleared.sessionStorage ? '✅ Cleared' : '❌ Failed'}`);
    console.log(`   IndexedDB: ${cleared.indexedDB} database(s) deleted\n`);
    console.log('🔄 NEXT STEPS:');
    console.log('   1. Close this tab completely');
    console.log('   2. Open a new tab');
    console.log('   3. Go to: https://mediforge.netlify.app/patients');
    console.log('   4. You should now see the correct patient list\n');
    console.log('═══════════════════════════════════════════════════════════\n');
  }, 1000);
  
  return cleared;
};


/**
 * Supabase Storage uploads for Pre-EMR medical records (images, PDFs).
 * Bucket: patient-documents: path: {orgId}/{patientUuid}/pre-emr-medical-records/{file}
 */
(function (global) {
  var BUCKET = 'patient-documents';
  var FOLDER_SEGMENT = 'pre-emr-medical-records';
  var DEFAULT_CONCURRENCY = 3;

  function getOrgId() {
    try {
      var user = JSON.parse(localStorage.getItem('user') || '{}');
      return user.organization_id || user.organizationId || null;
    } catch (e) {
      return null;
    }
  }

  function getPatientRowUuid(patient) {
    if (!patient) return null;
    var su = patient._supabaseUuid;
    if (su && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(su))) {
      return su;
    }
    var id = patient.id;
    if (id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id))) {
      return id;
    }
    return null;
  }

  function sanitizeFileName(name) {
    return String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180);
  }

  /** Extension without dot, for display and paths */
  function getExtensionFromFile(file) {
    var n = file && file.name ? String(file.name) : '';
    var m = n.match(/\.([a-zA-Z0-9]{1,8})$/);
    if (m) return m[1].toLowerCase();
    var t = (file && file.type) || '';
    if (t.indexOf('jpeg') !== -1 || t === 'image/jpg') return 'jpg';
    if (t.indexOf('png') !== -1) return 'png';
    if (t.indexOf('gif') !== -1) return 'gif';
    if (t.indexOf('webp') !== -1) return 'webp';
    if (t.indexOf('pdf') !== -1) return 'pdf';
    if (t.indexOf('image/') === 0) return 'img';
    return 'bin';
  }

  /** User-facing label: "Page 1.jpg", "Page 2.pdf" */
  function buildPageDisplayName(pageNum, file) {
    var ext = getExtensionFromFile(file);
    return 'Page ' + pageNum + (ext ? '.' + ext : '');
  }

  /** Count existing Pre-EMR file attachments (not free-text rows) so new uploads continue Page N+1, … */
  function countExistingPreEmrFileRecords(patient) {
    if (!patient || !Array.isArray(patient.unstructuredRecords)) return 0;
    var n = 0;
    for (var i = 0; i < patient.unstructuredRecords.length; i++) {
      var r = patient.unstructuredRecords[i];
      if (r && (r.kind === 'file' || r.storagePath)) n++;
    }
    return n;
  }

  function buildStorageObjectPath(orgId, patientUuid, pageNum, file, batchId) {
    var ext = getExtensionFromFile(file);
    var rand = Math.random().toString(36).slice(2, 10);
    var safePage = 'Page_' + pageNum + '_' + ext;
    return orgId + '/' + patientUuid + '/' + FOLDER_SEGMENT + '/' + batchId + '_' + pageNum + '_' + rand + '_' + sanitizeFileName(safePage);
  }

  function getApiKey(client) {
    if (client && client.supabaseKey) return client.supabaseKey;
    if (global.__SUPABASE_CONFIG__ && global.__SUPABASE_CONFIG__.anonKey) return global.__SUPABASE_CONFIG__.anonKey;
    return null;
  }

  /**
   * Use the Supabase JS client for uploads so object keys match createSignedUrl (XHR URL encoding
   * could diverge from the SDK and yield "Object not found" on view).
   */
  function uploadObjectWithProgress(client, path, file, contentType, onFileProgress) {
    if (onFileProgress) onFileProgress(0, file.size || 0);
    return client.storage
      .from(BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: contentType || file.type || 'application/octet-stream'
      })
      .then(function (up) {
        if (up.error) throw up.error;
        if (onFileProgress) onFileProgress(file.size, file.size);
      });
  }

  function normalizeStorageObjectPath(storagePath) {
    if (!storagePath || typeof storagePath !== 'string') return storagePath;
    var s = storagePath.trim().replace(/^\/+/, '');
    var prefix = BUCKET + '/';
    if (s.indexOf(prefix) === 0) s = s.slice(prefix.length);
    return s;
  }

  function uniqueStrings(arr) {
    var seen = Object.create(null);
    var out = [];
    (arr || []).forEach(function (s) {
      if (s == null || s === '') return;
      if (!seen[s]) {
        seen[s] = true;
        out.push(s);
      }
    });
    return out;
  }

  /** Treat ..._Page_4_jpg and ..._Page_4.jpg as equivalent for matching. */
  function normalizeComparableFileName(name) {
    if (!name) return '';
    var n = String(name);
    n = n.replace(/_Page_(\d+)_(jpe?g|png|pdf|gif|webp)$/i, '__PAGE__$1__.$2');
    n = n.replace(/_Page_(\d+)\.(jpe?g|png|pdf|gif|webp)$/i, '__PAGE__$1__.$2');
    return n.toLowerCase();
  }

  function swapFirstPathSegment(path, newOrgId) {
    if (!path || !newOrgId) return null;
    var parts = path.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    parts[0] = newOrgId;
    return parts.join('/');
  }

  /**
   * Legacy / UI uploads may use Page_4.jpg while DB has Page_4_jpg (sanitizeFileName-style).
   */
  function alternateLastSegmentPaths(path) {
    var parts = path.split('/').filter(Boolean);
    if (!parts.length) return [path];
    var last = parts[parts.length - 1];
    var out = [path];

    function addWithLast(newLast) {
      if (!newLast || newLast === last) return;
      var alt = parts.slice(0, -1).concat([newLast]).join('/');
      if (out.indexOf(alt) === -1) out.push(alt);
    }

    var m = last.match(/^(.*)_Page_(\d+)_(jpe?g|png|pdf|gif|webp)$/i);
    if (m) {
      var dotExt = m[3].replace(/^jpeg$/i, 'jpg').toLowerCase();
      addWithLast(m[1] + '_Page_' + m[2] + '.' + dotExt);
    }
    var m2 = last.match(/^(.*)_(jpe?g|png|pdf|gif|webp)$/i);
    if (m2 && m2[1]) {
      var dotExt2 = m2[2].replace(/^jpeg$/i, 'jpg').toLowerCase();
      addWithLast(m2[1] + '.' + dotExt2);
    }
    return out;
  }

  function tryOpenPaths(client, paths, ttl) {
    var lastErr;
    var i = 0;
    function step() {
      if (i >= paths.length) {
        return Promise.reject(lastErr || new Error('Storage path variants exhausted'));
      }
      var p = paths[i++];
      return tryCreateSignedUrl(client, p, ttl).catch(function (e) {
        lastErr = e;
        return tryDownloadObjectUrl(client, p);
      }).catch(function (e2) {
        lastErr = e2;
        return step();
      });
    }
    return step();
  }

  function tryCreateSignedUrl(client, path, expiresSec) {
    return client.storage
      .from(BUCKET)
      .createSignedUrl(path, expiresSec || 3600)
      .then(function (res) {
        if (res.error) throw res.error;
        return res.data.signedUrl;
      });
  }

  /** Signed URL can return 400 "Object not found" while authenticated download still works (RLS/sign quirks). */
  function tryDownloadObjectUrl(client, path) {
    return client.storage
      .from(BUCKET)
      .download(path)
      .then(function (res) {
        if (res.error) throw res.error;
        if (!res.data) throw new Error('Empty download');
        return URL.createObjectURL(res.data);
      });
  }

  /** Prefer rows with size metadata; fall back to any named row (some Storage list responses omit metadata). */
  function preferFileRows(rows) {
    var named = (rows || []).filter(function (r) {
      return r && r.name;
    });
    var withMeta = named.filter(function (r) {
      return r.metadata != null;
    });
    return withMeta.length ? withMeta : named;
  }

  function parseOrgPatientFromStoragePath(normalized) {
    var p = normalized.split('/').filter(Boolean);
    if (p.length < 3) return null;
    return { orgId: p[0], patientUuid: p[1] };
  }

  function getServerOrganizationId(client) {
    if (!client || !client.auth) return Promise.resolve(null);
    return client.auth.getUser().then(function (ref) {
      var au = ref.data && ref.data.user;
      if (!au || !au.id) return null;
      return client
        .from('users')
        .select('organization_id')
        .eq('auth_user_id', au.id)
        .maybeSingle()
        .then(function (r) {
          if (!r.error && r.data && r.data.organization_id) return String(r.data.organization_id);
          return client
            .from('users')
            .select('organization_id')
            .eq('id', au.id)
            .maybeSingle()
            .then(function (r2) {
              if (!r2.error && r2.data && r2.data.organization_id) return String(r2.data.organization_id);
              return null;
            });
        });
    });
  }

  /** List org/patient/* / * to find files when direct folder list is empty (nested layout / RLS quirks). */
  function deepListPatientPreEmrFiles(client, orgId, patientUuid) {
    var base = orgId + '/' + patientUuid;
    return client.storage
      .from(BUCKET)
      .list(base, { limit: 100 })
      .then(function (res) {
        if (res.error || !res.data || !res.data.length) return [];
        var collected = [];
        var jobs = res.data.map(function (entry) {
          if (!entry.name) return Promise.resolve();
          var prefix = base + '/' + entry.name;
          return client.storage
            .from(BUCKET)
            .list(prefix, { limit: 500 })
            .then(function (r2) {
              if (r2.error || !r2.data) return;
              r2.data.forEach(function (f) {
                if (f && f.name) collected.push({ name: f.name, folderPrefix: prefix });
              });
            });
        });
        return Promise.all(jobs).then(function () {
          return collected;
        });
      });
  }

  function openFileFromFlatList(client, flatFiles, fileName, ttl) {
    var rowsForPick = flatFiles.map(function (f) {
      return { name: f.name, metadata: { size: 1 } };
    });
    var picked = pickRowForFileName(rowsForPick, fileName);
    if (!picked) return Promise.reject(new Error('no_match'));
    var found = flatFiles.find(function (f) {
      return f.name === picked.name;
    });
    if (!found) return Promise.reject(new Error('no_match'));
    var fullPath = found.folderPrefix + '/' + found.name;
    return tryOpenPaths(client, alternateLastSegmentPaths(fullPath), ttl);
  }

  function pickRowForFileName(rows, fileName) {
    if (!fileName || !rows || !rows.length) return null;
    rows = preferFileRows(rows);
    var key = normalizeComparableFileName(fileName);
    var exact = rows.find(function (r) {
      return r && r.name === fileName;
    });
    if (exact) return exact;
    var byNorm = rows.find(function (r) {
      return r && r.name && normalizeComparableFileName(r.name) === key;
    });
    if (byNorm) return byNorm;
    var altNames = alternateLastSegmentPaths('_/__/' + fileName).map(function (p) {
      var segs = p.split('/');
      return segs[segs.length - 1];
    });
    for (var a = 0; a < altNames.length; a++) {
      var hit = rows.find(function (r) {
        return r && r.name === altNames[a];
      });
      if (hit) return hit;
    }
    return rows.find(function (r) {
      return (
        r &&
        r.name &&
        (r.name === decodeURIComponent(fileName) ||
          fileName.indexOf(r.name) !== -1 ||
          r.name.indexOf(fileName) !== -1 ||
          normalizeComparableFileName(r.name).indexOf(key) !== -1 ||
          key.indexOf(normalizeComparableFileName(r.name)) !== -1)
      );
    });
  }

  function listPreEmrFolderVariants(client, folderPrefix) {
    var prefixes = [folderPrefix];
    if (folderPrefix.indexOf('/pre-emr-medical-records') !== -1) {
      prefixes.push(folderPrefix.replace('/pre-emr-medical-records', '/pre-emr-records'));
    } else if (folderPrefix.indexOf('/pre-emr-records') !== -1) {
      prefixes.push(folderPrefix.replace('/pre-emr-records', '/pre-emr-medical-records'));
    }
    function tryList(i) {
      if (i >= prefixes.length) return Promise.resolve({ data: [], resolvedPrefix: null });
      return client.storage
        .from(BUCKET)
        .list(prefixes[i], { limit: 500, offset: 0 })
        .then(function (listRes) {
          if (listRes.error) return tryList(i + 1);
          var d = listRes.data || [];
          if (d.length) return { data: d, resolvedPrefix: prefixes[i] };
          return tryList(i + 1);
        });
    }
    return tryList(0);
  }

  function runPool(limit, taskFns) {
    return new Promise(function (resolve, reject) {
      var results = new Array(taskFns.length);
      var nextIndex = 0;
      var active = 0;
      var failed = false;

      function failOnce(err) {
        if (failed) return;
        failed = true;
        reject(err);
      }

      function runNext() {
        if (failed) return;
        if (nextIndex >= taskFns.length && active === 0) {
          resolve(results);
          return;
        }
        while (active < limit && nextIndex < taskFns.length) {
          var i = nextIndex++;
          active++;
          (function (idx) {
            taskFns[idx]()
              .then(function (r) {
                results[idx] = r;
              })
              .catch(failOnce)
              .finally(function () {
                active--;
                if (!failed) runNext();
              });
          })(i);
        }
      }
      runNext();
    });
  }

  /**
   * @param {object} patient
   * @param {File[]} files: order = next page numbers after existing file records (e.g. one file → Page N+1)
   * @param {object} [options]
   * @param {function} [options.onProgress]: ({ phase, pageIndex, totalPages, bytesUploaded, bytesTotal, percent, etaSeconds, label })
   * @param {number} [options.concurrency]: default 3
   * @returns {Promise<object[]>}
   */
  async function uploadPreEmrFiles(patient, files, options) {
    options = options || {};
    var onProgress = options.onProgress;
    var concurrency = Math.min(Math.max(1, options.concurrency || DEFAULT_CONCURRENCY), 6);

    if (!files || files.length === 0) {
      return [];
    }

    var client = global.supabaseClient;
    if (!client) throw new Error('Supabase client not ready');
    var orgId = getOrgId();
    try {
      var fromServer = await getServerOrganizationId(client);
      if (fromServer) orgId = fromServer;
    } catch (e) {}
    if (!orgId) throw new Error('Missing organization in session. Please sign in again.');
    var patientUuid = getPatientRowUuid(patient);
    if (!patientUuid) {
      throw new Error('Patient record must be synced with the server before uploading files. Open the patient from the chart and try again.');
    }
    var user = JSON.parse(localStorage.getItem('user') || '{}');
    var createdBy = user.username || user.email || 'Unknown';

    var basePage = countExistingPreEmrFileRecords(patient);

    var totalBytes = 0;
    for (var t = 0; t < files.length; t++) totalBytes += files[t].size || 0;

    var batchId = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    var loadedPerFile = new Array(files.length);
    for (var z = 0; z < files.length; z++) loadedPerFile[z] = 0;

    var tStart = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    var lastEmit = 0;

    function overallBytes() {
      var s = 0;
      for (var k = 0; k < loadedPerFile.length; k++) s += loadedPerFile[k];
      return s;
    }

    function emit(evt) {
      if (!onProgress) return;
      var now = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      if (evt && evt.force) {
        lastEmit = now;
      } else if (now - lastEmit < 80 && !evt.force) {
        return;
      }
      lastEmit = now;
      var ob = overallBytes();
      var pct = totalBytes > 0 ? Math.min(100, (ob / totalBytes) * 100) : files.length === 0 ? 100 : 0;
      var elapsedSec = ((now - tStart) / 1000) || 0.001;
      var rate = ob / elapsedSec;
      var remaining = Math.max(0, totalBytes - ob);
      var etaSeconds = rate > 100 ? Math.ceil(remaining / rate) : null;
      onProgress(
        Object.assign(
          {
            phase: 'upload',
            bytesUploaded: ob,
            bytesTotal: totalBytes,
            percent: pct,
            etaSeconds: etaSeconds
          },
          evt || {}
        )
      );
    }

    var taskFns = files.map(function (file, i) {
      return function () {
        var pageNum = basePage + i + 1;
        var displayName = buildPageDisplayName(pageNum, file);
        var path = buildStorageObjectPath(orgId, patientUuid, pageNum, file, batchId);
        var contentType = file.type || 'application/octet-stream';

        emit({
          phase: 'upload',
          pageNumber: pageNum,
          batchIndex: i + 1,
          batchTotal: files.length,
          label: displayName,
          fileBytesUploaded: 0,
          fileBytesTotal: file.size,
          force: true
        });

        return uploadObjectWithProgress(client, path, file, contentType, function (loaded, total) {
          loadedPerFile[i] = loaded;
          emit({
            phase: 'upload',
            pageNumber: pageNum,
            batchIndex: i + 1,
            batchTotal: files.length,
            label: displayName,
            fileBytesUploaded: loaded,
            fileBytesTotal: total || file.size
          });
        }).then(function () {
          loadedPerFile[i] = file.size;
          emit({
            phase: 'upload',
            pageNumber: pageNum,
            batchIndex: i + 1,
            batchTotal: files.length,
            label: displayName,
            fileBytesUploaded: file.size,
            fileBytesTotal: file.size,
            force: true
          });
          return {
            id: 'record_' + Date.now() + '_' + i + '_' + Math.random().toString(36).slice(2, 9),
            kind: 'file',
            fileName: displayName,
            mimeType: contentType,
            storagePath: path,
            sizeBytes: file.size,
            pageNumber: pageNum,
            createdAt: new Date().toISOString(),
            createdBy: createdBy
          };
        });
      };
    });

    var records = await runPool(concurrency, taskFns);
    emit({ phase: 'upload', percent: 100, bytesUploaded: totalBytes, bytesTotal: totalBytes, etaSeconds: 0, force: true });
    return records;
  }

  function getSignedUrl(storagePath, expiresSec) {
    var client = global.supabaseClient;
    if (!client) return Promise.reject(new Error('Supabase client not ready'));
    var normalized = normalizeStorageObjectPath(storagePath);
    var ttl = expiresSec || 3600;

    if (!normalized || normalized.indexOf('/') === -1) {
      return Promise.reject(new Error('Invalid storage path'));
    }

    var parts = normalized.split('/').filter(Boolean);
    var fileName = parts[parts.length - 1];
    var folderPrefix = parts.slice(0, -1).join('/');
    var parsed = parseOrgPatientFromStoragePath(normalized);

    function openViaDiscoveredPath(rows, resolvedFolderPrefix) {
      var alt = pickRowForFileName(rows, fileName);
      if (!alt || !alt.name) return Promise.reject(new Error('Pre-EMR file not found in storage. It may need to be re-uploaded.'));
      var altPath = resolvedFolderPrefix + '/' + alt.name;
      var alts = alternateLastSegmentPaths(altPath);
      return tryOpenPaths(client, alts, ttl);
    }

    var notFoundMsg =
      'Pre-EMR file not found in storage (folder is empty or inaccessible). If uploads still fail after a refresh, apply the latest Supabase migration for patient-documents storage policies or re-upload the file.';

    function afterDirectFails() {
      return listPreEmrFolderVariants(client, folderPrefix).then(function (listed) {
        var rows = listed.data || [];
        if (rows.length) {
          return openViaDiscoveredPath(rows, listed.resolvedPrefix || folderPrefix);
        }
        if (!parsed) throw new Error(notFoundMsg);
        return deepListPatientPreEmrFiles(client, parsed.orgId, parsed.patientUuid).then(function (flat) {
          function nextAfterFlat() {
            return getServerOrganizationId(client).then(function (srvOrg) {
              if (!srvOrg || srvOrg === parsed.orgId) throw new Error(notFoundMsg);
              return deepListPatientPreEmrFiles(client, srvOrg, parsed.patientUuid).then(function (flat2) {
                if (!flat2.length) throw new Error(notFoundMsg);
                return openFileFromFlatList(client, flat2, fileName, ttl);
              });
            });
          }
          if (flat.length) {
            return openFileFromFlatList(client, flat, fileName, ttl).catch(nextAfterFlat);
          }
          return nextAfterFlat();
        });
      });
    }

    return getServerOrganizationId(client)
      .catch(function () {
        return null;
      })
      .then(function (srvOrg) {
        var attempts = uniqueStrings(alternateLastSegmentPaths(normalized));
        if (parsed && srvOrg && srvOrg !== parsed.orgId) {
          var swapped = swapFirstPathSegment(normalized, srvOrg);
          if (swapped) {
            attempts = uniqueStrings(attempts.concat(alternateLastSegmentPaths(swapped)));
          }
        }
        return tryOpenPaths(client, attempts, ttl).catch(afterDirectFails);
      });
  }

  function removeStorageObject(storagePath) {
    var client = global.supabaseClient;
    if (!client || !storagePath) return Promise.resolve();
    return client.storage.from(BUCKET).remove([normalizeStorageObjectPath(storagePath)]).then(function (res) {
      if (res.error) console.warn('Storage remove:', res.error);
    });
  }

  global.preEmrStorage = {
    BUCKET: BUCKET,
    getPatientRowUuid: getPatientRowUuid,
    getExtensionFromFile: getExtensionFromFile,
    buildPageDisplayName: buildPageDisplayName,
    countExistingPreEmrFileRecords: countExistingPreEmrFileRecords,
    uploadPreEmrFiles: uploadPreEmrFiles,
    getSignedUrl: getSignedUrl,
    normalizeStorageObjectPath: normalizeStorageObjectPath,
    removeStorageObject: removeStorageObject
  };
})(typeof window !== 'undefined' ? window : globalThis);

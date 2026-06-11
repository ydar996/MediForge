/**
 * Physician credential verification (regulatory body registration + medical diploma).
 * UI helpers for physician-verification.html, platform admin page, dashboard banner.
 */
(function (w) {
  'use strict';

  var BUCKET = 'physician-verification-docs';

  function resolveOrgCountry(profile) {
    var c = profile && profile.organizations && profile.organizations.country;
    if (c) return String(c).trim();
    try {
      var u = JSON.parse(localStorage.getItem('user') || '{}');
      return String(u.orgCountry || '').trim();
    } catch (e) {
      return '';
    }
  }

  function noticeFragment(country) {
    if (typeof w.getMedicalRegulatoryBodyNoticeFragment === 'function') {
      return w.getMedicalRegulatoryBodyNoticeFragment(country || '');
    }
    return { fromClause: "your country's medical regulatory body", isSpecific: false };
  }

  function copySubmitProofBeforeDeadline(country) {
    var f = noticeFragment(country);
    return 'Submit your proof of clearance to practise from ' + f.fromClause + ' and your medical school diploma';
  }

  function copyLicensedPhysician90DayLine(country) {
    var f = noticeFragment(country);
    return (
      'Licensed physicians must submit proof of clearance to practise from ' +
      f.fromClause +
      ' and a medical school diploma within 90 days of first use of this application.'
    );
  }

  function copyUploadProofWhenLimited(country) {
    var f = noticeFragment(country);
    return 'Upload proof of clearance to practise from ' + f.fromClause + ' and your medical school diploma.';
  }

  function copyRejectedUploadLine(country) {
    var f = noticeFragment(country);
    return 'Upload new documents — proof from ' + f.fromClause + ' and your medical school diploma — before: ';
  }

  w.resolvePhysicianVerificationOrgCountry = resolveOrgCountry;

  /** Full intro paragraph for physician-verification.html (organization country from profile). */
  w.formatPhysicianVerificationIntroParagraph = function (organizationCountry) {
    var f = noticeFragment(organizationCountry);
    return (
      'Upload your registration with ' +
      f.fromClause +
      ' and your university diploma or equivalent proof of completion of medical training. ' +
      copyLicensedPhysician90DayLine(organizationCountry)
    );
  };

  function isDoctorRole(role) {
    if (!role || typeof role !== 'string') return false;
    var r = role.toLowerCase().trim().replace(/\s+/g, ' ');
    if (r.indexOf('physician assistant') !== -1) return false;
    var exact = { doctor: 1, physician: 1, 'medical doctor': 1, medicaldoctor: 1, dr: 1, 'dr.': 1, md: 1 };
    if (exact[r]) return true;
    if (r.indexOf('medical doctor') !== -1) return true;
    if (r === 'dr' || r.indexOf('dr.') === 0 || r.indexOf('dr ') === 0) return true;
    if (r.indexOf('physician') !== -1) return true;
    if (r.indexOf('doctor') !== -1) return true;
    return false;
  }

  function waitForSupabase(maxMs) {
    var deadline = Date.now() + maxMs;
    return new Promise(function (resolve) {
      (function poll() {
        if (w.supabaseClient) return resolve(w.supabaseClient);
        if (Date.now() >= deadline) return resolve(null);
        setTimeout(poll, 80);
      })();
    });
  }

  function accessStateFromRow(row) {
    if (!row) return { blocked: false, approved: false, row: null };
    var approved = row.review_status === 'approved';
    var untilMs = new Date(row.verification_access_until).getTime();
    var blocked = !approved && Date.now() > untilMs;
    return {
      row: row,
      approved: approved,
      blocked: blocked,
      reviewStatus: row.review_status,
      untilMs: untilMs,
      daysRemaining: Math.ceil((untilMs - Date.now()) / 86400000)
    };
  }

  w.PHYSICIAN_VERIFICATION_BUCKET = BUCKET;
  w.isDoctorRoleForVerification = isDoctorRole;
  w.physicianVerificationAccessStateFromRow = accessStateFromRow;

  /**
   * Start the 90-day verification clock for doctors: insert physician_verifications if missing.
   * Call after successful login (or session restore) — no need to open the verification page.
   */
  w.ensurePhysicianVerificationRecordForProfile = async function (profile) {
    if (!profile || !profile.id || !profile.organization_id) return;
    if (!isDoctorRole(profile.role)) return;
    var sb = w.supabaseClient;
    if (!sb) return;
    try {
      var ex = await sb.from('physician_verifications').select('id').eq('user_id', profile.id).maybeSingle();
      if (ex.data) return;
      var ins = await sb.from('physician_verifications').insert({
        user_id: profile.id,
        organization_id: profile.organization_id
      });
      if (ins.error) console.warn('Physician verification record insert:', ins.error);
    } catch (e) {
      console.warn('ensurePhysicianVerificationRecordForProfile', e);
    }
  };

  w.ensurePhysicianVerificationFromAuthSession = async function () {
    var sb = w.supabaseClient;
    if (!sb) return;
    var authRes = await sb.auth.getUser();
    var authUser = authRes && authRes.data && authRes.data.user;
    if (!authUser) return;
    var pr = await sb
      .from('users')
      .select('id, organization_id, role')
      .eq('auth_user_id', authUser.id)
      .maybeSingle();
    if (!pr.data) return;
    await w.ensurePhysicianVerificationRecordForProfile(pr.data);
  };

  /**
   * After successful org login: modal with deadline + how to open the upload page.
   * Call from login-handler only (not on INITIAL_SESSION) to avoid repeat popups.
   */
  w.runPostLoginPhysicianVerificationPrompt = function () {
    return new Promise(function (resolve) {
      function doneNoModal() {
        resolve({ showed: false });
      }
      var sb = w.supabaseClient;
      if (!sb) {
        doneNoModal();
        return;
      }
      sb.auth.getUser()
        .then(function (authRes) {
          var authUser = authRes.data && authRes.data.user;
          if (!authUser) {
            doneNoModal();
            return;
          }
          return sb
            .from('users')
            .select('id, organization_id, role, first_name, last_name, organizations(country)')
            .eq('auth_user_id', authUser.id)
            .maybeSingle();
        })
        .then(function (profRes) {
          if (!profRes) {
            doneNoModal();
            return null;
          }
          var profile = profRes.data;
          if (!profile || !isDoctorRole(profile.role)) {
            doneNoModal();
            return null;
          }
          var orgCountry = resolveOrgCountry(profile);
          return w.ensurePhysicianVerificationRecordForProfile(profile).then(function () {
            return sb
              .from('physician_verifications')
              .select('verification_access_until, review_status')
              .eq('user_id', profile.id)
              .maybeSingle()
              .then(function (pvRes) {
                return { vr: pvRes, orgCountry: orgCountry };
              });
          });
        })
        .then(function (pack) {
          if (!pack) return;
          var vr = pack.vr;
          var orgCountry = pack.orgCountry || '';
          if (!vr || !vr.data) {
            doneNoModal();
            return;
          }
          var row = vr.data;
          if (row.review_status === 'approved') {
            doneNoModal();
            return;
          }

          var deadlineStr = row.verification_access_until
            ? new Date(row.verification_access_until).toLocaleString()
            : '';

          var overlay = document.createElement('div');
          overlay.setAttribute('role', 'dialog');
          overlay.setAttribute('aria-modal', 'true');
          overlay.setAttribute('aria-labelledby', 'pv-login-modal-title');
          overlay.style.cssText =
            'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';

          var box = document.createElement('div');
          box.style.cssText =
            'background:#fff;max-width:540px;width:100%;border-radius:12px;padding:24px;box-shadow:0 8px 32px rgba(0,0,0,0.2);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;';

          var title = document.createElement('h2');
          title.id = 'pv-login-modal-title';
          title.textContent = 'Physician credential verification';
          title.style.cssText = 'margin:0 0 12px 0;font-size:1.25rem;color:#008753;';

          var body = document.createElement('div');
          body.style.cssText = 'font-size:15px;line-height:1.55;color:#333;margin-bottom:18px;';

          var status = row.review_status || 'not_submitted';
          if (status === 'pending_review') {
            var p1 = document.createElement('p');
            var s1 = document.createElement('strong');
            s1.textContent = 'Your documents are being reviewed.';
            p1.appendChild(s1);
            body.appendChild(p1);
            var p2 = document.createElement('p');
            p2.appendChild(document.createTextNode('Access deadline: '));
            var s2 = document.createElement('strong');
            s2.textContent = deadlineStr;
            p2.appendChild(s2);
            body.appendChild(p2);
            var p3 = document.createElement('p');
            p3.textContent =
              'You can check status from the Dashboard — Departmental Dashboards — Physician credential verification, or open the verification page from the banner.';
            body.appendChild(p3);
          } else if (status === 'rejected') {
            var r1 = document.createElement('p');
            var rs = document.createElement('strong');
            rs.textContent = 'Your previous submission needs to be replaced.';
            r1.appendChild(rs);
            body.appendChild(r1);
            var r2 = document.createElement('p');
            r2.appendChild(document.createTextNode(copyRejectedUploadLine(orgCountry)));
            var rd = document.createElement('strong');
            rd.textContent = deadlineStr;
            r2.appendChild(rd);
            body.appendChild(r2);
            var r3 = document.createElement('p');
            r3.textContent = 'Use these steps to open the upload page:';
            body.appendChild(r3);
            var rol = document.createElement('ol');
            rol.style.cssText = 'margin:8px 0;padding-left:22px;';
            ['On the Dashboard, open "Departmental Dashboards".', 'Click "Physician credential verification (regulator + diploma)".', 'Upload both documents and submit for review.'].forEach(function (txt) {
              var li = document.createElement('li');
              li.textContent = txt;
              rol.appendChild(li);
            });
            body.appendChild(rol);
          } else {
            var a1 = document.createElement('p');
            var as = document.createElement('strong');
            as.textContent = 'Your 90-day verification period is active.';
            a1.appendChild(as);
            body.appendChild(a1);
            var a2 = document.createElement('p');
            a2.appendChild(document.createTextNode(copySubmitProofBeforeDeadline(orgCountry) + ' before: '));
            var ad = document.createElement('strong');
            ad.textContent = deadlineStr;
            a2.appendChild(ad);
            body.appendChild(a2);
            var a3 = document.createElement('p');
            var as3 = document.createElement('strong');
            as3.textContent = 'How to upload:';
            a3.appendChild(as3);
            body.appendChild(a3);
            var ol = document.createElement('ol');
            ol.style.cssText = 'margin:8px 0;padding-left:22px;';
            var li1 = document.createElement('li');
            li1.textContent = 'On the Dashboard, find the section "Departmental Dashboards".';
            ol.appendChild(li1);
            var li2 = document.createElement('li');
            li2.textContent = 'Click "Physician credential verification (regulator + diploma)".';
            ol.appendChild(li2);
            var li3 = document.createElement('li');
            li3.textContent = 'Upload both documents and submit for review.';
            ol.appendChild(li3);
            body.appendChild(ol);
          }

          if (row.verification_access_until) {
            var untilMs = new Date(row.verification_access_until).getTime();
            if (!isNaN(untilMs)) {
              var daysLeft = Math.ceil((untilMs - Date.now()) / 86400000);
              var countP = document.createElement('p');
              countP.style.cssText = 'margin-top:12px;font-weight:700;';
              if (daysLeft > 7) countP.style.color = '#5d4037';
              else if (daysLeft >= 0) countP.style.color = '#e65100';
              else countP.style.color = '#b71c1c';
              if (daysLeft > 1) {
                countP.textContent = 'About ' + daysLeft + ' days left on your verification clock.';
              } else if (daysLeft === 1) {
                countP.textContent = '1 day left on your verification clock.';
              } else if (daysLeft === 0) {
                countP.textContent = 'Your access deadline is today.';
              } else {
                countP.textContent =
                  'Your verification deadline has passed; complete verification to restore full access.';
              }
              body.appendChild(countP);
            }
          }

          var linkP = document.createElement('p');
          linkP.style.cssText = 'font-size:14px;margin:0 0 16px 0;';
          var a = document.createElement('a');
          a.href = 'physician-verification';
          a.textContent = 'Or open the verification page directly';
          a.style.cssText = 'color:#008753;font-weight:600;';
          linkP.appendChild(a);

          var btnRow = document.createElement('div');
          btnRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;';

          function removeOverlay() {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            resolve({ showed: true });
          }

          function mkBtn(label, primary, onClick) {
            var b = document.createElement('button');
            b.type = 'button';
            b.textContent = label;
            b.className = primary ? 'pv-login-modal-btn pv-login-modal-btn-primary' : 'pv-login-modal-btn pv-login-modal-btn-secondary';
            b.style.padding = '10px 18px';
            b.style.borderRadius = '8px';
            b.style.fontWeight = '700';
            b.style.cursor = 'pointer';
            if (primary) {
              b.style.setProperty('background-color', '#008753', 'important');
              b.style.setProperty('color', '#ffffff', 'important');
              b.style.setProperty('border', 'none', 'important');
              b.style.boxShadow = '0 2px 8px rgba(0,135,83,0.35)';
            } else {
              b.style.setProperty('background-color', '#ffffff', 'important');
              b.style.setProperty('color', '#006b42', 'important');
              b.style.setProperty('border', '2px solid #008753', 'important');
              b.style.boxShadow = '0 1px 4px rgba(0,0,0,0.12)';
            }
            b.onclick = onClick;
            return b;
          }

          if (status !== 'pending_review') {
            btnRow.appendChild(
              mkBtn('Upload documents now', true, function () {
                removeOverlay();
                window.location.href = 'physician-verification';
              })
            );
          }
          var skip = mkBtn('Continue without uploading now — you can upload later', false, function () {
            removeOverlay();
          });
          skip.setAttribute(
            'title',
            'Skip for now and open the dashboard. Upload proof from ' +
              noticeFragment(orgCountry).fromClause +
              ' and your diploma anytime from the verification page.'
          );
          btnRow.appendChild(skip);

          box.appendChild(title);
          box.appendChild(body);
          if (status !== 'approved') box.appendChild(linkP);
          box.appendChild(btnRow);
          overlay.appendChild(box);
          document.body.appendChild(overlay);
        })
        .catch(function (e) {
          console.warn('runPostLoginPhysicianVerificationPrompt', e);
          doneNoModal();
        });
    });
  };

  w.getPhysicianVerificationSummary = async function () {
    var sb = await waitForSupabase(10000);
    if (!sb) return null;
    var authRes = await sb.auth.getUser();
    var authUser = authRes && authRes.data && authRes.data.user;
    if (!authUser) return null;
    var profRes = await sb
      .from('users')
      .select('id, organization_id, role, first_name, last_name, username, organizations(country)')
      .eq('auth_user_id', authUser.id)
      .maybeSingle();
    var profile = profRes.data;
    if (!profile || !isDoctorRole(profile.role)) return null;
    profile.organizationCountry = resolveOrgCountry(profile);
    var rowRes = await sb
      .from('physician_verifications')
      .select('*')
      .eq('user_id', profile.id)
      .maybeSingle();
    var row = rowRes.data;
    if (!row) {
      var ins = await sb
        .from('physician_verifications')
        .insert({ user_id: profile.id, organization_id: profile.organization_id })
        .select('*')
        .maybeSingle();
      row = ins.data;
    }
    if (!row) return null;
    var st = accessStateFromRow(row);
    st.profile = profile;
    return st;
  };

  var PV_BANNER_SNOOZE_PREFIX = 'mediforge_pv_banner_snooze_';

  function pvBannerSnoozeKey(userId) {
    return PV_BANNER_SNOOZE_PREFIX + userId;
  }

  /** Next 9:00 AM local — today if still before then, otherwise tomorrow (periodic daily reminder). */
  function getNextPeriodicBannerReminderMs() {
    var now = new Date();
    var next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0);
    if (now.getTime() >= next.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return next.getTime();
  }

  function isPvBannerSnoozed(userId) {
    var raw = localStorage.getItem(pvBannerSnoozeKey(userId));
    if (!raw) return false;
    var until = parseInt(raw, 10);
    if (isNaN(until) || Date.now() >= until) {
      localStorage.removeItem(pvBannerSnoozeKey(userId));
      return false;
    }
    return true;
  }

  function pvCountdownParts(untilMs) {
    var diff = untilMs - Date.now();
    if (diff <= 0) {
      return { d: 0, h: 0, m: 0, s: 0, expired: true };
    }
    var sec = Math.floor(diff / 1000);
    var d = Math.floor(sec / 86400);
    sec -= d * 86400;
    var h = Math.floor(sec / 3600);
    sec -= h * 3600;
    var m = Math.floor(sec / 60);
    var s = sec - m * 60;
    return { d: d, h: h, m: m, s: s, expired: false };
  }

  function buildBannerCountdownHtml(accent, heading) {
    var numC = accent === 'red' ? '#b71c1c' : accent === 'blue' ? '#0d47a1' : '#b45309';
    var box =
      'display:inline-flex;flex-direction:column;align-items:center;min-width:56px;padding:12px 14px;margin:0;border-radius:14px;background:linear-gradient(160deg,#ffffff 0%,#f4f6f9 100%);box-shadow:0 4px 16px rgba(0,0,0,0.07);border:1px solid rgba(0,0,0,0.06);';
    function unit(part, label) {
      return (
        '<div style="' +
        box +
        '"><span data-pv-cd="' +
        part +
        '" style="font-size:1.4rem;font-weight:800;font-variant-numeric:tabular-nums;color:' +
        numC +
        ';line-height:1;">0</span><span style="font-size:10px;text-transform:uppercase;letter-spacing:0.07em;color:#6b7280;margin-top:8px;font-weight:700;">' +
        label +
        '</span></div>'
      );
    }
    var head = heading || 'Time until access deadline';
    return (
      '<div style="text-align:center;font-size:13px;font-weight:700;margin:12px 0 6px;opacity:0.95;">' +
      head +
      '</div>' +
      '<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin:0 0 4px;" role="timer" aria-label="Countdown to verification access deadline">' +
      unit('d', 'Days') +
      unit('h', 'Hours') +
      unit('m', 'Min') +
      unit('s', 'Sec') +
      '</div>' +
      '<p data-pv-cd-expired style="display:none;text-align:center;font-weight:700;margin:6px 0 0;font-size:14px;">Access deadline has passed</p>'
    );
  }

  w.refreshPhysicianVerificationBanner = async function (elementId) {
    var el = elementId ? document.getElementById(elementId) : null;
    if (!el) return;
    if (el._pvCountdownInterval) {
      clearInterval(el._pvCountdownInterval);
      el._pvCountdownInterval = null;
    }
    var summary = await w.getPhysicianVerificationSummary();
    if (!summary || !summary.profile) {
      el.style.display = 'none';
      return;
    }
    if (summary.approved) {
      el.style.display = 'none';
      return;
    }
    if (isPvBannerSnoozed(summary.profile.id)) {
      el.style.display = 'none';
      return;
    }
    var status = summary.reviewStatus || 'not_submitted';
    var overdue = summary.blocked;
    var accent = overdue ? 'red' : status === 'pending_review' ? 'blue' : 'amber';
    var untilMs = summary.untilMs;

    var nextRem = new Date(getNextPeriodicBannerReminderMs());
    var nextRemStr = nextRem.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });

    var bodyLines = [];
    var accentBorder = '#f9a825';
    var summaryHint = 'Credential verification — expand for instructions and countdown';
    var panelColor = '#5d4037';
    var orgCountryBanner = (summary.profile && summary.profile.organizationCountry) || '';
    if (overdue) {
      accentBorder = '#c62828';
      summaryHint = 'Access may be limited — expand for details and deadline';
      panelColor = '#b71c1c';
      bodyLines.push(
        'Portal access is limited until your credentials are verified. ' + copyUploadProofWhenLimited(orgCountryBanner)
      );
      bodyLines.push(
        '<strong>Where to go:</strong> Dashboard → open <strong>Departmental Dashboards</strong> → <strong>Physician credential verification (regulator + diploma)</strong>, or use the link below.'
      );
      bodyLines.push('Access deadline was: <strong>' + new Date(untilMs).toLocaleString() + '</strong>');
    } else if (status === 'pending_review') {
      accentBorder = '#1565c0';
      summaryHint = 'Documents under review — expand for deadline and links';
      panelColor = '#0d47a1';
      bodyLines.push('Your documents are pending platform review.');
      bodyLines.push('Deadline to stay fully active: <strong>' + new Date(untilMs).toLocaleString() + '</strong>');
      bodyLines.push(
        '<strong>Where to check uploads:</strong> Dashboard → <strong>Departmental Dashboards</strong> → <strong>Physician credential verification</strong>, or the link below.'
      );
    } else {
      bodyLines.push(copyLicensedPhysician90DayLine(orgCountryBanner));
      bodyLines.push('Access deadline: <strong>' + new Date(untilMs).toLocaleString() + '</strong>');
      bodyLines.push(
        '<strong>How to upload:</strong> Dashboard → <strong>Departmental Dashboards</strong> → <strong>Physician credential verification (regulator + diploma)</strong>, then upload both documents and submit for review. You can also use the direct link below.'
      );
    }

    var cdHtml = buildBannerCountdownHtml(accent, overdue ? 'Access deadline elapsed' : 'Time until access deadline');
    var actionsHtml =
      '<div style="margin-top:16px;display:flex;flex-wrap:wrap;align-items:center;gap:10px;justify-content:flex-start;">' +
      '<a href="physician-verification" style="color:inherit;text-decoration:underline;font-weight:800;">Open verification page</a>' +
      '<button type="button" data-pv-banner-snooze style="padding:9px 16px;border:2px solid #008753;border-radius:10px;background:#fff;color:#006b42;cursor:pointer;font-weight:700;font-size:13px;">Remind me later</button>' +
      '</div>' +
      '<p style="font-size:12px;font-weight:500;margin:10px 0 0;opacity:0.88;line-height:1.45;"><strong>Remind me later</strong> hides this block until the next <strong>9:00 AM</strong> reminder (about <strong>' +
      nextRemStr +
      '</strong>).</p>';

    el.style.cssText = 'display:block;margin:0 auto 16px;max-width:900px;';
    el.innerHTML =
      '<details class="pv-dash-details" style="margin:0;border-radius:14px;overflow:hidden;border:2px solid ' +
      accentBorder +
      ';background:#fff;box-shadow:0 2px 12px rgba(0,0,0,0.06);">' +
      '<summary style="list-style:none;cursor:pointer;padding:14px 18px;font-weight:800;font-size:16px;color:#006b42;background:linear-gradient(135deg,#fff8e1,#FFFFF0);user-select:none;">' +
      'Important Outstanding Deliverable!' +
      '<span style="display:block;font-size:13px;font-weight:600;color:#36454F;margin-top:8px;line-height:1.4;">' +
      summaryHint +
      '</span></summary>' +
      '<div class="pv-dash-panel" style="padding:18px 20px;font-weight:600;color:' +
      panelColor +
      ';">' +
      bodyLines.join('<br><br>') +
      cdHtml +
      actionsHtml +
      '</div></details>';

    function tickCountdown() {
      var p = pvCountdownParts(untilMs);
      var nodes = ['d', 'h', 'm', 's'];
      var expiredEl = el.querySelector('[data-pv-cd-expired]');
      for (var i = 0; i < nodes.length; i++) {
        var node = el.querySelector('[data-pv-cd="' + nodes[i] + '"]');
        if (node) node.textContent = p.expired ? '0' : String(p[nodes[i]]);
      }
      if (expiredEl) {
        expiredEl.style.display = p.expired ? 'block' : 'none';
      }
    }
    tickCountdown();
    el._pvCountdownInterval = setInterval(tickCountdown, 1000);

    var snoozeBtn = el.querySelector('[data-pv-banner-snooze]');
    if (snoozeBtn) {
      snoozeBtn.onclick = function () {
        localStorage.setItem(pvBannerSnoozeKey(summary.profile.id), String(getNextPeriodicBannerReminderMs()));
        if (el._pvCountdownInterval) {
          clearInterval(el._pvCountdownInterval);
          el._pvCountdownInterval = null;
        }
        el.style.display = 'none';
      };
    }
  };
})(window);

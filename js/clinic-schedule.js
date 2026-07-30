/**
 * Clinic and pharmacy schedule helpers.
 * Config is stored per-org in localStorage (key: {org}_clinic-schedule).
 * Defaults: pharmacy follows clinic hours until staff override.
 */
(function clinicScheduleModule(global) {
  var DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  var DAY_LABELS = {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday'
  };

  function dataKey(suffix) {
    if (typeof global.getDataKey === 'function') return global.getDataKey(suffix);
    try {
      var user = JSON.parse(localStorage.getItem('user') || 'null');
      return user && user.org ? user.org + '_' + suffix : suffix;
    } catch (e) {
      return suffix;
    }
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function parseHm(hm) {
    var parts = String(hm || '00:00').split(':').map(Number);
    return { hour: parts[0] || 0, minute: parts[1] || 0 };
  }

  function toMinutes(hm) {
    var t = parseHm(hm);
    return t.hour * 60 + t.minute;
  }

  function fromMinutes(total) {
    var h = Math.floor(total / 60);
    var m = total % 60;
    return pad2(h) + ':' + pad2(m);
  }

  function dayKeyFromDate(dateInput) {
    var d;
    if (dateInput instanceof Date) {
      d = dateInput;
    } else if (typeof dateInput === 'string' && dateInput) {
      // YYYY-MM-DD as local date
      var bits = dateInput.split('-').map(Number);
      d = new Date(bits[0], (bits[1] || 1) - 1, bits[2] || 1);
    } else {
      d = new Date();
    }
    return DAY_KEYS[d.getDay() === 0 ? 6 : d.getDay() - 1];
  }

  function formatDateLocal(dateInput) {
    var d;
    if (dateInput instanceof Date) {
      d = dateInput;
    } else if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
      return dateInput.slice(0, 10);
    } else {
      d = new Date(dateInput);
    }
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function normalizeLunchBreaks(config) {
    if (Array.isArray(config.lunchBreaks) && config.lunchBreaks.length) {
      return config.lunchBreaks
        .filter(function (b) { return b && b.startTime; })
        .map(function (b) {
          return {
            startTime: b.startTime,
            duration: Math.max(5, parseInt(b.duration, 10) || 60),
            label: b.label || 'Break'
          };
        });
    }
    if (config.lunchBreak && config.lunchBreak.enabled && config.lunchBreak.startTime) {
      return [{
        startTime: config.lunchBreak.startTime,
        duration: Math.max(5, parseInt(config.lunchBreak.duration, 10) || 60),
        label: 'Lunch'
      }];
    }
    return [];
  }

  function defaultDayHours(config) {
    var start = config.startTime || '08:00';
    var end = config.endTime || '18:00';
    var working = config.workingDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    var map = {};
    DAY_KEYS.forEach(function (day) {
      var existing = config.dayHours && config.dayHours[day];
      if (existing && typeof existing === 'object') {
        map[day] = {
          enabled: existing.enabled !== false && (working.indexOf(day) !== -1 || existing.enabled === true),
          startTime: existing.startTime || start,
          endTime: existing.endTime || end
        };
        if (typeof existing.enabled === 'boolean') {
          map[day].enabled = existing.enabled;
        } else {
          map[day].enabled = working.indexOf(day) !== -1;
        }
      } else {
        map[day] = {
          enabled: working.indexOf(day) !== -1,
          startTime: start,
          endTime: end
        };
      }
    });
    return map;
  }

  function normalizeHolidays(config) {
    if (!Array.isArray(config.holidays)) return [];
    return config.holidays
      .filter(function (h) { return h && h.date; })
      .map(function (h) {
        return {
          date: String(h.date).slice(0, 10),
          name: String(h.name || 'Public Holiday').trim() || 'Public Holiday'
        };
      })
      .sort(function (a, b) { return a.date.localeCompare(b.date); });
  }

  function normalizeCustomDurations(config) {
    var presets = [15, 20, 30, 45, 60];
    var custom = Array.isArray(config.customDurations) ? config.customDurations : [];
    var all = presets.concat(custom).map(function (n) { return parseInt(n, 10); })
      .filter(function (n) { return n >= 5 && n <= 240; });
    var seen = {};
    var out = [];
    all.forEach(function (n) {
      if (!seen[n]) {
        seen[n] = true;
        out.push(n);
      }
    });
    out.sort(function (a, b) { return a - b; });
    return out;
  }

  function normalizePharmacy(config) {
    var p = config.pharmacy || {};
    return {
      useClinicSchedule: p.useClinicSchedule !== false,
      startTime: p.startTime || config.startTime || '08:00',
      endTime: p.endTime || config.endTime || '18:00',
      workingDays: Array.isArray(p.workingDays) ? p.workingDays : (config.workingDays || DAY_KEYS.slice(0, 5)),
      dayHours: p.dayHours || null,
      lunchBreaks: Array.isArray(p.lunchBreaks) ? p.lunchBreaks : []
    };
  }

  function normalizeConfig(raw) {
    var config = raw && typeof raw === 'object' ? raw : {};
    var dayHours = defaultDayHours(config);
    var workingDays = DAY_KEYS.filter(function (d) { return dayHours[d] && dayHours[d].enabled; });
    if (!workingDays.length) {
      workingDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
      workingDays.forEach(function (d) { dayHours[d].enabled = true; });
    }
    var lunchBreaks = normalizeLunchBreaks(config);
    var firstOpen = workingDays[0];
    return {
      startTime: (dayHours[firstOpen] && dayHours[firstOpen].startTime) || config.startTime || '08:00',
      endTime: (dayHours[firstOpen] && dayHours[firstOpen].endTime) || config.endTime || '18:00',
      slotDuration: parseInt(config.slotDuration, 10) || 20,
      regularVisitDuration: parseInt(config.regularVisitDuration, 10) || 20,
      initialVisitDuration: parseInt(config.initialVisitDuration, 10) || 45,
      customDurations: Array.isArray(config.customDurations)
        ? config.customDurations.map(function (n) { return parseInt(n, 10); }).filter(function (n) { return n >= 5 && n <= 240; })
        : [],
      availableDurations: normalizeCustomDurations(config),
      workingDays: workingDays,
      dayHours: dayHours,
      lunchBreaks: lunchBreaks,
      // Legacy single-break shape for older callers
      lunchBreak: lunchBreaks.length
        ? { enabled: true, startTime: lunchBreaks[0].startTime, duration: lunchBreaks[0].duration }
        : { enabled: false },
      holidays: normalizeHolidays(config),
      pharmacy: normalizePharmacy(Object.assign({}, config, { workingDays: workingDays, dayHours: dayHours }))
    };
  }

  function loadRawConfig() {
    try {
      return JSON.parse(localStorage.getItem(dataKey('clinic-schedule')) || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  function getClinicScheduleConfig() {
    return normalizeConfig(loadRawConfig());
  }

  function saveClinicScheduleConfig(config) {
    var normalized = normalizeConfig(config);
    localStorage.setItem(dataKey('clinic-schedule'), JSON.stringify(normalized));
    try {
      global.dispatchEvent(new CustomEvent('scheduleConfigUpdated', { detail: normalized }));
    } catch (e) { /* ignore */ }
    return normalized;
  }

  function getHolidayOnDate(dateInput, config) {
    var cfg = config || getClinicScheduleConfig();
    var dateStr = formatDateLocal(dateInput);
    for (var i = 0; i < cfg.holidays.length; i++) {
      if (cfg.holidays[i].date === dateStr) return cfg.holidays[i];
    }
    return null;
  }

  function resolveDayHours(config, dayKey, fromPharmacy) {
    var source = config;
    if (fromPharmacy) {
      var ph = config.pharmacy || {};
      if (ph.useClinicSchedule !== false) {
        source = config;
      } else {
        var pHours = defaultDayHours({
          startTime: ph.startTime || config.startTime,
          endTime: ph.endTime || config.endTime,
          workingDays: ph.workingDays || config.workingDays,
          dayHours: ph.dayHours || {}
        });
        return pHours[dayKey] || { enabled: false, startTime: '08:00', endTime: '18:00' };
      }
    }
    var hours = (source.dayHours && source.dayHours[dayKey]) || null;
    if (hours) return hours;
    return {
      enabled: (source.workingDays || []).indexOf(dayKey) !== -1,
      startTime: source.startTime || '08:00',
      endTime: source.endTime || '18:00'
    };
  }

  function resolveLunchBreaks(config, fromPharmacy) {
    if (fromPharmacy) {
      var ph = config.pharmacy || {};
      if (ph.useClinicSchedule === false) {
        return normalizeLunchBreaks({ lunchBreaks: ph.lunchBreaks || [], lunchBreak: ph.lunchBreak });
      }
    }
    return normalizeLunchBreaks(config);
  }

  function overlapsBreak(slotStartMin, slotDuration, breaks) {
    var slotEnd = slotStartMin + slotDuration;
    for (var i = 0; i < breaks.length; i++) {
      var b = breaks[i];
      var bStart = toMinutes(b.startTime);
      var bEnd = bStart + (parseInt(b.duration, 10) || 0);
      if (slotStartMin < bEnd && slotEnd > bStart) return true;
    }
    return false;
  }

  /**
   * Generate bookable slot start times for a date.
   * @param {string|Date} [dateInput] - if omitted, uses default weekday hours (legacy)
   * @param {{ pharmacy?: boolean, slotDuration?: number }} [options]
   * @returns {string[]} HH:MM slots
   */
  function getSlotsForDate(dateInput, options) {
    var opts = options || {};
    var config = getClinicScheduleConfig();
    var slotDuration = parseInt(opts.slotDuration, 10) || config.slotDuration || 20;
    var fromPharmacy = !!opts.pharmacy;

    if (dateInput) {
      var holiday = getHolidayOnDate(dateInput, config);
      if (holiday && !fromPharmacy) return [];
      // Pharmacy also closed on clinic holidays unless custom pharmacy later needs separate holidays
      if (holiday && fromPharmacy) return [];

      var dayKey = dayKeyFromDate(dateInput);
      var day = resolveDayHours(config, dayKey, fromPharmacy);
      if (!day.enabled) return [];

      var breaks = resolveLunchBreaks(config, fromPharmacy);
      return buildSlots(day.startTime, day.endTime, slotDuration, breaks);
    }

    // Legacy: no date: use global start/end
    return buildSlots(
      config.startTime,
      config.endTime,
      slotDuration,
      resolveLunchBreaks(config, fromPharmacy)
    );
  }

  function buildSlots(startTime, endTime, slotDuration, breaks) {
    var slots = [];
    var startMin = toMinutes(startTime);
    var endMin = toMinutes(endTime);
    if (!(endMin > startMin)) return slots;
    var cur = startMin;
    var guard = 0;
    while (cur + slotDuration <= endMin && guard < 500) {
      guard++;
      if (!overlapsBreak(cur, slotDuration, breaks || [])) {
        slots.push(fromMinutes(cur));
      }
      cur += slotDuration;
    }
    return slots;
  }

  function isClinicOpenOnDate(dateInput) {
    var config = getClinicScheduleConfig();
    if (getHolidayOnDate(dateInput, config)) {
      return { open: false, reason: 'holiday', holiday: getHolidayOnDate(dateInput, config) };
    }
    var dayKey = dayKeyFromDate(dateInput);
    var day = resolveDayHours(config, dayKey, false);
    if (!day.enabled) {
      return { open: false, reason: 'closed_day', dayKey: dayKey };
    }
    return {
      open: true,
      reason: null,
      dayKey: dayKey,
      startTime: day.startTime,
      endTime: day.endTime
    };
  }

  function getPharmacyScheduleConfig() {
    var config = getClinicScheduleConfig();
    var ph = config.pharmacy || {};
    if (ph.useClinicSchedule !== false) {
      return {
        useClinicSchedule: true,
        startTime: config.startTime,
        endTime: config.endTime,
        workingDays: config.workingDays.slice(),
        dayHours: JSON.parse(JSON.stringify(config.dayHours)),
        lunchBreaks: config.lunchBreaks.slice()
      };
    }
    var dayHours = defaultDayHours({
      startTime: ph.startTime || config.startTime,
      endTime: ph.endTime || config.endTime,
      workingDays: ph.workingDays || config.workingDays,
      dayHours: ph.dayHours || {}
    });
    return {
      useClinicSchedule: false,
      startTime: ph.startTime || config.startTime,
      endTime: ph.endTime || config.endTime,
      workingDays: DAY_KEYS.filter(function (d) { return dayHours[d].enabled; }),
      dayHours: dayHours,
      lunchBreaks: normalizeLunchBreaks({ lunchBreaks: ph.lunchBreaks || [] })
    };
  }

  function savePharmacyScheduleConfig(pharmacyPartial) {
    var config = getClinicScheduleConfig();
    config.pharmacy = Object.assign({}, config.pharmacy || {}, pharmacyPartial || {});
    return saveClinicScheduleConfig(config);
  }

  // Public API (also exposed as legacy globals used by appointments.js)
  global.ClinicSchedule = {
    DAY_KEYS: DAY_KEYS,
    DAY_LABELS: DAY_LABELS,
    getClinicScheduleConfig: getClinicScheduleConfig,
    saveClinicScheduleConfig: saveClinicScheduleConfig,
    getSlotsForDate: getSlotsForDate,
    isClinicOpenOnDate: isClinicOpenOnDate,
    getHolidayOnDate: getHolidayOnDate,
    getPharmacyScheduleConfig: getPharmacyScheduleConfig,
    savePharmacyScheduleConfig: savePharmacyScheduleConfig,
    normalizeConfig: normalizeConfig,
    formatDateLocal: formatDateLocal,
    dayKeyFromDate: dayKeyFromDate
  };

  global.getClinicSchedule = function getClinicSchedule() {
    return getClinicScheduleConfig();
  };

  global.getAllSlots = function getAllSlots(dateInput) {
    return getSlotsForDate(dateInput || null, {});
  };

  global.getSlotsForDate = getSlotsForDate;
  global.isClinicOpenOnDate = isClinicOpenOnDate;
  global.getHolidayOnDate = function (d) { return getHolidayOnDate(d); };

  /** Pure slot builder for UI previews (does not read/write storage). */
  global.ClinicSchedule.buildSlots = buildSlots;
  global.ClinicSchedule.slotsFromDayHours = function slotsFromDayHours(dayHours, lunchBreaks, slotDuration) {
    if (!dayHours || !dayHours.enabled) return [];
    return buildSlots(dayHours.startTime, dayHours.endTime, slotDuration || 20, lunchBreaks || []);
  };

  /**
   * Resolve appointment duration minutes from clinic schedule + appointment type label.
   * Initial/new-patient style types use initialVisitDuration; others use regularVisitDuration.
   */
  function resolveAppointmentDurationMinutes(appointmentTypeName, options) {
    var cfg = getClinicScheduleConfig();
    var opts = options || {};
    if (opts.durationMinutes && parseInt(opts.durationMinutes, 10) >= 5) {
      return parseInt(opts.durationMinutes, 10);
    }
    var label = String(appointmentTypeName || '').toLowerCase();
    var looksInitial = /initial|new\s*patient|new\s*visit|first\s*visit|intake|consult(ation)?\s*new/.test(label);
    if (looksInitial) {
      return parseInt(cfg.initialVisitDuration, 10) || 45;
    }
    return parseInt(cfg.regularVisitDuration, 10) || parseInt(cfg.slotDuration, 10) || 20;
  }

  global.ClinicSchedule.resolveAppointmentDurationMinutes = resolveAppointmentDurationMinutes;
  global.resolveAppointmentDurationMinutes = resolveAppointmentDurationMinutes;
})(typeof window !== 'undefined' ? window : globalThis);

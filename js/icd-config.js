/**
 * Active ICD coding standard for MediForge (Canadian default: ICD-10-CA).
 * Organization preference: organizations.settings.icd_version ("icd10ca" | "icd11").
 * Toggle from Dashboard → Facility Configuration.
 */
(function (global) {
  const SETTING_KEY = "icd_version";

  const SCRIPTS = {
    icd10ca: "js/icd10ca.js",
    icd11: "js/icd11.js"
  };

  const LABELS = {
    icd10ca: "ICD-10-CA",
    icd11: "ICD-11"
  };

  function normalizeIcdVersion(value) {
    if (value === "icd11" || value === "ICD-11") return "icd11";
    if (
      value === "icd10ca" ||
      value === "icd10" ||
      value === "ICD-10-CA" ||
      value === "ICD-10"
    ) {
      return "icd10ca";
    }
    return null;
  }

  function readIcdVersionFromLocalCache() {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const fromUser = normalizeIcdVersion(user.settings?.[SETTING_KEY]);
      if (fromUser) return fromUser;

      const organizations = JSON.parse(localStorage.getItem("organizations") || "{}");
      const keys = [user.organizationId, user.organization_id, user.org].filter(Boolean);
      for (let i = 0; i < keys.length; i += 1) {
        const org = organizations[keys[i]];
        const version = normalizeIcdVersion(org?.settings?.[SETTING_KEY]);
        if (version) return version;
      }
    } catch (_) {
      /* ignore */
    }
    return null;
  }

  const config = {
    /** @type {"icd10ca"|"icd11"} */
    version: readIcdVersionFromLocalCache() || "icd10ca",

    getScriptPath() {
      return SCRIPTS[this.version] || SCRIPTS.icd10ca;
    },

    getLabel() {
      return LABELS[this.version] || LABELS.icd10ca;
    },

    getScriptId() {
      return `icd-data-script-${this.version}`;
    },

    setVersion(version) {
      const normalized = normalizeIcdVersion(version);
      if (!normalized || !SCRIPTS[normalized]) {
        throw new Error(`Unknown ICD version: ${version}`);
      }
      this.version = normalized;
      global.__icdScriptLoading = null;
      delete global.ICD_CODES;
      if (normalized !== "icd11") {
        delete global.ICD11_CODES;
      }
      if (normalized !== "icd10ca") {
        delete global.ICD10CA_CODES;
      }
      if (typeof global.__resetIcdSearchIndex === "function") {
        global.__resetIcdSearchIndex();
      }
    }
  };

  global.MEDIFORGE_ICD_CONFIG = config;
  global.normalizeIcdVersion = normalizeIcdVersion;

  global.getActiveIcdCodes = function getActiveIcdCodes() {
    if (config.version === "icd11") {
      return global.ICD11_CODES || [];
    }
    return global.ICD10CA_CODES || global.ICD_CODES || [];
  };

  global.syncIcdCodeAliases = function syncIcdCodeAliases(sourceArray, kind) {
    const codes = sourceArray || [];
    if (kind === "icd10ca") {
      global.ICD10CA_CODES = codes;
    }
    if (config.version === kind) {
      global.ICD_CODES = codes;
      global.ICD11_CODES = codes;
    }
    return codes;
  };

  let initPromise = null;
  global.initIcdVersionFromOrganization = async function initIcdVersionFromOrganization() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      let version = readIcdVersionFromLocalCache();
      const orgId =
        typeof global.resolveOrganizationId === "function"
          ? await global.resolveOrganizationId()
          : (() => {
              const user = JSON.parse(localStorage.getItem("user") || "{}");
              return user.organizationId || user.organization_id || user.org || null;
            })();

      if (
        global.supabaseClient &&
        orgId &&
        typeof global.isOrganizationUuid === "function" &&
        global.isOrganizationUuid(orgId)
      ) {
        try {
          const { data, error } = await global.supabaseClient
            .from("organizations")
            .select("settings")
            .eq("id", orgId)
            .maybeSingle();
          if (!error && data?.settings?.[SETTING_KEY]) {
            version = normalizeIcdVersion(data.settings[SETTING_KEY]) || version;
          }
        } catch (err) {
          console.warn("[ICD] Could not load icd_version from Supabase:", err);
        }
      }

      config.setVersion(version || "icd10ca");
      return config.version;
    })();
    return initPromise;
  };

  global.getOrganizationIcdVersion = async function getOrganizationIcdVersion() {
    await global.initIcdVersionFromOrganization();
    return config.version;
  };

  global.setOrganizationIcdVersion = async function setOrganizationIcdVersion(version) {
    const normalized = normalizeIcdVersion(version);
    if (!normalized) {
      throw new Error(`Invalid ICD version: ${version}`);
    }

    const orgId =
      typeof global.resolveOrganizationId === "function"
        ? await global.resolveOrganizationId()
        : (() => {
            const user = JSON.parse(localStorage.getItem("user") || "{}");
            return user.organizationId || user.organization_id || user.org || null;
          })();

    if (!orgId) {
      throw new Error("Could not determine organization");
    }

    config.setVersion(normalized);

    if (typeof global.saveOrganizationSetting === "function") {
      await global.saveOrganizationSetting(orgId, SETTING_KEY, normalized);
    } else if (typeof global.cacheOrganizationSettingsLocal === "function") {
      global.cacheOrganizationSettingsLocal(orgId, { [SETTING_KEY]: normalized });
    }

    initPromise = null;
    return normalized;
  };
})(window);

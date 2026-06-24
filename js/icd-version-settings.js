/**
 * Dashboard control for organization ICD coding standard (ICD-10-CA vs ICD-11).
 * Requires js/icd-config.js and js/utils.js (saveOrganizationSetting).
 */
(function (global) {
  function getLabel(version) {
    return version === "icd11" ? "ICD-11" : "ICD-10-CA";
  }

  global.toggleIcdCodingStandard = async function toggleIcdCodingStandard() {
    try {
      const current =
        typeof global.getOrganizationIcdVersion === "function"
          ? await global.getOrganizationIcdVersion()
          : global.MEDIFORGE_ICD_CONFIG?.version || "icd10ca";
      const next = current === "icd11" ? "icd10ca" : "icd11";

      const confirmed = confirm(
        `Switch diagnosis coding standard from ${getLabel(current)} to ${getLabel(next)}?\n\n` +
          "This applies to all users in your organization when searching diagnoses, medical history, and prescriptions.\n\n" +
          "Existing saved diagnoses are not changed: only new searches and selections.\n\n" +
          "Refresh open clinical pages after switching."
      );
      if (!confirmed) return;

      if (typeof global.setOrganizationIcdVersion !== "function") {
        alert("ICD settings are unavailable. Please reload the dashboard and try again.");
        return;
      }

      await global.setOrganizationIcdVersion(next);
      await global.updateIcdCodingStandardButton();
      alert(`Diagnosis coding standard is now ${getLabel(next)}. Refresh open clinical pages for the change to take effect.`);
    } catch (error) {
      console.error("[ICD] toggle failed:", error);
      alert("Could not update ICD coding standard. Please try again.");
      await global.updateIcdCodingStandardButton();
    }
  };

  global.updateIcdCodingStandardButton = async function updateIcdCodingStandardButton() {
    const btn = document.getElementById("icd-coding-standard-btn");
    if (!btn) return;

    let version = global.MEDIFORGE_ICD_CONFIG?.version || "icd10ca";
    if (typeof global.getOrganizationIcdVersion === "function") {
      try {
        version = await global.getOrganizationIcdVersion();
      } catch (_) {
        /* keep cached label */
      }
    }

    btn.textContent = `📋 Diagnosis Codes: ${getLabel(version)}`;
  };

  function bootButton() {
    global.updateIcdCodingStandardButton();
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bootButton);
    } else {
      bootButton();
    }
    window.addEventListener("load", () => setTimeout(bootButton, 500));
  }
})(window);

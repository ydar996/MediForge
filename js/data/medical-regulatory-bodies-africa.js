/**
 * African medical practitioner regulatory bodies: reference data for physician verification copy.
 *
 * Update this file when authorities change or better public information is available.
 * Bump _meta.version when you edit entries.
 *
 * Fields:
 * - country: canonical label (match organizations.country when possible)
 * - aliases: alternate spellings / ISO-style names from forms or imports
 * - regulatoryBody: full name from official sources where known
 * - unknownAgency: when true, end-user notices use the generic phrase only (not regulatoryBody text)
 * - verificationNotes: internal hints (websites, how to verify): not shown in standard doctor notices
 */
(function (w) {
  'use strict';

  var GENERIC_FROM_CLAUSE = "your country's medical regulatory body";

  /** @type {{ version: number, updated: string, source: string }} */
  var META = {
    version: 1,
    updated: '2026-03-27',
    source: 'MediForge curated list; verify locally before legal reliance'
  };

  /**
   * @typedef {Object} RegulatoryEntry
   * @property {string} country
   * @property {string[]} [aliases]
   * @property {string} regulatoryBody
   * @property {boolean} unknownAgency
   * @property {string} verificationNotes
   */

  /** @type {RegulatoryEntry[]} */
  var ENTRIES = [
    { country: 'Algeria', aliases: [], regulatoryBody: 'Unknown / Ministry of Health (Ordre des Médecins possible)', unknownAgency: true, verificationNotes: 'Contact Ministry of Health' },
    { country: 'Angola', aliases: [], regulatoryBody: 'Unknown / Ministry of Health', unknownAgency: true, verificationNotes: 'Contact Ministry of Health' },
    { country: 'Benin', aliases: [], regulatoryBody: 'Unknown / Ministry of Health (Ordre des Médecins du Bénin)', unknownAgency: true, verificationNotes: 'Contact Ministry of Health' },
    { country: 'Botswana', aliases: [], regulatoryBody: 'Botswana Health Professions Council (BHPC)', unknownAgency: false, verificationNotes: 'bhpc.org.bw (registration & licensing portal)' },
    { country: 'Burkina Faso', aliases: [], regulatoryBody: 'Unknown / Ministry of Health', unknownAgency: true, verificationNotes: 'Contact Ministry of Health' },
    { country: 'Burundi', aliases: [], regulatoryBody: 'Unknown / Ministry of Health', unknownAgency: true, verificationNotes: 'Contact Ministry of Health' },
    { country: 'Cabo Verde', aliases: ['Cape Verde'], regulatoryBody: 'Unknown / Ministry of Health', unknownAgency: true, verificationNotes: 'Contact Ministry of Health' },
    { country: 'Cameroon', aliases: [], regulatoryBody: 'Unknown / Ministry of Health (Ordre des Médecins)', unknownAgency: true, verificationNotes: 'Contact Ministry of Health' },
    { country: 'Central African Republic', aliases: ['CAR'], regulatoryBody: 'Unknown / Ministry of Health', unknownAgency: true, verificationNotes: 'Contact Ministry of Health' },
    { country: 'Chad', aliases: [], regulatoryBody: 'Unknown / Ministry of Health', unknownAgency: true, verificationNotes: 'Contact Ministry of Health' },
    { country: 'Comoros', aliases: [], regulatoryBody: 'Unknown / Ministry of Health', unknownAgency: true, verificationNotes: 'Contact Ministry of Health' },
    { country: 'Congo (Republic of the)', aliases: ['Republic of the Congo', 'Congo', 'Congo-Brazzaville'], regulatoryBody: 'Unknown / Ministry of Health', unknownAgency: true, verificationNotes: 'Contact Ministry of Health' },
    { country: "Côte d'Ivoire", aliases: ["Cote d'Ivoire", 'Ivory Coast'], regulatoryBody: 'Unknown / Ministry of Health (Ordre National des Médecins)', unknownAgency: true, verificationNotes: 'Contact Ministry of Health' },
    { country: 'Democratic Republic of Congo', aliases: ['Democratic Republic of the Congo', 'DRC', 'Congo-Kinshasa'], regulatoryBody: 'Unknown / Ministry of Health', unknownAgency: true, verificationNotes: 'Contact Ministry of Health' },
    { country: 'Djibouti', aliases: [], regulatoryBody: 'Unknown / Ministry of Health', unknownAgency: true, verificationNotes: 'Contact Ministry of Health' },
    { country: 'Egypt', aliases: [], regulatoryBody: 'Egyptian Medical Syndicate (EMS) / Ministry of Health', unknownAgency: false, verificationNotes: 'Contact Syndicate or Ministry' },
    { country: 'Equatorial Guinea', aliases: [], regulatoryBody: 'Unknown / Ministry of Health', unknownAgency: true, verificationNotes: 'Contact Ministry of Health' },
    { country: 'Eritrea', aliases: [], regulatoryBody: 'Unknown / Ministry of Health', unknownAgency: true, verificationNotes: 'Contact Ministry of Health' },
    { country: 'Eswatini', aliases: ['Swaziland'], regulatoryBody: 'Eswatini Medical and Dental Council', unknownAgency: false, verificationNotes: 'eswatinimedicalcouncil.com' },
    { country: 'Ethiopia', aliases: [], regulatoryBody: 'Unknown / Ministry of Health (or relevant authority)', unknownAgency: true, verificationNotes: 'Contact Ministry of Health' },
    { country: 'Gabon', aliases: [], regulatoryBody: 'Unknown / Ministry of Health', unknownAgency: true, verificationNotes: 'Contact Ministry of Health' },
    { country: 'Gambia (The)', aliases: ['The Gambia', 'Gambia'], regulatoryBody: 'Medical and Dental Council, Republic of The Gambia', unknownAgency: false, verificationNotes: 'Contact council directly' },
    { country: 'Ghana', aliases: [], regulatoryBody: 'Ghana Medical and Dental Council', unknownAgency: false, verificationNotes: 'mdcghana.org' },
    { country: 'Guinea', aliases: [], regulatoryBody: 'Unknown / Ministry of Health', unknownAgency: true, verificationNotes: 'Contact Ministry of Health' },
    { country: 'Guinea-Bissau', aliases: [], regulatoryBody: 'Unknown / Ministry of Health', unknownAgency: true, verificationNotes: 'Contact Ministry of Health' },
    { country: 'Kenya', aliases: [], regulatoryBody: 'Kenya Medical Practitioners and Dentists Council (KMPDC)', unknownAgency: false, verificationNotes: 'kmpdc.go.ke (practitioner search)' },
    { country: 'Lesotho', aliases: [], regulatoryBody: 'Lesotho Medical, Dental & Pharmacy Council', unknownAgency: false, verificationNotes: 'Contact council directly' },
    { country: 'Liberia', aliases: [], regulatoryBody: 'Liberia Medical and Dental Council (LMDC)', unknownAgency: false, verificationNotes: 'Contact LMDC for verification' },
    { country: 'Libya', aliases: [], regulatoryBody: 'Unknown / Ministry of Health', unknownAgency: true, verificationNotes: 'Contact Ministry of Health' },
    { country: 'Madagascar', aliases: [], regulatoryBody: 'Unknown / Ministry of Health', unknownAgency: true, verificationNotes: 'Contact Ministry of Health' },
    { country: 'Malawi', aliases: [], regulatoryBody: 'Medical Council of Malawi (MCM)', unknownAgency: false, verificationNotes: 'medicalcouncilmw.org' },
    { country: 'Mali', aliases: [], regulatoryBody: 'Ordre des Médecins du Mali', unknownAgency: false, verificationNotes: 'Contact Ordre / Ministry of Health' },
    { country: 'Mauritania', aliases: [], regulatoryBody: 'Unknown / Ministry of Health', unknownAgency: true, verificationNotes: 'Contact Ministry of Health' },
    { country: 'Mauritius', aliases: [], regulatoryBody: 'Medical Council of Mauritius', unknownAgency: false, verificationNotes: 'medicalcouncilmu.org' },
    { country: 'Morocco', aliases: [], regulatoryBody: 'Unknown / Ministry of Health (Ordre des Médecins)', unknownAgency: true, verificationNotes: 'Contact Ministry of Health' },
    { country: 'Mozambique', aliases: [], regulatoryBody: 'Unknown / Ministry of Health', unknownAgency: true, verificationNotes: 'Contact Ministry of Health' },
    { country: 'Namibia', aliases: [], regulatoryBody: 'Medical and Dental Council of Namibia (under HPCNA)', unknownAgency: false, verificationNotes: 'hpcna.com' },
    { country: 'Niger', aliases: [], regulatoryBody: 'Unknown / Ministry of Health', unknownAgency: true, verificationNotes: 'Contact Ministry of Health' },
    { country: 'Nigeria', aliases: [], regulatoryBody: 'Medical and Dental Council of Nigeria (MDCN)', unknownAgency: false, verificationNotes: 'mdcn.gov.ng (Confirm Doctor Status tool)' },
    { country: 'Rwanda', aliases: [], regulatoryBody: 'Rwanda Medical and Dental Council (RMDC)', unknownAgency: false, verificationNotes: 'rmdc.rw' },
    { country: 'São Tomé and Príncipe', aliases: ['Sao Tome and Principe', 'São Tomé and Principe'], regulatoryBody: 'Unknown / Ministry of Health', unknownAgency: true, verificationNotes: 'Contact Ministry of Health' },
    { country: 'Senegal', aliases: [], regulatoryBody: 'Unknown / Ministry of Health (Ordre des Médecins)', unknownAgency: true, verificationNotes: 'Contact Ministry of Health' },
    { country: 'Seychelles', aliases: [], regulatoryBody: 'Seychelles Medical and Dental Council', unknownAgency: false, verificationNotes: 'Contact council directly' },
    { country: 'Sierra Leone', aliases: [], regulatoryBody: 'Sierra Leone Medical and Dental Council', unknownAgency: false, verificationNotes: 'mdcsierraleone.org' },
    { country: 'Somalia', aliases: [], regulatoryBody: 'Unknown / Ministry of Health (varies by region)', unknownAgency: true, verificationNotes: 'Contact Ministry of Health' },
    { country: 'South Africa', aliases: [], regulatoryBody: 'Health Professions Council of South Africa (HPCSA)', unknownAgency: false, verificationNotes: 'hpcsa.co.za (practitioner register/search)' },
    { country: 'South Sudan', aliases: [], regulatoryBody: 'South Sudan General Medical Council', unknownAgency: false, verificationNotes: 'Contact council directly' },
    { country: 'Sudan', aliases: [], regulatoryBody: 'Sudan Medical Council', unknownAgency: false, verificationNotes: 'Contact council directly' },
    { country: 'Tanzania', aliases: [], regulatoryBody: 'Medical Council of Tanganyika (mainland; Zanzibar separate)', unknownAgency: false, verificationNotes: 'mct.go.tz' },
    { country: 'Togo', aliases: [], regulatoryBody: 'Unknown / Ministry of Health (Ordre des Médecins)', unknownAgency: true, verificationNotes: 'Contact Ministry of Health' },
    { country: 'Tunisia', aliases: [], regulatoryBody: 'Unknown / Ministry of Health (Ordre des Médecins)', unknownAgency: true, verificationNotes: 'Contact Ministry of Health' },
    { country: 'Uganda', aliases: [], regulatoryBody: 'Uganda Medical and Dental Practitioners Council (UMDPC)', unknownAgency: false, verificationNotes: 'umdpc.go.ug' },
    { country: 'Zambia', aliases: [], regulatoryBody: 'Health Professions Council of Zambia (HPCZ)', unknownAgency: false, verificationNotes: 'hpcz.org.zm (registration verification)' },
    { country: 'Zimbabwe', aliases: [], regulatoryBody: 'Medical and Dental Practitioners Council of Zimbabwe (MDPCZ)', unknownAgency: false, verificationNotes: 'mdpcz.co.zw' }
  ];

  function normalizeKey(s) {
    if (!s || typeof s !== 'string') return '';
    return s
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\u2019/g, "'");
  }

  /** @type {Object.<string, RegulatoryEntry>} */
  var byNormalizedKey = {};
  function indexEntry(entry) {
    function add(k) {
      var nk = normalizeKey(k);
      if (nk) byNormalizedKey[nk] = entry;
    }
    add(entry.country);
    (entry.aliases || []).forEach(add);
  }
  ENTRIES.forEach(indexEntry);

  function lookupEntry(countryFromOrg) {
    var nk = normalizeKey(countryFromOrg);
    if (!nk) return null;
    return byNormalizedKey[nk] || null;
  }

  /**
   * @param {string} countryFromOrg - organizations.country (or equivalent)
   * @returns {{ fromClause: string, isSpecific: boolean, canonicalCountry: string|null, verificationNotes: string|null, meta: object }}
   */
  function getMedicalRegulatoryBodyNoticeFragment(countryFromOrg) {
    var entry = lookupEntry(countryFromOrg);
    if (!entry || entry.unknownAgency) {
      return {
        fromClause: GENERIC_FROM_CLAUSE,
        isSpecific: false,
        canonicalCountry: entry ? entry.country : null,
        verificationNotes: entry ? entry.verificationNotes : null,
        meta: META
      };
    }
    var body = (entry.regulatoryBody || '').trim();
    if (!body) {
      return {
        fromClause: GENERIC_FROM_CLAUSE,
        isSpecific: false,
        canonicalCountry: entry.country,
        verificationNotes: entry.verificationNotes,
        meta: META
      };
    }
    var fromClause = /^the\s+/i.test(body) ? body : 'the ' + body;
    return {
      fromClause: fromClause,
      isSpecific: true,
      canonicalCountry: entry.country,
      verificationNotes: entry.verificationNotes,
      meta: META
    };
  }

  w.MEDICAL_REGULATORY_BODIES_AFRICA = {
    meta: META,
    genericFromClause: GENERIC_FROM_CLAUSE,
    entries: ENTRIES,
    lookupEntry: lookupEntry,
    getMedicalRegulatoryBodyNoticeFragment: getMedicalRegulatoryBodyNoticeFragment,
    normalizeCountryKey: normalizeKey
  };

  w.getMedicalRegulatoryBodyNoticeFragment = getMedicalRegulatoryBodyNoticeFragment;
})(window);

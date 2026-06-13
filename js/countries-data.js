// Countries and States Data for MediForge
// Includes African countries with states/provinces and phone codes

const COUNTRIES_DATA = {
  // East Africa
  "Kenya": {
    code: "KE",
    phoneCode: "+254",
    phoneFormat: "+254 XXX XXX XXX",
    states: [
      "Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Thika", "Malindi",
      "Kitale", "Garissa", "Kakamega", "Machakos", "Meru", "Nyeri", "Kericho"
    ]
  },
  "Tanzania": {
    code: "TZ",
    phoneCode: "+255",
    phoneFormat: "+255 XXX XXX XXX",
    states: [
      "Dar es Salaam", "Mwanza", "Arusha", "Dodoma", "Mbeya", "Morogoro", "Tanga",
      "Zanzibar", "Kilimanjaro", "Tabora", "Kigoma", "Mtwara", "Shinyanga", "Pwani"
    ]
  },
  "Uganda": {
    code: "UG",
    phoneCode: "+256",
    phoneFormat: "+256 XXX XXX XXX",
    states: [
      "Kampala", "Wakiso", "Mukono", "Gulu", "Lira", "Mbarara", "Jinja", "Mbale",
      "Masaka", "Kasese", "Hoima", "Arua", "Soroti", "Kabale"
    ]
  },
  "Rwanda": {
    code: "RW",
    phoneCode: "+250",
    phoneFormat: "+250 XXX XXX XXX",
    states: [
      "Kigali", "Eastern Province", "Western Province", "Northern Province", "Southern Province"
    ]
  },
  "Burundi": {
    code: "BI",
    phoneCode: "+257",
    phoneFormat: "+257 XX XX XXXX",
    states: [
      "Bujumbura Mairie", "Gitega", "Ngozi", "Bururi", "Cibitoke", "Kirundo", "Makamba"
    ]
  },
  "Ethiopia": {
    code: "ET",
    phoneCode: "+251",
    phoneFormat: "+251 XX XXX XXXX",
    states: [
      "Addis Ababa", "Dire Dawa", "Oromia", "Amhara", "Tigray", "Somali", "SNNPR",
      "Afar", "Benishangul-Gumuz", "Gambela", "Harari"
    ]
  },
  "Somalia": {
    code: "SO",
    phoneCode: "+252",
    phoneFormat: "+252 XX XXX XXXX",
    states: [
      "Mogadishu", "Hargeisa", "Bosaso", "Kismayo", "Berbera", "Merca", "Galkayo"
    ]
  },

  // West Africa
  "Nigeria": {
    code: "NG",
    phoneCode: "+234",
    phoneFormat: "+234 XXX XXX XXXX",
    states: [
      // All 36 States + Federal Capital Territory (FCT) - Complete list as provided
      "Abia",
      "Adamawa",
      "Akwa Ibom",
      "Anambra",
      "Bauchi",
      "Bayelsa",
      "Benue",
      "Borno",
      "Cross River",
      "Delta",
      "Ebonyi",
      "Edo",
      "Ekiti",
      "Enugu",
      "Gombe",
      "Imo",
      "Jigawa",
      "Kaduna",
      "Kano",
      "Katsina",
      "Kebbi",
      "Kogi",
      "Kwara",
      "Lagos",
      "Nasarawa",
      "Niger",
      "Ogun",
      "Ondo",
      "Osun",
      "Oyo",
      "Plateau",
      "Rivers",
      "Sokoto",
      "Taraba",
      "Yobe",
      "Zamfara",
      "Federal Capital Territory (FCT)"
    ]
  },
  "Ghana": {
    code: "GH",
    phoneCode: "+233",
    phoneFormat: "+233 XX XXX XXXX",
    states: [
      "Greater Accra", "Ashanti", "Western", "Central", "Eastern", "Volta", "Northern",
      "Upper East", "Upper West", "Brong-Ahafo", "Kumasi", "Tamale", "Sekondi-Takoradi"
    ]
  },
  "Senegal": {
    code: "SN",
    phoneCode: "+221",
    phoneFormat: "+221 XX XXX XXXX",
    states: [
      "Dakar", "Thiès", "Diourbel", "Kaolack", "Saint-Louis", "Ziguinchor", "Louga"
    ]
  },
  "Ivory Coast": {
    code: "CI",
    phoneCode: "+225",
    phoneFormat: "+225 XX XX XX XX",
    states: [
      "Abidjan", "Yamoussoukro", "Bouaké", "Daloa", "San-Pédro", "Korhogo", "Man"
    ]
  },
  "Mali": {
    code: "ML",
    phoneCode: "+223",
    phoneFormat: "+223 XX XX XX XX",
    states: [
      "Bamako", "Sikasso", "Ségou", "Mopti", "Kayes", "Koulikoro", "Gao", "Tombouctou"
    ]
  },
  "Burkina Faso": {
    code: "BF",
    phoneCode: "+226",
    phoneFormat: "+226 XX XX XX XX",
    states: [
      "Ouagadougou", "Bobo-Dioulasso", "Koudougou", "Ouahigouya", "Banfora"
    ]
  },
  "Liberia": {
    code: "LR",
    phoneCode: "+231",
    phoneFormat: "+231 XX XXX XXXX",
    states: [
      "Montserrado", "Nimba", "Grand Bassa", "Bong", "Lofa", "Grand Gedeh"
    ]
  },
  "Sierra Leone": {
    code: "SL",
    phoneCode: "+232",
    phoneFormat: "+232 XX XXX XXX",
    states: [
      "Western Area", "Eastern Province", "Northern Province", "Southern Province"
    ]
  },
  "Gambia": {
    code: "GM",
    phoneCode: "+220",
    phoneFormat: "+220 XXX XXXX",
    states: [
      "Banjul", "Kanifing", "Brikama", "Mansakonko", "Kerewan", "Janjanbureh"
    ]
  },
  "Togo": {
    code: "TG",
    phoneCode: "+228",
    phoneFormat: "+228 XX XX XX XX",
    states: [
      "Maritime", "Plateaux", "Centrale", "Kara", "Savanes"
    ]
  },
  "Benin": {
    code: "BJ",
    phoneCode: "+229",
    phoneFormat: "+229 XX XX XX XX",
    states: [
      "Littoral", "Atlantique", "Ouémé", "Plateau", "Zou", "Collines", "Borgou", "Alibori", "Donga", "Couffo", "Mono"
    ]
  },
  "Guinea": {
    code: "GN",
    phoneCode: "+224",
    phoneFormat: "+224 XXX XX XX XX",
    states: [
      "Conakry", "Kindia", "Mamou", "Labé", "Kankan", "Faranah", "Boké", "Nzérékoré"
    ]
  },
  "Guinea-Bissau": {
    code: "GW",
    phoneCode: "+245",
    phoneFormat: "+245 XXX XXXX",
    states: [
      "Bissau", "Biombo", "Bafatá", "Gabú", "Oio", "Cacheu", "Tombali", "Quinara", "Bolama"
    ]
  },
  "Equatorial Guinea": {
    code: "GQ",
    phoneCode: "+240",
    phoneFormat: "+240 XXX XXX XXX",
    states: [
      "Bioko Norte", "Bioko Sur", "Centro Sur", "Kié-Ntem", "Litoral", "Wele-Nzas", "Annobón"
    ]
  },
  "São Tomé and Príncipe": {
    code: "ST",
    phoneCode: "+239",
    phoneFormat: "+239 XX XXXX",
    states: [
      "Água Grande", "Cantagalo", "Caué", "Lembá", "Lobata", "Mé-Zóchi", "Príncipe"
    ]
  },
  "Djibouti": {
    code: "DJ",
    phoneCode: "+253",
    phoneFormat: "+253 XX XX XX XX",
    states: [
      "Djibouti", "Ali Sabieh", "Dikhil", "Tadjourah", "Obock", "Arta"
    ]
  },
  "Eritrea": {
    code: "ER",
    phoneCode: "+291",
    phoneFormat: "+291 X XXX XXX",
    states: [
      "Maekel", "Debub", "Gash-Barka", "Anseba", "Northern Red Sea", "Southern Red Sea"
    ]
  },
  "South Sudan": {
    code: "SS",
    phoneCode: "+211",
    phoneFormat: "+211 XXX XXX XXX",
    states: [
      "Central Equatoria", "Eastern Equatoria", "Jonglei", "Lakes", "Northern Bahr el Ghazal", "Unity", "Upper Nile", "Warrap", "Western Bahr el Ghazal", "Western Equatoria"
    ]
  },
  "Mauritania": {
    code: "MR",
    phoneCode: "+222",
    phoneFormat: "+222 XX XX XX XX",
    states: [
      "Nouakchott", "Hodh Ech Chargui", "Hodh El Gharbi", "Assaba", "Gorgol", "Brakna", "Trarza", "Adrar", "Dakhlet Nouadhibou", "Tagant", "Guidimaka", "Tiris Zemmour", "Inchiri"
    ]
  },
  "Sudan": {
    code: "SD",
    phoneCode: "+249",
    phoneFormat: "+249 XXX XXX XXX",
    states: [
      "Khartoum", "North Darfur", "South Darfur", "East Darfur", "Central Darfur", "West Darfur", "Kassala", "Al Qadarif", "Al Jazirah", "White Nile", "Blue Nile", "Northern", "River Nile", "Red Sea", "North Kordofan", "South Kordofan", "West Kordofan", "Sennar"
    ]
  },
  "Niger": {
    code: "NE",
    phoneCode: "+227",
    phoneFormat: "+227 XX XX XX XX",
    states: [
      "Niamey", "Agadez", "Diffa", "Dosso", "Maradi", "Tahoua", "Tillabéri", "Zinder"
    ]
  },

  // Southern Africa
  "South Africa": {
    code: "ZA",
    phoneCode: "+27",
    phoneFormat: "+27 XX XXX XXXX",
    states: [
      "Gauteng", "Western Cape", "Eastern Cape", "KwaZulu-Natal", "Free State",
      "Limpopo", "Mpumalanga", "North West", "Northern Cape", "Johannesburg",
      "Cape Town", "Durban", "Pretoria", "Port Elizabeth", "Bloemfontein"
    ]
  },
  "Botswana": {
    code: "BW",
    phoneCode: "+267",
    phoneFormat: "+267 XX XXX XXX",
    states: [
      "Gaborone", "Francistown", "Molepolole", "Selebi-Phikwe", "Maun", "Serowe"
    ]
  },
  "Namibia": {
    code: "NA",
    phoneCode: "+264",
    phoneFormat: "+264 XX XXX XXXX",
    states: [
      "Khomas", "Erongo", "Hardap", "Karas", "Kavango", "Ohangwena", "Omaheke",
      "Omusati", "Oshana", "Oshikoto", "Otjozondjupa", "Zambezi", "Kunene"
    ]
  },
  "Malawi": {
    code: "MW",
    phoneCode: "+265",
    phoneFormat: "+265 X XXXX XXXX",
    states: [
      "Lilongwe", "Blantyre", "Mzuzu", "Zomba", "Mangochi", "Kasungu", "Karonga"
    ]
  },
  "Zambia": {
    code: "ZM",
    phoneCode: "+260",
    phoneFormat: "+260 XX XXX XXXX",
    states: [
      "Lusaka", "Copperbelt", "Southern", "Eastern", "Northern", "Western",
      "North-Western", "Central", "Luapula", "Muchinga"
    ]
  },
  "Zimbabwe": {
    code: "ZW",
    phoneCode: "+263",
    phoneFormat: "+263 X XXX XXX",
    states: [
      "Harare", "Bulawayo", "Manicaland", "Mashonaland Central", "Mashonaland East",
      "Mashonaland West", "Masvingo", "Matabeleland North", "Matabeleland South", "Midlands"
    ]
  },
  "Mozambique": {
    code: "MZ",
    phoneCode: "+258",
    phoneFormat: "+258 XX XXX XXXX",
    states: [
      "Maputo", "Gaza", "Inhambane", "Sofala", "Manica", "Tete", "Zambezia",
      "Nampula", "Cabo Delgado", "Niassa"
    ]
  },
  "Eswatini": {
    code: "SZ",
    phoneCode: "+268",
    phoneFormat: "+268 XX XX XXXX",
    states: [
      "Hhohho", "Manzini", "Shiselweni", "Lubombo"
    ]
  },
  "Lesotho": {
    code: "LS",
    phoneCode: "+266",
    phoneFormat: "+266 X XXX XXXX",
    states: [
      "Maseru", "Berea", "Leribe", "Mafeteng", "Mohale's Hoek", "Quthing",
      "Qacha's Nek", "Mokhotlong", "Thaba-Tseka", "Butha-Buthe"
    ]
  },

  // North Africa
  "Egypt": {
    code: "EG",
    phoneCode: "+20",
    phoneFormat: "+20 XXX XXX XXXX",
    states: [
      "Cairo", "Alexandria", "Giza", "Shubra El-Kheima", "Port Said", "Suez",
      "Luxor", "Aswan", "Asyut", "Ismailia", "Faiyum", "Zagazig", "Damietta"
    ]
  },
  "Morocco": {
    code: "MA",
    phoneCode: "+212",
    phoneFormat: "+212 XXX XXX XXX",
    states: [
      "Casablanca-Settat", "Rabat-Salé-Kénitra", "Fès-Meknès", "Marrakesh-Safi",
      "Tangier-Tetouan-Al Hoceima", "Oriental", "Souss-Massa", "Drâa-Tafilalet"
    ]
  },
  "Tunisia": {
    code: "TN",
    phoneCode: "+216",
    phoneFormat: "+216 XX XXX XXX",
    states: [
      "Tunis", "Sfax", "Sousse", "Kairouan", "Bizerte", "Gabès", "Ariana", "Nabeul"
    ]
  },
  "Algeria": {
    code: "DZ",
    phoneCode: "+213",
    phoneFormat: "+213 XXX XX XX XX",
    states: [
      "Algiers", "Oran", "Constantine", "Batna", "Djelfa", "Sétif", "Annaba", "Blida"
    ]
  },
  "Libya": {
    code: "LY",
    phoneCode: "+218",
    phoneFormat: "+218 XX XXX XXXX",
    states: [
      "Tripoli", "Benghazi", "Misrata", "Sabha", "Bayda", "Zawiya", "Tobruk"
    ]
  },

  // Central Africa
  "Cameroon": {
    code: "CM",
    phoneCode: "+237",
    phoneFormat: "+237 X XX XX XX XX",
    states: [
      "Centre", "Littoral", "West", "Northwest", "Southwest", "Adamawa",
      "East", "Far North", "North", "South"
    ]
  },
  "DR Congo": {
    code: "CD",
    phoneCode: "+243",
    phoneFormat: "+243 XXX XXX XXX",
    states: [
      "Kinshasa", "Lubumbashi", "Mbuji-Mayi", "Kananga", "Kisangani", "Bukavu",
      "Goma", "Matadi", "Likasi", "Kolwezi"
    ]
  },
  "Angola": {
    code: "AO",
    phoneCode: "+244",
    phoneFormat: "+244 XXX XXX XXX",
    states: [
      "Luanda", "Huambo", "Lobito", "Benguela", "Kuito", "Lubango", "Malanje"
    ]
  },
  "Chad": {
    code: "TD",
    phoneCode: "+235",
    phoneFormat: "+235 XX XX XX XX",
    states: [
      "N'Djamena", "Moundou", "Sarh", "Abéché", "Kélo", "Koumra", "Pala", "Am Timan"
    ]
  },
  "Central African Republic": {
    code: "CF",
    phoneCode: "+236",
    phoneFormat: "+236 XX XX XX XX",
    states: [
      "Bangui", "Bimbo", "Berbérati", "Carnot", "Bambari", "Bouar", "Bossangoa"
    ]
  },
  "Gabon": {
    code: "GA",
    phoneCode: "+241",
    phoneFormat: "+241 X XX XX XX",
    states: [
      "Libreville", "Port-Gentil", "Franceville", "Oyem", "Moanda", "Mouila"
    ]
  },

  // Island Nations
  "Mauritius": {
    code: "MU",
    phoneCode: "+230",
    phoneFormat: "+230 XXXX XXXX",
    states: [
      "Port Louis", "Black River", "Flacq", "Grand Port", "Moka",
      "Pamplemousses", "Plaines Wilhems", "Rivière du Rempart", "Savanne"
    ]
  },
  "Seychelles": {
    code: "SC",
    phoneCode: "+248",
    phoneFormat: "+248 X XX XX XX",
    states: [
      "Mahé", "Praslin", "La Digue", "Anse Boileau", "Anse Royale", "Beau Vallon"
    ]
  },
  "Madagascar": {
    code: "MG",
    phoneCode: "+261",
    phoneFormat: "+261 XX XX XXX XX",
    states: [
      "Antananarivo", "Toamasina", "Antsirabe", "Mahajanga", "Fianarantsoa", "Toliara"
    ]
  },
  "Comoros": {
    code: "KM",
    phoneCode: "+269",
    phoneFormat: "+269 XXX XXXX",
    states: [
      "Grande Comore", "Anjouan", "Mohéli"
    ]
  },
  "Cape Verde": {
    code: "CV",
    phoneCode: "+238",
    phoneFormat: "+238 XXX XX XX",
    states: [
      "Praia", "Mindelo", "Santa Maria", "Assomada", "Porto Novo", "Tarrafal"
    ]
  },

  // International (commonly used)
  "Canada": {
    code: "CA",
    phoneCode: "+1",
    phoneFormat: "+1 XXX XXX XXXX",
    states: [
      "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador",
      "Northwest Territories", "Nova Scotia", "Nunavut", "Ontario", "Prince Edward Island",
      "Quebec", "Saskatchewan", "Yukon"
    ]
  },
  "United States": {
    code: "US",
    phoneCode: "+1",
    phoneFormat: "+1 XXX XXX XXXX",
    states: [
      "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
      "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
      "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
      "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
      "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
      "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
      "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
      "Wisconsin", "Wyoming"
    ]
  },
  "United Kingdom": {
    code: "GB",
    phoneCode: "+44",
    phoneFormat: "+44 XXXX XXXXXX",
    states: [
      "England", "Scotland", "Wales", "Northern Ireland", "London", "Manchester",
      "Birmingham", "Leeds", "Glasgow", "Edinburgh", "Cardiff", "Belfast"
    ]
  }
};

// Attach US/Canada city lists when us-ca-cities-data.js is loaded
if (typeof window.US_CA_CITIES_BY_STATE !== 'undefined') {
  if (window.US_CA_CITIES_BY_STATE.Canada) {
    COUNTRIES_DATA.Canada.citiesByState = window.US_CA_CITIES_BY_STATE.Canada;
  }
  if (window.US_CA_CITIES_BY_STATE['United States']) {
    COUNTRIES_DATA['United States'].citiesByState = window.US_CA_CITIES_BY_STATE['United States'];
  }
}

// Expose countries data globally for intake and other modules
window.COUNTRIES_DATA = COUNTRIES_DATA;

/** Shown first in country dropdowns (registration, patient forms). */
window.PRIORITY_COUNTRIES = ['Canada', 'United States'];

// Helper function to get country by phone code
window.getCountryByPhoneCode = function(phoneCode) {
  for (const [country, data] of Object.entries(COUNTRIES_DATA)) {
    if (data.phoneCode === phoneCode) {
      return country;
    }
  }
  return null;
};

// Helper function to format phone number
window.formatPhoneNumber = function(phone, country) {
  if (!phone || !country || !COUNTRIES_DATA[country]) return phone;
  
  const countryData = COUNTRIES_DATA[country];
  const phoneCode = countryData.phoneCode;
  
  // Remove all non-numeric characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // If doesn't start with country code, add it
  if (!cleaned.startsWith(phoneCode)) {
    // Remove leading + or 0
    cleaned = cleaned.replace(/^[+0]+/, '');
    cleaned = phoneCode + cleaned;
  }
  
  return cleaned;
};

function appendCountryOptions(select, countries, selectedCountry) {
  countries.forEach(country => {
    if (!COUNTRIES_DATA[country]) return;
    const option = document.createElement('option');
    option.value = country;
    option.textContent = `${COUNTRIES_DATA[country].code} ${country}`;
    if (country === selectedCountry) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

// Helper function to populate country dropdown
window.populateCountryDropdown = function(selectId, selectedCountry = '') {
  const select = document.getElementById(selectId);
  if (!select) return;

  select.innerHTML = '<option value="">-- Select Country --</option>';

  const priority = window.PRIORITY_COUNTRIES || ['Canada', 'United States'];
  const prioritySet = new Set(priority);

  const priorityGroup = document.createElement('optgroup');
  priorityGroup.label = 'North America';
  appendCountryOptions(priorityGroup, priority, selectedCountry);
  select.appendChild(priorityGroup);

  const regions = {
    'East Africa': ['Kenya', 'Tanzania', 'Uganda', 'Rwanda', 'Burundi', 'Ethiopia', 'Somalia', 'Djibouti', 'Eritrea', 'South Sudan'],
    'West Africa': ['Nigeria', 'Ghana', 'Senegal', 'Ivory Coast', 'Mali', 'Burkina Faso', 'Liberia', 'Sierra Leone', 'Gambia', 'Togo', 'Benin', 'Guinea', 'Guinea-Bissau', 'Niger'],
    'Southern Africa': ['South Africa', 'Botswana', 'Namibia', 'Malawi', 'Zambia', 'Zimbabwe', 'Mozambique', 'Eswatini', 'Lesotho'],
    'North Africa': ['Egypt', 'Morocco', 'Tunisia', 'Algeria', 'Libya', 'Sudan', 'Mauritania'],
    'Central Africa': ['Cameroon', 'DR Congo', 'Angola', 'Chad', 'Central African Republic', 'Gabon', 'Equatorial Guinea', 'São Tomé and Príncipe'],
    'Island Nations': ['Mauritius', 'Seychelles', 'Madagascar', 'Comoros', 'Cape Verde'],
    'International': ['United Kingdom']
  };

  for (const [region, countries] of Object.entries(regions)) {
    const filtered = countries.filter(country => !prioritySet.has(country));
    if (filtered.length === 0) continue;

    const optgroup = document.createElement('optgroup');
    optgroup.label = region;
    appendCountryOptions(optgroup, filtered, selectedCountry);
    select.appendChild(optgroup);
  }
};

// Helper function to populate state dropdown based on selected country
window.populateStateDropdown = function(stateSelectId, country, selectedState = '') {
  const stateSelect = document.getElementById(stateSelectId);
  if (!stateSelect || !country || !COUNTRIES_DATA[country]) {
    if (stateSelect) {
      stateSelect.innerHTML = '<option value="">-- Select State/Province --</option>';
    }
    return;
  }
  
  const states = COUNTRIES_DATA[country].states || [];
  stateSelect.innerHTML = '<option value="">-- Select State/Province --</option>';
  
  states.forEach(state => {
    const option = document.createElement('option');
    option.value = state;
    option.textContent = state;
    if (state === selectedState) {
      option.selected = true;
    }
    stateSelect.appendChild(option);
  });

  return states;
};

// Helper function to populate city dropdown based on country + state/province
window.populateCityDropdown = function(citySelectId, country, state, selectedCity = '') {
  const citySelect = document.getElementById(citySelectId);
  if (!citySelect) return;

  citySelect.innerHTML = '<option value="">-- Select City --</option>';

  if (!country || !state || !COUNTRIES_DATA[country]) {
    return;
  }

  const countryData = COUNTRIES_DATA[country];
  let cities = [];

  if (countryData.citiesByState && countryData.citiesByState[state]) {
    cities = countryData.citiesByState[state];
  } else {
    cities = [state];
  }

  cities.forEach(city => {
    const option = document.createElement('option');
    option.value = city;
    option.textContent = city;
    if (city === selectedCity) {
      option.selected = true;
    }
    citySelect.appendChild(option);
  });
  if (selectedCity && cities.indexOf(selectedCity) === -1) {
    const legacy = document.createElement('option');
    legacy.value = selectedCity;
    legacy.textContent = selectedCity;
    legacy.selected = true;
    citySelect.appendChild(legacy);
  }
};

window.getPostalCodeLabel = function getPostalCodeLabel(country) {
  if (country === 'United States') return 'ZIP Code';
  if (country === 'Canada') return 'Postal Code';
  return 'Postal / ZIP Code';
};

window.normalizePostalCode = function normalizePostalCode(country, value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (country === 'Canada') {
    return raw.toUpperCase().replace(/\s+/g, ' ');
  }
  if (country === 'United States') {
    const digits = raw.replace(/[^\d-]/g, '');
    return digits;
  }
  return raw;
};

window.validatePostalCode = function validatePostalCode(country, value) {
  const normalized = window.normalizePostalCode(country, value);
  if (!normalized) {
    if (country === 'Canada' || country === 'United States') {
      return { valid: false, error: country === 'Canada' ? 'Please enter a postal code (e.g. K1A 0B1).' : 'Please enter a ZIP code (e.g. 90210).' };
    }
    return { valid: true, normalized: '' };
  }
  if (country === 'Canada') {
    const compact = normalized.replace(/\s/g, '');
    if (/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(compact)) {
      return { valid: true, normalized: compact.slice(0, 3) + ' ' + compact.slice(3) };
    }
    return { valid: false, error: 'Canadian postal code format: A1A 1A1 (e.g. K1A 0B1).' };
  }
  if (country === 'United States') {
    const ok = /^\d{5}(-\d{4})?$/.test(normalized);
    return ok ? { valid: true, normalized } : { valid: false, error: 'US ZIP code: 5 digits or 5+4 (e.g. 90210 or 90210-1234).' };
  }
  return { valid: true, normalized };
};

window.updatePostalCodeField = function updatePostalCodeField(country, postalInputId, labelId) {
  const field = document.getElementById(postalInputId);
  const label = labelId ? document.getElementById(labelId) : null;
  const labelText = window.getPostalCodeLabel(country);
  if (label) {
    label.textContent = `${labelText}${country === 'Canada' || country === 'United States' ? '*' : ''}:`;
  }
  if (!field) return;
  if (field.tagName === 'SELECT') {
    field.innerHTML = '<option value="">-- Select city first --</option>';
    field.disabled = true;
    field.required = country === 'Canada' || country === 'United States';
    return;
  }
  if (country === 'Canada') {
    field.placeholder = 'e.g. K1A 0B1';
    field.pattern = '[A-Za-z][0-9][A-Za-z][ ]?[0-9][A-Za-z][0-9]';
    field.title = 'Canadian postal code, e.g. K1A 0B1';
  } else if (country === 'United States') {
    field.placeholder = 'e.g. 90210';
    field.pattern = '\\d{5}(-\\d{4})?';
    field.title = 'US ZIP code, e.g. 90210 or 90210-1234';
  } else {
    field.placeholder = 'Postal or ZIP code';
    field.removeAttribute('pattern');
    field.title = '';
  }
  field.required = country === 'Canada' || country === 'United States';
};

window.populatePostalCodeDropdown = function populatePostalCodeDropdown(selectId, country, state, city, selectedPostal) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const prev = selectedPostal || select.value || '';
  select.innerHTML = '<option value="">-- Select ' + (country === 'United States' ? 'ZIP Code' : 'Postal Code') + ' --</option>';
  if (!country || !state || !city) {
    select.disabled = true;
    return;
  }
  const codes = typeof window.getPostalCodesForCity === 'function'
    ? window.getPostalCodesForCity(country, state, city)
    : [];
  if (!codes.length) {
    select.disabled = true;
    return;
  }
  codes.forEach(function (code) {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = code;
    if (prev === code) option.selected = true;
    select.appendChild(option);
  });
  if (prev && codes.indexOf(prev) === -1) {
    const legacy = document.createElement('option');
    legacy.value = prev;
    legacy.textContent = prev;
    legacy.selected = true;
    select.appendChild(legacy);
  }
  select.disabled = false;
  select.required = country === 'Canada' || country === 'United States';
};

window.handleAddressCityChange = function handleAddressCityChange(countrySelectId, stateSelectId, citySelectId, postalSelectId) {
  const country = document.getElementById(countrySelectId)?.value || '';
  const state = document.getElementById(stateSelectId)?.value || '';
  const city = document.getElementById(citySelectId)?.value || '';
  if (typeof window.populatePostalCodeDropdown === 'function') {
    window.populatePostalCodeDropdown(postalSelectId, country, state, city);
  }
};

window.handleAddressStateChange = function handleAddressStateChange(countrySelectId, stateSelectId, citySelectId, postalSelectId, selectedCity) {
  const country = document.getElementById(countrySelectId)?.value || '';
  const state = document.getElementById(stateSelectId)?.value || '';
  const citySelect = document.getElementById(citySelectId);
  if (citySelect) {
    citySelect.innerHTML = '<option value="">-- Select City --</option>';
    citySelect.disabled = !country || !state;
  }
  if (typeof window.populateCityDropdown === 'function' && country && state) {
    window.populateCityDropdown(citySelectId, country, state, selectedCity || '');
    if (citySelect) citySelect.disabled = false;
  }
  if (typeof window.populatePostalCodeDropdown === 'function') {
    window.populatePostalCodeDropdown(postalSelectId, country, state, selectedCity || '');
  }
};

window.populateCityDatalist = function populateCityDatalist(datalistId, country, state) {
  const datalist = document.getElementById(datalistId);
  if (!datalist || !country || !state || !COUNTRIES_DATA[country]) return;
  datalist.innerHTML = '';
  const countryData = COUNTRIES_DATA[country];
  let cities = [];
  if (countryData.citiesByState && countryData.citiesByState[state]) {
    cities = countryData.citiesByState[state];
  }
  cities.forEach(city => {
    const option = document.createElement('option');
    option.value = city;
    datalist.appendChild(option);
  });
};

window.populatePhoneCodeDropdownPriority = function populatePhoneCodeDropdownPriority(selectId, defaultCountry) {
  const select = document.getElementById(selectId);
  if (!select || !COUNTRIES_DATA) return;
  select.innerHTML = '<option value="">Code</option>';
  const priority = window.PRIORITY_COUNTRIES || ['Canada', 'United States'];
  const addedCodes = new Set();
  priority.forEach(country => {
    if (!COUNTRIES_DATA[country]) return;
    const data = COUNTRIES_DATA[country];
    const option = document.createElement('option');
    option.value = data.phoneCode;
    option.textContent = `${data.phoneCode} (${country})`;
    option.setAttribute('data-country', country);
    select.appendChild(option);
    addedCodes.add(data.phoneCode);
  });
  const rest = Object.entries(COUNTRIES_DATA)
    .filter(([country]) => !priority.includes(country))
    .sort((a, b) => a[0].localeCompare(b[0]));
  rest.forEach(([country, data]) => {
    if (addedCodes.has(data.phoneCode) && priority.every(p => COUNTRIES_DATA[p]?.phoneCode !== data.phoneCode || p !== country)) {
      /* allow duplicate +1 only once in priority block */
    }
    const option = document.createElement('option');
    option.value = data.phoneCode;
    option.textContent = `${data.phoneCode} (${country})`;
    option.setAttribute('data-country', country);
    select.appendChild(option);
  });
  const preferred = defaultCountry && COUNTRIES_DATA[defaultCountry]
    ? COUNTRIES_DATA[defaultCountry].phoneCode
    : COUNTRIES_DATA.Canada?.phoneCode || '+1';
  if (preferred) {
    const match = Array.from(select.options).find(function (o) {
      return o.getAttribute('data-country') === (defaultCountry || 'Canada');
    });
    if (match) match.selected = true;
    else select.value = preferred;
  }
};

// Helper function to update phone field format/placeholder based on country
window.updatePhoneFormat = function(phoneInputId, country) {
  const phoneInput = document.getElementById(phoneInputId);
  if (!phoneInput || !country || !COUNTRIES_DATA[country]) return;
  if (phoneInput.dataset && phoneInput.dataset.skipPhoneFormat === 'true') {
    return;
  }
  
  const countryData = COUNTRIES_DATA[country];
  phoneInput.placeholder = countryData.phoneFormat;

  const codeSelect = document.getElementById(`${phoneInputId}-country-code`);

  if (codeSelect) {
    const codeDigits = countryData.phoneCode.replace('+', '');
    const rawValue = phoneInput.value.replace(/[^\d]/g, '');
    if (rawValue.startsWith(codeDigits)) {
      const trimmed = rawValue.slice(codeDigits.length);
      phoneInput.value = trimmed;
    }
  } else if (!phoneInput.value || phoneInput.value.trim() === '') {
    phoneInput.value = countryData.phoneCode + ' ';
  }
};

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { COUNTRIES_DATA };
}

console.log('Countries data loaded:', Object.keys(COUNTRIES_DATA).length, 'countries');



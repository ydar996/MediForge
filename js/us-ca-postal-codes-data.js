/**
 * Representative postal / ZIP codes for US & Canada address forms.
 * City-specific lists override province/state defaults where defined.
 */
(function () {
  var CA_DEFAULTS = {
    Alberta: ['T2P 1J9', 'T5J 2R7', 'T3H 0A1'],
    'British Columbia': ['V6B 1A1', 'V5K 0A1', 'V6C 1G8', 'V7X 1A1', 'V8W 1A1'],
    Manitoba: ['R3C 0P8', 'R2C 0A1', 'R3B 0T6'],
    'New Brunswick': ['E2L 0A1', 'E1C 0A1', 'E3B 0A1'],
    'Newfoundland and Labrador': ['A1C 0A1', 'A1A 0A1', 'A2H 0A1'],
    'Northwest Territories': ['X1A 0A1', 'X0E 0A1'],
    'Nova Scotia': ['B3H 0A1', 'B2Y 0A1', 'B4N 0A1'],
    Nunavut: ['X0A 0H0', 'X0B 0A1'],
    Ontario: ['M5H 2N2', 'K1A 0A1', 'M4B 1B3', 'L8P 0A1', 'N6A 0A1'],
    'Prince Edward Island': ['C1A 0A1', 'C1N 0A1'],
    Quebec: ['H2Y 1C6', 'G1R 0A1', 'H3B 0A1', 'J4B 0A1'],
    Saskatchewan: ['S4P 0A1', 'S7K 0A1', 'S9A 0A1'],
    Yukon: ['Y1A 0A1', 'Y0B 0A1']
  };

  var US_DEFAULTS = {
    Alabama: ['35203', '36104', '36602'],
    Alaska: ['99501', '99701', '99801'],
    Arizona: ['85004', '85701', '85281'],
    Arkansas: ['72201', '72701', '71601'],
    California: ['90210', '94102', '90001', '92101', '95814'],
    Colorado: ['80202', '80903', '80302'],
    Connecticut: ['06103', '06510', '06901'],
    Delaware: ['19801', '19901', '19711'],
    Florida: ['33130', '32301', '32801', '33602', '33401'],
    Georgia: ['30303', '30901', '31401'],
    Hawaii: ['96813', '96720', '96740'],
    Idaho: ['83702', '83301', '83402'],
    Illinois: ['60601', '62701', '61602'],
    Indiana: ['46204', '46802', '47401'],
    Iowa: ['50309', '52401', '52801'],
    Kansas: ['67202', '66603', '66101'],
    Kentucky: ['40202', '40507', '42101'],
    Louisiana: ['70112', '70801', '71101'],
    Maine: ['04101', '04240', '04401'],
    Maryland: ['21201', '21401', '20850'],
    Massachusetts: ['02108', '01608', '01103'],
    Michigan: ['48226', '49503', '48933'],
    Minnesota: ['55401', '55101', '55802'],
    Mississippi: ['39201', '39501', '38601'],
    Missouri: ['63101', '64106', '65806'],
    Montana: ['59101', '59715', '59801'],
    Nebraska: ['68102', '68508', '69101'],
    Nevada: ['89101', '89501', '89701'],
    'New Hampshire': ['03101', '03801', '03301'],
    'New Jersey': ['07102', '08608', '07302'],
    'New Mexico': ['87102', '87501', '88001'],
    'New York': ['10001', '14202', '12207', '13202'],
    'North Carolina': ['28202', '27601', '27401'],
    'North Dakota': ['58102', '58501', '58801'],
    Ohio: ['43215', '44114', '45202'],
    Oklahoma: ['73102', '74103', '73501'],
    Oregon: ['97201', '97301', '97401'],
    Pennsylvania: ['19107', '15222', '17101'],
    'Rhode Island': ['02903', '02840', '02920'],
    'South Carolina': ['29201', '29401', '29601'],
    'South Dakota': ['57104', '57701', '57401'],
    Tennessee: ['37219', '38103', '37902'],
    Texas: ['75201', '77002', '78701', '78205', '79901'],
    Utah: ['84101', '84601', '84401'],
    Vermont: ['05602', '05401', '05701'],
    Virginia: ['23219', '23451', '24011'],
    Washington: ['98101', '99201', '98501'],
    'West Virginia': ['25301', '26505', '25701'],
    Wisconsin: ['53202', '53703', '54301'],
    Wyoming: ['82001', '82601', '83001']
  };

  var CITY_OVERRIDES = {
    'Canada|British Columbia|Vancouver': ['V5K 0A1', 'V6B 1A1', 'V6C 1G8', 'V6E 1A1', 'V6G 1A1', 'V6H 1A1', 'V6K 1A1', 'V6R 1A1'],
    'Canada|British Columbia|Victoria': ['V8V 1A1', 'V8W 1A1', 'V8X 1A1', 'V8Z 1A1'],
    'Canada|British Columbia|Surrey': ['V3R 0A1', 'V3S 0A1', 'V3T 0A1', 'V3W 0A1'],
    'Canada|British Columbia|Burnaby': ['V5A 1A1', 'V5B 1A1', 'V5C 1A1', 'V5G 1A1'],
    'Canada|Ontario|Toronto': ['M5H 2N2', 'M4B 1B3', 'M5V 1A1', 'M6G 1A1', 'M4Y 1A1'],
    'Canada|Ontario|Ottawa': ['K1A 0A1', 'K1P 0A1', 'K2P 0A1', 'K1N 0A1'],
    'Canada|Quebec|Montreal': ['H2Y 1C6', 'H3B 0A1', 'H3A 0A1', 'H2X 1A1'],
    'Canada|Alberta|Calgary': ['T2P 1J9', 'T2G 0A1', 'T3H 0A1', 'T2R 0A1'],
    'Canada|Alberta|Edmonton': ['T5J 2R7', 'T5K 0A1', 'T6G 0A1', 'T5H 0A1'],
    'United States|California|Los Angeles': ['90001', '90012', '90210', '90017'],
    'United States|California|San Francisco': ['94102', '94103', '94107', '94109'],
    'United States|New York|New York City': ['10001', '10011', '10019', '10036'],
    'United States|Texas|Houston': ['77002', '77019', '77056', '77098'],
    'United States|Illinois|Chicago': ['60601', '60611', '60614', '60654']
  };

  window.getPostalCodesForCity = function getPostalCodesForCity(country, state, city) {
    if (!country || !state || !city) return [];
    var key = country + '|' + state + '|' + city;
    if (CITY_OVERRIDES[key]) return CITY_OVERRIDES[key].slice();
    if (country === 'Canada' && CA_DEFAULTS[state]) return CA_DEFAULTS[state].slice();
    if (country === 'United States' && US_DEFAULTS[state]) return US_DEFAULTS[state].slice();
    return [];
  };
})();

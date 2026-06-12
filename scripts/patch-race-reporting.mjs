/**
 * Convert tribe-based reporting to race (North America). Reads race with legacy tribe fallback.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}
function write(rel, content) {
  fs.writeFileSync(path.join(ROOT, rel), content, "utf8");
  console.log("patched:", rel);
}

function patchDiseaseAnalytics() {
  let s = read("disease-analytics.html");
  const reps = [
    [/\.tribe-badge/g, ".race-badge"],
    [/tribe-filter/g, "race-filter"],
    [/tribeDistributionChart/g, "raceDistributionChart"],
    [/tribeDistribution/g, "raceDistribution"],
    [/createTribeDistributionChart/g, "createRaceDistributionChart"],
    [/Tribe\/Ethnicity Distribution/g, "Race Distribution"],
    [/Tribe\/Ethnicity/g, "Race"],
    [/All Tribes/g, "All Races"],
    [/Top Ethnicities\/Tribes/g, "Top Races"],
    [/Top Tribes/g, "Top Races"],
    [/tribe-distribution/g, "race-distribution"],
    [/Aggregate by tribes/g, "Aggregate by race"],
    [/Top 10 tribes/g, "Top 10 races"],
    [/sortedTribes/g, "sortedRaces"],
    [/tribeTotals/g, "raceTotals"],
    [/topTribes/g, "topRaces"],
    [/tribeSet/g, "raceSet"],
    [/tribeData/g, "raceData"],
    [/tribeFilter/g, "raceFilter"],
    [/populateFilters\(countries, diseases, tribes\)/g, "populateFilters(countries, diseases, races)"],
    [/Populate tribe filter/g, "Populate race filter"],
    [/Track by tribe/g, "Track by race"],
    [/Filter by tribe/g, "Filter by race"],
    [/currentFilters\.tribe/g, "currentFilters.race"],
    [/tribe: ''/g, "race: ''"],
    [/\btribes\b/g, "races"],
    [/patient\.tribe \|\| patient\.ethnicity/g, "patient.race || patient.tribe || patient.ethnicity"],
    [/const tribe = /g, "const race = "],
    [/if \(tribe && tribe !==/g, "if (race && race !=="],
    [/raceSet\.add\(tribe\)/g, "raceSet.add(race)"],
    [/disease\.races\[tribe\]/g, "disease.races[race]"],
    [/country\)\.races\[tribe\]/g, "country).races[race]"],
    [/\.forEach\(tribe =>/g, ".forEach(raceVal =>"],
    [/option\.value = tribe/g, "option.value = raceVal"],
    [/option\.textContent = tribe/g, "option.textContent = raceVal"],
    [/Object\.keys\(disease\.tribes\)/g, "Object.keys(disease.races)"],
    [/Object\.entries\(disease\.tribes\)/g, "Object.entries(disease.races)"],
    [/Object\.keys\(countryData\.tribes\)/g, "Object.keys(countryData.races)"],
    [/countryData\.tribes\[/g, "countryData.races["],
    [/filteredDisease\.tribes\[/g, "filteredDisease.races["],
    [/Object\.keys\(d\.tribes\)/g, "Object.keys(d.races)"],
    [/d\.tribes\[t\]/g, "d.races[t]"],
    [/Object\.entries\(cd\.tribes\)/g, "Object.entries(cd.races)"],
    [/labels = sortedRaces\.map\(\(\[tribe\]\)/g, "labels = sortedRaces.map(([raceVal])"],
    [/const tribe = labels/g, "const raceVal = labels"],
    [/race-filter'\)\.value = tribe/g, "race-filter').value = raceVal"],
    [/\.forEach\(t =>/g, ".forEach(t =>"],
  ];
  for (const [from, to] of reps) {
    s = s.replace(from, to);
  }
  write("disease-analytics.html", s);
}

function patchConditionsBreakdown() {
  let s = read("conditions-breakdown.html");
  s = s.replace("<th>Tribe</th>", "<th>Race</th>");
  s = s.replace(/tribes: new Set\(\)/g, "races: new Set()");
  s = s.replace(/\/\/ Tribe breakdown/g, "// Race breakdown");
  s = s.replace(
    /if \(patient\.tribe\) conditionData\.tribes\.add\(patient\.tribe\);/g,
    "const raceVal = (patient.race || patient.tribe || '').trim(); if (raceVal) conditionData.races.add(raceVal);"
  );
  s = s.replace(/tribes: condition\.tribes/g, "races: condition.races");
  s = s.replace(/condition\.tribes\)/g, "condition.races)");
  write("conditions-breakdown.html", s);
}

function patchConditionStatsHtml() {
  let s = read("condition-stats.html");
  s = s.replace("<th>Tribe Breakdown</th>", "<th>Race Breakdown</th>");
  s = s.replace(/tribeBreakdown: new Set\(\)/g, "raceBreakdown: new Set()");
  s = s.replace(/\/\/ Tribe breakdown/g, "// Race breakdown");
  s = s.replace(
    /if \(patient\.tribe\) stats\.tribeBreakdown\.add\(patient\.tribe\);/g,
    "const raceVal = (patient.race || patient.tribe || '').trim(); if (raceVal) stats.raceBreakdown.add(raceVal);"
  );
  s = s.replace(/\/\/ Format tribe breakdown/g, "// Format race breakdown");
  s = s.replace(/condition\.tribeBreakdown/g, "condition.raceBreakdown");
  s = s.replace(/let tribeBreakdown/g, "let raceBreakdown");
  s = s.replace(/\$\{tribeBreakdown\}/g, "${raceBreakdown}");
  write("condition-stats.html", s);
}

function patchConditionPatients() {
  let s = read("condition-patients.html");
  s = s.replace("<th>Tribe</th>", "<th>Race</th>");
  s = s.replace(/tribeStats/g, "raceStats");
  s = s.replace(
    /const tribe = patient\.tribe \|\| 'Unknown';/g,
    "const raceVal = (patient.race || patient.tribe || 'Unknown').trim() || 'Unknown';"
  );
  s = s.replace(/tribeStats\[tribe\]/g, "raceStats[raceVal]");
  s = s.replace(/let tribeStr = 'Tribes: '/g, "let raceStr = 'Race: '");
  s = s.replace(/tribeStr/g, "raceStr");
  s = s.replace(/\.map\(\(\[tribe, count\]\)/g, ".map(([raceVal, count])");
  s = s.replace(/\$\{patient\.tribe \|\| 'Unknown'\}/g, "${(patient.race || patient.tribe || 'Unknown').trim() || 'Unknown'}");
  write("condition-patients.html", s);
}

function patchConditionsJs() {
  let s = read("js/conditions.js");
  s = s.replace("gender, tribe, age", "gender, race, age");
  s = s.replace(/tribes: \{\}/g, "races: {}");
  s = s.replace(
    /const tribe = patient\.tribe \|\| 'Unknown';/g,
    "const raceVal = (patient.race || patient.tribe || 'Unknown').trim() || 'Unknown';"
  );
  s = s.replace(/stats\.tribes\[tribe\]/g, "stats.races[raceVal]");
  s = s.replace(/tribeStr/g, "raceStr");
  s = s.replace(/tribeDisplay/g, "raceDisplay");
  s = s.replace(/tribeCount/g, "raceCount");
  s = s.replace(/stats\.tribes/g, "stats.races");
  s = s.replace(/\[tribe, count\]/g, "[raceVal, count]");
  s = s.replace(/tribeHtml/g, "raceHtml");
  s = s.replace(/\$\{tribeHtml\}/g, "${raceHtml}");
  write("js/conditions.js", s);
}

function patchConditionStatsJs() {
  let s = read("js/condition-stats.js");
  s = s.replace("gender, tribe, age", "gender, race, age");
  s = s.replace(/const tribes = \{\}/g, "const races = {}");
  s = s.replace(/const tribeCount = \{\}/g, "const raceCount = {}");
  s = s.replace(/counting unique tribes/g, "counting unique races");
  s = s.replace(
    /const tribe = patient\.tribe \|\| 'Unknown';/g,
    "const raceVal = (patient.race || patient.tribe || 'Unknown').trim() || 'Unknown';"
  );
  s = s.replace(/tribes\[tribe\]/g, "races[raceVal]");
  s = s.replace(/tribeCount\[tribe\]/g, "raceCount[raceVal]");
  s = s.replace(/numTribes/g, "numRaces");
  s = s.replace(/tribeStr/g, "raceStr");
  s = s.replace(/tribeHtml/g, "raceHtml");
  s = s.replace(/\$\{tribeHtml\}/g, "${raceHtml}");
  s = s.replace(/Object\.entries\(tribes\)/g, "Object.entries(races)");
  s = s.replace(/Object\.keys\(tribeCount\)/g, "Object.keys(raceCount)");
  write("js/condition-stats.js", s);
}

function patchRaceOptions() {
  let s = read("js/patient-race-options.js");
  if (!s.includes("record.ethnicity")) {
    s = s.replace(
      "return String(record.race || record.tribe || '').trim();",
      "return String(record.race || record.tribe || record.ethnicity || '').trim();"
    );
  }
  write("js/patient-race-options.js", s);
}

patchDiseaseAnalytics();
patchConditionsBreakdown();
patchConditionStatsHtml();
patchConditionPatients();
patchConditionsJs();
patchConditionStatsJs();
patchRaceOptions();
console.log("race reporting patch complete");

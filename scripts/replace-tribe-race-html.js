const fs = require('fs');

const raceBlock = `    <label for="race" style="display: block; margin-top: 10px;">Race*:</label>
    <select id="race" name="race" required>
      <option value="" disabled selected>Select Race</option>
    </select>
    <p class="patient-race-help" data-patient-race-help style="margin: 6px 0 0; font-size: 13px; color: #555; line-height: 1.5;"></p>
    
`;

function replaceTribeBlock(file) {
  let s = fs.readFileSync(file, 'utf8');
  const start = s.indexOf('<label for="tribe"');
  if (start === -1) {
    console.log('no tribe in', file);
    return;
  }
  const end = s.indexOf('</select>', start) + '</select>'.length;
  s = s.slice(0, start) + raceBlock + s.slice(end);
  fs.writeFileSync(file, s);
  console.log('updated', file);
}

replaceTribeBlock('add-patient.html');
replaceTribeBlock('edit-patient.html');

// patient-intake.html: label + remove datalist
const intakePath = 'patient-intake.html';
let intake = fs.readFileSync(intakePath, 'utf8');
intake = intake.replace(
  /<label for="tribe">[\s\S]*?<input type="text" id="tribe" name="tribe"[^>]*required>/,
  `<label for="race">
              Race*
              <select id="race" name="race" required>
                <option value="" disabled selected>Select Race</option>
              </select>
              <p class="patient-race-help" data-patient-race-help style="margin: 6px 0 0; font-size: 13px; color: #555; line-height: 1.5;"></p>
            </label>`
);
intake = intake.replace(/\s*<datalist id="tribe-options">[\s\S]*?<\/datalist>\s*/m, '\n');
fs.writeFileSync(intakePath, intake);
console.log('updated', intakePath);

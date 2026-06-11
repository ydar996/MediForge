const fs = require('fs');

// Read the file
const content = fs.readFileSync('js/icd11.js', 'utf8');

// Extract all code entries using regex
const pattern = /\s*\{\s*code:\s*"([^"]+)",\s*title:\s*"([^"]+)"\s*\},?/g;
const matches = content.match(pattern);

console.log(`Total entries found: ${matches.length}`);

// Create a Map to track unique codes
const uniqueCodes = new Map();
const duplicates = new Map();

matches.forEach(match => {
    const codeMatch = match.match(/code:\s*"([^"]+)"/);
    const titleMatch = match.match(/title:\s*"([^"]+)"/);
    
    if (codeMatch && titleMatch) {
        const code = codeMatch[1];
        const title = titleMatch[1];
        
        if (uniqueCodes.has(code)) {
            // This is a duplicate
            if (!duplicates.has(code)) {
                duplicates.set(code, []);
            }
            duplicates.get(code).push(title);
        } else {
            uniqueCodes.set(code, title);
        }
    }
});

console.log(`Unique codes: ${uniqueCodes.size}`);
console.log(`Duplicate codes found: ${duplicates.size}`);

// Show some examples of duplicates
let duplicateCount = 0;
duplicates.forEach((titles, code) => {
    const count = titles.length + 1; // +1 for the original
    console.log(`Code '${code}' appears ${count} times`);
    duplicateCount += count - 1; // Count only the duplicates, not the original
});

console.log(`Total duplicate entries to remove: ${duplicateCount}`);

// Create new content with only unique codes
let newContent = "const ICD11_CODES = [\n";
const sortedCodes = Array.from(uniqueCodes.keys()).sort();
sortedCodes.forEach(code => {
    const title = uniqueCodes.get(code);
    newContent += `  { code: "${code}", title: "${title}" },\n`;
});
newContent += "];\n\n";

// Add the rest of the file content (functions, etc.)
const restOfFile = content.replace(/const ICD11_CODES = \[.*?\];/s, '');
newContent += restOfFile;

// Write the cleaned content back to file
fs.writeFileSync('js/icd11.js', newContent);

console.log("File cleaned and duplicates removed!");
console.log(`New unique code count: ${uniqueCodes.size}`);


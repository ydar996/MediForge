const fs = require('fs');

console.log('Starting duplicate removal process...');

try {
    // Read the file
    const content = fs.readFileSync('js/icd11.js', 'utf8');
    console.log('File read successfully');
    
    // Extract all code entries
    const codePattern = /code:\s*"([^"]+)"/g;
    const titlePattern = /title:\s*"([^"]+)"/g;
    
    const codes = [];
    const titles = [];
    
    let codeMatch;
    while ((codeMatch = codePattern.exec(content)) !== null) {
        codes.push(codeMatch[1]);
    }
    
    let titleMatch;
    while ((titleMatch = titlePattern.exec(content)) !== null) {
        titles.push(titleMatch[1]);
    }
    
    console.log(`Total codes found: ${codes.length}`);
    console.log(`Total titles found: ${titles.length}`);
    
    // Create unique entries
    const uniqueEntries = new Map();
    const duplicates = [];
    
    for (let i = 0; i < codes.length; i++) {
        const code = codes[i];
        const title = titles[i];
        
        if (uniqueEntries.has(code)) {
            duplicates.push({ code, title, index: i });
        } else {
            uniqueEntries.set(code, title);
        }
    }
    
    console.log(`Unique codes: ${uniqueEntries.size}`);
    console.log(`Duplicate entries: ${duplicates.length}`);
    
    if (duplicates.length > 0) {
        console.log('\nFirst 10 duplicate examples:');
        duplicates.slice(0, 10).forEach(dup => {
            console.log(`  ${dup.code}: ${dup.title}`);
        });
    }
    
    // Create new content with only unique codes
    const sortedCodes = Array.from(uniqueEntries.keys()).sort();
    let newContent = 'const ICD11_CODES = [\n';
    
    sortedCodes.forEach(code => {
        const title = uniqueEntries.get(code);
        newContent += `  { code: "${code}", title: "${title}" },\n`;
    });
    
    newContent += '];\n\n';
    
    // Add the rest of the file (functions, etc.)
    const restOfFile = content.replace(/const ICD11_CODES = \[[\s\S]*?\];/, '');
    newContent += restOfFile;
    
    // Write back to file
    fs.writeFileSync('js/icd11.js', newContent);
    
    console.log(`\nFile cleaned successfully!`);
    console.log(`Original entries: ${codes.length}`);
    console.log(`Unique entries: ${uniqueEntries.size}`);
    console.log(`Duplicates removed: ${duplicates.length}`);
    
} catch (error) {
    console.error('Error:', error.message);
}





















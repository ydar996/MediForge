const fs = require('fs');

try {
    const content = fs.readFileSync('js/icd11.js', 'utf8');
    
    // Count all code entries
    const codeMatches = content.match(/code:\s*"[^"]+"/g);
    const totalCodes = codeMatches ? codeMatches.length : 0;
    
    console.log(`Total code entries: ${totalCodes}`);
    
    // Extract unique codes
    const uniqueCodes = new Set();
    const duplicates = new Map();
    
    codeMatches.forEach(match => {
        const code = match.match(/code:\s*"([^"]+)"/)[1];
        if (uniqueCodes.has(code)) {
            duplicates.set(code, (duplicates.get(code) || 0) + 1);
        } else {
            uniqueCodes.add(code);
        }
    });
    
    console.log(`Unique codes: ${uniqueCodes.size}`);
    console.log(`Duplicate codes: ${duplicates.size}`);
    
    if (duplicates.size > 0) {
        console.log('\nDuplicate examples:');
        let count = 0;
        for (const [code, freq] of duplicates) {
            if (count < 10) { // Show first 10 examples
                console.log(`  ${code}: ${freq + 1} occurrences`);
                count++;
            }
        }
    }
    
} catch (error) {
    console.error('Error:', error.message);
}


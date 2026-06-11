# PowerShell script to remove duplicate ICD-11 codes
$filePath = "js/icd11.js"
$content = Get-Content $filePath -Raw

# Extract all code entries using regex
$pattern = '\s*\{\s*code:\s*"([^"]+)",\s*title:\s*"([^"]+)"\s*\},?'
$matches = [regex]::Matches($content, $pattern)

Write-Host "Total entries found: $($matches.Count)"

# Create a hashtable to track unique codes
$uniqueCodes = @{}
$duplicates = @{}

foreach ($match in $matches) {
    $code = $match.Groups[1].Value
    $title = $match.Groups[2].Value
    
    if ($uniqueCodes.ContainsKey($code)) {
        # This is a duplicate
        if (-not $duplicates.ContainsKey($code)) {
            $duplicates[$code] = @()
        }
        $duplicates[$code] += $title
    } else {
        $uniqueCodes[$code] = $title
    }
}

Write-Host "Unique codes: $($uniqueCodes.Count)"
Write-Host "Duplicate codes found: $($duplicates.Count)"

# Show some examples of duplicates
$duplicateCount = 0
foreach ($code in $duplicates.Keys) {
    $count = $duplicates[$code].Count + 1  # +1 for the original
    Write-Host "Code '$code' appears $count times"
    $duplicateCount += $count - 1  # Count only the duplicates, not the original
}

Write-Host "Total duplicate entries to remove: $duplicateCount"

# Create new content with only unique codes
$newContent = "const ICD11_CODES = [`n"
foreach ($code in $uniqueCodes.Keys | Sort-Object) {
    $title = $uniqueCodes[$code]
    $newContent += "  { code: `"$code`", title: `"$title`" },`n"
}
$newContent += "];`n`n"

# Add the rest of the file content (functions, etc.)
$restOfFile = $content -replace 'const ICD11_CODES = \[.*?\];', '', 'Singleline'
$newContent += $restOfFile

# Write the cleaned content back to file
Set-Content -Path $filePath -Value $newContent

Write-Host "File cleaned and duplicates removed!"
Write-Host "New unique code count: $($uniqueCodes.Count)"


# Deploy persistence fixes to Netlify
# Fixes: Infinite loop prevention, trace logs visibility, data persistence

Write-Host "Deploying persistence fixes to Netlify..." -ForegroundColor Cyan

# Build command (if needed)
# npm run build

# Deploy to Netlify
netlify deploy --prod --message "Fix: Prevent infinite save loop, ensure freeform field data persists (Supabase-first), make trace logs visible in console"

Write-Host "Deployment complete!" -ForegroundColor Green


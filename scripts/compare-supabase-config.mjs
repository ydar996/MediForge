const sites = [
  { name: 'dev', url: 'https://mediforge-dev.netlify.app/js/supabase-env.js' },
  { name: 'prod', url: 'https://mediforge.netlify.app/js/supabase-env.js' },
];

for (const site of sites) {
  const res = await fetch(site.url);
  const text = await res.text();
  const u = text.match(/url:\s*"([^"]*)"/)?.[1] || '';
  console.log(site.name + ':', {
    length: u.length,
    https: u.startsWith('https://'),
    asterisk: u.includes('*'),
    endsWith: u.slice(-15),
  });
}

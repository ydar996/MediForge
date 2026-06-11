# Custom Domain Setup: mediforge.eworkchop.com

This guide walks you through pointing `https://mediforge.eworkchop.com` to your MediForge app (currently at mediforge.netlify.app).

---

## Step 1: Add the Custom Domain in Netlify

1. Go to [app.netlify.com](https://app.netlify.com) and log in.
2. Open your **mediforge** site (production).
3. Go to **Domain management** (or **Domain settings**).
4. Click **Add custom domain** or **Add domain alias**.
5. Enter: `mediforge.eworkchop.com`
6. Save. Netlify will show you the DNS records to add.

---

## Step 2: Add the DNS Record at Your Domain Provider

Where you manage **eworkchop.com** (e.g. Namecheap, GoDaddy, Cloudflare, Google Domains):

Add a **CNAME** record:

| Field | Value |
|-------|-------|
| **Type** | CNAME |
| **Name / Host** | `mediforge` (or `mediforge.eworkchop.com` if your provider requires the full subdomain) |
| **Value / Target** | `mediforge.netlify.app` |
| **TTL** | 300 (or default) |

Some providers use different labels:
- **Host:** `mediforge`
- **Points to:** `mediforge.netlify.app`

---

## Step 3: Wait for DNS Propagation and SSL

- DNS propagation can take a few minutes to 24–48 hours.
- Netlify will automatically provision an SSL certificate for `mediforge.eworkchop.com` (HTTPS).
- In Netlify's Domain management, the domain will show as "Verified" when DNS is correct.

---

## Step 4: Set Primary Domain (Optional)

In Netlify's Domain management you can:
- Set `mediforge.eworkchop.com` as the **primary** domain.
- Add a redirect from `mediforge.netlify.app` → `mediforge.eworkchop.com` so anyone with the old link is automatically forwarded.

---

## Checklist

- [ ] Add `mediforge.eworkchop.com` in Netlify Domain management
- [ ] Add CNAME record: `mediforge` → `mediforge.netlify.app` at your DNS provider
- [ ] Wait for DNS propagation and SSL
- [ ] Test https://mediforge.eworkchop.com
- [ ] (Optional) Set up redirect from old Netlify URL to new domain

---

## If You Use Cloudflare

- Add the CNAME record as above.
- Set SSL mode to **Full** or **Full (strict)**.
- You can try with the orange cloud (proxy) off first if you have issues; enable it later if desired.

---

## After It's Working

Update any references in:
- Brochure
- Documentation
- Marketing materials
- Email templates

Replace `mediforge.netlify.app` with `mediforge.eworkchop.com`.

---

*Document created: February 2025*

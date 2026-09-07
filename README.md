# helpinKorea

Website for **helpinKorea** — Korea representative, registered local agent & compliance, and concierge services for foreign companies and individuals.

Static site + one Vercel serverless function that emails every inquiry to **tailwind@kakao.com**.

```
public/                 static site (Vercel serves this folder)
  index.html            landing page: services, how it works, pricing, about, guides, FAQ, inquiry form
  guides/*.html         SEO guide articles (add more here — one search question per page)
  privacy.html
  assets/styles.css, favicon.svg, og.png
  sitemap.xml, robots.txt
api/contact.js          POST /api/contact → validates, then emails the inquiry
test/contact.test.js    `npm test` — runs the handler with outbound email mocked
vercel.json             clean URLs, security + cache headers
.env.example            environment variables
```

## Deploy (GitHub → Vercel)

1. **GitHub**: create a new **private** repo `helpinkorea` under your account and upload this folder
   (drag-and-drop on GitHub's "upload files" page works, or `git remote add origin … && git push -u origin main`).
2. **Vercel**: *Add New → Project → Import* the repo. Framework preset **Other**, no build command,
   output directory left empty (Vercel serves `public/` automatically). Project name `helpinkorea`
   → site is live at **https://helpinkorea.vercel.app**. Every push to `main` redeploys.
3. **Environment variables** (Vercel → Project → Settings → Environment Variables) — see below.
4. **Custom domain** (optional): Vercel → Domains → add e.g. `helpinkorea.co`, then update the
   `https://helpinkorea.vercel.app` URLs in `index.html`, the guides, `sitemap.xml` and `robots.txt`.

## Inquiry email delivery — pick one

| Option | Setup | Notes |
|---|---|---|
| **A. FormSubmit (default, zero config)** | Nothing to set. Submit the form once; FormSubmit emails **tailwind@kakao.com** an *Activate* link — click it once. | Free. Emails come from FormSubmit. Good enough to launch today. |
| **B. Web3Forms** | Get a free access key at web3forms.com using tailwind@kakao.com → set `WEB3FORMS_KEY`. | Free, reliable, no domain needed. |
| **C. Resend** | Sign up at resend.com → set `RESEND_API_KEY` (and `RESEND_FROM` once you verify your own domain). | Best deliverability + nice HTML email; needs a custom domain to send from your own address. |

`CONTACT_TO` overrides the recipient (default `tailwind@kakao.com`). If delivery fails, the site shows the visitor a
pre-filled *mailto:* link so no inquiry is lost.

## Things to fill in

* `public/index.html` → `CONFIG` block near the bottom: WhatsApp number, Calendly link, LinkedIn URL
  (buttons stay hidden until filled).
* Google Analytics: paste the GA4 snippet where the comment says so at the end of `index.html`.
* Google Search Console: add the property for the site, verify with the HTML-tag method (paste the
  `<meta name="google-site-verification">` tag into `<head>` of `index.html`), then submit `/sitemap.xml`.
* Prices in the Pricing section are indicative — edit freely.

## Local development

```
npm i -g vercel
vercel dev          # serves public/ + /api/contact at http://localhost:3000
npm test            # handler tests (no email sent)
```

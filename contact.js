// Vercel Serverless Function — receives the inquiry form and emails it to CONTACT_TO.
//
// Delivery providers, in priority order (set ONE of these in Vercel → Settings → Environment Variables):
//   1. RESEND_API_KEY   — Resend (recommended once you have a custom domain). Optional RESEND_FROM.
//   2. WEB3FORMS_KEY    — Web3Forms access key created for tailwind@kakao.com (free, no domain needed).
//   3. (none)           — FormSubmit.co fallback: works with zero setup, but the FIRST submission sends an
//                         activation email to tailwind@kakao.com that must be clicked once.
//
// CONTACT_TO defaults to tailwind@kakao.com.

const CONTACT_TO = process.env.CONTACT_TO || "tailwind@kakao.com";

const FIELDS = [
  ["service", "Service"], ["name", "Name"], ["email", "Email"], ["country", "Country"], ["phone", "WhatsApp / phone"],
  ["company", "Company"], ["website", "Website"], ["industry", "Industry / product"], ["timeline", "Timeline"],
  ["agentType", "Appointment needed"], ["goal", "Main goal"], ["task", "Task"], ["link", "Link / location"],
  ["budget", "Budget"], ["message", "Message"], ["page", "Page"], ["submittedAt", "Submitted at (UTC)"]
];

const hits = new Map(); // very light per-IP rate limit (per warm instance)
function limited(ip) {
  const now = Date.now(), win = 10 * 60 * 1000;
  const arr = (hits.get(ip) || []).filter(t => now - t < win);
  arr.push(now); hits.set(ip, arr);
  return arr.length > 8;
}
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function render(d) {
  const rows = FIELDS.filter(([k]) => d[k]).map(([k, label]) => ({ label, value: String(d[k]) }));
  const text = rows.map(r => `${r.label}: ${r.value}`).join("\n");
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:640px">
    <h2 style="margin:0 0 6px">New inquiry — ${esc(d.service || "General")}</h2>
    <p style="color:#666;margin:0 0 18px">from ${esc(d.name)} &lt;${esc(d.email)}&gt; · ${esc(d.country || "")}</p>
    <table cellpadding="8" style="border-collapse:collapse;width:100%">${rows.map(r =>
      `<tr><td style="border-bottom:1px solid #eee;color:#666;width:180px;vertical-align:top">${esc(r.label)}</td><td style="border-bottom:1px solid #eee;white-space:pre-wrap">${esc(r.value)}</td></tr>`).join("")}
    </table>
    <p style="margin-top:18px"><a href="mailto:${esc(d.email)}?subject=Re: your helpinKorea inquiry">Reply to ${esc(d.name)}</a></p></div>`;
  const subject = `[helpinKorea] ${d.service || "Inquiry"} — ${d.name} (${d.country || "?"})`;
  return { subject, text, html };
}

async function viaResend(d, m) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || "helpinKorea <onboarding@resend.dev>",
      to: [CONTACT_TO], reply_to: d.email, subject: m.subject, text: m.text, html: m.html
    })
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}

async function viaWeb3Forms(d, m) {
  const r = await fetch("https://api.web3forms.com/submit", {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      access_key: process.env.WEB3FORMS_KEY, subject: m.subject, from_name: "helpinKorea website",
      replyto: d.email, name: d.name, email: d.email, message: m.text
    })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) throw new Error(`Web3Forms: ${j.message || r.status}`);
}

async function viaFormSubmit(d, m) {
  const r = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(CONTACT_TO)}`, {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      _subject: m.subject, _template: "table", _replyto: d.email, _captcha: "false",
      ...Object.fromEntries(FIELDS.filter(([k]) => d[k]).map(([k, label]) => [label, d[k]]))
    })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || String(j.success) === "false") throw new Error(`FormSubmit: ${j.message || r.status}`);
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  let d = req.body;
  if (typeof d === "string") { try { d = JSON.parse(d); } catch { d = {}; } }
  d = d || {};

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return res.status(429).json({ ok: false, error: "Too many requests, please try again later" });
  if (d._gotcha) return res.status(200).json({ ok: true }); // honeypot: pretend success

  const email = String(d.email || "").trim();
  if (!d.name || !email || !d.message) return res.status(400).json({ ok: false, error: "Name, email and message are required" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ ok: false, error: "Invalid email address" });
  for (const k of Object.keys(d)) if (typeof d[k] === "string") d[k] = d[k].slice(0, 5000);
  d.email = email;

  const m = render(d);
  try {
    if (process.env.RESEND_API_KEY) await viaResend(d, m);
    else if (process.env.WEB3FORMS_KEY) await viaWeb3Forms(d, m);
    else await viaFormSubmit(d, m);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("contact error:", err);
    return res.status(502).json({ ok: false, error: "Email delivery failed" });
  }
};

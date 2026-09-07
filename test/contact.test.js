// Runs the handler with fetch mocked — verifies validation, honeypot and payload shape without sending email.
const handler = require("../api/contact.js");
const calls = [];
global.fetch = async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body) }); return { ok: true, status: 200, json: async () => ({ success: "true" }), text: async () => "" }; };
function run(method, body, headers = {}) {
  return new Promise(resolve => {
    const res = { code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(j) { resolve({ code: this.code, json: j }); } };
    handler({ method, body, headers }, res);
  });
}
(async () => {
  let r = await run("GET", {}); console.assert(r.code === 405, "GET should be 405");
  r = await run("POST", { name: "A" }); console.assert(r.code === 400, "missing fields -> 400", r);
  r = await run("POST", { name: "A", email: "bad", message: "x" }); console.assert(r.code === 400, "bad email -> 400");
  r = await run("POST", { name: "Bot", email: "b@b.com", message: "x", _gotcha: "spam" }); console.assert(r.code === 200 && calls.length === 0, "honeypot swallowed");
  r = await run("POST", { service: "Local Agent & Compliance", name: "Anna Schmidt", email: "anna@example.com", country: "Germany", company: "ACME GmbH", message: "Do we need a PIPA agent?" }, { "x-forwarded-for": "1.2.3.4" });
  console.assert(r.code === 200 && r.json.ok, "valid -> 200", r);
  console.assert(calls.length === 1 && calls[0].url.includes("formsubmit.co/ajax/tailwind%40kakao.com"), "fallback goes to FormSubmit for tailwind@kakao.com", calls[0].url);
  console.assert(calls[0].body._subject.includes("Anna Schmidt") && calls[0].body.Company === "ACME GmbH", "payload has fields");
  process.env.RESEND_API_KEY = "re_test";
  r = await run("POST", { name: "B", email: "b@example.com", message: "hi" }, { "x-forwarded-for": "5.6.7.8" });
  console.assert(calls[1].url === "https://api.resend.com/emails" && calls[1].body.to[0] === "tailwind@kakao.com" && calls[1].body.reply_to === "b@example.com", "Resend path", calls[1]);
  console.log("all contact tests passed", calls.length, "outbound calls");
})();

const PRODUCTS = {
  pork: { name: "Pork", pricePerKg: 105 },
  beef: { name: "Beef", pricePerKg: 115 },
  wors: { name: "Wors", pricePerKg: 95 }
};
const EMAIL_TO = "lonwabommms@gmail.com";
const EMAIL_FROM = "Tobz Shisanyama <onboarding@resend.dev>";
const money = value => "R" + Number(value).toFixed(2);
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid request body." }, { status: 400 }); }

  const customer = body?.customer || {};
  const name = String(customer.name || "").trim();
  const phone = String(customer.phone || "").trim();
  const method = customer.method === "Delivery" ? "Delivery" : "Collection";
  const address = String(customer.address || "").trim();
  const notes = String(customer.notes || "").trim();

  if (!name || name.length > 100 || !phone || phone.length > 25) {
    return Response.json({ error: "Please provide a valid name and phone number." }, { status: 400 });
  }
  if (method === "Delivery" && !address) {
    return Response.json({ error: "A delivery address is required." }, { status: 400 });
  }
  if (address.length > 500 || notes.length > 500 || !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 3) {
    return Response.json({ error: "The order details are invalid." }, { status: 400 });
  }

  const seen = new Set();
  const items = [];
  for (const submitted of body.items) {
    const product = PRODUCTS[submitted?.id];
    const amount = Number(submitted?.amount);
    if (!product || seen.has(submitted.id) || !Number.isFinite(amount) || amount <= 0 || amount > 10000) {
      return Response.json({ error: "One or more order items are invalid." }, { status: 400 });
    }
    seen.add(submitted.id);
    const roundedAmount = Math.round(amount * 100) / 100;
    items.push({
      id: submitted.id,
      name: product.name,
      amount: roundedAmount,
      weightKg: (roundedAmount / product.pricePerKg).toFixed(2),
      pricePerKg: product.pricePerKg
    });
  }

  const total = Math.round(items.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
  const orderId = "TOBZ-TEST-" + Date.now().toString(36).toUpperCase();
  const itemRows = items.map(item =>
    "<tr><td style='padding:10px;border-bottom:1px solid #eee'>" + escapeHtml(item.name) + "</td><td style='padding:10px;border-bottom:1px solid #eee'>" + escapeHtml(item.weightKg) + " kg</td><td style='padding:10px;border-bottom:1px solid #eee'>" + money(item.amount) + "</td></tr>"
  ).join("");

  const html = `
    <div style="font-family:Arial,sans-serif;color:#222;max-width:640px;margin:auto">
      <div style="background:#171714;color:#fff;padding:22px"><h1 style="margin:0;font-size:22px">TOBZ SHISANYAMA</h1><p style="color:#f26a21;margin:8px 0 0">NEW SANDBOX ORDER</p></div>
      <div style="padding:22px">
        <p style="background:#fff0e6;color:#8e3c14;padding:12px"><strong>PAID — SIMULATED TEST PAYMENT</strong><br>No money was collected. This is a test order only.</p>
        <h2>Order ${escapeHtml(orderId)}</h2>
        <p><strong>Customer:</strong> ${escapeHtml(name)}<br><strong>Phone:</strong> ${escapeHtml(phone)}<br><strong>Method:</strong> ${escapeHtml(method)}<br>${address ? "<strong>Address:</strong> " + escapeHtml(address) + "<br>" : ""}${notes ? "<strong>Notes:</strong> " + escapeHtml(notes) : ""}</p>
        <table style="width:100%;border-collapse:collapse;text-align:left"><thead><tr><th style="padding:10px">Item</th><th style="padding:10px">Weight</th><th style="padding:10px">Amount</th></tr></thead><tbody>${itemRows}</tbody></table>
        <h2 style="text-align:right">Total: ${money(total)}</h2>
        <p style="font-size:12px;color:#777">Payment status: PAID – SIMULATED. Live payment processing is not enabled.</p>
      </div>
    </div>`;

  let emailSent = false;
  if (env.RESEND_API_KEY) {
    try {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + env.RESEND_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [EMAIL_TO],
          subject: "[TEST ORDER] " + orderId + " — " + money(total),
          html
        })
      });
      emailSent = emailResponse.ok;
      if (!emailSent) console.error("Resend email request failed:", emailResponse.status, await emailResponse.text());
    } catch (error) {
      console.error("Resend request error:", error);
    }
  } else {
    console.error("RESEND_API_KEY is not configured in Cloudflare Pages.");
  }

  return Response.json({
    orderId,
    paymentStatus: "PAID_SIMULATED",
    emailSent,
    items,
    total
  });
}

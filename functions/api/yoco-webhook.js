const EMAIL_TO = "lonwabommms@gmail.com";
const EMAIL_FROM = "Tobz Shisanyama <onboarding@resend.dev>";

const money = cents => "R" + (Number(cents) / 100).toFixed(2);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

async function verifyYocoSignature(request, rawBody, secret) {
  const id = request.headers.get("webhook-id");
  const timestamp = request.headers.get("webhook-timestamp");
  const signatureHeader = request.headers.get("webhook-signature");
  if (!id || !timestamp || !signatureHeader || !secret.startsWith("whsec_")) return false;

  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > 180) return false;

  let secretBytes;
  try {
    const binary = atob(secret.slice("whsec_".length));
    secretBytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  } catch {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signedContent = id + "." + timestamp + "." + rawBody;
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent)));
  let binary = "";
  digest.forEach(byte => binary += String.fromCharCode(byte));
  const expected = btoa(binary);

  return signatureHeader.split(" ").some(part => {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value || value.length !== expected.length) return false;
    let difference = 0;
    for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ value.charCodeAt(i);
    return difference === 0;
  });
}

function makeEmail(order, orderId) {
  const customer = JSON.parse(order.customer_json);
  const items = JSON.parse(order.items_json);
  const rows = items.map(item =>
    "<tr><td style='padding:10px;border-bottom:1px solid #eee'>" + escapeHtml(item.name) +
    "</td><td style='padding:10px;border-bottom:1px solid #eee'>" + escapeHtml(item.weightKg) +
    " kg</td><td style='padding:10px;border-bottom:1px solid #eee'>" + money(item.amountCents) + "</td></tr>"
  ).join("");

  return {
    subject: "PAID ORDER " + orderId + " — " + money(order.total_cents),
    html: `<div style="font-family:Arial,sans-serif;color:#222;max-width:640px;margin:auto">
      <div style="background:#171714;color:#fff;padding:22px"><h1 style="margin:0;font-size:22px">TOBZ SHISANYAMA</h1><p style="color:#f26a21;margin:8px 0 0">PAYMENT CONFIRMED</p></div>
      <div style="padding:22px"><p style="background:#e8f7ed;color:#176b35;padding:12px"><strong>PAYMENT CONFIRMED BY YOCO</strong><br>This order was confirmed by a verified Yoco payment notification.</p>
      <h2>Order ${escapeHtml(orderId)}</h2>
      <p><strong>Customer:</strong> ${escapeHtml(customer.name)}<br><strong>Phone:</strong> ${escapeHtml(customer.phone)}<br><strong>Method:</strong> ${escapeHtml(customer.method)}<br>${customer.address ? "<strong>Address:</strong> " + escapeHtml(customer.address) + "<br>" : ""}${customer.notes ? "<strong>Notes:</strong> " + escapeHtml(customer.notes) : ""}</p>
      <table style="width:100%;border-collapse:collapse;text-align:left"><thead><tr><th style="padding:10px">Item</th><th style="padding:10px">Weight</th><th style="padding:10px">Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <h2 style="text-align:right">Total: ${money(order.total_cents)}</h2></div></div>`
  };
}

export async function onRequestPost({ request, env }) {
  if (!env.DB || !env.YOCO_WEBHOOK_SECRET) {
    return new Response("Webhook is not configured.", { status: 500 });
  }

  const rawBody = await request.text();
  const valid = await verifyYocoSignature(request, rawBody, env.YOCO_WEBHOOK_SECRET);
  if (!valid) return new Response("Invalid webhook signature.", { status: 401 });

  let event;
  try { event = JSON.parse(rawBody); }
  catch { return new Response("Invalid JSON.", { status: 400 }); }

  if (event.type !== "payment.succeeded") return new Response("Event ignored.", { status: 200 });

  const payment = event.payload || {};
  // Yoco's Checkout API payment notification documents metadata.checkoutId.
  // We also accept metadata.orderId when it is echoed from our checkout request.
  // The checkout ID is saved against the order by place-order.js.
  const orderId = payment.metadata?.orderId;
  const checkoutId = payment.metadata?.checkoutId;
  if ((!orderId && !checkoutId) || payment.status !== "succeeded" || payment.currency !== "ZAR") {
    return new Response("Payment details incomplete.", { status: 400 });
  }

  let order = null;
  if (orderId) {
    order = await env.DB.prepare(
      "SELECT * FROM orders WHERE order_id = ?"
    ).bind(orderId).first();
  }
  if (!order && checkoutId) {
    order = await env.DB.prepare(
      "SELECT * FROM orders WHERE checkout_id = ?"
    ).bind(checkoutId).first();
  }

  if (!order) {
    console.error("No order matched Yoco payment metadata:", {
      hasOrderId: Boolean(orderId),
      hasCheckoutId: Boolean(checkoutId)
    });
    return new Response("Order not found.", { status: 200 });
  }
  if (Number(payment.amount) !== Number(order.total_cents)) {
    console.error("Yoco amount mismatch for order:", order.order_id);
    return new Response("Payment amount mismatch.", { status: 400 });
  }

  if (order.payment_status !== "paid") {
    await env.DB.prepare(
      "UPDATE orders SET payment_status = 'paid', paid_at = CURRENT_TIMESTAMP WHERE order_id = ? AND payment_status = 'pending'"
    ).bind(order.order_id).run();
  }

  const claim = await env.DB.prepare(
    "UPDATE orders SET email_status = 'sending' WHERE order_id = ? AND payment_status = 'paid' AND email_status IN ('pending','failed')"
  ).bind(order.order_id).run();

  if (!claim.meta?.changes) return new Response("Payment already processed.", { status: 200 });

  if (!env.RESEND_API_KEY) {
    await env.DB.prepare("UPDATE orders SET email_status = 'failed' WHERE order_id = ?").bind(order.order_id).run();
    return new Response("Email service is not configured.", { status: 500 });
  }

  try {
    const email = makeEmail(order, order.order_id);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + env.RESEND_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [EMAIL_TO],
        subject: email.subject,
        html: email.html
      })
    });
    if (!response.ok) {
      console.error("Resend error:", response.status, await response.text());
      await env.DB.prepare("UPDATE orders SET email_status = 'failed' WHERE order_id = ?").bind(order.order_id).run();
      return new Response("Email delivery failed.", { status: 500 });
    }
    await env.DB.prepare("UPDATE orders SET email_status = 'sent' WHERE order_id = ?").bind(order.order_id).run();
  } catch (error) {
    console.error("Email error:", error);
    await env.DB.prepare("UPDATE orders SET email_status = 'failed' WHERE order_id = ?").bind(order.order_id).run();
    return new Response("Email delivery failed.", { status: 500 });
  }

  return new Response("Payment confirmed and email sent.", { status: 200 });
}
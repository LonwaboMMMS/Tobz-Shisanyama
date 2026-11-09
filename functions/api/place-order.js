const PRODUCTS = {
  pork: { name: "Pork", pricePerKg: 105 },
  beef: { name: "Beef", pricePerKg: 115 },
  wors: { name: "Wors", pricePerKg: 95 }
};

export async function onRequestPost({ request, env }) {
  if (!env.YOCO_SECRET_KEY) {
    return Response.json({ error: "Yoco is not configured yet." }, { status: 503 });
  }
  if (!env.DB) {
    return Response.json({ error: "The orders database is not connected yet." }, { status: 503 });
  }

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
      amountCents: Math.round(roundedAmount * 100),
      weightKg: (roundedAmount / product.pricePerKg).toFixed(2),
      pricePerKg: product.pricePerKg
    });
  }

  const totalCents = items.reduce((sum, item) => sum + item.amountCents, 0);
  if (totalCents < 200) {
    return Response.json({ error: "The minimum Yoco payment is R2.00." }, { status: 400 });
  }

  const orderId = "TOBZ-" + crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();
  const customerData = { name, phone, method, address, notes };
  const origin = new URL(request.url).origin;

  try {
    await env.DB.prepare(
      "INSERT INTO orders (order_id, customer_json, items_json, total_cents, currency, payment_status, email_status) VALUES (?, ?, ?, ?, 'ZAR', 'pending', 'pending')"
    ).bind(orderId, JSON.stringify(customerData), JSON.stringify(items), totalCents).run();

    const yocoResponse = await fetch("https://payments.yoco.com/api/checkouts", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + env.YOCO_SECRET_KEY,
        "Content-Type": "application/json",
        "Idempotency-Key": orderId
      },
      body: JSON.stringify({
        amount: totalCents,
        currency: "ZAR",
        successUrl: origin + "/payment-return.html?order=" + encodeURIComponent(orderId),
        cancelUrl: origin + "/checkout.html?payment=cancelled",
        failureUrl: origin + "/checkout.html?payment=failed",
        clientReferenceId: orderId,
        metadata: { orderId }
      })
    });

    const checkout = await yocoResponse.json().catch(() => ({}));
    if (!yocoResponse.ok || !checkout.id || !checkout.redirectUrl) {
      console.error("Yoco checkout creation failed:", yocoResponse.status, checkout);
      await env.DB.prepare("UPDATE orders SET payment_status = 'checkout_failed' WHERE order_id = ?").bind(orderId).run();
      return Response.json({ error: "Yoco could not start the payment. Please try again." }, { status: 502 });
    }

    await env.DB.prepare("UPDATE orders SET checkout_id = ? WHERE order_id = ?")
      .bind(checkout.id, orderId).run();

    return Response.json({
      orderId,
      paymentStatus: "pending",
      redirectUrl: checkout.redirectUrl,
      total: totalCents / 100
    });
  } catch (error) {
    console.error("Order checkout error:", error);
    return Response.json({ error: "We could not create your checkout. Please try again." }, { status: 500 });
  }
}

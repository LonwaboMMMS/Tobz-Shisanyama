// Tobz Shisanyama sandbox checkout. This deliberately simulates payment; it does not collect money.
const CHECKOUT_PRODUCTS = {
  pork: { name: "Pork", pricePerKg: 105 },
  beef: { name: "Beef", pricePerKg: 115 },
  wors: { name: "Wors", pricePerKg: 95 }
};
const CHECKOUT_CART_KEY = "tobz-shisanyama-cart-v1";
const TEST_WHATSAPP_NUMBER = "27742795157";
const TEST_EMAIL = "lonwabommms@gmail.com";
const formatMoney = value => new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(value);
const checkoutCart = (() => {
  try { return JSON.parse(localStorage.getItem(CHECKOUT_CART_KEY)) || []; }
  catch { return []; }
})();
const validItems = checkoutCart.filter(item => CHECKOUT_PRODUCTS[item.id] && Number.isFinite(Number(item.amount)) && Number(item.amount) > 0)
  .map(item => ({ id: item.id, amount: Math.round(Number(item.amount) * 100) / 100 }));
const checkoutTotal = validItems.reduce((sum, item) => sum + item.amount, 0);
const itemsContainer = document.getElementById("checkout-items");
const totalContainer = document.getElementById("checkout-total");
const form = document.getElementById("checkout-form");
const statusBox = document.getElementById("checkout-status");
const submitButton = document.getElementById("place-order");
const whatsappButton = document.getElementById("whatsapp-order");
const addressField = document.getElementById("address-field");
const addressInput = document.getElementById("customer-address");

document.querySelectorAll(".year").forEach(el => el.textContent = new Date().getFullYear());
document.getElementById("order-method").addEventListener("change", event => {
  const delivery = event.target.value === "Delivery";
  addressField.hidden = !delivery;
  addressInput.required = delivery;
});
if (!validItems.length) {
  document.getElementById("checkout-layout").hidden = true;
  document.getElementById("checkout-empty").hidden = false;
} else {
  itemsContainer.innerHTML = validItems.map(item => {
    const product = CHECKOUT_PRODUCTS[item.id];
    const kg = item.amount / product.pricePerKg;
    return '<div class="checkout-summary-line"><span>' + product.name + ' · ' + kg.toFixed(2) + ' kg</span><span>' + formatMoney(item.amount) + '</span></div>';
  }).join("");
  totalContainer.textContent = formatMoney(checkoutTotal);
}

function buildWhatsAppMessage(order) {
  const lines = [
    "*TOBZ SHISANYAMA — TEST ORDER*",
    "Order: " + order.orderId,
    "Payment: PAID — SIMULATED (NO MONEY COLLECTED)",
    "",
    "Customer: " + order.customer.name,
    "Phone: " + order.customer.phone,
    "Order type: " + order.customer.method,
    ...(order.customer.address ? ["Address: " + order.customer.address] : []),
    "",
    "*ORDER DETAILS*",
    ...order.items.map(item => item.name + " — " + item.weightKg + " kg — " + formatMoney(item.amount)),
    "",
    "TOTAL: " + formatMoney(order.total),
    ...(order.customer.notes ? ["", "Notes: " + order.customer.notes] : [])
  ];
  return lines.join("\n");
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!validItems.length || !form.reportValidity()) return;
  submitButton.disabled = true;
  submitButton.textContent = "SUBMITTING TEST ORDER…";
  statusBox.className = "checkout-status";
  statusBox.textContent = "";
  whatsappButton.hidden = true;

  const customer = {
    name: form.elements.name.value.trim(),
    phone: form.elements.phone.value.trim(),
    method: form.elements.method.value,
    address: form.elements.address.value.trim(),
    notes: form.elements.notes.value.trim()
  };
  try {
    const response = await fetch("/api/place-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer, items: validItems })
    });
    const result = await response.json();
    if (!response.ok || !result.orderId) throw new Error(result.error || "The order could not be submitted.");
    const orderForWhatsApp = {
      orderId: result.orderId,
      customer,
      items: result.items,
      total: result.total
    };
    whatsappButton.href = "https://wa.me/" + TEST_WHATSAPP_NUMBER + "?text=" + encodeURIComponent(buildWhatsAppMessage(orderForWhatsApp));
    whatsappButton.hidden = false;
    if (result.emailSent) {
      statusBox.className = "checkout-status visible";
      statusBox.innerHTML = "<strong>TEST ORDER SUBMITTED · PAID – SIMULATED</strong>Order " + result.orderId + " was created and the notification email was sent to " + TEST_EMAIL + ". No money was collected. Use the WhatsApp button below to send the order to Tobz.";
    } else {
      statusBox.className = "checkout-status visible error";
      statusBox.innerHTML = "<strong>ORDER CREATED, EMAIL NOT SENT</strong>Order " + result.orderId + " was created as a simulated paid test. WhatsApp is ready below, but email needs setup. Add the RESEND_API_KEY secret in Cloudflare Pages and check the deployment logs.";
    }
    localStorage.removeItem(CHECKOUT_CART_KEY);
    form.querySelectorAll("input,select,textarea,button").forEach(el => { if (el.type !== "submit") el.disabled = true; });
    submitButton.textContent = "TEST ORDER COMPLETE";
  } catch (error) {
    statusBox.className = "checkout-status visible error";
    statusBox.textContent = error.message || "Something went wrong. Please try again.";
    submitButton.disabled = false;
    submitButton.textContent = "PLACE TEST ORDER · MARK AS PAID";
  }
});

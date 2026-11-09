// Tobz Shisanyama checkout: order creation and redirect to Yoco's hosted payment page.
const CHECKOUT_PRODUCTS = {
  pork: { name: "Pork", pricePerKg: 105 },
  beef: { name: "Beef", pricePerKg: 115 },
  wors: { name: "Wors", pricePerKg: 95 }
};
const CHECKOUT_CART_KEY = "tobz-shisanyama-cart-v1";
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
const addressField = document.getElementById("address-field");
const addressInput = document.getElementById("customer-address");

document.querySelectorAll(".year").forEach(el => el.textContent = new Date().getFullYear());
document.getElementById("order-method").addEventListener("change", event => {
  const delivery = event.target.value === "Delivery";
  addressField.hidden = !delivery;
  addressInput.required = delivery;
});

const paymentMessage = new URLSearchParams(location.search).get("payment");
if (paymentMessage) {
  statusBox.className = "checkout-status visible error";
  statusBox.textContent = paymentMessage === "cancelled"
    ? "Payment was cancelled. Your order has not been paid."
    : "The payment was not completed. Please try again or contact Tobz.";
}

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

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!validItems.length || !form.reportValidity()) return;
  submitButton.disabled = true;
  submitButton.textContent = "CONNECTING TO YOCO…";
  statusBox.className = "checkout-status";
  statusBox.textContent = "";

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
    if (!response.ok || !result.redirectUrl) throw new Error(result.error || "Yoco checkout could not be started.");

    localStorage.removeItem(CHECKOUT_CART_KEY);
    statusBox.className = "checkout-status visible";
    statusBox.textContent = "Your order has been created. Redirecting you to Yoco to complete payment…";
    location.href = result.redirectUrl;
  } catch (error) {
    statusBox.className = "checkout-status visible error";
    statusBox.textContent = error.message || "Something went wrong. Please try again.";
    submitButton.disabled = false;
    submitButton.textContent = "CONTINUE TO YOCO PAYMENT";
  }
});

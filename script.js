// Tobz Shisanyama storefront
// Product prices and names will be configured when the menu is supplied.
const products = [];
let cart = [];

const productGrid = document.getElementById('product-grid');
const cartOverlay = document.getElementById('cart-overlay');
const cartItems = document.getElementById('cart-items');
const cartCount = document.getElementById('cart-count');
const cartTotal = document.getElementById('cart-total');
const cartNote = document.getElementById('cart-note');
const checkoutButton = document.getElementById('checkout-button');

document.getElementById('year').textContent = new Date().getFullYear();

function formatRand(amount) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
}

function renderProducts(category = 'all') {
  const visible = products.filter(product => category === 'all' || product.category === category);
  if (!visible.length) {
    productGrid.innerHTML = '<div class="menu-empty"><p>Our menu is being prepared.</p><span>Check back soon for the full selection.</span></div>';
    return;
  }
  productGrid.innerHTML = visible.map(product => `
    <article class="product-card">
      <img class="product-photo" src="${product.image}" alt="${product.name}" loading="lazy">
      <div class="product-info">
        <span class="product-category">${product.category.toUpperCase()}</span>
        <h3>${product.name}</h3>
        <p class="product-price">${formatRand(product.pricePerKg)} <span>/ kg</span></p>
        <div class="product-buy">
          <label class="weight-label">WEIGHT (KG)
            <input type="number" min="0.1" step="0.1" value="1" id="weight-${product.id}" aria-label="Weight in kilograms">
          </label>
          <button class="add-button" data-add="${product.id}">ADD +</button>
        </div>
      </div>
    </article>`).join('');
}

function addToCart(productId, weight) {
  const product = products.find(item => item.id === productId);
  if (!product || !Number.isFinite(weight) || weight <= 0) return;
  const existing = cart.find(item => item.id === productId);
  if (existing) existing.weight = Math.round((existing.weight + weight) * 100) / 100;
  else cart.push({ id: productId, weight });
  renderCart();
}

function renderCart() {
  const count = cart.reduce((sum, item) => sum + item.weight, 0);
  const total = cart.reduce((sum, item) => {
    const product = products.find(p => p.id === item.id);
    return sum + (product ? product.pricePerKg * item.weight : 0);
  }, 0);
  cartCount.textContent = count.toFixed(2).replace(/\.00$/, '');
  cartTotal.textContent = formatRand(total);
  cartNote.textContent = cart.length ? 'Delivery fees, if applicable, will be confirmed at checkout.' : 'Your cart is waiting for something delicious.';
  checkoutButton.disabled = cart.length === 0;

  if (!cart.length) {
    cartItems.innerHTML = '<div class="empty-cart"><span>🛒</span><h3>Your cart is empty</h3><p>Some good meat would look great here.</p></div>';
    return;
  }

  cartItems.innerHTML = cart.map(item => {
    const product = products.find(p => p.id === item.id);
    if (!product) return '';
    return `<div class="cart-line">
      <div><h4>${product.name}</h4><p>${formatRand(product.pricePerKg)} per kg · ${formatRand(product.pricePerKg * item.weight)}</p><button class="remove-item" data-remove="${product.id}">Remove</button></div>
      <label><span class="sr-only">Weight in kilograms</span><input type="number" min="0.1" step="0.1" value="${item.weight}" data-weight="${product.id}"></label>
    </div>`;
  }).join('');
}

function openCart() {
  cartOverlay.classList.add('open');
  cartOverlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}
function closeCart() {
  cartOverlay.classList.remove('open');
  cartOverlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

document.getElementById('open-cart').addEventListener('click', openCart);
document.getElementById('close-cart').addEventListener('click', closeCart);
cartOverlay.addEventListener('click', event => { if (event.target === cartOverlay) closeCart(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeCart(); });

document.querySelector('.category-tabs').addEventListener('click', event => {
  const tab = event.target.closest('[data-category]');
  if (!tab) return;
  document.querySelectorAll('.category-tab').forEach(button => button.classList.toggle('active', button === tab));
  renderProducts(tab.dataset.category);
});

productGrid.addEventListener('click', event => {
  const button = event.target.closest('[data-add]');
  if (!button) return;
  const weightInput = document.getElementById(`weight-${button.dataset.add}`);
  const weight = Number(weightInput.value);
  if (!Number.isFinite(weight) || weight <= 0) {
    weightInput.focus();
    return;
  }
  addToCart(button.dataset.add, weight);
  button.textContent = 'ADDED ✓';
  setTimeout(() => { button.textContent = 'ADD +'; }, 900);
});

cartItems.addEventListener('click', event => {
  const button = event.target.closest('[data-remove]');
  if (!button) return;
  cart = cart.filter(item => item.id !== button.dataset.remove);
  renderCart();
});
cartItems.addEventListener('change', event => {
  const input = event.target.closest('[data-weight]');
  if (!input) return;
  const weight = Number(input.value);
  if (!Number.isFinite(weight) || weight <= 0) {
    renderCart();
    return;
  }
  const item = cart.find(entry => entry.id === input.dataset.weight);
  if (item) item.weight = Math.round(weight * 100) / 100;
  renderCart();
});

// Checkout will be connected after delivery, payment and order-handling details are confirmed.
checkoutButton.addEventListener('click', () => {
  alert('Checkout will be available once the ordering and payment details are configured.');
});

renderProducts();
renderCart();

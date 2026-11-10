// Tobz Shisanyama: price-first ordering. Customers enter rand; weight is calculated from the price per kg.
const products=[
 {id:'pork',name:'Pork',category:'Pork',pricePerKg:105},
 {id:'beef',name:'Beef',category:'Beef',pricePerKg:115},
 {id:'wors',name:'Wors',category:'Wors',pricePerKg:95}
];
const CART_KEY='tobz-shisanyama-cart-v1';
let cart=loadCart();
const money=value=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(value);
const byId=id=>document.getElementById(id);
function loadCart(){try{return JSON.parse(localStorage.getItem(CART_KEY))||[]}catch{return []}}
function saveCart(){localStorage.setItem(CART_KEY,JSON.stringify(cart))}
function weightFor(amount,rate){return amount/rate}
function updateWeight(productId){
 const input=document.querySelector('[data-amount="'+productId+'"]');
 const output=document.querySelector('[data-weight-result="'+productId+'"]');
 if(!input||!output)return;
 const amount=Number(input.value),product=products.find(p=>p.id===productId);
 output.textContent=Number.isFinite(amount)&&amount>0?(weightFor(amount,product.pricePerKg).toFixed(2)+' kg'):'— kg';
}
function addProduct(id){
 const input=document.querySelector('[data-amount="'+id+'"]');
 const amount=Number(input?.value),product=products.find(p=>p.id===id);
 if(!product||!Number.isFinite(amount)||amount<=0){input?.focus();return}
 const existing=cart.find(item=>item.id===id);
 if(existing){existing.amount=Math.round((existing.amount+amount)*100)/100}
 else cart.push({id,amount});
 saveCart();
// Menu category tabs: update the selected tab and filter the product cards.
const categoryTabs = document.querySelectorAll('.category-tab');
const productCards = document.querySelectorAll('.product-card');
function setMenuCategory(category) {
 categoryTabs.forEach(tab => {
  const selected = tab.getAttribute('href') === '#' + category;
  tab.classList.toggle('active', selected);
  if (selected) tab.setAttribute('aria-current', 'true');
  else tab.removeAttribute('aria-current');
 });
 productCards.forEach(card => {
  card.hidden = category !== 'all' && card.id !== category;
 });
}
if (categoryTabs.length && productCards.length) {
 categoryTabs.forEach(tab => tab.addEventListener('click', event => {
  event.preventDefault();
  const category = tab.getAttribute('href').slice(1);
  setMenuCategory(category);
  history.replaceState(null, '', '#' + category);
 }));
 const initialCategory = location.hash.slice(1);
 setMenuCategory(['pork', 'beef', 'wors'].includes(initialCategory) ? initialCategory : 'all');
}

renderCart();
 const button=document.querySelector('[data-add="'+id+'"]');
 if(button){const old=button.innerHTML;button.textContent='ADDED ✓';setTimeout(()=>button.innerHTML=old,900)}
}
function renderCart(){
 const count=cart.length;
 const total=cart.reduce((sum,item)=>sum+item.amount,0);
 const countEl=byId('cart-count'),mobileCount=byId('mobile-cart-count'),totalEl=byId('cart-total'),itemsEl=byId('cart-items'),checkout=byId('checkout-button');
 if(countEl)countEl.textContent=count;
 if(mobileCount)mobileCount.textContent=cart.length;
 if(totalEl)totalEl.textContent=money(total);
 if(checkout)checkout.disabled=!cart.length;
 if(!itemsEl)return;
 if(!cart.length){itemsEl.innerHTML='<div class="empty-cart"><span>🛍️</span><h3>Your bag is empty</h3><p>Head to the menu and add something for the fire.</p></div>';return}
 itemsEl.innerHTML=cart.map(item=>{
  const p=products.find(product=>product.id===item.id);if(!p)return '';
  const kg=weightFor(item.amount,p.pricePerKg);
  return '<div class="cart-line"><div><h4>'+p.name+'</h4><p>'+money(p.pricePerKg)+' per kg · '+kg.toFixed(2)+' kg</p><p class="cart-line-price">'+money(item.amount)+'</p><button class="remove-item" data-remove="'+p.id+'">Remove</button></div><label><span class="sr-only">Amount in rand</span><span class="amount-input-wrap"><b>R</b><input type="number" min="1" step="1" value="'+item.amount+'" data-cart-amount="'+p.id+'"></span></label></div>';
 }).join('');
}
function openCart(){const overlay=byId('cart-overlay');if(!overlay)return;overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}
function closeCart(){const overlay=byId('cart-overlay');if(!overlay)return;overlay.classList.remove('open');overlay.setAttribute('aria-hidden','true');document.body.style.overflow=''}
document.querySelectorAll('.year').forEach(el=>el.textContent=new Date().getFullYear());
document.querySelectorAll('[data-amount]').forEach(input=>{updateWeight(input.dataset.amount);input.addEventListener('input',()=>updateWeight(input.dataset.amount))});
document.querySelectorAll('[data-add]').forEach(button=>button.addEventListener('click',()=>addProduct(button.dataset.add)));
byId('open-cart')?.addEventListener('click',openCart);byId('mobile-cart')?.addEventListener('click',openCart);byId('close-cart')?.addEventListener('click',closeCart);
byId('cart-overlay')?.addEventListener('click',event=>{if(event.target===byId('cart-overlay'))closeCart()});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeCart()});
byId('cart-items')?.addEventListener('click',event=>{const button=event.target.closest('[data-remove]');if(!button)return;cart=cart.filter(item=>item.id!==button.dataset.remove);saveCart();renderCart()});
byId('cart-items')?.addEventListener('change',event=>{const input=event.target.closest('[data-cart-amount]');if(!input)return;const amount=Number(input.value);if(!Number.isFinite(amount)||amount<=0){renderCart();return}const item=cart.find(entry=>entry.id===input.dataset.cartAmount);if(item)item.amount=Math.round(amount*100)/100;saveCart();renderCart()});
byId('checkout-button')?.addEventListener('click',()=>{if(cart.length)window.location.href='checkout.html'});
renderCart();

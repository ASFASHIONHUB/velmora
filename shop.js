const toast = document.querySelector('#cart-toast');
const bagCount = document.querySelector('#bag-count');
const cart = readSaved('velmora-cart', []);
let profile = readSaved('velmora-customer', null);
let lastTrigger = null;

function readSaved(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch (error) {
    console.error(`Unable to load ${key} from this browser.`, error);
    return fallback;
  }
}

function saveSaved(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Unable to save ${key} in this browser.`, error);
    showToast('Could not save to this browser');
    return false;
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2400);
}

function formatPrice(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function openDialog(dialog, trigger) {
  lastTrigger = trigger;
  dialog.hidden = false;
  dialog.querySelector('input, button')?.focus();
  document.body.classList.add('dialog-open');
}

function closeDialog(dialog) {
  dialog.hidden = true;
  if (document.querySelector('.shop-overlay:not([hidden])') === null) {
    document.body.classList.remove('dialog-open');
  }
  lastTrigger?.focus();
}

function setProfileForm(form, value) {
  for (const field of ['name', 'email', 'phone', 'address']) {
    const control = form.elements.namedItem(field);
    if (control) control.value = value?.[field] || '';
  }
}

function syncProfile() {
  const button = document.querySelector('#open-account');
  button.textContent = profile?.name ? `Hi, ${profile.name.split(/\s+/)[0]}` : 'Account';
  setProfileForm(document.querySelector('#profile-form'), profile);
}

function syncCart() {
  const lines = document.querySelector('#cart-lines');
  const empty = document.querySelector('#cart-empty');
  const checkoutForm = document.querySelector('#checkout-form');
  const lineCount = cart.reduce((total, item) => total + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  bagCount.textContent = String(lineCount);
  lines.replaceChildren();
  empty.hidden = cart.length > 0;
  checkoutForm.hidden = cart.length === 0;
  document.querySelector('#cart-total').textContent = formatPrice(total);

  cart.forEach(item => {
    const row = document.createElement('div');
    row.className = 'cart-line';
    const description = document.createElement('div');
    const name = document.createElement('b');
    name.textContent = item.name;
    const price = document.createElement('small');
    price.textContent = `${formatPrice(item.price)} each`;
    description.append(name, price);

    const controls = document.createElement('div');
    controls.className = 'quantity-controls';
    const decrease = document.createElement('button');
    decrease.type = 'button';
    decrease.dataset.cartAction = 'decrease';
    decrease.dataset.product = item.id;
    decrease.setAttribute('aria-label', `Remove one ${item.name}`);
    decrease.textContent = '−';
    const quantity = document.createElement('output');
    quantity.textContent = String(item.quantity);
    const increase = document.createElement('button');
    increase.type = 'button';
    increase.dataset.cartAction = 'increase';
    increase.dataset.product = item.id;
    increase.setAttribute('aria-label', `Add one ${item.name}`);
    increase.textContent = '+';
    controls.append(decrease, quantity, increase);
    row.append(description, controls);
    lines.append(row);
  });
}

document.querySelectorAll('.add-bag').forEach(button => button.addEventListener('click', () => {
  const id = button.dataset.product;
  const existing = cart.find(item => item.id === id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ id, name: id, price: Number(button.dataset.price), quantity: 1 });
  }
  if (saveSaved('velmora-cart', cart)) {
    syncCart();
    showToast(`${id} added to your bag`);
  }
}));

document.querySelector('#cart-lines').addEventListener('click', event => {
  const button = event.target.closest('button[data-cart-action]');
  if (!button) return;
  const itemIndex = cart.findIndex(item => item.id === button.dataset.product);
  if (itemIndex === -1) return;
  if (button.dataset.cartAction === 'increase') cart[itemIndex].quantity += 1;
  if (button.dataset.cartAction === 'decrease') cart[itemIndex].quantity -= 1;
  if (cart[itemIndex].quantity < 1) cart.splice(itemIndex, 1);
  if (saveSaved('velmora-cart', cart)) syncCart();
});

function filterProducts(category) {
  document.querySelectorAll('.product-card').forEach(card => {
    card.style.display = category === 'all' || card.dataset.productCategory === category ? '' : 'none';
  });
  document.querySelectorAll('.shop-filter').forEach(button => {
    button.classList.toggle('active', button.dataset.shopFilter === category);
  });
}

document.querySelectorAll('[data-shop-filter]').forEach(button => button.addEventListener('click', event => {
  const category = button.dataset.shopFilter;
  filterProducts(category);
  if (button.classList.contains('shop-filter')) event.preventDefault();
}));

const accountDialog = document.querySelector('#account-overlay');
const cartDialog = document.querySelector('#cart-overlay');
document.querySelector('#open-account').addEventListener('click', event => openDialog(accountDialog, event.currentTarget));
document.querySelector('#open-cart').addEventListener('click', event => {
  syncCart();
  setProfileForm(document.querySelector('#checkout-form'), profile);
  openDialog(cartDialog, event.currentTarget);
});

document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => {
  closeDialog(button.closest('.shop-overlay'));
}));
document.querySelectorAll('.shop-overlay').forEach(overlay => overlay.addEventListener('click', event => {
  if (event.target === overlay) closeDialog(overlay);
}));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    const open = document.querySelector('.shop-overlay:not([hidden])');
    if (open) closeDialog(open);
  }
});

document.querySelector('#profile-form').addEventListener('submit', event => {
  event.preventDefault();
  const form = event.currentTarget;
  const nextProfile = Object.fromEntries(['name', 'email', 'phone', 'address'].map(field => [
    field,
    form.elements.namedItem(field).value.trim()
  ]));
  if (!saveSaved('velmora-customer', nextProfile)) return;
  profile = nextProfile;
  syncProfile();
  setProfileForm(document.querySelector('#checkout-form'), profile);
  document.querySelector('#profile-feedback').textContent = 'Profile saved in this browser. You can edit it any time.';
});

document.querySelector('#checkout-form').addEventListener('submit', event => {
  event.preventDefault();
  if (cart.length === 0) return;
  const form = event.currentTarget;
  const customer = Object.fromEntries(['name', 'email', 'address'].map(field => [
    field,
    form.elements.namedItem(field).value.trim()
  ]));
  const order = {
    id: `VM-${Date.now().toString().slice(-8)}`,
    customer,
    items: cart.map(item => ({ ...item })),
    total: cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    placedAt: new Date().toISOString(),
    status: 'Demo order — not submitted for payment'
  };
  const orders = readSaved('velmora-demo-orders', []);
  if (!saveSaved('velmora-demo-orders', [...orders, order])) return;
  cart.splice(0, cart.length);
  if (!saveSaved('velmora-cart', cart)) return;
  syncCart();
  document.querySelector('#order-feedback').textContent = `Demo order ${order.id} saved in this browser. No payment was taken.`;
  profile = { ...profile, ...customer };
  if (saveSaved('velmora-customer', profile)) syncProfile();
});

syncProfile();
syncCart();

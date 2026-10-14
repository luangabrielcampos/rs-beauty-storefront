import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { media } from '@wix/sdk';
import { wixClient } from './wixClient';
import GlobalHeader from './components/GlobalHeader';
import Hero from './components/Hero';
import { useCart } from './context/CartContext';
const WIX_STORES_APP_ID = '215238eb-22a5-4c36-9e7b-e7c08025e04e';
const SESSION_KEY = 'rs_beauty_wix_session';
const CART_SELECTION_KEY =
  'rs_beauty_cart_variant_selections';

function getProductId(product) {
  return product?._id || product?.id;
}

function saveCartVariantSelection(
  product,
  variantId,
  options
) {
  const productId = getProductId(product);

  if (
    !productId ||
    !variantId ||
    !Object.keys(options || {}).length
  ) {
    return;
  }

  try {
    const stored = JSON.parse(
      localStorage.getItem(CART_SELECTION_KEY) ||
        '{}'
    );

    const record = {
      productId,
      variantId,
      productName: product?.name || '',
      options,
      updatedAt: Date.now(),
    };

    stored[`${productId}:${variantId}`] =
      record;

    if (product?.name) {
      stored[`name:${product.name}`] = record;
    }

    localStorage.setItem(
      CART_SELECTION_KEY,
      JSON.stringify(stored)
    );
  } catch (error) {
    console.error(
      'Could not save cart options:',
      error
    );
  }
}

function getPrice(product) {
  return (
    product?.minVariantPriceInfo?.actualPrice?.formattedAmount ||
    product?.variantSummary?.minPriceVariant?.price?.actualPrice?.formattedAmount ||
    product?.actualPriceRange?.minValue?.formattedAmount ||
    ''
  );
}

function getComparePrice(product) {
  return (
    product?.minVariantPriceInfo?.compareAtPrice?.formattedAmount ||
    product?.variantSummary?.minPriceVariant?.price?.compareAtPrice?.formattedAmount ||
    product?.compareAtPriceRange?.minValue?.formattedAmount ||
    ''
  );
}

function resolveWixImage(image) {
  const value =
    typeof image === 'string'
      ? image
      : image?.url || '';

  if (!value) return '';

  if (value.startsWith('//')) {
    return `https:${value}`;
  }

  if (/^(https?:|data:|blob:)/i.test(value)) {
    return value;
  }

  try {
    return media.getImageUrl(value)?.url || '';
  } catch (error) {
    console.error('Could not resolve Wix image:', error);
    return '';
  }
}

function getImage(product) {
  const mainImage = product?.media?.main?.image;
  const galleryImage =
    product?.media?.itemsInfo?.items?.find(
      (item) => item?.image
    )?.image;

  return (
    resolveWixImage(mainImage) ||
    resolveWixImage(galleryImage)
  );
}

function getLineItemName(item) {
  if (typeof item?.name === 'string') return item.name;

  return (
    item?.name?.translated ||
    item?.name?.original ||
    'Product'
  );
}

function getLineItemQuantity(item) {
  return (
    item?.quantityInfo?.confirmedQuantity ||
    item?.quantityInfo?.requestedQuantity ||
    1
  );
}

function getLineItemPrice(item) {
  const amount =
    item?.pricing?.totalPrice?.convertedAmount ||
    item?.pricing?.totalPrice?.amount ||
    item?.pricing?.unitPrice?.convertedAmount ||
    item?.pricing?.unitPrice?.amount;

  if (!amount) return '';

  return `$${Number(amount).toFixed(2)}`;
}

function getSubtotal(cart) {
  const amount =
    cart?.subtotal?.convertedAmount ||
    cart?.subtotal?.amount;

  if (!amount) return '$0.00';

  return `$${Number(amount).toFixed(2)}`;
}

function getVariantChoices(variant) {
  const result = {};

  for (const choice of variant?.choices || []) {
    const names = choice?.optionChoiceNames;

    if (names?.optionName && names?.choiceName) {
      result[names.optionName] = names.choiceName;
    }
  }

  return result;
}

function getAvailableVariants(product) {
  return (product?.variantsInfo?.variants || []).filter((variant) => {
    if (variant?.visible === false) return false;

    const inventory = variant?.inventoryStatus;

    if (
      inventory?.inStock === false &&
      inventory?.preorderEnabled !== true
    ) {
      return false;
    }

    return true;
  });
}

function buildOptionGroups(variants) {
  const groups = new Map();

  for (const variant of variants) {
    const choices = getVariantChoices(variant);

    for (const [optionName, choiceName] of Object.entries(choices)) {
      if (!groups.has(optionName)) {
        groups.set(optionName, new Set());
      }

      groups.get(optionName).add(choiceName);
    }
  }

  return Array.from(groups.entries()).map(([name, choices]) => ({
    name,
    choices: Array.from(choices),
  }));
}

function findMatchingVariant(variants, selectedOptions) {
  const selectedNames = Object.keys(selectedOptions);

  return variants.find((variant) => {
    const variantChoices = getVariantChoices(variant);
    const variantNames = Object.keys(variantChoices);

    if (selectedNames.length !== variantNames.length) {
      return false;
    }

    return variantNames.every(
      (optionName) =>
        selectedOptions[optionName] === variantChoices[optionName]
    );
  });
}

function createCatalogItem(product, variantId) {
  const productId = getProductId(product);

  if (!productId) {
    throw new Error('Produto sem ID válido.');
  }

  if (!variantId) {
    throw new Error('Nenhuma variante foi selecionada.');
  }

  return {
    catalogReference: {
      catalogItemId: productId,
      appId: WIX_STORES_APP_ID,
      options: {
        variantId,
      },
    },
    quantity: 1,
  };
}

function countCartItems(cart) {
  return (cart?.lineItems || []).reduce(
    (total, item) => total + getLineItemQuantity(item),
    0
  );
}

function App() {
  const {
    cartReady,
    addProductToCart,
    buyProductNow,
  } = useCart();

  const [products, setProducts] = useState([]);

  const [cart, setCart] = useState(null);
  const [cartCount, setCartCount] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);

  const [variantPicker, setVariantPicker] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [variantError, setVariantError] = useState('');

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function saveSession() {
    try {
      const tokens = wixClient.auth.getTokens();

      if (tokens) {
        localStorage.setItem(
          SESSION_KEY,
          JSON.stringify(tokens)
        );
      }
    } catch (err) {
      console.error('Erro ao salvar sessão:', err);
    }
  }

  async function initializeSession() {
    let storedTokens;

    try {
      const stored = localStorage.getItem(SESSION_KEY);

      if (stored) {
        storedTokens = JSON.parse(stored);
        wixClient.auth.setTokens(storedTokens);
      }
    } catch (err) {
      console.error('Erro ao recuperar sessão:', err);
    }

    const validTokens =
      await wixClient.auth.generateVisitorTokens(storedTokens);

    wixClient.auth.setTokens(validTokens);

    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify(validTokens)
    );
  }

  function applyCart(updatedCart) {
    const resolvedCart =
      updatedCart?.cart ||
      updatedCart ||
      null;

    setCart(resolvedCart);
    setCartCount(countCartItems(resolvedCart));

    saveSession();

    return resolvedCart;
  }

  async function loadCurrentCart() {
    try {
      const response =
        await wixClient.currentCartV2.getCurrentCart();

      return applyCart(response);
    } catch {
      setCart(null);
      setCartCount(0);

      return null;
    }
  }

  useEffect(() => {
    if (!cartReady) return;

    async function startStore() {
      try {
        const response =
          await wixClient.productsV3.queryProducts(
            {
              cursorPaging: {
                limit: 100,
              },
            },
            {
              fields: ['CURRENCY'],
            }
          );

        setProducts(response?.products || []);

      } catch (err) {
        console.error(err);

        setError(
          err?.message ||
          'Erro ao carregar a loja.'
        );
      } finally {
        setLoading(false);
      }
    }

    startStore();
  }, [cartReady]);

  async function executeProductAction(
    action,
    product,
    variantId,
    variantOptions = {}
  ) {
    if (action === 'buy') {
      await buyNow(product, variantId);
      return;
    }

    await addToCart(
      product,
      variantId,
      variantOptions
    );
  }

  async function prepareProductAction(product, action) {
    const productId = getProductId(product);

    try {
      setBusy(`prepare-${productId}`);
      setError('');
      setMessage('');
      setVariantError('');

      const fullProduct =
        await wixClient.productsV3.getProduct(
          productId,
          {
            fields: ['VARIANT_OPTION_CHOICE_NAMES'],
          }
        );

      const variants = getAvailableVariants(fullProduct);

      if (!variants.length) {
        throw new Error(
          `${product.name} não possui uma variante disponível.`
        );
      }

      const optionGroups = buildOptionGroups(variants);

      // Produto sem opções: segue direto.
      if (!optionGroups.length) {
        await executeProductAction(
          action,
          product,
          variants[0]._id,
          getVariantChoices(variants[0])
        );

        return;
      }

      // Se existir somente uma combinação possível,
      // não obriga o cliente a selecionar.
      if (variants.length === 1) {
        await executeProductAction(
          action,
          product,
          variants[0]._id,
          getVariantChoices(variants[0])
        );

        return;
      }

      // Produto possui opções reais.
      setSelectedOptions({});

      setVariantPicker({
        product,
        action,
        variants,
        optionGroups,
      });
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
        'Não foi possível carregar as opções do produto.'
      );
    } finally {
      setBusy('');
    }
  }

  function isChoiceAvailable(optionName, choiceName) {
    if (!variantPicker) return false;

    const proposedSelection = {
      ...selectedOptions,
      [optionName]: choiceName,
    };

    return variantPicker.variants.some((variant) => {
      const choices = getVariantChoices(variant);

      return Object.entries(proposedSelection).every(
        ([name, value]) => choices[name] === value
      );
    });
  }

  async function confirmVariantSelection() {
    if (!variantPicker) return;

    const requiredOptions =
      variantPicker.optionGroups.map((group) => group.name);

    const missingOption =
      requiredOptions.find(
        (name) => !selectedOptions[name]
      );

    if (missingOption) {
      setVariantError(
        `Selecione ${missingOption} para continuar.`
      );

      return;
    }

    const selectedVariant =
      findMatchingVariant(
        variantPicker.variants,
        selectedOptions
      );

    if (!selectedVariant) {
      setVariantError(
        'Essa combinação não está disponível. Escolha outra opção.'
      );

      return;
    }

    const { action, product } = variantPicker;

    const variantOptions =
      getVariantChoices(selectedVariant);

    setVariantPicker(null);
    setSelectedOptions({});
    setVariantError('');

    await executeProductAction(
      action,
      product,
      selectedVariant._id,
      variantOptions
    );
  }

  async function addToCart(
    product,
    variantId,
    variantOptions = {}
  ) {
    const key = `cart-${getProductId(product)}`;

    try {
      setBusy(key);
      setMessage('');
      setError('');

      await addProductToCart({
        productId: getProductId(product),
        variantId,
        quantity: 1,
        productName: product.name,
      });

      saveCartVariantSelection(
        product,
        variantId,
        variantOptions
      );

      setMessage(
        `${product.name} added to cart.`
      );

    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
        `Não foi possível adicionar ${product.name} ao carrinho.`
      );
    } finally {
      setBusy('');
    }
  }

  async function buyNow(product, variantId) {
    const key = `buy-${getProductId(product)}`;

    try {
      setBusy(key);
      setMessage('');
      setError('');

      await buyProductNow({
        productId: getProductId(product),
        variantId,
        quantity: 1,
      });

    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
        `Não foi possível comprar ${product.name}.`
      );

      setBusy('');
    }
  }

  async function openCart() {
    setError('');

    await loadCurrentCart();

    setCartOpen(true);
  }

  async function changeQuantity(item, difference) {
    const lineItemId = item?._id;
    const currentQuantity =
      getLineItemQuantity(item);

    const newQuantity =
      currentQuantity + difference;

    if (!lineItemId) return;

    if (newQuantity < 1) {
      await removeItem(item);
      return;
    }

    try {
      setBusy(`line-${lineItemId}`);
      setError('');

      const response =
        await wixClient.currentCartV2.updateLineItemsInCurrentCart({
          lineItems: [
            {
              lineItemId,
              quantity: {
                newQuantity,
              },
            },
          ],
        });

      applyCart(response);
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
        'Não foi possível atualizar a quantidade.'
      );
    } finally {
      setBusy('');
    }
  }

  async function removeItem(item) {
    const lineItemId = item?._id;

    if (!lineItemId) return;

    try {
      setBusy(`line-${lineItemId}`);
      setError('');

      const response =
        await wixClient.currentCartV2.removeLineItemsFromCurrentCart(
          [lineItemId]
        );

      applyCart(response);
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
        'Não foi possível remover o produto.'
      );
    } finally {
      setBusy('');
    }
  }

  async function checkoutCurrentCart() {
    try {
      setBusy('cart-checkout');
      setError('');

      const currentCart =
        await loadCurrentCart();

      if (
        !currentCart?._id ||
        !currentCart?.lineItems?.length
      ) {
        throw new Error(
          'Seu carrinho está vazio.'
        );
      }

      const checkout =
        await wixClient.cartV2.getCheckoutUrl(
          currentCart._id,
          {
            currencyCode: 'USD',
          }
        );

      if (!checkout?.checkoutUrl) {
        throw new Error(
          'O Wix não retornou a URL do checkout.'
        );
      }

      window.location.assign(
        checkout.checkoutUrl
      );
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
        'Não foi possível abrir o checkout.'
      );

      setBusy('');
    }
  }

  if (loading) {
    return (
      <div className="status-page">
        Loading RS BEAUTY...
      </div>
    );
  }

  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #ffffff;
          color: #161616;
          font-family: Arial, Helvetica, sans-serif;
        }

        button {
          font-family: inherit;
        }

        .store {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 18px 60px;
        }

        .header {
          height: 76px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #ededed;
          margin-bottom: 28px;
        }

        .logo {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: 1.5px;
        }

        .cart-indicator {
          font-size: 15px;
          font-weight: 700;
          padding: 10px 14px;
          border: 1px solid #dddddd;
          border-radius: 999px;
          background: #ffffff !important;
          color: #111111 !important;
          cursor: pointer;
        }

        .section-title {
  font-size: 28px;
  margin: 0;
  color: #111111 !important;
  opacity: 1 !important;
  font-weight: 800;
}

        .home-shop-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 18px;
          margin: 0 0 22px;
        }

        .home-view-all {
          color: #111111;
          font-size: 13px;
          font-weight: 800;
          text-decoration: none;
          border-bottom: 1px solid #111111;
          padding-bottom: 3px;
        }

        .home-view-all:hover {
          opacity: 0.65;
        }
        .notice {
          margin-bottom: 14px;
          padding: 11px 14px;
          border-radius: 8px;
          font-size: 14px;
          background: #f2fff5;
          border: 1px solid #cbeed2;
        }

        .error {
          background: #fff3f3;
          border-color: #f0c5c5;
        }

        .product-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 20px;
        }

        .product-card {
          min-width: 0;
          position: relative;
          display: flex;
          flex-direction: column;
          padding: 12px;
          border: 1px solid #ece7e3;
          border-radius: 16px;
          background: #ffffff;
          transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease;
        }

        .product-card:hover {
          transform: translateY(-4px);
          border-color: #d7cdc7;
          box-shadow: 0 16px 34px rgba(31, 23, 19, .08);
        }

        .image-box {
          position: relative;
          width: 100%;
          aspect-ratio: 1 / 1;
          overflow: hidden;
          background: #f5f5f5;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .sale-badge {
          position: absolute;
          top: 10px;
          left: 10px;
          z-index: 2;
          padding: 7px 10px;
          border-radius: 999px;
          background: #111111;
          color: #ffffff;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .8px;
          text-transform: uppercase;
        }

        .product-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .image-placeholder {
          font-size: 13px;
          font-weight: 700;
          color: #999;
          text-align: center;
          padding: 10px;
        }

        .product-name {
          margin: 12px 0 7px;
          font-size: 16px;
          line-height: 1.3;
          min-height: 41px;
        }

        .price-row {
          display: flex;
          gap: 8px;
          align-items: center;
          margin-bottom: 12px;
          min-height: 24px;
        }

        .price {
          font-size: 17px;
          font-weight: 800;
        }

        .compare-price {
          color: #888;
          font-size: 13px;
          text-decoration: line-through;
        }

        .actions {
          display: flex;
          flex-direction: column;
          gap: 7px;
          margin-top: auto;
        }

        .action-button {
          width: 100%;
          min-height: 42px;
          border-radius: 7px;
          cursor: pointer;
          font-weight: 700;
          font-size: 14px;
        }

        .action-button:disabled {
          opacity: .55;
          cursor: wait;
        }

        .buy-button {
          border: 1px solid #111;
          background: #111;
          color: #fff;
        }

        .cart-button {
          border: 1px solid #111;
          background: #fff;
          color: #111;
        }

        .cart-overlay,
        .variant-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, .40);
        }

        .cart-overlay {
          z-index: 1000;
        }

        .cart-drawer {
          position: fixed;
          right: 0;
          top: 0;
          bottom: 0;
          width: min(430px, 100%);
          background: white;
          z-index: 1001;
          display: flex;
          flex-direction: column;
          box-shadow: -8px 0 30px rgba(0,0,0,.12);
        }

        .drawer-header {
          height: 72px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          border-bottom: 1px solid #eee;
        }

        .drawer-header h2 {
          margin: 0;
          font-size: 21px;
          font-weight: 800;
          color: #111111 !important;
        }

        .close-cart {
          border: 0;
          background: transparent !important;
          color: #111111 !important;
          font-size: 28px;
          cursor: pointer;
        }

        .drawer-items {
          flex: 1;
          overflow-y: auto;
          padding: 8px 20px;
        }

        .empty-cart {
          text-align: center;
          color: #777;
          padding: 70px 10px;
        }

        .drawer-item {
          padding: 18px 0;
          border-bottom: 1px solid #ededed;
        }

        .drawer-item-name {
          font-size: 15px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .drawer-item-price {
          font-size: 14px;
          margin-bottom: 12px;
        }

        .quantity-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .quantity-controls {
          display: flex;
          align-items: center;
          border: 1px solid #ccc;
          border-radius: 7px;
          overflow: hidden;
        }

        .qty-button {
          width: 34px;
          height: 34px;
          background: #ffffff !important;
          color: #111111 !important;
          border: 0;
          cursor: pointer;
          font-size: 18px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .qty-value {
          width: 38px;
          text-align: center;
          font-weight: 700;
        }

        .remove-button {
          background: transparent !important;
          color: #111111 !important;
          border: 0;
          text-decoration: underline;
          cursor: pointer;
          font-size: 12px;
        }

        .drawer-footer {
          border-top: 1px solid #ddd;
          padding: 18px 20px 22px;
          background: white;
        }

        .subtotal-row {
          display: flex;
          justify-content: space-between;
          font-size: 17px;
          font-weight: 800;
          margin-bottom: 16px;
        }

        .drawer-checkout,
        .variant-confirm {
          width: 100%;
          min-height: 48px;
          border: 1px solid #111;
          border-radius: 7px;
          background: #111;
          color: white;
          font-weight: 800;
          cursor: pointer;
        }

        .continue-shopping {
          width: 100%;
          min-height: 44px;
          margin-top: 8px;
          border: 1px solid #111;
          border-radius: 7px;
          background: white;
          color: #111;
          font-weight: 700;
          cursor: pointer;
        }

        .variant-overlay {
          z-index: 1200;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
        }

        .variant-modal {
          width: min(470px, 100%);
          max-height: 90vh;
          overflow-y: auto;
          background: #fff;
          border-radius: 14px;
          padding: 24px;
          box-shadow: 0 20px 60px rgba(0,0,0,.25);
        }

        .variant-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 22px;
        }

        .variant-modal-header h2 {
          margin: 0;
          font-size: 21px;
        }

        .variant-modal-header p {
          margin: 6px 0 0;
          color: #666;
          font-size: 13px;
        }

        .variant-close {
          border: 0;
          background: transparent;
          color: #111;
          font-size: 28px;
          cursor: pointer;
        }

        .variant-option {
          margin-bottom: 20px;
        }

        .variant-option-label {
          display: block;
          margin-bottom: 9px;
          font-size: 14px;
          font-weight: 800;
        }

        .choice-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .choice-button {
          min-width: 58px;
          min-height: 40px;
          padding: 8px 14px;
          border: 1px solid #bbb;
          border-radius: 7px;
          background: #fff;
          color: #111;
          font-weight: 700;
          cursor: pointer;
        }

        .choice-button.selected {
          background: #111;
          border-color: #111;
          color: #fff;
        }

        .choice-button:disabled {
          opacity: .30;
          cursor: not-allowed;
        }

        .variant-error {
          margin: 0 0 14px;
          padding: 10px;
          background: #fff2f2;
          color: #a00000;
          border-radius: 7px;
          font-size: 13px;
        }

        .status-page {
          min-height: 100vh;
          display: grid;
          place-items: center;
        }

        .premium-header {
  width: 100%;
  background: #ffffff;
  border-bottom: 1px solid #eeeeee;
  position: sticky;
  top: 0;
  z-index: 900;
}

.premium-header-inner {
  max-width: 1280px;
  height: 74px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 30px;
}

.premium-logo {
  color: #111111;
  text-decoration: none;
  font-size: 23px;
  font-weight: 900;
  letter-spacing: 1.8px;
  justify-self: start;
}

.desktop-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;
}

.desktop-nav a {
  color: #111111;
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
}

.desktop-nav a:hover {
  opacity: 0.6;
}

.header-actions {
  justify-self: end;
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon-button {
  width: 40px;
  height: 40px;
  border: 0;
  background: transparent;
  color: #111111;
  font-size: 21px;
  cursor: pointer;
}

.header-cart-button {
  min-height: 40px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #111111;
  border-radius: 999px;
  padding: 0 14px;
  background: #ffffff;
  color: #111111;
  font-weight: 700;
  cursor: pointer;
}

.header-cart-count {
  min-width: 21px;
  height: 21px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #111111;
  color: #ffffff;
  font-size: 11px;
  font-weight: 800;
}
.premium-hero {
  min-height: 560px;
  margin: 24px 0 55px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  overflow: hidden;
  border-radius: 20px;
  background: #f4f0ed;
}

.premium-hero-content {
  padding: 70px 60px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
}

.hero-eyebrow {
  margin-bottom: 18px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 3px;
  color: #6d625e;
}

.hero-title {
  max-width: 560px;
  margin: 0;
  color: #111111;
  font-size: clamp(42px, 5vw, 68px);
  line-height: 0.98;
  letter-spacing: -2.5px;
  font-weight: 800;
}

.hero-description {
  max-width: 500px;
  margin: 25px 0 0;
  color: #59514d;
  font-size: 17px;
  line-height: 1.6;
}

.hero-actions {
  margin-top: 32px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.hero-primary-button,
.hero-secondary-button {
  min-height: 48px;
  padding: 0 23px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  font-size: 14px;
  font-weight: 800;
  transition: 0.2s ease;
}

.hero-primary-button {
  background: #111111;
  border: 1px solid #111111;
  color: #ffffff;
}

.hero-secondary-button {
  background: transparent;
  border: 1px solid #111111;
  color: #111111;
}

.hero-primary-button:hover,
.hero-secondary-button:hover {
  transform: translateY(-2px);
}

.hero-trust {
  margin-top: 35px;
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  color: #554e4a;
  font-size: 12px;
  font-weight: 700;
}

.premium-hero-visual {
  min-height: 560px;
  padding: 22px;
}

.hero-image-placeholder {
  width: 100%;
  height: 100%;
  min-height: 516px;
  border-radius: 16px;
  background:
    radial-gradient(
      circle at 50% 40%,
      #e1cbc2 0%,
      #ccb3aa 35%,
      #a98e85 100%
    );
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  text-align: center;
}

.hero-image-placeholder span {
  font-size: 34px;
  font-weight: 900;
  letter-spacing: 4px;
}

.hero-image-placeholder small {
  margin-top: 8px;
  font-size: 13px;
  letter-spacing: 1px;
}.hero-main-image {
  width: 100%;
  height: 100%;
  min-height: 516px;
  display: block;
  object-fit: cover;
  object-position: center;
  border-radius: 16px;
}

.conversion-section {
  margin: 76px 0 0;
}

html {
  scroll-behavior: smooth;
}

#shop,
#faq {
  scroll-margin-top: 96px;
}

.conversion-section-heading {
  max-width: 760px;
  margin: 0 auto 34px;
  text-align: center;
}

.conversion-kicker {
  display: block;
  margin-bottom: 12px;
  color: #765f55;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 2.4px;
  text-transform: uppercase;
}

.conversion-title {
  margin: 0;
  color: #111111 !important;
  opacity: 1 !important;
  visibility: visible !important;
  font-size: clamp(32px, 4.5vw, 54px);
  line-height: 1.02;
  letter-spacing: -2px;
}

.conversion-copy {
  max-width: 650px;
  margin: 18px auto 0;
  color: #625953;
  font-size: 16px;
  line-height: 1.7;
}

.conversion-benefits {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.conversion-benefit {
  min-height: 190px;
  padding: 25px 22px;
  border: 1px solid #e8dfda;
  border-radius: 17px;
  background: #fbf8f6;
}

.conversion-benefit-number {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  margin-bottom: 30px;
  border-radius: 50%;
  background: #111111;
  color: #ffffff;
  font-size: 11px;
  font-weight: 900;
}

.conversion-benefit h3 {
  margin: 0 0 9px;
  color: #111111;
  font-size: 17px;
}

.conversion-benefit p {
  margin: 0;
  color: #6a605b;
  font-size: 13px;
  line-height: 1.6;
}

.conversion-editorial {
  display: grid;
  grid-template-columns: 1.05fr .95fr;
  gap: 18px;
}

.conversion-editorial-panel {
  min-height: 380px;
  padding: 50px;
  border-radius: 20px;
  background: #171412;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
}

.conversion-editorial-panel .conversion-kicker {
  color: #d5b9ab;
}

.conversion-editorial-panel h2 {
  max-width: 560px;
  margin: 0;
  color: #ffffff !important;
  opacity: 1 !important;
  visibility: visible !important;
  font-size: clamp(34px, 4.5vw, 58px);
  line-height: .98;
  letter-spacing: -2px;
}

.conversion-editorial-panel p {
  max-width: 540px;
  margin: 22px 0 0;
  color: #d8d0cc;
  font-size: 15px;
  line-height: 1.7;
}

.conversion-primary-link,
.conversion-secondary-link {
  min-height: 48px;
  padding: 0 22px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  font-size: 13px;
  font-weight: 900;
}

.conversion-primary-link {
  margin-top: 28px;
  background: #ffffff;
  color: #111111;
}

.conversion-secondary-link {
  border: 1px solid #111111;
  background: transparent;
  color: #111111;
}

.conversion-checklist {
  padding: 42px;
  border-radius: 20px;
  background: #f3ebe6;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.conversion-checklist h3 {
  margin: 0 0 22px;
  font-size: 24px;
}

.conversion-check {
  display: grid;
  grid-template-columns: 34px 1fr;
  gap: 13px;
  padding: 17px 0;
  border-top: 1px solid rgba(94, 72, 61, .17);
}

.conversion-check:first-of-type {
  border-top: 0;
}

.conversion-check-icon {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #ffffff;
  color: #111111;
  font-weight: 900;
}

.conversion-check strong,
.conversion-check span {
  display: block;
}

.conversion-check strong {
  margin-bottom: 4px;
  font-size: 14px;
}

.conversion-check span {
  color: #6d6059;
  font-size: 12px;
  line-height: 1.5;
}

.conversion-faq {
  display: grid;
  grid-template-columns: .78fr 1.22fr;
  gap: 70px;
  padding: 66px 58px;
  border: 1px solid #e7dfda;
  border-radius: 20px;
  background: #ffffff;
}

.conversion-faq-intro h2 {
  margin: 0;
  color: #111111 !important;
  opacity: 1 !important;
  visibility: visible !important;
  font-size: clamp(32px, 4vw, 48px);
  line-height: 1;
  letter-spacing: -1.8px;
}

.conversion-faq-intro p {
  margin: 18px 0 0;
  color: #6a605b;
  font-size: 14px;
  line-height: 1.7;
}

.conversion-faq-list details {
  border-bottom: 1px solid #e8e1dc;
}

.conversion-faq-list summary {
  padding: 20px 32px 20px 0;
  color: #111111;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
}

.conversion-faq-list details p {
  margin: -4px 0 20px;
  color: #6a605b;
  font-size: 13px;
  line-height: 1.65;
}

.conversion-closing {
  padding: 72px 30px;
  border-radius: 20px;
  background: linear-gradient(135deg, #f2e8e2, #e7d5cc);
  text-align: center;
}

.conversion-closing h2 {
  max-width: 800px;
  margin: 0 auto;
  color: #111111 !important;
  opacity: 1 !important;
  visibility: visible !important;
  font-size: clamp(36px, 5.2vw, 66px);
  line-height: .98;
  letter-spacing: -2.4px;
}

.conversion-closing p {
  max-width: 630px;
  margin: 20px auto 0;
  color: #655851;
  font-size: 15px;
  line-height: 1.7;
}

.conversion-closing-actions {
  margin-top: 28px;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
}

.conversion-closing .conversion-primary-link {
  margin-top: 0;
  background: #111111;
  color: #ffffff;
}

.home-footer {
  margin: 70px 0 0;
  padding: 34px 0 0;
  border-top: 1px solid #e9e3df;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 30px;
}

.home-footer-brand strong {
  display: block;
  color: #111111;
  font-size: 20px;
  letter-spacing: 2px;
}

.home-footer-brand span {
  display: block;
  margin-top: 9px;
  color: #716761;
  font-size: 12px;
}

.home-footer-links {
  display: flex;
  flex-wrap: wrap;
  gap: 22px;
}

.home-footer-links a {
  color: #111111;
  font-size: 12px;
  font-weight: 800;
  text-decoration: none;
}

@media (max-width: 640px) {
  .hero-main-image {
    min-height: 350px;
    object-position: center;
  }
}

@media (max-width: 900px) {
          .product-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {.premium-hero {
  min-height: auto;
  margin: 12px 0 32px;
  grid-template-columns: 1fr;
  border-radius: 14px;
}

.premium-hero-content {
  padding: 38px 20px 30px;
}

.hero-eyebrow {
  margin-bottom: 13px;
  font-size: 10px;
}

.hero-title {
  font-size: 38px;
  line-height: 1;
  letter-spacing: -1.5px;
}

.hero-description {
  margin-top: 18px;
  font-size: 14px;
  line-height: 1.55;
}

.hero-actions {
  width: 100%;
  margin-top: 24px;
  flex-direction: column;
}

.hero-primary-button,
.hero-secondary-button {
  width: 100%;
}

.hero-trust {
  margin-top: 24px;
  gap: 10px;
  font-size: 10px;
}

.premium-hero-visual {
  min-height: 360px;
  padding: 0 12px 12px;
}

.hero-image-placeholder {
  min-height: 350px;
}

.hero-image-placeholder span {
  font-size: 25px;
}
          .store {
            padding: 0 10px 40px;
          }

          .header {
            height: 62px;
            margin-bottom: 18px;
          }

          .logo {
            font-size: 18px;
          }

          .cart-indicator {
            font-size: 12px;
            padding: 8px 10px;
          }

          .section-title {
            font-size: 20px;
          }

          .home-shop-heading {
            margin-bottom: 14px;
          }

          .home-view-all {
            font-size: 11px;
          }

          .product-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 11px;
          }

          .product-card {
            padding: 7px;
            border-radius: 12px;
          }

          .product-card:hover {
            transform: none;
            box-shadow: none;
          }

          .sale-badge {
            top: 7px;
            left: 7px;
            padding: 6px 8px;
            font-size: 8px;
          }

          .product-name {
  margin: 12px 0 7px;
  font-size: 16px;
  line-height: 1.3;
  min-height: 41px;
  color: #111111 !important;
  opacity: 1 !important;
  font-weight: 700;
}

          .price {
            font-size: 14px;
          }

          .compare-price {
            font-size: 11px;
          }

          .action-button {
            min-height: 38px;
            padding: 7px 4px;
            font-size: 11px;
          }

          .cart-drawer {
            width: 100%;
          }

          .variant-modal {
            padding: 20px 16px;
          }
        .premium-header-inner {
  height: 62px;
  grid-template-columns: 1fr auto;
  gap: 8px;
}

.premium-logo {
  font-size: 18px;
}

.desktop-nav {
  display: none;
}

.header-icon-button {
  display: none;
}

.header-cart-button {
  min-height: 36px;
  padding: 0 11px;
  font-size: 12px;
}

.header-cart-count {
  min-width: 19px;
  height: 19px;
  font-size: 10px;
}

}

@media (max-width: 760px) {
  .conversion-section {
    margin-top: 52px;
  }

  .conversion-section-heading {
    margin-bottom: 24px;
  }

  .conversion-kicker {
    font-size: 9px;
  }

  .conversion-title {
    font-size: 34px;
    letter-spacing: -1.4px;
  }

  .conversion-copy {
    font-size: 14px;
  }

  .conversion-benefits {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 9px;
  }

  .conversion-benefit {
    min-height: 178px;
    padding: 19px 15px;
  }

  .conversion-benefit-number {
    margin-bottom: 24px;
  }

  .conversion-benefit h3 {
    font-size: 15px;
  }

  .conversion-benefit p {
    font-size: 11px;
  }

  .conversion-editorial,
  .conversion-faq {
    grid-template-columns: 1fr;
  }

  .conversion-editorial-panel {
    min-height: 390px;
    padding: 34px 24px;
  }

  .conversion-editorial-panel h2 {
    font-size: 41px;
  }

  .conversion-checklist {
    padding: 28px 22px;
  }

  .conversion-faq {
    gap: 28px;
    padding: 38px 22px;
  }

  .conversion-closing {
    padding: 52px 20px;
  }

  .conversion-closing h2 {
    font-size: 42px;
  }

  .conversion-closing-actions {
    flex-direction: column;
  }

  .conversion-closing-actions a {
    width: 100%;
  }

  .home-footer {
    margin-top: 52px;
    flex-direction: column;
  }
}
   `}</style>

      <main className="store">
       <GlobalHeader />

<Hero />

        <div className="home-shop-heading">
          <h1 className="section-title">
            Featured Products
          </h1>

          <Link
            className="home-view-all"
            to="/shop"
          >
            View All Products →
          </Link>
        </div>

        {message && (
          <div className="notice">
            {message}
          </div>
        )}

        {error && (
          <div className="notice error">
            {error}
          </div>
        )}

<section
  id="shop"
  className="product-grid"
>

          {products.slice(0, 8).map((product) => {
            const id = getProductId(product);
            const image = getImage(product);
            const price = getPrice(product);
            const comparePrice = getComparePrice(product);

            return (
              <article
  className="product-card"
  key={id}
>
  <Link
    to={`/product/${id}`}
    style={{
      display: 'block',
      color: 'inherit',
      textDecoration: 'none',
    }}
  >
    <div className="image-box">
      {comparePrice && comparePrice !== price && (
        <span className="sale-badge">
          Special price
        </span>
      )}

      {image ? (
        <img
          src={image}
          alt={product.name}
          className="product-image"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="image-placeholder">
          {product.name}
        </div>
      )}
    </div>
  </Link>

  <Link
    to={`/product/${id}`}
    style={{
      display: 'block',
      color: 'inherit',
      textDecoration: 'none',
    }}
  >
    <h2
      className="product-name"
      style={{
        color: '#111111',
        opacity: 1,
        fontWeight: 700,
        visibility: 'visible',
      }}
    >
      {product.name}
    </h2>
  </Link>
                <div className="price-row">
                  <span className="price">
                    {price}
                  </span>

                  {comparePrice &&
                    comparePrice !== price && (
                      <span className="compare-price">
                        {comparePrice}
                      </span>
                    )}
                </div>

                <div className="actions">
                  <button
                    className="action-button buy-button"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      prepareProductAction(product, 'buy')
                    }
                  >
                    {busy === `buy-${id}` ||
                    busy === `prepare-${id}`
                      ? 'Loading...'
                      : 'Buy Now'}
                  </button>

                  <button
                    className="action-button cart-button"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      prepareProductAction(product, 'cart')
                    }
                  >
                    {busy === `cart-${id}` ||
                    busy === `prepare-${id}`
                      ? 'Loading...'
                      : 'Add to Cart'}
                  </button>
                </div>
              </article>
            );
          })}
        </section>

        <section
          className="conversion-section"
          aria-labelledby="confidence-title"
        >
          <div className="conversion-section-heading">
            <span className="conversion-kicker">
              Confidence at every step
            </span>

            <h2
              id="confidence-title"
              className="conversion-title"
            >
              Beauty shopping made beautifully simple.
            </h2>

            <p className="conversion-copy">
              Thoughtful products, clear choices and a secure
              checkout experience designed to help you shop
              without second-guessing.
            </p>
          </div>

          <div className="conversion-benefits">
            <article className="conversion-benefit">
              <span className="conversion-benefit-number">01</span>
              <h3>Carefully selected</h3>
              <p>
                A focused collection chosen to complement real
                beauty, hair and self-care routines.
              </p>
            </article>

            <article className="conversion-benefit">
              <span className="conversion-benefit-number">02</span>
              <h3>Clear product choices</h3>
              <p>
                Available sizes, colors and combinations are
                shown before a product enters your bag.
              </p>
            </article>

            <article className="conversion-benefit">
              <span className="conversion-benefit-number">03</span>
              <h3>Secure Wix checkout</h3>
              <p>
                Your order moves through a protected commerce
                checkout with payment options based on location.
              </p>
            </article>

            <article className="conversion-benefit">
              <span className="conversion-benefit-number">04</span>
              <h3>Transparent totals</h3>
              <p>
                Products, quantities and order totals remain
                visible before you complete your purchase.
              </p>
            </article>
          </div>
        </section>

        <section className="conversion-section conversion-editorial">
          <div className="conversion-editorial-panel">
            <span className="conversion-kicker">
              The RS BEAUTY™ standard
            </span>

            <h2>
              More intention in every routine.
            </h2>

            <p>
              We bring together beauty essentials that feel
              practical, elevated and easy to make part of your
              everyday care.
            </p>

            <a
              className="conversion-primary-link"
              href="#shop"
            >
              Shop the collection →
            </a>
          </div>

          <div className="conversion-checklist">
            <h3>Designed around your experience</h3>

            <div className="conversion-check">
              <span className="conversion-check-icon">✓</span>
              <div>
                <strong>Shop at your pace</strong>
                <span>
                  Compare products and review your bag before checkout.
                </span>
              </div>
            </div>

            <div className="conversion-check">
              <span className="conversion-check-icon">✓</span>
              <div>
                <strong>International-ready checkout</strong>
                <span>
                  Available destinations and delivery details are
                  confirmed during checkout.
                </span>
              </div>
            </div>

            <div className="conversion-check">
              <span className="conversion-check-icon">✓</span>
              <div>
                <strong>One consistent bag</strong>
                <span>
                  Products and selected options stay together as you browse.
                </span>
              </div>
            </div>
          </div>
        </section>

        <section
          id="faq"
          className="conversion-section conversion-faq"
          aria-labelledby="faq-title"
        >
          <div className="conversion-faq-intro">
            <span className="conversion-kicker">
              Shopping questions
            </span>

            <h2 id="faq-title">
              Everything clear before checkout.
            </h2>

            <p>
              Quick answers to the questions customers commonly
              check before placing an international order.
            </p>
          </div>

          <div className="conversion-faq-list">
            <details>
              <summary>Which currency is used?</summary>
              <p>
                Store prices are displayed in USD unless a product
                or checkout page explicitly states otherwise.
              </p>
            </details>

            <details>
              <summary>Do you offer international delivery?</summary>
              <p>
                Destination availability, delivery methods and any
                applicable shipping cost are confirmed during checkout.
              </p>
            </details>

            <details>
              <summary>How do I choose a product option?</summary>
              <p>
                Select the required size, color or variation before
                adding the item. Unavailable combinations are disabled.
              </p>
            </details>

            <details>
              <summary>Is checkout secure?</summary>
              <p>
                Orders are completed through Wix's secure commerce
                checkout. Available payment methods can vary by location.
              </p>
            </details>
          </div>
        </section>

        <section className="conversion-section conversion-closing">
          <span className="conversion-kicker">
            Your next ritual starts here
          </span>

          <h2>
            Find the products that feel made for your routine.
          </h2>

          <p>
            Explore the RS BEAUTY™ collection and choose what makes
            everyday care feel more considered, confident and yours.
          </p>

          <div className="conversion-closing-actions">
            <a
              className="conversion-primary-link"
              href="#shop"
            >
              Shop featured products
            </a>

            <Link
              className="conversion-secondary-link"
              to="/shop"
            >
              View all products
            </Link>
          </div>
        </section>

        <footer className="home-footer">
          <div className="home-footer-brand">
            <strong>RS BEAUTY™</strong>
            <span>
              Curated beauty technology for routines around the world.
            </span>
          </div>

          <nav
            className="home-footer-links"
            aria-label="Footer navigation"
          >
            <Link to="/">Home</Link>
            <Link to="/shop">Shop</Link>
            <a href="#faq">FAQ</a>
          </nav>
        </footer>
      </main>

      {cartOpen && (
        <>
          <div
            className="cart-overlay"
            onClick={() => setCartOpen(false)}
          />

          <aside className="cart-drawer">
            <div className="drawer-header">
              <h2>
                Your Cart ({cartCount})
              </h2>

              <button
                className="close-cart"
                onClick={() => setCartOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="drawer-items">
              {!cart?.lineItems?.length ? (
                <div className="empty-cart">
                  Your cart is empty.
                </div>
              ) : (
                cart.lineItems.map((item) => {
                  const quantity =
                    getLineItemQuantity(item);

                  return (
                    <div
                      className="drawer-item"
                      key={item._id}
                    >
                      <div className="drawer-item-name">
                        {getLineItemName(item)}
                      </div>

                      <div className="drawer-item-price">
                        {getLineItemPrice(item)}
                      </div>

                      <div className="quantity-row">
                        <div className="quantity-controls">
                          <button
                            className="qty-button"
                            disabled={
                              busy === `line-${item._id}`
                            }
                            onClick={() =>
                              changeQuantity(item, -1)
                            }
                          >
                            −
                          </button>

                          <span className="qty-value">
                            {quantity}
                          </span>

                          <button
                            className="qty-button"
                            disabled={
                              busy === `line-${item._id}`
                            }
                            onClick={() =>
                              changeQuantity(item, 1)
                            }
                          >
                            +
                          </button>
                        </div>

                        <button
                          className="remove-button"
                          disabled={
                            busy === `line-${item._id}`
                          }
                          onClick={() =>
                            removeItem(item)
                          }
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="drawer-footer">
              <div className="subtotal-row">
                <span>Subtotal</span>

                <span>
                  {getSubtotal(cart)}
                </span>
              </div>

              <button
                className="drawer-checkout"
                disabled={
                  !cart?.lineItems?.length ||
                  busy === 'cart-checkout'
                }
                onClick={checkoutCurrentCart}
              >
                {busy === 'cart-checkout'
                  ? 'Loading...'
                  : 'Checkout'}
              </button>

              <button
                className="continue-shopping"
                onClick={() =>
                  setCartOpen(false)
                }
              >
                Continue Shopping
              </button>
            </div>
          </aside>
        </>
      )}

      {variantPicker && (
        <div className="variant-overlay">
          <div className="variant-modal">
            <div className="variant-modal-header">
              <div>
                <h2>
                  {variantPicker.product.name}
                </h2>

                <p>
                  Choose your options
                </p>
              </div>

              <button
                className="variant-close"
                onClick={() => {
                  setVariantPicker(null);
                  setSelectedOptions({});
                  setVariantError('');
                }}
              >
                ×
              </button>
            </div>

            {variantPicker.optionGroups.map((group) => (
              <div
                className="variant-option"
                key={group.name}
              >
                <span className="variant-option-label">
                  {group.name}
                </span>

                <div className="choice-list">
                  {group.choices.map((choice) => {
                    const selected =
                      selectedOptions[group.name] === choice;

                    const available =
                      isChoiceAvailable(
                        group.name,
                        choice
                      );

                    return (
                      <button
                        key={choice}
                        className={
                          selected
                            ? 'choice-button selected'
                            : 'choice-button'
                        }
                        disabled={!available}
                        onClick={() => {
                          setVariantError('');

                          setSelectedOptions(
                            (current) => ({
                              ...current,
                              [group.name]: choice,
                            })
                          );
                        }}
                      >
                        {choice}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {variantError && (
              <div className="variant-error">
                {variantError}
              </div>
            )}

            <button
              className="variant-confirm"
              onClick={confirmVariantSelection}
            >
              {variantPicker.action === 'buy'
                ? 'Buy Now'
                : 'Add to Cart'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default App;

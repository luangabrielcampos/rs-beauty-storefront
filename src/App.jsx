import { getStoreCheckoutUrl } from './checkoutRedirect.js';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { media } from '@wix/sdk';
import { wixClient } from './wixClient';
import GlobalHeader from './components/GlobalHeader';
import Hero from './components/Hero';
import explorePremium from './assets/categories/explore-premium.png';
import hairCategory from './assets/categories/hair.png';
import skinCategory from './assets/categories/skin.png';
import faceCategory from './assets/categories/face.png';
import lipsCategory from './assets/categories/lips.png';
import nailsCategory from './assets/categories/nails.png';
import bodyMassageCategory from './assets/categories/body-massage.png';

import { useCart } from './context/CartContext';
const WIX_STORES_APP_ID = '215238eb-22a5-4c36-9e7b-e7c08025e04e';
const SESSION_KEY = 'rs_beauty_wix_session';
const CART_SELECTION_KEY =
  'rs_beauty_cart_variant_selections';

function getProductId(product) {
  return product?._id || product?.id;
}

function getCartImage(product) {
  const mainMedia = product?.media?.main;
  const firstMedia =
    product?.media?.itemsInfo?.items?.[0];

  return (
    mainMedia?.image ||
    mainMedia?.url ||
    mainMedia?._id ||
    mainMedia?.uploadId ||
    firstMedia?.image ||
    firstMedia?.url ||
    firstMedia?._id ||
    firstMedia?.uploadId ||
    ''
  );
}



function saveCartVariantSelection(
  product,
  variantId,
  options
) {
  const productId = getProductId(product);

  if (
  !productId ||
  !variantId
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
  options: options || {},
  image: getCartImage(product),
  updatedAt: Date.now(),
};

    stored[`${productId}:${variantId}`] = record;

stored[`product:${productId}`] = record;

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
      filter: {
        visible: true,
      },
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
                 fields: [
           'VARIANT_OPTION_CHOICE_NAMES',
          'MEDIA_ITEMS_INFO',
  ],
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
          fullProduct,
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
        product: fullProduct,
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
        await getStoreCheckoutUrl(currentCart._id);

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

@media (min-width: 769px) {
  .product-grid.product-grid--single {
    grid-template-columns: minmax(0, 340px);
    justify-content: center;
  }
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

..conversion-section {
  margin: 48px 0 0;
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
  grid-template-columns: 1fr;
  gap: 0;
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
  width: 100%;
  padding: 20px 32px 20px 0;
  box-sizing: border-box;
  color: #111111;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
  text-align: left;
}
.conversion-faq-list details p {
  margin: -4px 0 20px;
  color: #6a605b;
  font-size: 13px;
  line-height: 1.65;
  text-align: left;
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

.home-categories {
  width: min(1180px, calc(100% - 44px));
  margin: 76px auto 72px;
}

.home-categories-header {
  margin-bottom: 28px;
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 24px;
}

.home-categories-eyebrow {
  display: block;
  margin-bottom: 10px;
  color: #73645f;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 2.6px;
}

.home-categories-header h2 {
  max-width: 620px;
  margin: 0;
  color: #111111;
  font-size: clamp(30px, 4vw, 48px);
  font-weight: 900;
  line-height: 1.02;
  letter-spacing: -1.8px;
}

.home-categories-view-all {
  padding-bottom: 4px;
  border-bottom: 1px solid #111111;
  color: #111111;
  font-size: 13px;
  font-weight: 800;
  text-decoration: none;
}

.home-categories-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.home-category-card {
  min-height: 230px;
  padding: 26px;
  border: 1px solid #e8dfda;
  border-radius: 18px;
  background: #f8f4f1;
  color: #111111;
  text-decoration: none;

  display: flex;
  flex-direction: column;

  transition:
    transform 0.25s ease,
    border-color 0.25s ease,
    background 0.25s ease;
}

.home-category-card:hover {
  transform: translateY(-4px);
  border-color: #cfc0b8;
  background: #f4eeea;
}

.home-category-card > span {
  margin-bottom: auto;
  color: #9b8d87;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1.8px;
}

.home-category-card h3 {
  margin: 32px 0 7px;
  color: #111111;
  font-size: 26px;
  font-weight: 900;
  letter-spacing: -0.8px;
}

.home-category-card p {
  margin: 0 0 18px;
  max-width: 240px;
  color: #5c5552;
  font-size: 13px;
  line-height: 1.5;
}

.home-category-card strong {
  color: #111111;
  font-size: 12px;
  font-weight: 900;
}

@media (max-width: 640px) {
  .home-categories {
    width: calc(100% - 24px);
    margin: 42px auto 44px;
  }

  .home-categories-header {
    margin-bottom: 18px;
    align-items: flex-end;
  }

  .home-categories-eyebrow {
    margin-bottom: 7px;
    font-size: 8px;
    letter-spacing: 2px;
  }

  .home-categories-header h2 {
    max-width: 270px;
    font-size: 27px;
    letter-spacing: -1px;
  }

  .home-categories-view-all {
    font-size: 11px;
    white-space: nowrap;
  }

  .home-categories-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 9px;
  }

  .home-category-card {
    min-height: 178px;
    padding: 16px;
    border-radius: 14px;
  }

  .home-category-card h3 {
    margin-top: 24px;
    font-size: 19px;
    letter-spacing: -0.4px;
  }

  .home-category-card p {
    margin-bottom: 12px;
    font-size: 10px;
    line-height: 1.45;
  }

  .home-category-card strong {
    font-size: 10px;
  }
}

/* PREMIUM VISUAL CATEGORY CARDS */

.home-category-card--visual {
  position: relative;
  min-height: 0;
  aspect-ratio: 4 / 5;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 18px;
  background: #f8f4f1;
  isolation: isolate;
}

.home-category-card--visual:hover {
  transform: translateY(-4px);
  border-color: transparent;
  background: #f8f4f1;
}

.home-category-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  z-index: 0;
  transition: transform 0.45s ease;
}

.home-category-card--visual:hover .home-category-image {
  transform: scale(1.035);
}

.home-category-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  background:
    linear-gradient(
      180deg,
      rgba(17, 17, 17, 0.02) 35%,
      rgba(17, 17, 17, 0.18) 65%,
      rgba(17, 17, 17, 0.78) 100%
    );
}

.home-category-content {
  position: absolute;
  left: 22px;
  right: 22px;
  bottom: 20px;
  z-index: 2;

  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.home-category-card--visual .home-category-content h3 {
  margin: 0;
  color: #ffffff;
  font-size: 25px;
  font-weight: 900;
  line-height: 1;
  letter-spacing: -0.7px;
}

.home-category-content span {
  flex-shrink: 0;
  color: #ffffff;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.15px;
}

@media (max-width: 640px) {
  .home-category-card--visual {
    min-height: 0;
    padding: 0;
    aspect-ratio: 4 / 5;
    border-radius: 14px;
  }

  .home-category-content {
    left: 13px;
    right: 13px;
    bottom: 13px;
    display: block;
  }

  .home-category-card--visual .home-category-content h3 {
    margin: 0 0 5px;
    font-size: 18px;
    line-height: 1.05;
    letter-spacing: -0.4px;
  }

  .home-category-content span {
    font-size: 9px;
  }
}

/* PREMIUM FEATURED PRODUCT CARDS */

.product-card {
  overflow: hidden;
  border: 1px solid #ebe2dd;
  border-radius: 14px;
  background: #ffffff;
}

.product-card .image-box {
  position: relative;
  overflow: hidden;
  aspect-ratio: 1 / 1.08;
  border-radius: 12px;
  background: #f8f4f1;
}

.product-card .product-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s ease;
}

.product-card:hover .product-image {
  transform: scale(1.025);
}

.product-card .sale-badge {
  position: absolute;
  top: 9px;
  left: 9px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  background: #111111;
  color: #ffffff;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.5px;
}

.product-card .product-name {
  margin: 11px 9px 8px;
  min-height: 34px;
  color: #111111 !important;
  font-size: 13px;
  font-weight: 800 !important;
  line-height: 1.3;
  letter-spacing: -0.15px;
}

.product-card .price-row {
  margin: 0 9px 11px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.product-card .price {
  color: #111111;
  font-size: 14px;
  font-weight: 900;
}

.product-card .compare-price {
  color: #8a817d;
  font-size: 10px;
  font-weight: 600;
  text-decoration: line-through;
}

.product-card .actions {
  padding: 0 7px 8px;
  display: grid;
  gap: 6px;
}

.product-card .action-button {
  min-height: 34px;
  border-radius: 7px;
  font-size: 10px;
  font-weight: 900;
}

.product-card .buy-button {
  background: #111111;
  color: #ffffff;
  border: 1px solid #111111;
}

.product-card .cart-button {
  background: #ffffff;
  color: #111111;
  border: 1px solid #111111;
}

@media (max-width: 640px) {
  .product-card {
    border-radius: 12px;
  }

  .product-card .image-box {
    aspect-ratio: 1 / 1.08;
    border-radius: 10px;
  }

  .product-card .sale-badge {
    top: 7px;
    left: 7px;
    min-height: 22px;
    padding: 0 7px;
    font-size: 8px;
  }

  .product-card .product-name {
  margin: 10px 8px 8px;
  min-height: 38px;
  font-size: 13px;
  line-height: 1.28;
}

  .product-card .price-row {
    margin: 0 7px 9px;
  }

  .product-card .price {
    font-size: 13px;
  }

  .product-card .compare-price {
    font-size: 9px;
  }

  .product-card .actions {
    padding: 0 6px 7px;
    gap: 5px;
  }

  .product-card .action-button {
    min-height: 32px;
    font-size: 9px;
  }
}

/* PREMIUM RS BEAUTY FOOTER */

.home-footer {
  margin-top: 42px;
  padding: 38px 24px 22px;
  border-top: 1px solid #e8dfda;
  background: #ffffff;
  color: #111111;
}

.home-footer-brand {
  max-width: 430px;
  margin-bottom: 34px;
}

.home-footer-brand strong {
  display: block;
  margin-bottom: 10px;
  color: #111111;
  font-size: 20px;
  font-weight: 900;
  letter-spacing: 3px;
}

.home-footer-brand span {
  display: block;
  color: #6a605b;
  font-size: 13px;
  line-height: 1.6;
}

.home-footer-columns {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 28px;
  padding: 28px 0 32px;
  border-top: 1px solid #eee7e3;
  border-bottom: 1px solid #eee7e3;
}

.home-footer-column {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 9px;
}

.home-footer-heading {
  margin-bottom: 4px;
  color: #8b6d60;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 1.5px;
}

.home-footer-column a {
  color: #111111;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.35;
  text-decoration: none;
}

.home-footer-column a:hover {
  opacity: 0.6;
}

.home-footer-bottom {
  padding-top: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  color: #847a75;
  font-size: 10px;
  line-height: 1.4;
}

@media (max-width: 640px) {
  .home-footer {
    margin-top: 36px;
    padding: 32px 18px 20px;
  }

  .home-footer-brand {
    margin-bottom: 26px;
  }

  .home-footer-brand strong {
    font-size: 18px;
    letter-spacing: 2.5px;
  }

  .home-footer-brand span {
    max-width: 280px;
    font-size: 11px;
  }

  .home-footer-columns {
    grid-template-columns: 1fr 1fr;
    gap: 26px 18px;
    padding: 24px 0 28px;
  }

  .home-footer-column:last-child {
    grid-column: 1 / -1;
  }

  .home-footer-heading {
    font-size: 8px;
  }

  .home-footer-column a {
    font-size: 11px;
  }

  .home-footer-bottom {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
    font-size: 9px;
  }
}

/* FOOTER MOBILE FINAL REFINEMENT */

.home-footer-brand,
.home-footer-columns,
.home-footer-bottom {
  width: 100%;
  box-sizing: border-box;
}

@media (max-width: 640px) {
  .home-footer {
    padding: 32px 18px 24px;
  }

  .home-footer-brand {
    width: 100%;
    margin-bottom: 24px;
    text-align: left;
  }

  .home-footer-brand strong {
    font-size: 19px;
    letter-spacing: 2.4px;
  }

  .home-footer-brand span {
    max-width: 300px;
    font-size: 12px;
    line-height: 1.6;
  }

  .home-footer-columns {
    width: 100%;
    grid-template-columns: 1fr 1fr;
    gap: 26px 24px;
    padding: 25px 0 28px;
  }

  .home-footer-heading {
    font-size: 9px;
    letter-spacing: 1.3px;
  }

  .home-footer-column {
    gap: 10px;
  }

  .home-footer-column a {
    font-size: 12px;
    line-height: 1.4;
  }

  .home-footer-column:last-child {
    grid-column: 1 / -1;
  }

  .home-footer-bottom {
    width: 100%;
    padding-top: 20px;
    font-size: 10px;
    line-height: 1.5;
  }
}

/* FOOTER DESKTOP FINAL FIX */

@media (min-width: 641px) {
  .home-footer {
    display: block;
    width: 100%;
    margin-top: 42px;
    padding: 42px 24px 24px;
    box-sizing: border-box;
  }

  .home-footer-brand {
    width: 100%;
    max-width: 460px;
    margin: 0 0 32px;
  }

  .home-footer-brand strong {
    font-size: 20px;
    letter-spacing: 3px;
  }

  .home-footer-brand span {
    margin-top: 10px;
    font-size: 13px;
    line-height: 1.6;
  }

  .home-footer-columns {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 48px;
    padding: 28px 0 32px;
    box-sizing: border-box;
  }

  .home-footer-column {
    align-items: flex-start;
  }

  .home-footer-heading {
    font-size: 9px;
  }

  .home-footer-column a {
    font-size: 12px;
  }

  .home-footer-bottom {
    width: 100%;
    padding-top: 20px;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    box-sizing: border-box;
    font-size: 10px;
  }
}




.home-product-details { display: flex; flex-direction: column; flex: 1; min-width: 0; }
@media (min-width: 769px) {
/* Home: a single featured product fills the available section. */
#shop.product-grid--single { grid-template-columns: minmax(0, 1fr); }
#shop.product-grid--single .product-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 38px;
  padding: 28px;
  background: #faf7f4;
  border-radius: 22px;
}
#shop.product-grid--single .product-card:hover { transform: none; }
#shop.product-grid--single .image-box { background: #fff; border-radius: 16px; }
#shop.product-grid--single .home-product-details { justify-content: center; padding: 16px 12px; }
.home-product-kicker { color: #655752; font-size: 10px; font-weight: 700; letter-spacing: 2.4px; }
#shop.product-grid--single .product-name { margin: 16px 0 0; font-size: clamp(28px, 3vw, 40px); line-height: 1.12; text-align: left; letter-spacing: -1px; }
.home-product-description { margin: 18px 0; color: #564c48; font-size: 15px; line-height: 1.7; }
#shop.product-grid--single .price-row { margin-top: 18px; }
#shop.product-grid--single .actions { margin-top: 24px; }
.home-product-discover { align-self: flex-start; margin-top: 20px; color: #111; font-size: 13px; text-underline-offset: 5px; }
.home-product-discover:focus-visible { outline: 2px solid #655752; outline-offset: 5px; }
}
@media (max-width: 768px) {
  #shop.product-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .home-product-kicker, .home-product-description, .home-product-discover { display: none; }
}

.home-confidence { margin-top: 48px; }
.home-confidence .conversion-section-heading { max-width: 600px; margin: 0 auto 24px; }
.home-confidence .conversion-kicker { margin-bottom: 10px; font-weight: 700; }
.home-confidence .conversion-title { font-size: clamp(28px, 3.3vw, 40px); line-height: 1.15; letter-spacing: -1.2px; font-weight: 700; }
.home-confidence .conversion-copy { margin-top: 12px; font-size: 14px; line-height: 1.6; }
.home-confidence .conversion-benefit { min-height: 0; padding: 20px; text-align: left; border-radius: 14px; }
.home-confidence .conversion-benefit-number { width: 28px; height: 28px; margin-bottom: 16px; font-weight: 700; }
.home-confidence .conversion-benefit h3 { font-size: 15px; line-height: 1.3; margin-bottom: 8px; text-align: left; }
.home-confidence .conversion-benefit p { font-size: 13px; line-height: 1.55; text-align: left; }
@media (max-width: 760px) {
  .home-confidence { margin-top: 36px; }
  .home-confidence .conversion-section-heading { margin-bottom: 20px; }
  .home-confidence .conversion-title { font-size: 28px; letter-spacing: -.8px; }
  .home-confidence .conversion-copy { font-size: 13px; }
  .home-confidence .conversion-benefits { gap: 10px; }
  .home-confidence .conversion-benefit { padding: 16px 12px; }
  .home-confidence .conversion-benefit-number { width: 26px; height: 26px; margin-bottom: 12px; }
  .home-confidence .conversion-benefit h3 { font-size: 13px; }
  .home-confidence .conversion-benefit p { font-size: 12px; }
}

.home-ritual-panel { position: relative; overflow: hidden; isolation: isolate; min-height: 380px; padding: 0; margin-top: 0; background: #211710; }
.home-ritual-image { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center top; z-index: -2; }
.home-ritual-panel::before { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, rgba(20,13,9,.78), rgba(20,13,9,.35) 43%, transparent 70%); z-index: -1; }
.home-ritual-content { padding: 44px; max-width: 48%; box-sizing: border-box; text-align: left; }
.home-ritual-content h2 { font-size: clamp(30px, 3.8vw, 46px); line-height: 1.08; letter-spacing: -1.2px; text-align: left; font-weight: 700; }
.home-ritual-content p { margin-top: 16px; font-size: 14px; line-height: 1.65; text-align: left; color: #f0e8e2; }
.home-ritual-content .conversion-kicker { font-weight: 700; text-align: left; }
.home-ritual-content .conversion-primary-link { margin-top: 22px; font-weight: 700; }
@media (max-width: 760px) {
  .home-ritual-panel { min-height: 0; display: block; }
  .home-ritual-image { position: relative; display: block; height: 210px; object-position: 70% 30%; z-index: auto; }
  .home-ritual-panel::before { display: none; }
  .home-ritual-content { max-width: none; padding: 24px 22px 28px; }
  .home-ritual-content h2 { font-size: 28px; }
  .home-ritual-content p { font-size: 13px; }
}

.conversion-section.conversion-editorial { margin-top: 36px; }
.conversion-editorial + .conversion-faq { margin-top: 36px; }
@media (max-width: 760px) {
  .conversion-section.conversion-editorial { margin-top: 28px; }
  .conversion-editorial + .conversion-faq { margin-top: 28px; }
}

#faq.conversion-faq { padding: 36px; gap: 36px; }
#faq .conversion-faq-intro { text-align: left; }
#faq .conversion-kicker { font-weight: 700; }
#faq .conversion-faq-intro h2 { font-size: clamp(28px, 3vw, 36px); line-height: 1.12; letter-spacing: -1px; text-align: left; font-weight: 700; }
#faq .conversion-faq-intro p { margin-top: 14px; text-align: left; }
#faq .conversion-faq-list summary { padding: 16px 8px 16px 0; font-size: 14px; font-weight: 700; line-height: 1.45; }
#faq .conversion-faq-list summary:focus-visible { outline: 2px solid #655752; outline-offset: 3px; }
#faq .conversion-faq-list details p { margin: 0 0 16px; }
.conversion-section.conversion-closing { margin-top: 36px; padding: 30px 36px; display: flex; align-items: center; justify-content: space-between; gap: 24px; text-align: left; background: #f2e8e2; }
.conversion-closing .conversion-kicker { font-weight: 700; margin-bottom: 10px; }
.conversion-closing h2 { font-size: clamp(24px, 2.8vw, 32px); line-height: 1.15; letter-spacing: -.8px; text-align: left; font-weight: 700; }
.conversion-closing p { margin: 10px 0 0; font-size: 14px; text-align: left; }
.conversion-closing .conversion-primary-link { flex-shrink: 0; font-weight: 700; }
@media (max-width: 760px) {
  #faq.conversion-faq { padding: 24px 20px; gap: 20px; }
  #faq .conversion-faq-intro h2 { font-size: 26px; }
  #faq .conversion-faq-intro p { font-size: 13px; }
  .conversion-section.conversion-closing { margin-top: 28px; padding: 24px 22px; flex-direction: column; align-items: flex-start; gap: 20px; }
  .conversion-closing h2 { font-size: 26px; }
  .conversion-closing p { font-size: 13px; }
}


/* Explore collection image, immediately above the footer. */
.conversion-section.home-explore-premium {
  position: relative; isolation: isolate; overflow: hidden;
  min-height: 440px; box-sizing: border-box; padding: 52px 44px;
  display: flex; flex-direction: column; align-items: flex-start;
  justify-content: center; gap: 24px; background: #e7d6bd;
}
.home-explore-premium .home-explore-image {
  position: absolute; inset: 0; z-index: -2;
  width: 100%; height: 100%; object-fit: cover; object-position: center;
}
.home-explore-premium::before {
  content: ''; position: absolute; inset: 0; z-index: -1;
  background: linear-gradient(90deg, rgba(242,232,218,.96) 0%, rgba(242,232,218,.88) 26%, rgba(242,232,218,.25) 49%, transparent 65%);
  pointer-events: none;
}
.home-explore-premium .home-closing-copy { max-width: 34%; }
.home-explore-premium .conversion-kicker { color: #4b3828; }
.home-explore-premium h2 { color: #211b16; font-size: clamp(28px, 3vw, 38px); }
.home-explore-premium p { color: #4b3828; line-height: 1.6; }
.home-explore-premium .conversion-primary-link {
  background: #211b16; color: #fff; border: 1px solid #211b16;
  position: relative; padding: 14px 20px; text-decoration: none;
}
.home-explore-premium .conversion-primary-link:hover { background: #403126; color: #fff; }
.home-explore-premium .conversion-primary-link:focus-visible { outline: 2px solid #211b16; outline-offset: 4px; }
@media (max-width: 760px) {
  .conversion-section.home-explore-premium {
    min-height: 0; padding: 0 0 26px; gap: 20px; background: #f2e8e2;
  }
  .home-explore-premium .home-explore-image {
    position: static; z-index: auto; display: block;
    width: 100%; height: auto; aspect-ratio: 3 / 2; object-fit: cover;
  }
  .home-explore-premium::before { display: none; }
  .home-explore-premium .home-closing-copy { max-width: none; padding: 0 22px; }
  .home-explore-premium h2 { font-size: 28px; }
  .home-explore-premium .conversion-primary-link { margin: 0 22px; }
}

@media (min-width: 761px) {
  .conversion-section.home-explore-premium {
    aspect-ratio: 3 / 2;
    min-height: 0;
  }
}

/* Consolidated Home footer layout. */
footer.home-footer { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); align-items: start; gap: 28px 40px; margin-top: 36px; padding: 30px 0 20px; width: 100%; box-sizing: border-box; text-align: left; }
.home-footer .home-footer-brand { margin: 0; max-width: 300px; }
.home-footer .home-footer-brand strong { font-size: 20px; font-weight: 700; letter-spacing: 2px; }
.home-footer .home-footer-brand span { margin-top: 0; font-size: 13px; }
.home-footer .home-footer-columns { padding: 0; gap: 24px; border: 0; }
.home-footer .home-footer-column { gap: 0; }
.home-footer .home-footer-heading { font-size: 10px; font-weight: 700; margin-bottom: 8px; }
.home-footer .home-footer-column a { display: block; padding: 6px 0; font-size: 12px; line-height: 1.5; font-weight: 500; }
.home-footer .home-footer-column a:focus-visible { outline: 2px solid #655752; outline-offset: 3px; }
.home-footer .home-footer-bottom { grid-column: 1 / -1; padding-top: 16px; border-top: 1px solid #eee7e3; gap: 12px; }
@media (max-width: 640px) {
  footer.home-footer { display: block; margin-top: 28px; padding: 24px 12px 18px; }
  .home-footer .home-footer-brand { margin-bottom: 24px; }
  .home-footer .home-footer-brand strong { font-size: 18px; }
  .home-footer .home-footer-brand span { font-size: 12px; }
  .home-footer .home-footer-columns { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px 16px; padding: 0 0 20px; }
  .home-footer .home-footer-column:last-child { grid-column: 1 / -1; }
  .home-footer .home-footer-bottom { flex-direction: column; align-items: flex-start; gap: 4px; }
}
   `}</style>

      <main className="store">
       <GlobalHeader />

<Hero />

<section className="home-categories">
  <div className="home-categories-header">
    <div>
      <span className="home-categories-eyebrow">
        SHOP BY CATEGORY
      </span>

      <h2>
        Beauty for every part of your routine.
      </h2>
    </div>

    <Link
      to="/shop"
      className="home-categories-view-all"
    >
      View All
    </Link>
  </div>

  <div className="home-categories-grid">
  <Link
     to="/shop?category=Hair"
    className="home-category-card home-category-card--visual"
  >
    <img
      src={hairCategory}
      alt="Hair beauty collection"
      className="home-category-image"
    />
    <div className="home-category-overlay" />

    <div className="home-category-content">
      <h3>Hair</h3>
      <span>Explore →</span>
    </div>
  </Link>

  <Link
    to="/shop"
    className="home-category-card home-category-card--visual"
  >
    <img
      src={skinCategory}
      alt="Skin beauty collection"
      className="home-category-image"
    />
    <div className="home-category-overlay" />

    <div className="home-category-content">
      <h3>Skin</h3>
      <span>Explore →</span>
    </div>
  </Link>

  <Link
    to="/shop"
    className="home-category-card home-category-card--visual"
  >
    <img
      src={faceCategory}
      alt="Face beauty collection"
      className="home-category-image"
    />
    <div className="home-category-overlay" />

    <div className="home-category-content">
      <h3>Face</h3>
      <span>Explore →</span>
    </div>
  </Link>

  <Link
    to="/shop"
    className="home-category-card home-category-card--visual"
  >
    <img
      src={lipsCategory}
      alt="Lips beauty collection"
      className="home-category-image"
    />
    <div className="home-category-overlay" />

    <div className="home-category-content">
      <h3>Lips</h3>
      <span>Explore →</span>
    </div>
  </Link>

  <Link
    to="/shop"
    className="home-category-card home-category-card--visual"
  >
    <img
      src={nailsCategory}
      alt="Nails beauty collection"
      className="home-category-image"
    />
    <div className="home-category-overlay" />

    <div className="home-category-content">
      <h3>Nails</h3>
      <span>Explore →</span>
    </div>
  </Link>

  <Link
    to="/shop"
    className="home-category-card home-category-card--visual"
  >
    <img
      src={bodyMassageCategory}
      alt="Body and massage beauty collection"
      className="home-category-image"
    />
    <div className="home-category-overlay" />

    <div className="home-category-content">
      <h3>Body & Massage</h3>
      <span>Explore →</span>
    </div>
  </Link>
</div>

</section>

        <div className="home-shop-heading">
          <h2 className="section-title">
            Featured Products
          </h2>

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
  className={`product-grid ${
    products.slice(0, 8).length === 1
      ? 'product-grid--single'
      : ''
  }`}
>

          {products.slice(0, 8).map((product) => {
            const id = getProductId(product);
            const image = getImage(product);
            const price = getPrice(product);
            const comparePrice = getComparePrice(product);

const currentPriceValue = Number(
  String(price || '').replace(/[^\d.]/g, '')
);

const comparePriceValue = Number(
  String(comparePrice || '').replace(/[^\d.]/g, '')
);

const savings =
  Number.isFinite(currentPriceValue) &&
  Number.isFinite(comparePriceValue) &&
  comparePriceValue > currentPriceValue
    ? Math.round(
        (comparePriceValue - currentPriceValue) * 100
      ) / 100
    : 0;

const savingsLabel =
  savings > 0
    ? `SAVE $${Number.isInteger(savings)
        ? savings.toFixed(0)
        : savings.toFixed(2)}`
    : '';


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
      {savingsLabel && (
  <span className="sale-badge">
    {savingsLabel}
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

  <div className="home-product-details">
    {products.length === 1 && (
      <span className="home-product-kicker">THE BEAUTY EDIT</span>
    )}
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
    {products.length === 1 && id === '8a9211d2-bb19-4b4c-99d2-6787b96b20a3' && (
      <p className="home-product-description">
        Make room for curls in your everyday routine. Explore AutoCurl,
        see it in action and choose the option that suits you.
      </p>
    )}
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
    {products.length === 1 && (
      <Link className="home-product-discover" to={`/product/${id}`}>
        Explore product details →
      </Link>
    )}
  </div>
              </article>
            );
          })}
        </section>

        <section
          className="conversion-section home-confidence"
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
              Shop with confidence.
            </h2>

            <p className="conversion-copy">
              The essentials for a simpler shopping experience.
            </p>
          </div>

          <div className="conversion-benefits">

           <article className="conversion-benefit">
  <span className="conversion-benefit-number">01</span>
  <h3>Carefully Curated</h3>
  <p>
    Beauty tools selected for everyday routines.
  </p>
</article>

<article className="conversion-benefit">
  <span className="conversion-benefit-number">02</span>
  <h3>Secure Checkout</h3>
  <p>
    Secure checkout with available payment options.
  </p>
</article>

<article className="conversion-benefit">
  <span className="conversion-benefit-number">03</span>
  <h3>Delivery Details</h3>
  <p>
    Find destinations and estimates in our shipping policy.
  </p>
</article>

<article className="conversion-benefit">
  <span className="conversion-benefit-number">04</span>
  <h3>Customer Care</h3>
  <p>
    Contact us for help with products or your order.
  </p>
</article>

          </div>
        </section>

        <section className="conversion-section conversion-editorial">
          <div className="conversion-editorial-panel home-ritual-panel">
            <img className="home-ritual-image" src="/images/rs-beauty-ritual-dark.png" alt="Woman enjoying a quiet beauty ritual at a warm, softly lit vanity" loading="lazy" decoding="async" />
            <div className="home-ritual-content">
            <span className="conversion-kicker">
              The RS BEAUTY™ standard
            </span>

            <h2>
              Your time. Your ritual.
            </h2>

            <p>
              Make a little space for yourself. Discover beauty tools for your everyday routine.
            </p>

            <a
              className="conversion-primary-link"
              href="#shop"
            >
              Shop the collection →
            </a>
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
              A few helpful answers.
            </h2>

            <p>
  Details on delivery, product options and payment.
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
              <summary>Where do you currently deliver?</summary>
              <p>
  We currently deliver to the United States, Canada and the United Kingdom. 
  Free shipping is available to these destinations. Orders are generally
   processed within 1–3 business days, with delivery typically taking approximately 
   10–15 business days after processing.
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
  Orders are completed through a secure checkout experience.
  Available payment methods may vary depending on your location.
            </p>
            </details>
          </div>
        </section>

        <section className="conversion-section conversion-closing home-explore-premium" aria-labelledby="home-explore-title">
          <img className="home-explore-image" src={explorePremium} alt="Beauty essentials arranged on travertine with champagne satin" loading="lazy" decoding="async" width="1536" height="1024" />
          <div className="home-closing-copy">
            <span className="conversion-kicker">Explore RS BEAUTY™</span>
            <h2 id="home-explore-title">Find your everyday essentials.</h2>
            <p>Discover the collection at your own pace.</p>
          </div>
          <Link className="conversion-primary-link" to="/shop">Shop the collection →</Link>
        </section>

        <footer className="home-footer">
  <div className="home-footer-brand">
    <strong>RS BEAUTY™</strong>

    <span>
      Beauty tools for your everyday rituals.
    </span>
  </div>

  <div className="home-footer-columns">
    <div className="home-footer-column">
      <span className="home-footer-heading">
        SHOP
      </span>

      <Link to="/shop">
        Shop All
      </Link>

      <a href="#shop">
        Featured Products
      </a>
    </div>

    <div className="home-footer-column">
      <span className="home-footer-heading">
        CUSTOMER CARE
      </span>

      <a href="#faq">
        FAQ
      </a>

      <Link to="/contact">
        Contact Us
      </Link>

      <Link to="/shipping">
        Shipping & Delivery
      </Link>

      <Link to="/returns">
        Returns & Refunds
      </Link>
    </div>

    <div className="home-footer-column">
      <span className="home-footer-heading">
        POLICIES
      </span>

      <Link to="/privacy">
        Privacy Policy
      </Link>

      <Link to="/terms">
        Terms & Conditions
      </Link>
    </div>
  </div>

  <div className="home-footer-bottom">
    <span>© 2026 RS BEAUTY™</span>
    <span>All rights reserved.</span>
  </div>
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

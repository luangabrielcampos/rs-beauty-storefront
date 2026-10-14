import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Link,
  useParams,
} from 'react-router';

import { media } from '@wix/sdk';

import { wixClient } from '../wixClient';
import GlobalHeader from '../components/GlobalHeader';
import { useCart } from '../context/CartContext';

const SESSION_KEY = 'rs_beauty_wix_session';

const WIX_STORES_APP_ID =
  '215238eb-22a5-4c36-9e7b-e7c08025e04e';

const CART_SELECTION_KEY =
  'rs_beauty_cart_variant_selections';

function saveCartVariantSelection(
  product,
  variant,
  options
) {
  const productId =
    product?._id || product?.id;

  const variantId =
    variant?._id || variant?.id;

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

function getProductImages(product) {
  const mediaItems =
    product?.media?.itemsInfo?.items || [];

  const candidates = [
    product?.media?.main?.image,
    ...mediaItems.map((item) => item?.image),
  ];

  const seen = new Set();

  return candidates.reduce((images, image) => {
    const url = resolveWixImage(image);

    if (!url || seen.has(url)) return images;

    seen.add(url);
    images.push({
      url,
      altText: image?.altText || '',
    });

    return images;
  }, []);
}

function getProductPrice(product) {
  return (
    product?.actualPriceRange?.minValue?.formattedAmount ||
    product?.minVariantPriceInfo?.actualPrice?.formattedAmount ||
    ''
  );
}

function getProductComparePrice(product) {
  return (
    product?.compareAtPriceRange?.minValue?.formattedAmount ||
    product?.minVariantPriceInfo?.compareAtPrice?.formattedAmount ||
    ''
  );
}

function getVariantPrice(variant) {
  return (
    variant?.price?.actualPrice?.formattedAmount ||
    ''
  );
}

function getVariantComparePrice(variant) {
  return (
    variant?.price?.compareAtPrice?.formattedAmount ||
    ''
  );
}

function extractDescription(node) {
  if (!node) return '';

  if (typeof node === 'string') return node;

  if (Array.isArray(node)) {
    return node
      .map(extractDescription)
      .filter(Boolean)
      .join(' ');
  }

  if (node?.textData?.text) {
    return node.textData.text;
  }

  if (node?.nodes) {
    return extractDescription(node.nodes);
  }

  return '';
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
  return (product?.variantsInfo?.variants || []).filter(
    (variant) => {
      if (variant?.visible === false) {
        return false;
      }

      const inventory = variant?.inventoryStatus;

      if (
        inventory?.inStock === false &&
        inventory?.preorderEnabled !== true
      ) {
        return false;
      }

      return true;
    }
  );
}

function buildOptionGroups(variants) {
  const groups = new Map();

  for (const variant of variants) {
    const choices = getVariantChoices(variant);

    for (const [optionName, choiceName] of Object.entries(
      choices
    )) {
      if (!groups.has(optionName)) {
        groups.set(optionName, new Set());
      }

      groups.get(optionName).add(choiceName);
    }
  }

  return Array.from(groups.entries()).map(
    ([name, choices]) => ({
      name,
      choices: Array.from(choices),
    })
  );
}

function findMatchingVariant(
  variants,
  selectedOptions
) {
  return variants.find((variant) => {
    const choices = getVariantChoices(variant);
    const names = Object.keys(choices);

    if (
      names.length !==
      Object.keys(selectedOptions).length
    ) {
      return false;
    }

    return names.every(
      (name) =>
        selectedOptions[name] === choices[name]
    );
  });
}

function createCatalogItem(
  product,
  variantId,
  quantity
) {
  const productId = product?._id || product?.id;

  if (!productId || !variantId) {
    throw new Error(
      'Select an available product option.'
    );
  }

  return {
    catalogReference: {
      catalogItemId: productId,
      appId: WIX_STORES_APP_ID,
      options: {
        variantId,
      },
    },
    quantity,
  };
}

async function initializeWixSession() {
  let storedTokens;

  try {
    const stored =
      localStorage.getItem(SESSION_KEY);

    if (stored) {
      storedTokens = JSON.parse(stored);
      wixClient.auth.setTokens(storedTokens);
    }
  } catch (error) {
    console.error(
      'Could not restore Wix session:',
      error
    );
  }

  const validTokens =
    await wixClient.auth.generateVisitorTokens(
      storedTokens
    );

  wixClient.auth.setTokens(validTokens);

  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify(validTokens)
  );
}

function ProductPage() {
  const { productId } = useParams();

  const {
    cartReady,
    addProductToCart,
    buyProductNow,
  } = useCart();

  const [product, setProduct] = useState(null);
  const [activeImage, setActiveImage] = useState('');
  const [selectedOptions, setSelectedOptions] =
    useState({});
  const [quantity, setQuantity] = useState(1);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!cartReady) return;

    let cancelled = false;

    async function loadProduct() {
      try {
        setLoading(true);
        setError('');

        const response =
          await wixClient.productsV3.getProduct(
            productId,
            {
              fields: [
                'MEDIA_ITEMS_INFO',
                'VARIANT_OPTION_CHOICE_NAMES',
                'DESCRIPTION',
                'CURRENCY',
              ],
            }
          );

        const resolvedProduct =
          response?.product || response;

        if (
          !resolvedProduct?._id &&
          !resolvedProduct?.id
        ) {
          throw new Error('Product not found.');
        }

        if (cancelled) return;

        const images =
          getProductImages(resolvedProduct);

        const availableVariants =
          getAvailableVariants(resolvedProduct);

        const variantChoices =
  availableVariants.map((variant) =>
    getVariantChoices(variant)
  );

const optionNames = new Set(
  variantChoices.flatMap((choices) =>
    Object.keys(choices || {})
  )
);

const defaultOptions = {};

optionNames.forEach((optionName) => {
  const values = [
    ...new Set(
      variantChoices
        .map((choices) => choices?.[optionName])
        .filter(Boolean)
    ),
  ];

  if (values.length === 1) {
    defaultOptions[optionName] = values[0];
  }
});

        setProduct(resolvedProduct);
        setActiveImage(images[0]?.url || '');
        setSelectedOptions(defaultOptions);
        setQuantity(1);
      } catch (requestError) {
        console.error(requestError);

        if (!cancelled) {
          setError(
            requestError?.message ||
            'We could not load this product.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProduct();

    return () => {
      cancelled = true;
    };
  }, [productId, cartReady]);

  const variants = useMemo(
    () => getAvailableVariants(product),
    [product]
  );

  const optionGroups = useMemo(
    () => buildOptionGroups(variants),
    [variants]
  );

  const selectionComplete = optionGroups.every(
    (group) => selectedOptions[group.name]
  );

  const selectedVariant = useMemo(() => {
    if (!variants.length) return null;

    if (
      variants.length === 1 ||
      optionGroups.length === 0
    ) {
      return variants[0];
    }

    if (!selectionComplete) {
      return null;
    }

    return findMatchingVariant(
      variants,
      selectedOptions
    );
  }, [
    variants,
    optionGroups,
    selectionComplete,
    selectedOptions,
  ]);

  function isChoiceAvailable(
    optionName,
    choiceName
  ) {
    const proposedSelection = {
      ...selectedOptions,
      [optionName]: choiceName,
    };

    return variants.some((variant) => {
      const choices = getVariantChoices(variant);

      return Object.entries(proposedSelection).every(
        ([name, value]) => choices[name] === value
      );
    });
  }

  function selectChoice(optionName, choiceName) {
    setMessage('');
    setError('');

    setSelectedOptions((current) => ({
      ...current,
      [optionName]: choiceName,
    }));
  }

  async function addToCart() {
    if (!selectedVariant) {
      setError(
        'Please select all available options.'
      );

      return;
    }

    try {
      setBusy('cart');
      setMessage('');
      setError('');

      await addProductToCart({
        productId: product?._id || product?.id,
        variantId:
          selectedVariant?._id || selectedVariant?.id,
        quantity,
        productName: product.name,
      });

      saveCartVariantSelection(
        product,
        selectedVariant,
        getVariantChoices(selectedVariant)
      );

      setMessage(
        `${product.name} was added to your bag.`
      );

    } catch (requestError) {
      console.error(requestError);

      setError(
        requestError?.message ||
        'We could not add this product to your bag.'
      );
    } finally {
      setBusy('');
    }
  }

  async function buyNow() {
    if (!selectedVariant) {
      setError(
        'Please select all available options.'
      );

      return;
    }

    try {
      setBusy('buy');
      setMessage('');
      setError('');

      await buyProductNow({
        productId: product?._id || product?.id,
        variantId:
          selectedVariant?._id || selectedVariant?.id,
        quantity,
      });

    } catch (requestError) {
      console.error(requestError);

      setError(
        requestError?.message ||
        'We could not open the checkout.'
      );

      setBusy('');
    }
  }

  if (loading) {
    return (
      <main className="rs-product-status">
        <div className="rs-product-spinner" />
        <p>Loading your product...</p>

        <style>{productPageStyles}</style>
      </main>
    );
  }

  if (error && !product) {
    return (
      <main className="rs-product-status">
        <span className="rs-product-status-label">
          RS BEAUTY™
        </span>

        <h1>Product unavailable</h1>

        <p>{error}</p>

        <Link
          to="/"
          className="rs-product-back-button"
        >
          Return to the store
        </Link>

        <style>{productPageStyles}</style>
      </main>
    );
  }

  if (!product) return null;

  const images = getProductImages(product);

  const price =
    getVariantPrice(selectedVariant) ||
    getProductPrice(product);

  const comparePrice =
    getVariantComparePrice(selectedVariant) ||
    getProductComparePrice(product);

  const description =
    product?.plainDescription ||
    extractDescription(product?.description) ||
    'Discover this carefully selected RS BEAUTY essential.';

  const needsOptions =
    optionGroups.length > 0 &&
    !selectionComplete;

  const purchaseDisabled =
    Boolean(busy) ||
    !selectedVariant;

  return (
    <main className="rs-product-page">
      <GlobalHeader />

      <section className="rs-product-main">
        <div
          className={
            images.length > 1
              ? 'rs-product-gallery'
              : 'rs-product-gallery no-thumbnails'
          }
        >
          {images.length > 1 && (
            <div className="rs-product-thumbnails">
              {images.map((image, index) => (
                <button
                  type="button"
                  className={
                    activeImage === image.url
                      ? 'rs-product-thumbnail is-active'
                      : 'rs-product-thumbnail'
                  }
                  key={`${image.url}-${index}`}
                  onClick={() =>
                    setActiveImage(image.url)
                  }
                  aria-label={`View product image ${index + 1}`}
                >
                  <img src={image.url} alt="" />
                </button>
              ))}
            </div>
          )}

          <div className="rs-product-main-image">
            {activeImage ? (
              <img
                src={activeImage}
                alt={product.name}
              />
            ) : (
              <div className="rs-product-no-image">
                <span>RS BEAUTY™</span>
                <p>Product image coming soon</p>
              </div>
            )}
          </div>
        </div>

        <div className="rs-product-information">
          <span className="rs-product-eyebrow">
            {product?.brand?.name || 'RS BEAUTY™'}
          </span>

          <h1 className="rs-product-title">
            {product.name}
          </h1>

          <div className="rs-product-price-row">
            {comparePrice &&
              comparePrice !== price && (
                <span className="rs-product-compare-price">
                  {comparePrice}
                </span>
              )}

            <span className="rs-product-price">
              {price || 'Price unavailable'}
            </span>

            {comparePrice &&
              comparePrice !== price && (
                <span className="rs-product-save-badge">
                  SAVE $30
                </span>
              )}
          </div>

          <div className="rs-product-description">
            <strong className="rs-product-description-title">
              Effortless Curls. Polished Results.
            </strong>

            <p>
              Create smooth, defined curls with less effort.
            </p>

            <div className="rs-product-benefits">
              <span>✓ Easier everyday styling</span>
              <span>✓ Smooth, defined-looking curls</span>
              <span>✓ Designed for a polished finish</span>
            </div>
          </div>

          {optionGroups.map((group) => (
            <div
              className="rs-product-option"
              key={group.name}
            >
              <span className="rs-product-option-label">
                {group.name}
              </span>

              <div className="rs-product-choice-list">
                {group.choices.map((choice) => {
                  const selected =
                    selectedOptions[group.name] ===
                    choice;

                  const available =
                    isChoiceAvailable(
                      group.name,
                      choice
                    );

                  return (
                    <button
                      type="button"
                      key={choice}
                      className={
                        selected
                          ? 'rs-product-choice is-selected'
                          : 'rs-product-choice'
                      }
                      disabled={!available}
                      onClick={() =>
                        selectChoice(
                          group.name,
                          choice
                        )
                      }
                    >
                      {choice}

                      {!available && (
                        <span aria-hidden="true">
                          ×
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {needsOptions && (
            <div className="rs-product-selection-warning">
            Select your plug type to continue.
            </div>
          )}

          <div className="rs-product-quantity-area">
            <span>Quantity</span>

            <div className="rs-product-quantity">
              <button
                type="button"
                onClick={() =>
                  setQuantity((current) =>
                    Math.max(1, current - 1)
                  )
                }
                disabled={quantity === 1}
              >
                −
              </button>

              <strong>{quantity}</strong>

              <button
                type="button"
                onClick={() =>
                  setQuantity((current) =>
                    Math.min(10, current + 1)
                  )
                }
                disabled={quantity === 10}
              >
                +
              </button>
            </div>
          </div>

          {message && (
            <div className="rs-product-message">
              ✓ {message}
            </div>
          )}

          {error && product && (
            <div className="rs-product-error">
              {error}
            </div>
          )}

          <div className="rs-product-actions">
            <button
              type="button"
              className="rs-product-buy-button"
              disabled={purchaseDisabled}
              onClick={buyNow}
            >
              {busy === 'buy'
                ? 'Opening Checkout...'
                : needsOptions
                  ? 'Choose Options First'
                  : 'Buy Now'}
            </button>

            <button
              type="button"
              className="rs-product-cart-button"
              disabled={purchaseDisabled}
              onClick={addToCart}
            >
              {busy === 'cart'
                ? 'Adding to Bag...'
                : needsOptions
                  ? 'Choose Options First'
                  : 'Add to Cart'}
            </button>
          </div>

          <div className="rs-product-trust-line">
            Secure Checkout
            <span>•</span>
            Easy Support
            <span>•</span>
            Delivery to US, Canada & UK
          </div>
        </div>
      </section>

      <section className="rs-product-details">
        <span>PRODUCT INFORMATION</span>

        <h2>
          Everything you need to know.
        </h2>

        <div className="rs-product-accordions">
          <details>
            <summary>
              Product details
              <span aria-hidden="true">+</span>
            </summary>

            <p>
              RS BEAUTY™ AutoCurl Pro is designed to make everyday curling
              simpler, helping create smooth, defined curls with a polished
              finish from the comfort of home.
            </p>
          </details>

          <details>
            <summary>
              Delivery &amp; returns
              <span aria-hidden="true">+</span>
            </summary>

           <p>
  Orders are generally processed within 1–3 business days.
  Delivery typically takes approximately 10–15 business days
  after processing, depending on the destination and local
  carrier conditions. If your item arrives damaged, defective
  or incorrect, please contact our customer care team within
  30 days of delivery for support.
</p>

          </details>

          <details>
            <summary>
              Customer care
              <span aria-hidden="true">+</span>
            </summary>

            <p>
              Need help with your order? Our customer care team is here to
              assist you before and after your purchase. Contact us if you
              have questions about your order, delivery or product.
            </p>
          </details>
               </div>
      </section>

      <footer className="rs-product-footer">
        <div className="rs-product-footer-brand">
          <strong>RS BEAUTY™</strong>
          <p>
            Beauty essentials curated for modern routines
            around the world.
          </p>
        </div>

        <div className="rs-product-footer-columns">
          <div className="rs-product-footer-column">
            <span className="rs-product-footer-heading">
              SHOP
            </span>

            <Link to="/shop">Shop All</Link>
            <Link to="/shop">Featured Products</Link>
          </div>

          <div className="rs-product-footer-column">
            <span className="rs-product-footer-heading">
              CUSTOMER CARE
            </span>

            <Link to="/contact">Contact Us</Link>
            <Link to="/shipping">Shipping & Delivery</Link>
            <Link to="/returns">Returns & Refunds</Link>
          </div>

          <div className="rs-product-footer-column">
            <span className="rs-product-footer-heading">
              EXPLORE
            </span>

            <Link to="/">Home</Link>
            <Link to="/shop">Shop</Link>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms & Conditions</Link>
          </div>
        </div>

        <div className="rs-product-footer-bottom">
          <span>© 2026 RS BEAUTY™</span>
          <span>All rights reserved.</span>
        </div>
      </footer>

      <style>{productPageStyles}</style>
    </main>
  );
}

const productPageStyles = `
  .rs-product-page,
  .rs-product-page * {
    box-sizing: border-box;
  }

  .rs-product-page {
    width: 100%;
    max-width: 1280px;
    min-height: 100vh;
    margin: 0 auto;
    padding: 0 22px 80px;
    background: #ffffff;
    color: #111111;
    font-family: Arial, Helvetica, sans-serif;
    text-align: left;
  }

  .rs-product-header {
    min-height: 76px;
    margin-bottom: 44px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #ececec;
  }

  .rs-product-logo,
  .rs-product-return {
    color: #111111;
    font-weight: 800;
    text-decoration: none;
  }

  .rs-product-logo {
    font-size: 23px;
    letter-spacing: 1.8px;
  }

  .rs-product-return {
    font-size: 13px;
  }

  .rs-product-main {
    display: grid;
    grid-template-columns:
      minmax(0, 1.08fr)
      minmax(360px, 0.92fr);
    gap: 72px;
    align-items: start;
  }

  .rs-product-gallery {
    min-width: 0;
    display: grid;
    grid-template-columns: 80px minmax(0, 1fr);
    gap: 14px;
  }

  .rs-product-gallery.no-thumbnails {
    grid-template-columns: 1fr;
  }

  .rs-product-thumbnails {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .rs-product-thumbnail {
    width: 80px;
    height: 80px;
    padding: 0;
    overflow: hidden;
    border: 1px solid #e4e4e4;
    border-radius: 9px;
    background: #ffffff;
    cursor: pointer;
  }

  .rs-product-thumbnail.is-active {
    border: 2px solid #111111;
  }

  .rs-product-thumbnail img,
  .rs-product-main-image img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }

  .rs-product-main-image {
    width: 100%;
    aspect-ratio: 1 / 1;
    overflow: hidden;
    border-radius: 18px;
    background: #f5f2f0;
  }

  .rs-product-no-image {
    width: 100%;
    height: 100%;
    padding: 30px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #796c67;
    text-align: center;
  }

  .rs-product-no-image span {
    font-size: 21px;
    font-weight: 900;
    letter-spacing: 2px;
  }

  .rs-product-information {
    min-width: 0;
    padding: 14px 0;
  }

  .rs-product-eyebrow {
    display: block;
    margin-bottom: 17px;
    color: #766863;
    font-size: 11px;
    font-weight: 850;
    letter-spacing: 2.5px;
  }

  .rs-product-title {
    margin: 0 !important;
    color: #111111 !important;
    font-size: clamp(38px, 4.5vw, 62px) !important;
    line-height: 1.02 !important;
    letter-spacing: -2.3px !important;
    text-align: left !important;
  }

  .rs-product-price-row {
    min-height: 40px;
    margin-top: 25px;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .rs-product-price {
    color: #111111;
    font-size: 25px;
    font-weight: 850;
  }

  .rs-product-compare-price {
    color: #8d8d8d;
    font-size: 15px;
    text-decoration: line-through;
  }

  .rs-product-save-badge {
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    padding: 0 10px;
    border-radius: 999px;
    background: #111111;
    color: #ffffff;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.4px;
  }

  .rs-product-description {
    margin: 24px 0 30px;
    color: #5c5552;
    font-size: 15px;
    line-height: 1.7;
  }

  .rs-product-description-title {
    display: block;
    margin-bottom: 9px;
    color: #111111;
    font-size: 18px;
    font-weight: 900;
    line-height: 1.3;
  }

  .rs-product-description p {
    margin: 0 0 14px;
    color: #5c5552;
    font-size: 14px;
    line-height: 1.65;
  }

  .rs-product-benefits {
    display: grid;
    gap: 7px;
  }

  .rs-product-benefits span {
    display: block;
    color: #3f3936;
    font-size: 13px;
    font-weight: 700;
    line-height: 1.45;
  }

  .rs-product-option {
    margin-bottom: 23px;
  }

  .rs-product-option-label {
    display: block;
    margin-bottom: 10px;
    color: #111111;
    font-size: 13px;
    font-weight: 850;
  }

  .rs-product-choice-list {
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
  }

  .rs-product-choice {
    min-width: 58px;
    min-height: 42px;
    padding: 8px 15px;
    border: 1px solid #bdb6b3;
    border-radius: 8px;
    background: #ffffff;
    color: #111111;
    font-size: 13px;
    font-weight: 750;
    cursor: pointer;
  }

  .rs-product-choice.is-selected {
    border-color: #111111;
    background: #111111;
    color: #ffffff;
  }

  .rs-product-choice:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    text-decoration: line-through;
  }

  .rs-product-selection-warning,
  .rs-product-selection-success,
  .rs-product-message,
  .rs-product-error {
    margin: 13px 0;
    padding: 11px 13px;
    border-radius: 8px;
    font-size: 12px;
    line-height: 1.45;
  }

  .rs-product-selection-warning {
    background: #fff8e4;
    color: #6f5312;
  }

  .rs-product-selection-success,
  .rs-product-message {
    background: #eef9f0;
    color: #24612f;
  }

  .rs-product-error {
    background: #fff0f0;
    color: #9c2626;
  }

  .rs-product-quantity-area {
    margin-top: 24px;
  }

  .rs-product-quantity-area > span {
    display: block;
    margin-bottom: 9px;
    font-size: 13px;
    font-weight: 850;
  }

  .rs-product-quantity {
    width: 126px;
    min-height: 43px;
    display: grid;
    grid-template-columns: 40px 46px 40px;
    overflow: hidden;
    border: 1px solid #cfc9c6;
    border-radius: 8px;
  }

  .rs-product-quantity button {
    border: 0;
    background: #ffffff;
    color: #111111;
    font-size: 18px;
    cursor: pointer;
  }

  .rs-product-quantity strong {
    display: grid;
    place-items: center;
    font-size: 13px;
  }

  .rs-product-actions {
    margin-top: 25px;
    display: grid;
    gap: 10px;
  }

  .rs-product-buy-button,
  .rs-product-cart-button {
    width: 100%;
    min-height: 52px;
    border: 1px solid #111111;
    border-radius: 9px;
    font-size: 14px;
    font-weight: 850;
    cursor: pointer;
  }

  .rs-product-buy-button {
    background: #111111;
    color: #ffffff;
  }

  .rs-product-cart-button {
    background: #ffffff;
    color: #111111;
  }

  .rs-product-buy-button:disabled,
  .rs-product-cart-button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .rs-product-trust-line {
    margin-top: 14px;
    padding: 13px 16px;
    border: 1px solid #e8dfda;
    border-radius: 10px;
    background: #fbf8f6;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 9px;
    color: #4f4743;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.1px;
  }

  .rs-product-trust-line span {
    color: #b6aaa4;
    font-size: 10px;
  }

  .rs-product-details {
    margin-top: 36px;
    padding: 54px 60px;
    border: 1px solid #ebe2dd;
    border-radius: 22px;
    background: #f8f4f1;
  }

  .rs-product-details > span {
    color: #73645f;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 2.5px;
  }

  .rs-product-details h2 {
    margin: 14px 0 26px;
    max-width: 680px;
    color: #111111 !important;
    font-size: 38px;
    font-weight: 850;
    line-height: 1.05;
    letter-spacing: -1.4px;
    text-align: left;
  }

  .rs-product-details p {
    max-width: 780px;
    margin: 0;
    color: #5b5350;
    line-height: 1.75;
  }

  .rs-product-accordions {
    max-width: 100%;
    border-top: 1px solid #d9ceca;
  }

  .rs-product-accordions details {
    border-bottom: 1px solid #d9ceca;
  }

  .rs-product-accordions summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 68px;
    color: #111111;
    font-size: 14px;
    font-weight: 850;
    list-style: none;
    cursor: pointer;
    transition: opacity 0.2s ease;
  }

  .rs-product-accordions summary:hover {
    opacity: 0.6;
  }

  .rs-product-accordions summary::-webkit-details-marker {
    display: none;
  }

  .rs-product-accordions summary span {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #ffffff;
    font-size: 18px;
    transition: transform 180ms ease;
  }

  .rs-product-accordions details[open] summary span {
    transform: rotate(45deg);
  }

  .rs-product-accordions details p {
    padding: 0 46px 20px 0;
    font-size: 14px;
  }

  .rs-product-status {
    width: 100%;
    max-width: 1280px;
    min-height: 100vh;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #ffffff;
    color: #111111;
    text-align: center;
  }

  .rs-product-status h1 {
    color: #111111 !important;
  }

  .rs-product-spinner {
    width: 38px;
    height: 38px;
    border: 3px solid #e5ddda;
    border-top-color: #111111;
    border-radius: 50%;
    animation: rsProductSpin 750ms linear infinite;
  }

  @keyframes rsProductSpin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 850px) {
    .rs-product-main {
      grid-template-columns: 1fr;
      gap: 38px;
    }

    .rs-product-gallery {
      grid-template-columns: 1fr;
    }

    .rs-product-thumbnails {
      order: 2;
      flex-direction: row;
      overflow-x: auto;
    }
  }

  @media (max-width: 640px) {

.rs-product-information {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 12px;
}

.rs-product-eyebrow,
.rs-product-title,
.rs-product-price-row,
.rs-product-description,
.rs-product-quantity-area,
.rs-product-actions,
.rs-product-trust-line,
.rs-product-message,
.rs-product-error {
  grid-column: 1 / -1;
}

.rs-product-option {
  margin-bottom: 16px;
}

.rs-product-main-image {
  aspect-ratio: auto;
  height: 340px;
  border-radius: 14px;
}

.rs-product-main-image img {
  object-fit: cover;
  object-position: center;
}

    .rs-product-page {
      padding: 0 12px 50px;
    }

    .rs-product-header {
      min-height: 62px;
      margin-bottom: 20px;
    }

    .rs-product-logo {
      font-size: 18px;
    }

    .rs-product-main {
      gap: 20px;
    }

    .rs-product-information {
      padding: 0;
    }

    .rs-product-title {
      font-size: 34px !important;
      letter-spacing: -1.5px !important;
    }

    .rs-product-eyebrow {
      margin-bottom: 12px;
    }

    .rs-product-price-row {
      margin-top: 17px;
    }

    .rs-product-description {
      margin: 18px 0 24px;
      font-size: 14px;
      line-height: 1.65;
    }

    .rs-product-option {
      margin-bottom: 18px;
    }

    .rs-product-quantity-area {
      margin-top: 20px;
    }

    .rs-product-actions {
      position: static;
      margin-top: 20px;
      padding: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
    }

    .rs-product-divider {
      margin: 25px 0;
    }

    .rs-product-confidence {
      gap: 14px;
    }

    .rs-product-details {
      margin-top: 38px;
      padding: 30px 20px;
    }

    .rs-product-details h2 {
      margin: 13px 0 22px;
      font-size: 29px;
    }

    .rs-product-accordions summary {
      min-height: 58px;
      font-size: 13px;
    }

    .rs-product-accordions details p {
      padding: 0 36px 18px 0;
      font-size: 13px;
    }
  }
/* PRODUCT PAGE FOOTER */

.rs-product-footer {
  margin-top: 56px;
  padding: 42px 0 22px;
  border-top: 1px solid #e8dfda;
  color: #111111;
}

.rs-product-footer-brand {
  padding-bottom: 28px;
  border-bottom: 1px solid #eee6e1;
}

.rs-product-footer-brand strong {
  display: block;
  margin-bottom: 8px;
  font-size: 21px;
  font-weight: 900;
  letter-spacing: 2.2px;
}

.rs-product-footer-brand p {
  margin: 0;
  color: #6d625d;
  font-size: 13px;
  line-height: 1.6;
}

.rs-product-footer-columns {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 36px;
  padding: 30px 0;
  border-bottom: 1px solid #eee6e1;
}

.rs-product-footer-column {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.rs-product-footer-heading {
  margin-bottom: 7px;
  color: #8b5d4d;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1.5px;
}

.rs-product-footer-column a {
  color: #111111;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  transition: opacity 0.2s ease;
}

.rs-product-footer-column a:hover {
  opacity: 0.55;
}

.rs-product-footer-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 20px;
  color: #8b817c;
  font-size: 11px;
}

@media (max-width: 640px) {
  .rs-product-footer {
    margin-top: 38px;
    padding: 32px 0 20px;
  }

  .rs-product-footer-brand {
    padding-bottom: 24px;
  }

  .rs-product-footer-brand strong {
    font-size: 19px;
  }

  .rs-product-footer-brand p {
    max-width: 290px;
    font-size: 12px;
  }

  .rs-product-footer-columns {
    grid-template-columns: 1fr 1fr;
    gap: 28px 20px;
    padding: 26px 0;
  }

  .rs-product-footer-column:last-child {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .rs-product-footer-column:last-child
    .rs-product-footer-heading {
    grid-column: 1 / -1;
  }

  .rs-product-footer-column a {
    font-size: 12px;
  }

  .rs-product-footer-bottom {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
    font-size: 10px;
  }
}



`;

export default ProductPage;

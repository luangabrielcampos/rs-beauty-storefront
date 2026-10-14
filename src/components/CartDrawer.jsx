import {
  useEffect,
  useState,
} from 'react';

import { media } from '@wix/sdk';

import { wixClient } from '../wixClient';
import { useCart } from '../context/CartContext';

const variantDetailsCache = new Map();
const productImageCache = new Map();
const CART_SELECTION_KEY =
  'rs_beauty_cart_variant_selections';

// RS_CART_IMAGE_METADATA_V2

function getText(value) {
  if (typeof value === 'string') {
    return value;
  }

  return (
    value?.translated ||
    value?.original ||
    value?.value ||
    ''
  );
}

function getItemName(item) {
  return (
    getText(item?.name) ||
    'RS BEAUTY Product'
  );
}

function resolveWixImage(image) {
  if (!image) return '';

  const value =
    typeof image === 'string'
      ? image
      : image?.url ||
        image?.src ||
        image?.id ||
        image?.imageInfo?.url ||
        image?.imageInfo?.src ||
        '';

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
    console.error(
      'Could not resolve Wix image:',
      error
    );

    return '';
  }
}

function getItemImage(item) {
  return (
    resolveWixImage(item?.attributes?.image) ||
    resolveWixImage(item?.image) ||
    resolveWixImage(item?.media?.mainMedia?.image) ||
    resolveWixImage(item?.media?.main?.image) ||
    ''
  );
}

function getProductMainImage(product) {
  const mediaItems =
    product?.media?.itemsInfo?.items || [];

  return (
    resolveWixImage(product?.media?.main?.image) ||
    resolveWixImage(mediaItems[0]?.image) ||
    ''
  );
}

function getCatalogReferencedData(item) {
  const catalogReference =
    item?.catalogReference ||
    item?.source?.catalogReference ||
    {};

  const productId =
    catalogReference?.catalogItemId ||
    item?.source?.rootCatalogItemId ||
    item?.productId ||
    item?.product?._id ||
    item?.product?.id ||
    '';

  const variantId =
    catalogReference?.options?.variantId ||
    catalogReference?.variantId ||
    item?.variantId ||
    '';

  return {
    productId,
    variantId,
  };
}

async function getCatalogProductImage(item) {
  
  const { productId } =
    getCatalogReferenceData(item);



  if (!productId) return '';

  if (productImageCache.has(productId)) {
    return productImageCache.get(productId);
  }

  try {
    const response =
      await wixClient.productsV3.getProduct(
        productId,
        {
          fields: ['MEDIA_ITEMS_INFO'],
        }
      );

   const product = response?.product || response;
const image = getProductMainImage(product);


    productImageCache.set(productId, image);

    return image;
  } catch (error) {
    console.error(
      'Could not load cart product image:',
      error
    );

    return '';
  }
}

function getItemQuantity(item) {
  return (
    item?.quantityInfo?.confirmedQuantity ||
    item?.quantityInfo?.requestedQuantity ||
    item?.quantity ||
    1
  );
}

function formatUSD(amount) {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount)) {
    return '';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(numericAmount);
}

function getItemPrice(item) {
  const formatted =
    item?.pricing?.totalPrice?.formattedConvertedAmount ||
    item?.pricing?.totalPrice?.formattedAmount ||
    item?.pricing?.unitPrice?.formattedConvertedAmount ||
    item?.pricing?.unitPrice?.formattedAmount;

  if (formatted) {
    return formatted;
  }

  const amount =
    item?.pricing?.totalPrice?.convertedAmount ||
    item?.pricing?.totalPrice?.amount ||
    item?.pricing?.unitPrice?.convertedAmount ||
    item?.pricing?.unitPrice?.amount;

  return formatUSD(amount);
}

function getSubtotal(cart) {
  const formatted =
    cart?.subtotal?.formattedConvertedAmount ||
    cart?.subtotal?.formattedAmount;

  if (formatted) {
    return formatted;
  }

  const amount =
    cart?.subtotal?.convertedAmount ||
    cart?.subtotal?.amount ||
    0;

  return formatUSD(amount);
}

function getDescriptionLines(item) {
  return (item?.descriptionLines || [])
    .map((line) => {
      const name = getText(line?.name);

      const value =
        getText(line?.plainText) ||
        getText(line?.colorInfo?.description) ||
        getText(line?.colorInfo?.original) ||
        getText(line?.value);

      if (!value) {
        return '';
      }

      return name
        ? `${name}: ${value}`
        : value;
    })
    .filter(Boolean);
}

function getCatalogReferenceData(item) {
  const catalogReference =
    item?.catalogReference || {};

  const productId =
    catalogReference?.catalogItemId ||
    catalogReference?.catalogItem?.id ||
    '';

  const variantId =
    catalogReference?.options?.variantId ||
    catalogReference?.options?.options?.variantId ||
    catalogReference?.variantId ||
    '';

  return {
    productId,
    variantId,
  };
}

function getSavedCartRecord(item) {
  try {
    const stored = JSON.parse(
      localStorage.getItem(CART_SELECTION_KEY) ||
        '{}'
    );

    const {
      productId,
      variantId,
    } = getCatalogReferenceData(item);

    const exactRecord =
      productId && variantId
        ? stored[`${productId}:${variantId}`]
        : null;

    const productRecord = productId
      ? stored[`product:${productId}`]
      : null;

    const nameRecord =
      stored[`name:${getItemName(item)}`];

    return (
      exactRecord ||
      productRecord ||
      nameRecord ||
      null
    );
  } catch (error) {
    console.error(
      'Could not read saved cart metadata:',
      error
    );

    return null;
  }
}

function getSavedVariantDescriptionLines(item) {
  const record = getSavedCartRecord(item);

  return Object.entries(
    record?.options || {}
  ).map(
    ([optionName, choiceName]) =>
      `${optionName}: ${choiceName}`
  );
}

function getSavedProductImage(item) {
  const record = getSavedCartRecord(item);

  return resolveWixImage(record?.image || '');
}

async function getVariantDescriptionLines(item) {
  const {
    productId,
    variantId,
  } = getCatalogReferenceData(item);

  if (!productId || !variantId) {
    return [];
  }

  const cacheKey = `${productId}:${variantId}`;

  if (variantDetailsCache.has(cacheKey)) {
    return variantDetailsCache.get(cacheKey);
  }

  try {
    const response =
      await wixClient.productsV3.getProduct(
        productId,
        {
          fields: [
            'VARIANT_OPTION_CHOICE_NAMES',
          ],
        }
      );

    const product =
      response?.product || response;

    const variant =
      (product?.variantsInfo?.variants || [])
        .find((currentVariant) =>
          (currentVariant?._id ||
            currentVariant?.id) === variantId
        );

    const descriptions =
      (variant?.choices || [])
        .map((choice) => {
          const names =
            choice?.optionChoiceNames;

          if (
            !names?.optionName ||
            !names?.choiceName
          ) {
            return '';
          }

          return (
            `${names.optionName}: ` +
            names.choiceName
          );
        })
        .filter(Boolean);

    variantDetailsCache.set(
      cacheKey,
      descriptions
    );

    return descriptions;
  } catch (error) {
    console.error(
      'Could not load cart variant details:',
      error
    );

    return [];
  }
}

function CartDrawer() {
  const {
    cart,
    cartCount,
    cartOpen,
    cartBusy,
    cartMessage,
    cartError,
    closeCart,
    changeCartItemQuantity,
    removeCartItem,
    checkoutCurrentCart,
  } = useCart();

  const [resolvedOptions, setResolvedOptions] =
    useState({});

  const [resolvedImages, setResolvedImages] =
    useState({});

  useEffect(() => {
    if (!cartOpen) return undefined;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    function closeWithEscape(event) {
      if (event.key === 'Escape') {
        closeCart();
      }
    }

    window.addEventListener(
      'keydown',
      closeWithEscape
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        'keydown',
        closeWithEscape
      );
    };
  }, [cartOpen, closeCart]);

  useEffect(() => {
    if (!cartOpen) return undefined;

    const items = cart?.lineItems || [];

    if (!items.length) {
      setResolvedOptions({});
      return undefined;
    }

    let cancelled = false;

    async function loadVariantDetails() {
      const entries = await Promise.all(
        items.map(async (item) => {
          const itemId =
            item?._id || item?.id;

          const cartDescriptions =
            getDescriptionLines(item);

          if (cartDescriptions.length) {
            return [
              itemId,
              cartDescriptions,
            ];
          }

          const variantDescriptions =
            await getVariantDescriptionLines(item);

          return [
            itemId,
            variantDescriptions,
          ];
        })
      );

      if (!cancelled) {
        setResolvedOptions(
          Object.fromEntries(entries)
        );
      }
    }

    loadVariantDetails();

    return () => {
      cancelled = true;
    };
  }, [cartOpen, cart]);

  useEffect(() => {
    if (!cartOpen) return undefined;

    const items = cart?.lineItems || [];

    if (!items.length) {
      setResolvedImages({});
      return undefined;
    }

    let cancelled = false;

    async function loadMissingImages() {
      const entries = await Promise.all(
        items.map(async (item) => {
          const itemId = item?._id || item?.id;
          const currentImage = getItemImage(item);

          const image =
            currentImage ||
            (await getCatalogProductImage(item));

          return [itemId, image];
        })
      );

      if (!cancelled) {
        setResolvedImages(
          Object.fromEntries(entries)
        );
      }
    }

    loadMissingImages();

    return () => {
      cancelled = true;
    };
  }, [cartOpen, cart]);

  if (!cartOpen) {
    return null;
  }

  const lineItems = cart?.lineItems || [];

  return (
    <>
      <style>{`
        .global-cart-overlay {
          position: fixed;
          inset: 0;
          z-index: 4000;
          background: rgba(17, 17, 17, 0.46);
          backdrop-filter: blur(2px);
        }

        .global-cart-drawer {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          z-index: 4001;
          width: min(440px, 100%);
          display: flex;
          flex-direction: column;
          background: #ffffff;
          color: #111111;
          box-shadow: -16px 0 50px rgba(0, 0, 0, 0.16);
          animation: globalCartEnter 220ms ease-out;
        }

        @keyframes globalCartEnter {
          from {
            transform: translateX(100%);
          }

          to {
            transform: translateX(0);
          }
        }

        .global-cart-header {
          min-height: 76px;
          padding: 0 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #e9e5e2;
        }

        .global-cart-heading {
          margin: 0;
          color: #111111 !important;
          font-size: 20px;
          font-weight: 850;
          letter-spacing: -0.3px;
        }

        .global-cart-close {
          width: 42px;
          height: 42px;
          padding: 0;
          border: 0;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: #f5f1ee;
          color: #111111;
          font-size: 27px;
          line-height: 1;
          cursor: pointer;
        }

        .global-cart-notice {
          margin: 14px 20px 0;
          padding: 11px 13px;
          border-radius: 9px;
          background: #eef9f0;
          color: #245d31;
          font-size: 12px;
          line-height: 1.45;
        }

        .global-cart-notice.error {
          background: #fff0f0;
          color: #8d2424;
        }

        .global-cart-items {
          flex: 1;
          overflow-y: auto;
          padding: 4px 20px 24px;
        }

        .global-empty-cart {
          min-height: 360px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: #746b67;
        }

        .global-empty-cart-symbol {
          width: 62px;
          height: 62px;
          margin-bottom: 18px;
          border: 1px solid #d9d1cc;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-size: 25px;
        }

        .global-empty-cart strong {
          margin-bottom: 7px;
          color: #111111;
          font-size: 17px;
        }

        .global-empty-cart span {
          max-width: 250px;
          font-size: 13px;
          line-height: 1.5;
        }

        .global-cart-item {
          display: grid;
          grid-template-columns: 92px minmax(0, 1fr);
          gap: 14px;
          padding: 20px 0;
          border-bottom: 1px solid #ece8e5;
        }

        .global-cart-image-box {
          width: 92px;
          height: 112px;
          overflow: hidden;
          border-radius: 10px;
          display: grid;
          place-items: center;
          background: #f4f0ed;
        }

        .global-cart-image {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
        }

        .global-cart-image-placeholder {
          padding: 8px;
          color: #8b7d76;
          font-size: 10px;
          font-weight: 800;
          text-align: center;
          letter-spacing: 0.7px;
        }

        .global-cart-item-content {
          min-width: 0;
        }

        .global-cart-item-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .global-cart-item-name {
          margin: 0;
          color: #111111;
          font-size: 14px;
          font-weight: 800;
          line-height: 1.35;
        }

        .global-cart-item-price {
          flex-shrink: 0;
          font-size: 13px;
          font-weight: 800;
        }

        .global-cart-options {
          min-height: 18px;
          margin: 7px 0 14px;
          color: #756b66;
          font-size: 11px;
          line-height: 1.45;
        }

        .global-cart-option {
          display: block;
        }

        .global-cart-item-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .global-cart-quantity {
          height: 38px;
          display: inline-flex;
          align-items: center;
          overflow: hidden;
          border: 1px solid #cfc7c2;
          border-radius: 8px;
        }

        .global-cart-quantity button {
          width: 35px;
          height: 100%;
          padding: 0;
          border: 0;
          background: #ffffff;
          color: #111111;
          font-size: 17px;
          cursor: pointer;
        }

        .global-cart-quantity button:disabled {
          opacity: 0.35;
          cursor: wait;
        }

        .global-cart-quantity span {
          min-width: 32px;
          text-align: center;
          font-size: 13px;
          font-weight: 800;
        }

        .global-cart-remove {
          padding: 5px 0;
          border: 0;
          background: transparent;
          color: #756b66;
          font-size: 11px;
          text-decoration: underline;
          cursor: pointer;
        }

        .global-cart-remove:disabled {
          opacity: 0.4;
          cursor: wait;
        }

        .global-cart-footer {
          padding: 18px 20px 22px;
          border-top: 1px solid #e2dcd8;
          background: #ffffff;
          box-shadow: 0 -8px 25px rgba(0, 0, 0, 0.04);
        }

        .global-cart-subtotal {
          margin-bottom: 7px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 17px;
          font-weight: 850;
        }

        .global-cart-small-print {
          margin: 0 0 16px;
          color: #746b67;
          font-size: 11px;
        }

        .global-cart-checkout {
          width: 100%;
          min-height: 50px;
          border: 1px solid #111111;
          border-radius: 9px;
          background: #111111;
          color: #ffffff;
          font-size: 14px;
          font-weight: 850;
          cursor: pointer;
        }

        .global-cart-checkout:disabled {
          background: #a8a8a8;
          border-color: #a8a8a8;
          cursor: not-allowed;
        }

        .global-cart-continue {
          width: 100%;
          min-height: 44px;
          margin-top: 9px;
          border: 1px solid #111111;
          border-radius: 9px;
          background: #ffffff;
          color: #111111;
          font-size: 13px;
          font-weight: 750;
          cursor: pointer;
        }

        .global-cart-security {
          margin-top: 13px;
          color: #746b67;
          font-size: 10px;
          text-align: center;
        }

        @media (max-width: 520px) {
          .global-cart-drawer {
            width: 100%;
          }

          .global-cart-header {
            min-height: 66px;
            padding: 0 15px;
          }

          .global-cart-items {
            padding-right: 14px;
            padding-left: 14px;
          }

          .global-cart-footer {
            padding: 15px 14px 18px;
          }

          .global-cart-item {
            grid-template-columns: 80px minmax(0, 1fr);
            gap: 12px;
          }

          .global-cart-image-box {
            width: 80px;
            height: 100px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .global-cart-drawer {
            animation: none;
          }
        }
      `}</style>

      <button
        type="button"
        className="global-cart-overlay"
        aria-label="Close shopping bag"
        onClick={closeCart}
      />

      <aside
        className="global-cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Shopping bag"
      >
        <header className="global-cart-header">
          <h2 className="global-cart-heading">
            Your Bag ({cartCount})
          </h2>

          <button
            type="button"
            className="global-cart-close"
            aria-label="Close shopping bag"
            onClick={closeCart}
          >
            ×
          </button>
        </header>

        {cartMessage && (
          <div className="global-cart-notice">
            {cartMessage}
          </div>
        )}

        {cartError && (
          <div className="global-cart-notice error">
            {cartError}
          </div>
        )}

        <div className="global-cart-items">
          {!lineItems.length ? (
            <div className="global-empty-cart">
              <div className="global-empty-cart-symbol">
                ♡
              </div>

              <strong>Your bag is empty</strong>

              <span>
                Discover beauty essentials selected
                for your everyday ritual.
              </span>
            </div>
          ) : (
            lineItems.map((item) => {
              const itemId =
                item?._id || item?.id;

              const image =
                getItemImage(item) ||
                getSavedProductImage(item) ||
                resolvedImages[itemId] ||
                '';

              const quantity =
                getItemQuantity(item);

              const cartDescriptionLines =
                getDescriptionLines(item);

              const apiDescriptionLines =
                resolvedOptions[itemId] || [];

              const savedDescriptionLines =
                getSavedVariantDescriptionLines(item);

              const descriptionLines =
                cartDescriptionLines.length
                  ? cartDescriptionLines
                  : apiDescriptionLines.length
                    ? apiDescriptionLines
                    : savedDescriptionLines;

              const itemIsBusy =
                cartBusy === `line-${itemId}`;

              return (
                <article
                  className="global-cart-item"
                  key={itemId}
                >
                  <div className="global-cart-image-box">
                    {image ? (
                      <img
                        src={image}
                        alt={getItemName(item)}
                        className="global-cart-image"
                      />
                    ) : (
                      <div className="global-cart-image-placeholder">
                        RS BEAUTY™
                      </div>
                    )}
                  </div>

                  <div className="global-cart-item-content">
                    <div className="global-cart-item-top">
                      <h3 className="global-cart-item-name">
                        {getItemName(item)}
                      </h3>

                      <span className="global-cart-item-price">
                        {getItemPrice(item)}
                      </span>
                    </div>

                    <div className="global-cart-options">
                      {descriptionLines.map(
                        (description) => (
                          <span
                            className="global-cart-option"
                            key={description}
                          >
                            {description}
                          </span>
                        )
                      )}
                    </div>

                    <div className="global-cart-item-actions">
                      <div className="global-cart-quantity">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          disabled={itemIsBusy}
                          onClick={() =>
                            changeCartItemQuantity(
                              item,
                              -1
                            )
                          }
                        >
                          −
                        </button>

                        <span>{quantity}</span>

                        <button
                          type="button"
                          aria-label="Increase quantity"
                          disabled={itemIsBusy}
                          onClick={() =>
                            changeCartItemQuantity(
                              item,
                              1
                            )
                          }
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        className="global-cart-remove"
                        disabled={itemIsBusy}
                        onClick={() =>
                          removeCartItem(item)
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <footer className="global-cart-footer">
          <div className="global-cart-subtotal">
            <span>Subtotal</span>
            <span>{getSubtotal(cart)}</span>
          </div>

          <p className="global-cart-small-print">
            Taxes and shipping calculated at checkout.
          </p>

          <button
            type="button"
            className="global-cart-checkout"
            disabled={
              !lineItems.length ||
              cartBusy === 'cart-checkout'
            }
            onClick={checkoutCurrentCart}
          >
            {cartBusy === 'cart-checkout'
              ? 'Opening secure checkout...'
              : 'Secure Checkout'}
          </button>

          <button
            type="button"
            className="global-cart-continue"
            onClick={closeCart}
          >
            Continue Shopping
          </button>

          <div className="global-cart-security">
            ✓ Secure payment · ✓ Easy returns
          </div>
        </footer>
      </aside>
    </>
  );
}

export default CartDrawer;

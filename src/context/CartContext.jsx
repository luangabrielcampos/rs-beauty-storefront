import { getStoreCheckoutUrl } from '../checkoutRedirect.js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { wixClient } from '../wixClient';

const CartContext = createContext(null);

const SESSION_KEY = 'rs_beauty_wix_session';
const WIX_STORES_APP_ID =
  '215238eb-22a5-4c36-9e7b-e7c08025e04e';

let sessionPromise = null;

function saveSession() {
  try {
    const tokens = wixClient.auth.getTokens();

    if (tokens) {
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify(tokens)
      );
    }
  } catch (error) {
    console.error('Erro ao salvar a sessão Wix:', error);
  }
}

async function initializeWixSession() {
  let storedTokens;

  try {
    const storedSession =
      localStorage.getItem(SESSION_KEY);

    if (storedSession) {
      storedTokens = JSON.parse(storedSession);
      wixClient.auth.setTokens(storedTokens);
    }
  } catch (error) {
    console.error(
      'Erro ao recuperar a sessão Wix:',
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

  return validTokens;
}

function ensureWixSession() {
  if (!sessionPromise) {
    sessionPromise =
      initializeWixSession().catch((error) => {
        sessionPromise = null;
        throw error;
      });
  }

  return sessionPromise;
}

function resolveCart(response) {
  return response?.cart || response || null;
}

function getLineItemQuantity(item) {
  return (
    item?.quantityInfo?.confirmedQuantity ||
    item?.quantityInfo?.requestedQuantity ||
    item?.quantity ||
    1
  );
}

function countCartItems(cart) {
  return (cart?.lineItems || []).reduce(
    (total, item) =>
      total + getLineItemQuantity(item),
    0
  );
}

function createCatalogItem({
  productId,
  variantId,
  quantity = 1,
}) {
  if (!productId) {
    throw new Error('Produto sem identificação válida.');
  }

  if (!variantId) {
    throw new Error('Selecione uma variante do produto.');
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

export function CartProvider({ children }) {
  const [cart, setCart] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartReady, setCartReady] = useState(false);
  const [cartBusy, setCartBusy] = useState('');
  const [cartMessage, setCartMessage] = useState('');
  const [cartError, setCartError] = useState('');

  const cartCount = useMemo(
    () => countCartItems(cart),
    [cart]
  );

  const applyCart = useCallback((response) => {
    const updatedCart = resolveCart(response);

    setCart(updatedCart);
    saveSession();

    return updatedCart;
  }, []);

  const refreshCart = useCallback(async () => {
    await ensureWixSession();

    try {
      const response =
        await wixClient.currentCartV2.getCurrentCart();

      return applyCart(response);
    } catch {
      setCart(null);
      return null;
    }
  }, [applyCart]);

  useEffect(() => {
    let active = true;

    async function startGlobalCart() {
      try {
        await ensureWixSession();

        if (!active) return;

        await refreshCart();
      } catch (error) {
        console.error(error);

        if (active) {
          setCartError(
            error?.message ||
              'Não foi possível iniciar o carrinho.'
          );
        }
      } finally {
        if (active) {
          setCartReady(true);
        }
      }
    }

    startGlobalCart();

    return () => {
      active = false;
    };
  }, [refreshCart]);

  const clearCartStatus = useCallback(() => {
    setCartMessage('');
    setCartError('');
  }, []);

  const openCart = useCallback(async () => {
    clearCartStatus();
    setCartOpen(true);
    await refreshCart();
  }, [clearCartStatus, refreshCart]);

  const closeCart = useCallback(() => {
    setCartOpen(false);
  }, []);

  const addProductToCart = useCallback(
    async ({
      productId,
      variantId,
      quantity = 1,
      productName = 'Product',
    }) => {
      try {
        setCartBusy(`add-${productId}`);
        clearCartStatus();

        await ensureWixSession();

        const catalogItem = createCatalogItem({
          productId,
          variantId,
          quantity,
        });

        const response =
          await wixClient.currentCartV2
            .addLineItemsToCurrentCart({
              catalogItems: [catalogItem],
            });

        const updatedCart = applyCart(response);

        setCartMessage(
          `✓ ${productName} was added to your bag.`
        );

        return updatedCart;
      } catch (error) {
        console.error(error);

        const message =
          error?.message ||
          `Não foi possível adicionar ${productName} ao carrinho.`;

        setCartError(message);
        throw error;
      } finally {
        setCartBusy('');
      }
    },
    [applyCart, clearCartStatus]
  );

  const buyProductNow = useCallback(
    async ({
      productId,
      variantId,
      quantity = 1,
    }) => {
      try {
        setCartBusy(`buy-${productId}`);
        clearCartStatus();

        await ensureWixSession();

        const catalogItem = createCatalogItem({
          productId,
          variantId,
          quantity,
        });

        const createdCart =
          await wixClient.cartV2.createCart({
            catalogItems: [catalogItem],
          });

        const cartId =
          createdCart?._id ||
          createdCart?.id ||
          createdCart?.cart?._id ||
          createdCart?.cart?.id;

        if (!cartId) {
          throw new Error(
            'Não foi possível criar o checkout.'
          );
        }

        const checkout =
          await getStoreCheckoutUrl(cartId);

        saveSession();

        if (!checkout?.checkoutUrl) {
          throw new Error(
            'O Wix não retornou o endereço do checkout.'
          );
        }

        window.location.assign(
          checkout.checkoutUrl
        );
      } catch (error) {
        console.error(error);

        setCartError(
          error?.message ||
            'Não foi possível abrir o checkout.'
        );

        setCartBusy('');
        throw error;
      }
    },
    [clearCartStatus]
  );

  const changeCartItemQuantity = useCallback(
    async (item, difference) => {
      const lineItemId =
        item?._id || item?.id;

      const currentQuantity =
        getLineItemQuantity(item);

      const newQuantity =
        currentQuantity + difference;

      if (!lineItemId) return;

      if (newQuantity < 1) {
        return removeCartItem(item);
      }

      try {
        setCartBusy(`line-${lineItemId}`);
        clearCartStatus();

        const response =
          await wixClient.currentCartV2
            .updateLineItemsInCurrentCart({
              lineItems: [
                {
                  lineItemId,
                  quantity: {
                    newQuantity,
                  },
                },
              ],
            });

        return applyCart(response);
      } catch (error) {
        console.error(error);

        setCartError(
          error?.message ||
            'Não foi possível atualizar a quantidade.'
        );

        throw error;
      } finally {
        setCartBusy('');
      }
    },
    [applyCart, clearCartStatus]
  );

  const removeCartItem = useCallback(
    async (item) => {
      const lineItemId =
        item?._id || item?.id;

      if (!lineItemId) return;

      try {
        setCartBusy(`line-${lineItemId}`);
        clearCartStatus();

        const response =
          await wixClient.currentCartV2
            .removeLineItemsFromCurrentCart(
              [lineItemId]
            );

        return applyCart(response);
      } catch (error) {
        console.error(error);

        setCartError(
          error?.message ||
            'Não foi possível remover o produto.'
        );

        throw error;
      } finally {
        setCartBusy('');
      }
    },
    [applyCart, clearCartStatus]
  );

  const checkoutCurrentCart = useCallback(
    async () => {
      try {
        setCartBusy('cart-checkout');
        clearCartStatus();

        const currentCart =
          await refreshCart();

        const cartId =
          currentCart?._id ||
          currentCart?.id;

        if (
          !cartId ||
          !currentCart?.lineItems?.length
        ) {
          throw new Error(
            'Seu carrinho está vazio.'
          );
        }

        const checkout =
          await getStoreCheckoutUrl(cartId);

        if (!checkout?.checkoutUrl) {
          throw new Error(
            'O Wix não retornou o endereço do checkout.'
          );
        }

        saveSession();

        window.location.assign(
          checkout.checkoutUrl
        );
      } catch (error) {
        console.error(error);

        setCartError(
          error?.message ||
            'Não foi possível abrir o checkout.'
        );

        setCartBusy('');
        throw error;
      }
    },
    [clearCartStatus, refreshCart]
  );

  const value = useMemo(
    () => ({
      cart,
      cartCount,
      cartOpen,
      cartReady,
      cartBusy,
      cartMessage,
      cartError,
      openCart,
      closeCart,
      refreshCart,
      addProductToCart,
      buyProductNow,
      changeCartItemQuantity,
      removeCartItem,
      checkoutCurrentCart,
      clearCartStatus,
    }),
    [
      cart,
      cartCount,
      cartOpen,
      cartReady,
      cartBusy,
      cartMessage,
      cartError,
      openCart,
      closeCart,
      refreshCart,
      addProductToCart,
      buyProductNow,
      changeCartItemQuantity,
      removeCartItem,
      checkoutCurrentCart,
      clearCartStatus,
    ]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error(
      'useCart precisa estar dentro de CartProvider.'
    );
  }

  return context;
}
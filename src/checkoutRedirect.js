import { wixClient } from './wixClient.js';

// Cart V2 unifies cart and checkout: its cart ID is also the checkout ID.
export async function getStoreCheckoutUrl(cartId) {
  if (!cartId) throw new Error('O carrinho não tem uma identificação válida.');

  const origin = window.location.origin;
  const result = await wixClient.redirects.createRedirectSession({
    ecomCheckout: { checkoutId: cartId },
    callbacks: {
      thankYouPageUrl: new URL('/order-confirmation', origin).href,
      postFlowUrl: new URL('/shop', origin).href,
      cartPageUrl: new URL('/', origin).href,
    },
    preferences: {
      useGenericWixPages: true,
      maintainIdentity: true,
      additionalQueryParameters: { currency: 'USD' },
    },
  });

  const checkoutUrl = result?.redirectSession?.fullUrl;
  if (!checkoutUrl) {
    throw new Error('O Wix não retornou o endereço do checkout.');
  }
  return { checkoutUrl };
}

import { createClient, OAuthStrategy } from '@wix/sdk';
import { redirects } from '@wix/redirects';
import { productsV3 } from '@wix/stores';
import { currentCartV2, cartV2 } from '@wix/ecom';

export const wixClient = createClient({
  modules: {
    redirects,
    productsV3,
    currentCartV2,
    cartV2,
  },

  auth: OAuthStrategy({
    clientId: import.meta.env.VITE_WIX_CLIENT_ID,
    siteId: import.meta.env.VITE_WIX_SITE_ID,
  }),
});
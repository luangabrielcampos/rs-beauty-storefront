import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  Route,
  Routes,
} from 'react-router';

import './index.css';
import App from './App.jsx';
import OrderReturnPage from './pages/OrderReturnPage.jsx';
import ProductPage from './pages/ProductPage.jsx';
import ShopPage from './pages/ShopPage.jsx';
import StoreInfoPage from './pages/StoreInfoPage.jsx';
import { CartProvider } from './context/CartContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <CartProvider>
        <Routes>
          <Route path="/order-confirmation" element={<OrderReturnPage />} />
          <Route
  path="/contact"
  element={<StoreInfoPage page="contact" />}
/>

<Route
  path="/shipping"
  element={<StoreInfoPage page="shipping" />}
/>

<Route
  path="/returns"
  element={<StoreInfoPage page="returns" />}
/>

<Route
  path="/privacy"
  element={<StoreInfoPage page="privacy" />}
/>

<Route
  path="/terms"
  element={<StoreInfoPage page="terms" />}
/>
          <Route
            path="/"
            element={<App />}
          />

          <Route
            path="/product/:productId"
            element={<ProductPage />}
          />

          <Route
            path="/shop"
            element={<ShopPage />}
          />

          <Route
            path="*"
            element={<App />}
          />
        </Routes>
      </CartProvider>
    </BrowserRouter>
  </StrictMode>
);

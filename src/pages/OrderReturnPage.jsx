import { Link, useSearchParams } from 'react-router';

export default function OrderReturnPage() {
  const [params] = useSearchParams();
  const candidate = params.get('orderId') || '';
  const orderId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidate)
    ? candidate
    : '';

  // A URL parameter is a reference, never proof of an order or payment.
  // Do not clear a cart or trigger fulfillment from this page.
  return (
    <main className="rs-order-return">
      <style>{`
        .rs-order-return { min-height:100svh; box-sizing:border-box; padding:32px 20px;
          display:grid; place-items:center; background:#f6f1eb; color:#241d19;
          font-family:Arial,sans-serif; }
        .rs-order-return * { box-sizing:border-box; }
        .rs-order-card { width:100%; max-width:580px; padding:clamp(24px,6vw,52px);
          background:#fff; border:1px solid #e6d9cc; border-radius:20px;
          box-shadow:0 16px 60px #4934210a; }
        .rs-order-brand { display:inline-block; color:#241d19; text-decoration:none;
          font-weight:800; letter-spacing:3px; font-size:17px; margin-bottom:44px; }
       .rs-order-card h1 {
  color: #241d19;
  font-family: Georgia, serif;
  font-weight: 400;
  font-size: clamp(32px, 7vw, 44px);
  line-height: 1.15;
  margin: 0 0 20px;
}
        .rs-order-card p { font-size:15px; line-height:1.7; color:#655a51; }
        .rs-order-reference { background:#f6f1eb; border-radius:10px; padding:18px;
          margin:24px 0; font-size:13px; }
        .rs-order-reference span { display:block; margin-top:8px; overflow-wrap:anywhere; }
        .rs-order-actions { display:flex; flex-wrap:wrap; gap:12px; margin-top:30px; }
        .rs-order-actions a { flex:1 1 160px; text-align:center; text-decoration:none;
          padding:15px; border:1px solid #241d19; border-radius:8px; color:#241d19;
          font-size:14px; font-weight:600; }
        .rs-order-actions a:first-child { background:#241d19; color:white; }
        .rs-order-return a:focus-visible { outline:3px solid #ad7442; outline-offset:4px; }
      `}</style>
      <section className="rs-order-card" aria-labelledby="rs-order-heading">
        <Link className="rs-order-brand" to="/">RS BEAUTY™</Link>
        <h1 id="rs-order-heading">{orderId ? 'Thank you for choosing us.' : 'Your checkout details'}</h1>
        {orderId ? (
          <>
            <p>Check your confirmation email for your order details and payment status.</p>
            <div className="rs-order-reference">
              <strong>Order reference received from checkout</strong>
              <span>{orderId}</span>
            </div>
            <p>This page does not verify payment approval. If you need help confirming your order, contact us with the reference above before placing another order.</p>
          </>
        ) : (
          <p>No order reference was received. If you just completed checkout, check your email or contact us before placing another order.</p>
        )}
        <nav className="rs-order-actions" aria-label="Next steps">
          <Link to="/shop">Continue shopping</Link>
          <Link to="/contact">Contact us</Link>
        </nav>
      </section>
    </main>
  );
}

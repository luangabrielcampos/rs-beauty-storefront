import { Link } from "react-router";
import GlobalHeader from "../components/GlobalHeader.jsx";
const PAGE_CONTENT = {
  contact: {
    eyebrow: "CUSTOMER CARE",
    title: "How can we help?",
    intro:
      "Our customer care team is here to help with questions about your order, delivery or product.",
    sections: [
      {
        title: "Contact us",
        text: "If you need assistance, please contact our customer care team and include your order number whenever possible.",
      },
      {
        title: "Order support",
        text: "For questions about an existing order, include the email used at checkout and your order number so we can assist you more efficiently.",
      },
      {
        title: "Before you buy",
        text: "Have a question about a product, delivery or available options? Contact us before ordering and we will be happy to help.",
      },
    ],
  },
  shipping: {
    eyebrow: "DELIVERY",
    title: "Shipping & Delivery",
    intro:
      "Clear delivery information so you know what to expect after placing your order.",
    sections: [
      {
        title: "Order processing",
        text: "Orders are generally prepared for shipment within 1–3 business days.",
      },
      {
        title: "Estimated delivery",
        text: "Delivery typically takes approximately 10–15 business days after processing, depending on the destination and local carrier conditions.",
      },
      {
        title: "International delivery",
        text: "We currently deliver to the United States, Canada and the United Kingdom. Available shipping options are shown at checkout.",
      },
      {
        title: "Tracking",
        text: "When tracking information is available, it will be provided after your order has been processed and shipped.",
      },
    ],
  },
  returns: {
    eyebrow: "CUSTOMER CARE",
    title: "Returns & Refunds",
    intro: "We want you to feel confident when shopping with RS BEAUTY™.",
    sections: [
      {
        title: "30-day return policy",
        text: "For change-of-mind returns under our voluntary 30-day policy, contact us within 30 days of delivery and include your order number. Items must be unused. Opening the packaging solely to inspect the item does not by itself count as use. This condition does not restrict your statutory cancellation or inspection rights, or your rights concerning faulty, damaged or incorrectly supplied goods.",
      },
      {
        title: "Damaged, defective or incorrect items",
        text: "If your item arrives damaged, defective or incorrect, contact us as soon as possible after discovering the issue. Include your order number and, where possible, clear photos or a video to help us assess the problem. We will explain the available remedies in accordance with your applicable consumer rights.",
      },
      {
        title: "Order cancellations",
        text: "Contact us as soon as possible to request cancellation. If your order has not entered processing or shipment, we can cancel it for a full refund. Once processing or shipment begins, we may be unable to stop dispatch, but this does not remove any applicable cancellation or return rights. Contact receitassenior@gmail.com for assistance.",
      },
      {
        title: "Returns",
        text: "Contact us before sending an item back so we can provide the return address and instructions. If a return is required because your item is faulty, damaged or incorrectly supplied, RS BEAUTY will cover the necessary return shipping costs. For change-of-mind returns, you are responsible for return shipping costs unless applicable law requires otherwise. This does not affect your statutory rights.",
      },
      {
        title: "Refunds",
        text: "Approved refunds are issued to the original payment method. The time required for the funds to appear may vary depending on your bank or payment provider.",
      },
    ],
  },
  privacy: {
    eyebrow: "LEGAL",
    title: "Privacy Policy",
    intro:
      "RS BEAUTY is operated by Luan Gabriel Campos de Britto, based in Brazil, who is responsible for the personal information handled by our store. This Privacy Policy explains how we collect, use and share that information. For privacy questions or requests, contact receitassenior@gmail.com.",
    sections: [
      {
        title: "Information we collect",
        text: "We may collect information you provide when placing an order, contacting customer support, creating an account or interacting with our store. This may include your name, email address, shipping address, phone number and order information.",
      },
      {
        title: "How information is used",
        text: "We may use your information to process and deliver orders, provide customer support, communicate about your purchase, improve our store, prevent fraud and comply with applicable legal obligations.",
      },
      {
        title: "Legal bases for using information",
        text: "Where applicable data protection law requires a legal basis, we process order and delivery information to perform our contract with you, and required records to meet legal obligations. We rely on legitimate interests for responding to enquiries and protecting our store against fraud, subject to your rights. Where consent is required, we rely on that consent.",
      },
      {
        title: "Payments",
        text: "Payment information is processed by our payment and commerce providers. RS BEAUTY™ does not directly store complete payment card details.",
      },
      {
        title: "Service providers",
        text: "We share information needed to operate our store and fulfil your orders with service providers, including Wix, payment processors, fulfilment suppliers, delivery companies and customer support services. Depending on their role, this may include your contact details, delivery address, order details and payment transaction information.",
      },
      {
        title: "International processing",
        text: "RS BEAUTY is operated from Brazil and uses service providers that may process information in other countries. Fulfilling an international order may require sharing delivery and order details with suppliers and carriers outside your country. Contact receitassenior@gmail.com for information about the providers and locations involved in your order.",
      },
      {
        title: "Cookies and similar technologies",
        text: "Our store uses browser storage to remember your cart selections. Cookies and similar technologies may also be used by our commerce and payment providers to support checkout and security. You can manage cookies and site data through your browser settings. Blocking or clearing them may affect store functions or remove saved cart selections.",
      },
      {
        title: "Data retention",
        text: "We retain personal information only for as long as reasonably necessary to provide our services, maintain business records, resolve disputes and meet legal or regulatory requirements.",
      },
      {
        title: "Your privacy rights",
        text: "Depending on applicable law, you may request access to, correction or deletion of your personal information, restriction of its use, or a portable copy. Where processing relies on consent, you may withdraw that consent without affecting prior lawful processing. Contact receitassenior@gmail.com to exercise your rights. We may need to verify your identity. Legal conditions and exceptions may apply.",
      },
      {
        title: "Your right to object",
        text: "Where applicable law provides this right, you may object to processing based on legitimate interests because of your circumstances. You may object to direct marketing at any time. Send your request to receitassenior@gmail.com.",
      },
      {
        title: "Privacy complaints",
        text: "You can contact us about a privacy concern at receitassenior@gmail.com. You also have the right to complain to the relevant data protection authority. In the United Kingdom, you can contact the Information Commissioner’s Office at ico.org.uk/make-a-complaint/.",
      },
      {
        title: "Contact us",
        text: "For privacy-related questions or requests, contact us at receitassenior@gmail.com.",
      },
    ],
  },
  terms: {
    eyebrow: "LEGAL",
    title: "Terms & Conditions",
    intro:
      "These terms apply when accessing or purchasing through the RS BEAUTY™ store.",
    sections: [
      {
        title: "Store use",
        text: "By accessing or using the RS BEAUTY™ store, you agree to use the website lawfully and not attempt to interfere with its operation, security or availability.",
      },
           {
        title: "Products and pricing",
        text: "Prices and promotions may change for future purchases. These changes do not alter the price of an order already placed. If we discover a pricing or product information error affecting your order, we will contact you to explain the issue and available options. We will not charge an additional amount without your agreement.",
      },
            {
        title: "Orders",
        text: "Orders are subject to product availability and successful payment authorization. If we cannot fulfil your order, we will notify you as soon as possible. If we cancel your order, we will refund the full amount paid for that order, including any shipping charges, to your original payment method. We will not substitute a product or charge an additional amount without your agreement. This does not affect your statutory consumer rights.",
      },
      {
        title: "Payments",
        text: "Payments are processed through third-party payment providers. Available payment methods may vary depending on your location and the checkout options available at the time of purchase.",
      },
      {
        title: "Shipping and delivery",
        text: "Delivery estimates are provided in good faith and may vary depending on destination, carrier operations, customs, local conditions or circumstances outside our direct control.",
      },
      {
        title: "Cancellations, returns and refunds",
        text: "Cancellation, return and refund requests are handled according to our Returns & Refunds policy. Customers should contact our customer care team before sending any product back.",
      },
      {
        title: "Prohibited use",
        text: "You may not use the store for unlawful purposes, attempt unauthorized access, interfere with store functionality or misuse content, services or systems associated with RS BEAUTY™.",
      },
      {
        title: "Store availability",
        text: "We may update, modify, suspend or discontinue parts of the store when necessary for maintenance, security, improvements or operational reasons.",
      },
      {
        title: "Customer support",
        text: "For questions regarding an order, these terms or our store policies, contact us at receitassenior@gmail.com.",
      },
    ],
  },
};
export default function StoreInfoPage({ page }) {
  const content = PAGE_CONTENT[page] || PAGE_CONTENT.contact;
  return (
    <main className="store-info-page">
      <GlobalHeader />
      <section className="store-info-hero">
        <span>{content.eyebrow}</span>
        <h1>{content.title}</h1>
        <p>{content.intro}</p>
      </section>
      <section className="store-info-content">
        {content.sections.map((section) => (
          <article key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.text}</p>
          </article>
        ))}
      </section>
      {page === "contact" && (
        <section className="store-info-contact-card">
          <span className="store-info-contact-label">EMAIL SUPPORT</span>
          <h2>We're here to help.</h2>
          <a
            href="mailto:receitassenior@gmail.com"
            className="store-info-contact-email"
          >
            receitassenior@gmail.com
          </a>
          <p>Response time: 1–2 business days</p>
          <a
            href="https://mail.google.com/mail/?view=cm&fs=1&to=receitassenior%40gmail.com&su=RS%20BEAUTY%20Customer%20Care"
            target="_blank"
            rel="noopener noreferrer"
            className="store-info-contact-button"
          >
            Email via Gmail →
          </a>
        </section>
      )}
      <div className="store-info-return">
        <Link to="/shop">Continue shopping →</Link>
      </div>
      <style>{`
        .store-info-page {
          width: min(1120px, calc(100% - 32px));
          margin: 0 auto;
          color: #111111;
          background: #ffffff;
        }
        .store-info-header {
          min-height: 78px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #eadbd2;
        }
        .store-info-logo {
          color: #111111;
          font-size: 20px;
          font-weight: 900;
          letter-spacing: 3px;
          text-decoration: none;
        }
        .store-info-header nav {
          display: flex;
          gap: 28px;
        }
        .store-info-header nav a {
          color: #111111;
          font-size: 13px;
          font-weight: 800;
          text-decoration: none;
        }
        .store-info-hero {
          margin-top: 22px;
          padding: 72px 40px;
          border-radius: 22px;
          background: #f5e9e3;
          text-align: center;
        }
        .store-info-hero span {
          color: #87695b;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 3px;
        }
        .store-info-hero h1 {
  margin: 14px auto 16px;
  color: #111111 !important;
  font-size: clamp(42px, 6vw, 68px);
  font-weight: 850;
  line-height: 1;
  letter-spacing: -2px;
}
        .store-info-hero p {
          overflow-wrap: anywhere;
          max-width: 650px;
          margin: 0 auto;
          color: #655953;
          font-size: 15px;
          line-height: 1.7;
        }
        .store-info-content {
          max-width: 820px;
          margin: 56px auto;
        }
        .store-info-content article {
          padding: 26px 0;
          border-bottom: 1px solid #eadbd2;
        }
        .store-info-content h2 {
  margin: 0 0 10px;
  color: #111111 !important;
  font-size: 20px;
  font-weight: 800;
}
        .store-info-content p {
          overflow-wrap: anywhere;
          margin: 0;
          color: #655953;
          font-size: 14px;
          line-height: 1.8;
        }
.store-info-contact-card {
  max-width: 820px;
  margin: -16px auto 54px;
  padding: 42px 30px;
  border: 1px solid #eadbd2;
  border-radius: 20px;
  background: #f8f4f1;
  text-align: center;
}
.store-info-contact-label {
  display: block;
  margin-bottom: 12px;
  color: #87695b;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 2.5px;
}
.store-info-contact-card h2 {
  margin: 0 0 12px;
  color: #111111 !important;
  font-size: 28px;
  font-weight: 850;
}
.store-info-contact-email {
  display: inline-block;
  margin-bottom: 8px;
  color: #111111;
  font-size: 16px;
  font-weight: 800;
  text-decoration: underline;
}
.store-info-contact-card p {
  margin: 0 0 24px;
  color: #655953;
  font-size: 13px;
}
.store-info-contact-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 46px;
  padding: 0 24px;
  border-radius: 999px;
  background: #111111;
  color: #ffffff;
  font-size: 13px;
  font-weight: 800;
  text-decoration: none;
}
        .store-info-return {
          padding: 10px 0 60px;
          text-align: center;
        }
        .store-info-return a {
          display: inline-flex;
          padding: 14px 24px;
          border-radius: 999px;
          background: #111111;
          color: #ffffff;
          font-size: 13px;
          font-weight: 800;
          text-decoration: none;
        }
        @media (max-width: 680px) {
          .store-info-page {
            width: calc(100% - 24px);
          }
          .store-info-header {
            min-height: 64px;
          }
          .store-info-logo {
            font-size: 16px;
            letter-spacing: 2px;
          }
          .store-info-header nav {
            gap: 14px;
          }
          .store-info-header nav a {
            font-size: 11px;
          }
          .store-info-hero {
            margin-top: 12px;
            padding: 46px 20px;
            border-radius: 16px;
          }
          .store-info-hero h1 {
            font-size: 40px;
            letter-spacing: -1.4px;
          }
          .store-info-hero p {
            font-size: 13px;
          }
          .store-info-content {
            margin: 28px auto;
          }
          .store-info-content article {
            padding: 22px 4px;
          }
        }
      `}</style>
    </main>
  );
}

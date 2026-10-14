import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Link,
  useLocation,
} from 'react-router';
import { media } from '@wix/sdk';

import { wixClient } from '../wixClient';
import GlobalHeader from '../components/GlobalHeader';
import { useCart } from '../context/CartContext';

const CART_SELECTION_KEY =
  'rs_beauty_cart_variant_selections';

// RS_CART_IMAGE_METADATA_V2

const INITIAL_VISIBLE_PRODUCTS = 12;

// RS_GLOBAL_HEADER_SEARCH_SYNC_V1

function getInitialShopSearch() {
  try {
    return (
      new URLSearchParams(window.location.search)
        .get('search') || ''
    );
  } catch {
    return '';
  }
}

function getInitialShopSort() {
  try {
    const requestedSort =
      new URLSearchParams(window.location.search)
        .get('sort') || 'featured';

    const supportedSorts = [
      'featured',
      'newest',
      'price-asc',
      'price-desc',
      'name-asc',
    ];

    return supportedSorts.includes(requestedSort)
      ? requestedSort
      : 'featured';
  } catch {
    return 'featured';
  }
}

function getProductId(product) {
  return product?._id || product?.id || '';
}

function getVariantId(variant) {
  return variant?._id || variant?.id || '';
}

function getText(value) {
  if (typeof value === 'string') return value;

  return (
    value?.translated ||
    value?.original ||
    value?.value ||
    value?.name ||
    ''
  );
}

function extractRichText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;

  if (Array.isArray(node)) {
    return node
      .map(extractRichText)
      .filter(Boolean)
      .join(' ');
  }

  if (node?.textData?.text) {
    return node.textData.text;
  }

  if (node?.nodes) {
    return extractRichText(node.nodes);
  }

  return '';
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

function getPriceAmount(product) {
  const value =
    product?.actualPriceRange?.minValue?.amount ||
    product?.minVariantPriceInfo?.actualPrice?.amount ||
    product?.variantSummary?.minPriceVariant?.price
      ?.actualPrice?.amount;

  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function getComparePriceAmount(product) {
  const value =
    product?.compareAtPriceRange?.minValue?.amount ||
    product?.minVariantPriceInfo?.compareAtPrice?.amount ||
    product?.variantSummary?.minPriceVariant?.price
      ?.compareAtPrice?.amount;

  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function getPrice(product) {
  return (
    product?.actualPriceRange?.minValue?.formattedAmount ||
    product?.minVariantPriceInfo?.actualPrice?.formattedAmount ||
    product?.variantSummary?.minPriceVariant?.price
      ?.actualPrice?.formattedAmount ||
    ''
  );
}

function getComparePrice(product) {
  return (
    product?.compareAtPriceRange?.minValue?.formattedAmount ||
    product?.minVariantPriceInfo?.compareAtPrice
      ?.formattedAmount ||
    product?.variantSummary?.minPriceVariant?.price
      ?.compareAtPrice?.formattedAmount ||
    ''
  );
}

function getDiscountPercent(product) {
  const price = getPriceAmount(product);
  const comparePrice = getComparePriceAmount(product);

  if (!price || comparePrice <= price) return 0;

  return Math.round(
    ((comparePrice - price) / comparePrice) * 100
  );
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
      if (variant?.visible === false) return false;

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

function findMatchingVariant(variants, selectedOptions) {
  const selectedNames = Object.keys(selectedOptions);

  return variants.find((variant) => {
    const choices = getVariantChoices(variant);
    const names = Object.keys(choices);

    if (selectedNames.length !== names.length) {
      return false;
    }

    return names.every(
      (name) => selectedOptions[name] === choices[name]
    );
  });
}

function getProductOptionGroups(product) {
  return (product?.options || [])
    .map((option) => {
      const optionName = getText(option?.name);
      const choices =
        option?.choicesSettings?.choices ||
        option?.choices ||
        [];

      return {
        name: optionName,
        choices: choices
          .map((choice) => getText(choice?.name))
          .filter(Boolean),
      };
    })
    .filter(
      (group) => group.name && group.choices.length
    );
}

function getProductCategoryIds(product) {
  const ids = new Set();

  const mainCategoryId =
    product?.mainCategoryId ||
    product?.mainCategory?._id ||
    product?.mainCategory?.id;

  if (mainCategoryId) {
    ids.add(mainCategoryId);
  }

  for (
    const categoryId of
    product?.categoryIds || []
  ) {
    if (categoryId) {
      ids.add(categoryId);
    }
  }

  for (
    const category of
    product?.categories || []
  ) {
    const id =
      category?._id ||
      category?.id;

    if (id) {
      ids.add(id);
    }
  }

  for (
    const category of
    product?.directCategoriesInfo?.categories || []
  ) {
    const id =
      category?.id ||
      category?._id;

    if (id) {
      ids.add(id);
    }
  }

  return Array.from(ids);
}

function productMatchesOptionFilters(
  product,
  optionFilters
) {
  const activeFilters = Object.entries(optionFilters)
    .filter(([, choices]) => choices.length);

  if (!activeFilters.length) return true;

  const productGroups = getProductOptionGroups(product);

  return activeFilters.every(
    ([optionName, selectedChoices]) => {
      const productGroup = productGroups.find(
        (group) => group.name === optionName
      );

      if (!productGroup) return false;

      return selectedChoices.some((choice) =>
        productGroup.choices.includes(choice)
      );
    }
  );
}

function saveCartVariantSelection(
  product,
  variantId,
  options
) {
  const productId = getProductId(product);

  if (!productId) {
    return;
  }

  try {
    const stored = JSON.parse(
      localStorage.getItem(CART_SELECTION_KEY) || '{}'
    );

    const record = {
      productId,
      variantId,
      productName: product?.name || '',
      options: options || {},
      image: getImage(product) || '',
      updatedAt: Date.now(),
    };

    if (variantId) {
      stored[`${productId}:${variantId}`] = record;
    }

    stored[`product:${productId}`] = record;

    if (product?.name) {
      stored[`name:${product.name}`] = record;
    }

    localStorage.setItem(
      CART_SELECTION_KEY,
      JSON.stringify(stored)
    );
  } catch (error) {
    console.error('Could not save cart options:', error);
  }
}

function ShopPage() {
  const location = useLocation();

  const {
    cartReady,
    addProductToCart,
    buyProductNow,
  } = useCart();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  const [search, setSearch] = useState(
    getInitialShopSearch
  );
  const [sortBy, setSortBy] = useState(
    getInitialShopSort
  );
  
  const [selectedCategory, setSelectedCategory] =
  useState('');

  const [saleOnly, setSaleOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState(0);
  const [optionFilters, setOptionFilters] = useState({});
  const [mobileFiltersOpen, setMobileFiltersOpen] =
    useState(false);
  const [visibleCount, setVisibleCount] = useState(
    INITIAL_VISIBLE_PRODUCTS
  );

  const [variantPicker, setVariantPicker] =
    useState(null);
  const [selectedOptions, setSelectedOptions] =
    useState({});
  const [variantError, setVariantError] = useState('');

  useEffect(() => {
    setSearch(getInitialShopSearch());
    setSortBy(getInitialShopSort());
    setVisibleCount(INITIAL_VISIBLE_PRODUCTS);
  }, [location.search]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    if (mobileFiltersOpen) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileFiltersOpen]);

  useEffect(() => {
    if (!cartReady) return;

    async function loadShop() {
      try {
        setLoading(true);
        setError('');

        const productResponse =
          await wixClient.productsV3.queryProducts(
            {
              cursorPaging: {
                limit: 100,
              },
            },
            {
     fields: [
    'CURRENCY',
    'DIRECT_CATEGORIES_INFO',
          ],
        }
          );

        const loadedProducts =
          productResponse?.products ||
          productResponse?.items ||
          [];

        setProducts(loadedProducts);

        const highestPrice = Math.ceil(
          Math.max(
            0,
            ...loadedProducts.map(getPriceAmount)
          )
        );

        setMaxPrice(highestPrice || 1000);

        try {
          const categoryResponse =
  await wixClient.fetchWithAuth(
    'https://www.wixapis.com/categories/v1/categories/query',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        treeReference: {
          appNamespace: '@wix/stores',
          treeKey: null,
        },
        query: {
          cursorPaging: {
            limit: 1000,
          },
        },
      }),
    }
  );

          if (categoryResponse.ok) {
            const categoryData =
              await categoryResponse.json();

            setCategories(
              categoryData?.categories ||
              categoryData?.items ||
              []
            );
          }
        } catch (categoryError) {
          console.info(
            'Wix categories are not available yet:',
            categoryError
          );
        }
      } catch (shopError) {
        console.error(shopError);

        setError(
          shopError?.message ||
            'We could not load the collection. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    }

    loadShop();
  }, [cartReady]);

  const highestCatalogPrice = useMemo(
    () =>
      Math.ceil(
        Math.max(0, ...products.map(getPriceAmount))
      ) || 1000,
    [products]
  );

  const optionGroups = useMemo(() => {
    const groups = new Map();

    for (const product of products) {
      for (const group of getProductOptionGroups(product)) {
        if (!groups.has(group.name)) {
          groups.set(group.name, new Set());
        }

        for (const choice of group.choices) {
          groups.get(group.name).add(choice);
        }
      }
    }

    return Array.from(groups.entries()).map(
      ([name, choices]) => ({
        name,
        choices: Array.from(choices).sort(),
      })
    );
  }, [products]);

  const visibleCategories = useMemo(() => {
    const usedIds = new Set(
      products.flatMap(getProductCategoryIds)
    );

    return categories.filter((category) => {
      const id = category?._id || category?.id;
      const name = getText(category?.name).toLowerCase();
      const slug = getText(category?.slug).toLowerCase();

      return (
        id &&
        usedIds.has(id) &&
        name !== 'all products' &&
        slug !== 'all-products'
      );
    });
  }, [categories, products]);

useEffect(() => {
  const requestedCategory =
    new URLSearchParams(location.search)
      .get('category');

  if (!requestedCategory) {
    setSelectedCategory('');
    return;
  }

  const normalizedRequested =
    requestedCategory.trim().toLowerCase();

  const matchingCategory =
    visibleCategories.find((category) => {
      const categoryName =
        getText(category?.name)
          .trim()
          .toLowerCase();

      return categoryName === normalizedRequested;
    });

  if (!matchingCategory) {
    setSelectedCategory('');
    return;
  }

  const categoryId =
    matchingCategory?._id ||
    matchingCategory?.id ||
    '';

  setSelectedCategory(categoryId);
}, [location.search, visibleCategories]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const result = products.filter((product) => {
      const name = getText(product?.name).toLowerCase();
      const description = extractRichText(
        product?.description
      ).toLowerCase();
      const price = getPriceAmount(product);
      const categoriesForProduct =
        getProductCategoryIds(product);

      const matchesSearch =
        !normalizedSearch ||
        name.includes(normalizedSearch) ||
        description.includes(normalizedSearch);

      const matchesCategory =
        !selectedCategory ||
        categoriesForProduct.includes(selectedCategory);

      const matchesSale =
        !saleOnly || getDiscountPercent(product) > 0;

      const matchesPrice =
        !maxPrice || price <= maxPrice;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesSale &&
        matchesPrice &&
        productMatchesOptionFilters(
          product,
          optionFilters
        )
      );
    });

    return result.sort((a, b) => {
      if (sortBy === 'newest') {
        return (
          new Date(b?._createdDate || 0) -
          new Date(a?._createdDate || 0)
        );
      }

      if (sortBy === 'price-asc') {
        return getPriceAmount(a) - getPriceAmount(b);
      }

      if (sortBy === 'price-desc') {
        return getPriceAmount(b) - getPriceAmount(a);
      }

      if (sortBy === 'name-asc') {
        return getText(a?.name).localeCompare(
          getText(b?.name)
        );
      }

      return 0;
    });
  }, [
    products,
    search,
    sortBy,
    selectedCategory,
    saleOnly,
    maxPrice,
    optionFilters,
  ]);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_PRODUCTS);
  }, [
    search,
    sortBy,
    selectedCategory,
    saleOnly,
    maxPrice,
    optionFilters,
  ]);

  function toggleOptionFilter(optionName, choiceName) {
    setOptionFilters((current) => {
      const choices = current[optionName] || [];
      const nextChoices = choices.includes(choiceName)
        ? choices.filter((choice) => choice !== choiceName)
        : [...choices, choiceName];

      return {
        ...current,
        [optionName]: nextChoices,
      };
    });
  }

  function clearFilters() {
    setSearch('');
    setSelectedCategory('');
    setSaleOnly(false);
    setMaxPrice(highestCatalogPrice);
    setOptionFilters({});
    setSortBy('featured');
  }

  async function executeProductAction(
    action,
    product,
    variantId,
    variantOptions = {}
  ) {
    if (action === 'buy') {
      await buyProductNow({
        productId: getProductId(product),
        variantId,
        quantity: 1,
      });

      return;
    }

    saveCartVariantSelection(
      product,
      variantId,
    
      variantOptions
    );

    await addProductToCart({
      productId: getProductId(product),
      variantId,
      quantity: 1,
      productName: product.name,
    });

    setMessage(`${product.name} was added to your bag.`);
  }

  async function prepareProductAction(product, action) {
    const productId = getProductId(product);

    try {
      setBusy(`prepare-${productId}`);
      setError('');
      setMessage('');
      setVariantError('');

      const response =
        await wixClient.productsV3.getProduct(
          productId,
          {
            fields: ['VARIANT_OPTION_CHOICE_NAMES'],
          }
        );

      const fullProduct = response?.product || response;
      const variants = getAvailableVariants(fullProduct);

      if (!variants.length) {
        throw new Error(
          `${product.name} is currently unavailable.`
        );
      }

      const groups = buildOptionGroups(variants);

      if (!groups.length || variants.length === 1) {
        const variant = variants[0];

        setBusy(`${action}-${productId}`);

        await executeProductAction(
          action,
          product,
          getVariantId(variant),
          getVariantChoices(variant)
        );

        return;
      }

      setSelectedOptions({});
      setVariantPicker({
        product,
        action,
        variants,
        optionGroups: groups,
      });
    } catch (actionError) {
      console.error(actionError);

      setError(
        actionError?.message ||
          'We could not load the product options.'
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

    const missingOption =
      variantPicker.optionGroups.find(
        (group) => !selectedOptions[group.name]
      );

    if (missingOption) {
      setVariantError(
        `Select ${missingOption.name} to continue.`
      );
      return;
    }

    const variant = findMatchingVariant(
      variantPicker.variants,
      selectedOptions
    );

    if (!variant) {
      setVariantError(
        'This combination is unavailable. Choose another option.'
      );
      return;
    }

    const { action, product } = variantPicker;

    try {
      setBusy(`${action}-${getProductId(product)}`);
      setVariantPicker(null);

      await executeProductAction(
        action,
        product,
        getVariantId(variant),
        getVariantChoices(variant)
      );
    } catch (actionError) {
      console.error(actionError);
      setError(
        actionError?.message ||
          'We could not complete this action.'
      );
    } finally {
      setBusy('');
      setSelectedOptions({});
      setVariantError('');
    }
  }

  const activeFilterCount =
    (selectedCategory ? 1 : 0) +
    (saleOnly ? 1 : 0) +
    Object.values(optionFilters).filter(
      (choices) => choices.length
    ).length +
    (maxPrice < highestCatalogPrice ? 1 : 0);

  return (
    <>
      <style>{`
        .premium-header {
          position: sticky;
          top: 0;
          z-index: 900;
          width: 100%;
          border-bottom: 1px solid #eeeeee;
          background: #ffffff;
        }

        .premium-header-inner {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 30px;
          max-width: 1280px;
          height: 74px;
          margin: 0 auto;
        }

        .premium-logo {
          justify-self: start;
          color: #111111;
          font-size: 23px;
          font-weight: 900;
          letter-spacing: 1.8px;
          text-decoration: none;
        }

        .desktop-nav {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 32px;
        }

        .desktop-nav a {
          color: #111111;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
        }

        .desktop-nav a:hover {
          opacity: 0.6;
        }

        .header-actions {
          display: flex;
          align-items: center;
          justify-self: end;
          gap: 8px;
        }

        .header-icon-button {
          display: inline-grid;
          place-items: center;
          width: 40px;
          height: 40px;
          border: 0;
          background: transparent;
          color: #111111;
          font-size: 21px;
          text-decoration: none;
          cursor: pointer;
        }

        .header-cart-button {
          display: flex;
          align-items: center;
          gap: 8px;
          min-height: 40px;
          border: 1px solid #111111;
          border-radius: 999px;
          padding: 0 14px;
          background: #ffffff;
          color: #111111;
          font-weight: 700;
          cursor: pointer;
        }

        .header-cart-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 21px;
          height: 21px;
          border-radius: 50%;
          background: #111111;
          color: #ffffff;
          font-size: 11px;
          font-weight: 800;
        }

        
        .rs-shop-page {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto;

  color: var(--rs-text);

  background:
    linear-gradient(
      180deg,
      var(--rs-white) 0%,
      #fbf7f4 48%,
      var(--rs-cream) 100%
    );
}
        .rs-shop-hero {
          margin: 24px 0 32px;
          padding: 54px 56px;
          border-radius: 24px;
          background:
            radial-gradient(circle at 84% 22%, rgba(181, 143, 128, 0.22), transparent 32%),
            linear-gradient(135deg, #f7f2ef 0%, #eee1da 100%);
          text-align: center;
        }

        .rs-shop-eyebrow {
          display: block;
          margin-bottom: 12px;
          color: #76594d;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.24em;
          text-transform: uppercase;
        }

        .rs-shop-hero h1 {
          margin: 0;
          color: #111111 !important;
          font-size: clamp(40px, 6vw, 74px);
          line-height: 0.95;
          letter-spacing: -0.055em;
          opacity: 1 !important;
          visibility: visible !important;
        }

        .rs-shop-hero p {
          max-width: 610px;
          margin: 20px auto 0;
          color: #5f514b;
          font-size: 16px;
          line-height: 1.65;
        }

        .rs-shop-trust {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          margin: 0 0 34px;
          padding: 18px 8px;
          border-top: 1px solid #e8e0dc;
          border-bottom: 1px solid #e8e0dc;
        }

        .rs-shop-trust span {
          text-align: center;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.02em;
        }

        .rs-shop-toolbar {
          display: grid;
          grid-template-columns: minmax(240px, 1fr) auto;
          gap: 16px;
          align-items: center;
          margin-bottom: 26px;
        }

        .rs-shop-search {
  position: relative;
}

.rs-shop-search span {
  position: absolute;
  top: 50%;
  left: 18px;
  transform: translateY(-50%);

  color: var(--rs-text-soft);
  font-size: 16px;

  pointer-events: none;
  z-index: 1;
}

.rs-shop-search input,
.rs-shop-sort {
  width: 100%;
  min-height: 52px;

  border: 1px solid var(--rs-border);
  border-radius: 999px;

  background: rgba(255, 255, 255, 0.82);
  color: var(--rs-black);

  font: inherit;
  font-size: 14px;
  font-weight: 600;

  outline: none;

  box-shadow:
    0 6px 20px rgba(40, 25, 20, 0.035);

  transition:
    border-color var(--rs-transition),
    background var(--rs-transition),
    box-shadow var(--rs-transition);
}

.rs-shop-search input {
  padding: 0 22px 0 50px;
}

.rs-shop-search input::placeholder {
  color: var(--rs-text-soft);
  opacity: 0.72;
  font-weight: 500;
}

.rs-shop-search input:hover,
.rs-shop-sort:hover {
  border-color: #cbbcb4;
  background: var(--rs-white);
}

.rs-shop-search input:focus,
.rs-shop-sort:focus {
  border-color: var(--rs-accent);
  background: var(--rs-white);

  box-shadow:
    0 0 0 3px rgba(185, 120, 99, 0.10),
    0 8px 22px rgba(40, 25, 20, 0.05);
}

.rs-shop-sort {
  min-width: 220px;
  padding: 0 42px 0 18px;

  cursor: pointer;
}.rs-shop-search {
  position: relative;
}

.rs-shop-search span {
  position: absolute;
  top: 50%;
  left: 18px;
  transform: translateY(-50%);

  color: var(--rs-text-soft);
  font-size: 16px;

  pointer-events: none;
  z-index: 1;
}

.rs-shop-search input,
.rs-shop-sort {
  width: 100%;
  min-height: 52px;

  border: 1px solid var(--rs-border);
  border-radius: 999px;

  background: rgba(255, 255, 255, 0.82);
  color: var(--rs-black);

  font: inherit;
  font-size: 14px;
  font-weight: 600;

  outline: none;

  box-shadow:
    0 6px 20px rgba(40, 25, 20, 0.035);

  transition:
    border-color var(--rs-transition),
    background var(--rs-transition),
    box-shadow var(--rs-transition);
}

.rs-shop-search input {
  padding: 0 22px 0 50px;
}

.rs-shop-search input::placeholder {
  color: var(--rs-text-soft);
  opacity: 0.72;
  font-weight: 500;
}

.rs-shop-search input:hover,
.rs-shop-sort:hover {
  border-color: #cbbcb4;
  background: var(--rs-white);
}

.rs-shop-search input:focus,
.rs-shop-sort:focus {
  border-color: var(--rs-accent);
  background: var(--rs-white);

  box-shadow:
    0 0 0 3px rgba(185, 120, 99, 0.10),
    0 8px 22px rgba(40, 25, 20, 0.05);
}

.rs-shop-sort {
  min-width: 220px;
  padding: 0 42px 0 18px;

  cursor: pointer;
}

        .rs-shop-mobile-filter-trigger,
        .rs-shop-filter-overlay,
        .rs-shop-filter-mobile-top,
        .rs-shop-filter-apply {
          display: none;
        }

        .rs-shop-layout {
          display: grid;
          grid-template-columns: 230px minmax(0, 1fr);
          gap: 34px;
          align-items: start;
        }

        .rs-shop-filters {
  position: sticky;
  top: 18px;

  padding: 24px 22px;

  border: 1px solid var(--rs-border);
  border-radius: var(--rs-radius-lg);

  background:
    linear-gradient(
      180deg,
      var(--rs-white) 0%,
      var(--rs-cream) 100%
    );

  box-shadow:
    0 10px 30px rgba(40, 25, 20, 0.05);
}

       .rs-shop-filter-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;

  margin-bottom: 14px;
  padding-bottom: 14px;

  border-bottom: 1px solid var(--rs-border);
}

.rs-shop-filter-heading strong {
  color: var(--rs-black);
  font-size: 18px;
  font-weight: 900;
  letter-spacing: -0.3px;
}

        .rs-shop-filter-heading span {
          display: grid;
          place-items: center;
          min-width: 23px;
          height: 23px;
          border-radius: 50%;
          background: #111111;
          color: #ffffff;
          font-size: 11px;
        }

        .rs-shop-clear {
          border: 0;
          padding: 0;
          background: none;
          color: #6d5d55;
          font-size: 12px;
          text-decoration: underline;
          cursor: pointer;
        }

       .rs-shop-filter-group {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--rs-border);
}

.rs-shop-filter-group h3 {
  margin: 0 0 14px;

  color: var(--rs-black);
  font-size: 12px;
  font-weight: 900;
  line-height: 1.2;

  letter-spacing: 0.08em;
  text-transform: uppercase;
}

        .rs-shop-category-button {
  display: flex;
  align-items: center;

  width: 100%;
  min-height: 38px;

  margin: 3px 0;
  padding: 0 11px;

  border: 1px solid transparent;
  border-radius: var(--rs-radius-sm);

  background: transparent;
  color: var(--rs-text-soft);

  font-size: 13px;
  font-weight: 650;
  text-align: left;

  cursor: pointer;

  transition:
    background var(--rs-transition),
    border-color var(--rs-transition),
    color var(--rs-transition),
    transform var(--rs-transition);
}

.rs-shop-category-button:hover {
  background: var(--rs-cream);
  border-color: var(--rs-border);
  color: var(--rs-black);
  transform: translateX(2px);
}

.rs-shop-category-button.active {
  background: var(--rs-black);
  border-color: var(--rs-black);
  color: var(--rs-white);
  font-weight: 850;
}

.rs-shop-check {
  display: flex;
  align-items: center;
  gap: 10px;

  min-height: 38px;
  margin: 4px 0;
  padding: 0 9px;

  border-radius: var(--rs-radius-sm);

  color: var(--rs-text-soft);
  font-size: 13px;
  font-weight: 600;

  cursor: pointer;

  transition:
    background var(--rs-transition),
    color var(--rs-transition);
}

.rs-shop-check:hover {
  background: var(--rs-cream);
  color: var(--rs-black);
}

      .rs-shop-check input {
  appearance: none;
  -webkit-appearance: none;

  width: 17px;
  height: 17px;
  flex: 0 0 17px;

  margin: 0;

  border: 1.5px solid #b8aaa3;
  border-radius: 4px;

  background: var(--rs-white);

  cursor: pointer;

  transition:
    background var(--rs-transition),
    border-color var(--rs-transition),
    box-shadow var(--rs-transition);
}

.rs-shop-check input:hover {
  border-color: var(--rs-accent);
}

.rs-shop-check input:checked {
  border-color: var(--rs-black);
  background: var(--rs-black);

  box-shadow:
    inset 0 0 0 3px var(--rs-white);
}
        .rs-shop-range-copy {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
          color: #665952;
          font-size: 12px;
        }

       .rs-shop-range {
  appearance: none;
  -webkit-appearance: none;

  width: 100%;
  height: 18px;

  margin: 2px 0 0;

  background: transparent;

  cursor: pointer;
}

/* Chrome / Edge */
.rs-shop-range::-webkit-slider-runnable-track {
  height: 4px;

  border-radius: 999px;

  background: #ded3cd;
}

.rs-shop-range::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;

  width: 18px;
  height: 18px;

  margin-top: -7px;

  border: 3px solid var(--rs-white);
  border-radius: 50%;

  background: var(--rs-black);

  box-shadow:
    0 2px 8px rgba(17, 17, 17, 0.18);
}

/* Firefox */
.rs-shop-range::-moz-range-track {
  height: 4px;

  border: 0;
  border-radius: 999px;

  background: #ded3cd;
}

.rs-shop-range::-moz-range-thumb {
  width: 14px;
  height: 14px;

  border: 3px solid var(--rs-white);
  border-radius: 50%;

  background: var(--rs-black);

  box-shadow:
    0 2px 8px rgba(17, 17, 17, 0.18);
}

        .rs-shop-results-head {
          display: flex;
          justify-content: space-between;
          align-items: end;
          margin-bottom: 17px;
        }

        .rs-shop-results-head h2 {
          margin: 0;
          color: #111111 !important;
          font-size: 27px;
          letter-spacing: -0.035em;
          opacity: 1 !important;
          visibility: visible !important;
        }

        .rs-shop-results-head span {
          color: #766a64;
          font-size: 12px;
        }

        .rs-shop-grid {
  display: grid;
  grid-template-columns: repeat(
    auto-fill,
    minmax(210px, 1fr)
  );
  gap: 24px 20px;
  align-items: start;
}

.rs-shop-card {
  min-width: 0;
  display: flex;
  flex-direction: column;

  padding: 10px;

  border: 1px solid var(--rs-border);
  border-radius: var(--rs-radius-md);

  background: var(--rs-white);

  box-shadow:
    0 8px 28px rgba(40, 25, 20, 0.05);

  transition:
    transform var(--rs-transition),
    border-color var(--rs-transition),
    box-shadow var(--rs-transition);
}

.rs-shop-card:hover {
  transform: translateY(-3px);

  border-color: #d8c9c1;

  box-shadow:
    0 16px 38px rgba(40, 25, 20, 0.09);
}

        .rs-shop-card-media {
          position: relative;
          overflow: hidden;
          aspect-ratio: 1 / 1.08;
          border-radius: 16px;
          background: #f4f1ef;
        }

        .rs-shop-card-media img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 450ms ease;
        }

        .rs-shop-card:hover .rs-shop-card-media img {
          transform: scale(1.035);
        }

        .rs-shop-placeholder {
          display: grid;
          place-items: center;
          width: 100%;
          height: 100%;
          padding: 24px;
          color: #978a84;
          text-align: center;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
        }

        .rs-shop-badge {
          position: absolute;
          top: 12px;
          left: 12px;
          z-index: 1;
          border-radius: 999px;
          padding: 7px 10px;
          background: #111111;
          color: #ffffff;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }

        
        .rs-shop-card-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;S
  padding: 16px 4px 2px;
}

.rs-shop-card-title {
  min-height: 42px;
  margin: 0 0 12px;
  color: var(--rs-black);
  font-size: 15px;
  font-weight: 800;
  line-height: 1.32;
  letter-spacing: -0.15px;
}

        .rs-shop-card-link {
          color: inherit;
          text-decoration: none;
        }

        .rs-shop-price-row {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 7px;

  min-height: 28px;
  margin-top: 0;
  margin-bottom: 4px;
}

.rs-shop-price {
  color: var(--rs-black);
  font-size: 18px;
  font-weight: 900;
  line-height: 1;
  letter-spacing: -0.25px;
}

.rs-shop-compare-price {
  color: var(--rs-text-soft);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  opacity: 0.62;
  text-decoration: line-through;
}

        
 .rs-shop-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin-top: auto;
  padding-top: 16px;
}

.rs-shop-action {
  width: 100%;
  min-height: 46px;
  border-radius: var(--rs-radius-sm);
  padding: 0 16px;

  display: inline-flex;
  align-items: center;
  justify-content: center;

  font-size: 12px;
  font-weight: 850;
  line-height: 1;
  letter-spacing: 0.15px;
  white-space: nowrap;

  cursor: pointer;

  transition:
    background var(--rs-transition),
    color var(--rs-transition),
    border-color var(--rs-transition),
    transform var(--rs-transition),
    box-shadow var(--rs-transition);
}

.rs-shop-action:disabled {
  cursor: wait;
  opacity: 0.55;
}

.rs-shop-buy {
  border: 1px solid var(--rs-black);
  background: var(--rs-black);
  color: var(--rs-white);
  box-shadow: 0 8px 18px rgba(17, 17, 17, 0.08);
}

.rs-shop-buy:hover:not(:disabled) {
  background: var(--rs-black-soft);
  border-color: var(--rs-black-soft);
  transform: translateY(-1px);
  box-shadow: 0 10px 22px rgba(17, 17, 17, 0.13);
}

.rs-shop-cart {
  border: 1px solid var(--rs-border);
  background: var(--rs-white);
  color: var(--rs-black);
}

.rs-shop-cart:hover:not(:disabled) {
  border-color: var(--rs-accent);
  background: var(--rs-cream);
  color: var(--rs-black);
  transform: translateY(-1px);
}

        .rs-shop-notice {
          margin: 0 0 20px 264px;
          border-radius: 10px;
          padding: 13px 16px;
          background: #edf8ef;
          color: #176b2c;
          font-size: 13px;
        }

        .rs-shop-notice.error {
          background: #fff0ee;
          color: #9b1c1c;
        }

        .rs-shop-empty {
          grid-column: 1 / -1;
          border: 1px solid #e5ddda;
          border-radius: 18px;
          padding: 62px 24px;
          text-align: center;
        }

        .rs-shop-empty h3 {
          margin: 0 0 9px;
          font-size: 24px;
        }

        .rs-shop-empty p {
          margin: 0 0 20px;
          color: #756861;
        }

        .rs-shop-load-more {
          display: block;
          min-width: 210px;
          min-height: 48px;
          margin: 38px auto 0;
          border: 1px solid #111111;
          border-radius: 999px;
          background: #ffffff;
          color: #111111;
          font-weight: 800;
          cursor: pointer;
        }

        .rs-shop-skeleton {
          aspect-ratio: 1 / 1.08;
          border-radius: 16px;
          background: linear-gradient(
            90deg,
            #f2efed 25%,
            #faf8f7 50%,
            #f2efed 75%
          );
          background-size: 200% 100%;
          animation: rs-shop-shimmer 1.2s infinite;
        }

        @keyframes rs-shop-shimmer {
          to { background-position: -200% 0; }
        }

        .rs-shop-footer {
          margin-top: 72px;
          border-top: 1px solid #e7dfdb;
          padding: 34px 0 44px;
          text-align: center;
        }

        .rs-shop-footer strong {
          display: block;
          margin-bottom: 8px;
          font-size: 18px;
          letter-spacing: 0.16em;
        }

        .rs-shop-footer p {
          margin: 0;
          color: #786b65;
          font-size: 12px;
        }

        .rs-shop-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 2000;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(17, 17, 17, 0.58);
          backdrop-filter: blur(4px);
        }

        .rs-shop-modal {
          width: min(470px, 100%);
          max-height: calc(100vh - 40px);
          overflow: auto;
          border-radius: 22px;
          padding: 28px;
          background: #ffffff;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.28);
        }

        .rs-shop-modal-top {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: start;
        }

        .rs-shop-modal h2 {
          margin: 0;
          color: #111111 !important;
          font-size: 25px;
          letter-spacing: -0.035em;
          opacity: 1 !important;
          visibility: visible !important;
        }

        .rs-shop-modal-close {
          display: grid;
          place-items: center;
          width: 36px;
          height: 36px;
          flex: 0 0 auto;
          border: 0;
          border-radius: 50%;
          background: #f3efed;
          font-size: 20px;
          cursor: pointer;
        }

        .rs-shop-modal-group {
          margin-top: 23px;
        }

        .rs-shop-modal-group h3 {
          margin: 0 0 10px;
          color: #111111 !important;
          font-size: 13px;
          opacity: 1 !important;
          visibility: visible !important;
        }

        .rs-shop-modal-choices {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .rs-shop-choice {
          min-width: 54px;
          min-height: 42px;
          border: 1px solid #cfc5c0;
          border-radius: 9px;
          padding: 8px 13px;
          background: #ffffff;
          color: #111111;
          cursor: pointer;
        }

        .rs-shop-choice.active {
          border-color: #111111;
          background: #111111;
          color: #ffffff;
        }

        .rs-shop-choice:disabled {
          color: #b7afab;
          text-decoration: line-through;
          cursor: not-allowed;
        }

        .rs-shop-modal-error {
          margin-top: 18px;
          border-radius: 9px;
          padding: 11px 13px;
          background: #fff3db;
          color: #7c5200;
          font-size: 12px;
        }

        .rs-shop-modal-confirm {
          width: 100%;
          min-height: 50px;
          margin-top: 22px;
          border: 0;
          border-radius: 10px;
          background: #111111;
          color: #ffffff;
          font-weight: 850;
          cursor: pointer;
        }

        @media (max-width: 900px) {
          .rs-shop-layout {
            grid-template-columns: 190px minmax(0, 1fr);
            gap: 22px;
          }

          .rs-shop-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .rs-shop-notice {
            margin-left: 212px;
          }
        }

        @media (max-width: 680px) {
          .premium-header-inner {
            grid-template-columns: 1fr auto;
            gap: 8px;
            height: 62px;
          }


          .premium-logo {
            font-size: 18px;
          }

          .desktop-nav,
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

          .rs-shop-page {
            width: min(100% - 24px, 1120px);
          }

         .rs-shop-hero {
  margin-top: 10px;
  padding: 24px 18px 26px;
  border-radius: 16px;
}

.rs-shop-hero h1 {
  font-size: clamp(38px, 11.5vw, 50px);
  line-height: 0.98;
  letter-spacing: -1.4px;
}

.rs-shop-hero p {
  max-width: 290px;
  margin-left: auto;
  margin-right: auto;
  font-size: 13px;
  line-height: 1.55;
}

.rs-shop-trust {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;

  margin-bottom: 14px;
  padding: 10px 4px;
}

.rs-shop-trust span {
  font-size: 9.5px;
  line-height: 1.3;
  letter-spacing: 0;
}

.rs-shop-toolbar {
  grid-template-columns: 1fr;
  gap: 8px;
  margin-bottom: 16px;
}

.rs-shop-search input,
.rs-shop-sort {
  min-height: 46px;
  font-size: 13px;
}

.rs-shop-mobile-filter-trigger {
  min-height: 44px;
}




         .rs-shop-toolbar {
  grid-template-columns: 1fr;
  gap: 8px;
}

          .rs-shop-sort {
            min-width: 0;
          }

          .rs-shop-layout {
            display: block;
          }

          .rs-shop-mobile-filter-trigger {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            min-height: 44px;
            margin: -10px 0 22px;
            border: 1px solid #111111;
            border-radius: 999px;
            padding: 0 18px;
            background: #111111;
            color: #ffffff;
            font-size: 13px;
            font-weight: 850;
            letter-spacing: 0.02em;
            cursor: pointer;
          }

          .rs-shop-mobile-filter-trigger span:last-child {
            display: grid;
            place-items: center;
            min-width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #ffffff;
            color: #111111;
            font-size: 12px;
          }

          .rs-shop-filter-overlay {
            position: fixed;
            inset: 0;
            z-index: 1540;
            display: block;
            border: 0;
            padding: 0;
            background: rgba(17, 17, 17, 0.48);
            backdrop-filter: blur(3px);
            cursor: pointer;
          }

          .rs-shop-filters {
            position: fixed;
            top: 62px;
            right: 0;
            bottom: 0;
            z-index: 1550;
            display: none;
            width: min(340px, calc(100vw - 28px));
            margin: 0;
            overflow-y: auto;
            border-radius: 20px 0 0 20px;
            padding: 20px;
            box-shadow: -24px 0 70px rgba(17, 17, 17, 0.22);
          }

          .rs-shop-filters.is-open {
            display: block;
          }

          .rs-shop-filter-mobile-top {
            position: sticky;
            top: 0;
            z-index: 2;
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin: -20px -20px 14px;
            border-bottom: 1px solid #e5ddda;
            padding: 16px 20px;
            background: #faf8f7;
          }

          .rs-shop-filter-mobile-top strong {
            font-size: 17px;
          }

          .rs-shop-filter-mobile-top button {
            display: grid;
            place-items: center;
            width: 38px;
            height: 38px;
            border: 0;
            border-radius: 50%;
            background: #eee9e6;
            color: #111111;
            font-size: 22px;
            line-height: 1;
            cursor: pointer;
          }

          .rs-shop-filter-heading {
            display: none;
          }

          .rs-shop-filter-group {
            margin-top: 15px;
            padding-top: 14px;
          }

          .rs-shop-filter-apply {
            position: sticky;
            bottom: -20px;
            z-index: 2;
            display: block;
            width: calc(100% + 40px);
            min-height: 54px;
            margin: 22px -20px -20px;
            border: 0;
            padding: 0 18px;
            background: #111111;
            color: #ffffff;
            font-size: 13px;
            font-weight: 850;
            cursor: pointer;
          }

          .rs-shop-results-head h2 {
            font-size: 22px;
          }

          .rs-shop-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 24px 10px;
          padding: 0 10px;
          box-sizing: border-box;
          }

          .rs-shop-card-media {
            border-radius: 12px;
          }

          .rs-shop-card-title {
            min-height: 40px;
            font-size: 13px;
          }

          .rs-shop-card-content {
            min-height: 180px;
            padding-top: 10px;
          }

          .rs-shop-price {
            font-size: 14px;
          }

          .rs-shop-actions {
            grid-template-columns: 1fr;
            gap: 6px;
          }

          .rs-shop-action {
            min-height: 38px;
            padding: 6px 3px;
            font-size: 10px;
          }

          .rs-shop-notice {
            margin-left: 0;
          }

          .rs-shop-modal {
            padding: 23px 18px;
          }
        }
      `}</style>

      <div className="rs-shop-page">
        <GlobalHeader />

        <section className="rs-shop-hero">
          <span className="rs-shop-eyebrow">
            RS BEAUTY™ COLLECTION
          </span>
          <h1>Find your next ritual.</h1>
          <p>
            Curated beauty, hair and self-care essentials
            selected to make every routine feel more
            intentional.
          </p>
        </section>

        <div className="rs-shop-trust">
          <span>✓ Secure Checkout</span>
          <span>✓ Carefully Selected</span>
          <span>✓ Easy Returns</span>
        </div>

        <section
          className="rs-shop-toolbar"
          id="products"
        >
          <label className="rs-shop-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search products"
              aria-label="Search products"
            />
          </label>

          <select
            className="rs-shop-sort"
            value={sortBy}
            onChange={(event) =>
              setSortBy(event.target.value)
            }
            aria-label="Sort products"
          >
            <option value="featured">Featured</option>
            <option value="newest">Newest</option>
            <option value="price-asc">
              Price: Low to High
            </option>
            <option value="price-desc">
              Price: High to Low
            </option>
            <option value="name-asc">Name: A–Z</option>
          </select>
        </section>

        <button
          className="rs-shop-mobile-filter-trigger"
          onClick={() => setMobileFiltersOpen(true)}
          aria-expanded={mobileFiltersOpen}
          type="button"
        >
          <span>Filters &amp; Refine</span>
          <span>{activeFilterCount || '+'}</span>
        </button>

        {message && (
          <div className="rs-shop-notice">{message}</div>
        )}

        {error && (
          <div className="rs-shop-notice error">
            {error}
          </div>
        )}

        {mobileFiltersOpen && (
          <button
            className="rs-shop-filter-overlay"
            onClick={() => setMobileFiltersOpen(false)}
            aria-label="Close filters"
            type="button"
          />
        )}

        <div className="rs-shop-layout">
          <aside
            className={`rs-shop-filters ${
              mobileFiltersOpen ? 'is-open' : ''
            }`}
          >
            <div className="rs-shop-filter-mobile-top">
              <strong>
                Filters
                {activeFilterCount > 0
                  ? ` (${activeFilterCount})`
                  : ''}
              </strong>
              <button
                onClick={() => setMobileFiltersOpen(false)}
                aria-label="Close filters"
                type="button"
              >
                ×
              </button>
            </div>

            <div className="rs-shop-filter-heading">
              <strong>Filters</strong>
              {activeFilterCount > 0 && (
                <span>{activeFilterCount}</span>
              )}
            </div>

            <button
              className="rs-shop-clear"
              onClick={clearFilters}
              type="button"
            >
              Clear all
            </button>

            {visibleCategories.length > 0 && (
              <div className="rs-shop-filter-group">
                <h3>Categories</h3>

                <button
                  className={`rs-shop-category-button ${
                    !selectedCategory ? 'active' : ''
                  }`}
                  onClick={() => setSelectedCategory('')}
                  type="button"
                >
                  All Products
                </button>

                {visibleCategories.map((category) => {
                  const id =
                    category?._id || category?.id;

                  return (
                    <button
                      className={`rs-shop-category-button ${
                        selectedCategory === id
                          ? 'active'
                          : ''
                      }`}
                      key={id}
                      onClick={() =>
                        setSelectedCategory(id)
                      }
                      type="button"
                    >
                      {getText(category?.name)}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="rs-shop-filter-group">
              <h3>Offers</h3>
              <label className="rs-shop-check">
                <input
                  type="checkbox"
                  checked={saleOnly}
                  onChange={(event) =>
                    setSaleOnly(event.target.checked)
                  }
                />
                On sale
              </label>
            </div>

            <div className="rs-shop-filter-group">
              <h3>Price</h3>
              <div className="rs-shop-range-copy">
                <span>$0</span>
                <span>Up to ${maxPrice}</span>
              </div>
              <input
                className="rs-shop-range"
                type="range"
                min="0"
                max={highestCatalogPrice}
                step="1"
                value={maxPrice}
                onChange={(event) =>
                  setMaxPrice(Number(event.target.value))
                }
              />
            </div>

            {optionGroups.map((group) => (
              <div
                className="rs-shop-filter-group"
                key={group.name}
              >
                <h3>{group.name}</h3>

                {group.choices.map((choice) => (
                  <label
                    className="rs-shop-check"
                    key={choice}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(
                        optionFilters[group.name]?.includes(
                          choice
                        )
                      )}
                      onChange={() =>
                        toggleOptionFilter(
                          group.name,
                          choice
                        )
                      }
                    />
                    {choice}
                  </label>
                ))}
              </div>
            ))}

            <button
              className="rs-shop-filter-apply"
              onClick={() => setMobileFiltersOpen(false)}
              type="button"
            >
              Show {filteredProducts.length}{' '}
              {filteredProducts.length === 1
                ? 'Product'
                : 'Products'}
            </button>
          </aside>

          <section>
            <div className="rs-shop-results-head">
              <h2>Shop All</h2>
              <span>
                {filteredProducts.length}{' '}
                {filteredProducts.length === 1
                  ? 'product'
                  : 'products'}
              </span>
            </div>

            <div className="rs-shop-grid">
              {loading &&
                Array.from({ length: 8 }).map((_, index) => (
                  <div
                    className="rs-shop-skeleton"
                    key={`skeleton-${index}`}
                  />
                ))}

              {!loading &&
                filteredProducts
                  .slice(0, visibleCount)
                  .map((product) => {
                    const id = getProductId(product);
                    const image = getImage(product);
                    const price = getPrice(product);
                    const comparePrice =
                      getComparePrice(product);
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
                    const isBusy =
                      busy.includes(id);

                    return (
                      <article
                        className="rs-shop-card"
                        key={id}
                      >
                        <Link
                          className="rs-shop-card-link"
                          to={`/product/${id}`}
                        >
                          <div className="rs-shop-card-media">
                            {savingsLabel && (
                          <span className="rs-shop-badge">
                            {savingsLabel}
                          </span>
                         )}

                            {image ? (
                              <img
                                src={image}
                                alt={product.name}
                                loading="lazy"
                              />
                            ) : (
                              <div className="rs-shop-placeholder">
                                RS BEAUTY™
                                <br />
                                Product image coming soon
                              </div>
                            )}
                          </div>
                        </Link>

                        <div className="rs-shop-card-content">
                          <Link
                            className="rs-shop-card-link"
                            to={`/product/${id}`}
                          >
                            <h3 className="rs-shop-card-title">
                              {product.name}
                            </h3>
                          </Link>

                          <div className="rs-shop-price-row">
                            <span className="rs-shop-price">
                              {price}
                            </span>

                            {comparePrice &&
                              comparePrice !== price && (
                                <span className="rs-shop-compare-price">
                                  {comparePrice}
                                </span>
                              )}
                          </div>

                          <div className="rs-shop-actions">
                            <button
                              className="rs-shop-action rs-shop-buy"
                              disabled={Boolean(busy)}
                              onClick={() =>
                                prepareProductAction(
                                  product,
                                  'buy'
                                )
                              }
                              type="button"
                            >
                              {isBusy ? 'Loading...' : 'Buy Now'}
                            </button>

                            <button
                              className="rs-shop-action rs-shop-cart"
                              disabled={Boolean(busy)}
                              onClick={() =>
                                prepareProductAction(
                                  product,
                                  'cart'
                                )
                              }
                              type="button"
                            >
                              {isBusy
                                ? 'Loading...'
                                : 'Add to Cart'}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}

              {!loading && filteredProducts.length === 0 && (
                <div className="rs-shop-empty">
                  <h3>No products found</h3>
                  <p>
                    Try another search or clear the selected
                    filters.
                  </p>
                  <button
                    className="rs-shop-load-more"
                    onClick={clearFilters}
                    type="button"
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </div>

            {visibleCount < filteredProducts.length && (
              <button
                className="rs-shop-load-more"
                onClick={() =>
                  setVisibleCount(
                    (count) =>
                      count + INITIAL_VISIBLE_PRODUCTS
                  )
                }
                type="button"
              >
                Load More Products
              </button>
            )}
          </section>
        </div>

        <footer className="rs-shop-footer">
          <strong>RS BEAUTY</strong>
          <p>
            Curated beauty technology for routines around the
            world.
          </p>
        </footer>
      </div>

      {variantPicker && (
        <div
          className="rs-shop-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setVariantPicker(null);
            }
          }}
        >
          <div
            className="rs-shop-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rs-shop-variant-title"
          >
            <div className="rs-shop-modal-top">
              <div>
                <span className="rs-shop-eyebrow">
                  SELECT YOUR OPTIONS
                </span>
                <h2 id="rs-shop-variant-title">
                  {variantPicker.product.name}
                </h2>
              </div>

              <button
                className="rs-shop-modal-close"
                onClick={() => setVariantPicker(null)}
                aria-label="Close option selector"
                type="button"
              >
                ×
              </button>
            </div>

            {variantPicker.optionGroups.map((group) => (
              <div
                className="rs-shop-modal-group"
                key={group.name}
              >
                <h3>{group.name}</h3>

                <div className="rs-shop-modal-choices">
                  {group.choices.map((choice) => {
                    const available = isChoiceAvailable(
                      group.name,
                      choice
                    );

                    return (
                      <button
                        className={`rs-shop-choice ${
                          selectedOptions[group.name] ===
                          choice
                            ? 'active'
                            : ''
                        }`}
                        disabled={!available}
                        key={choice}
                        onClick={() => {
                          setSelectedOptions((current) => ({
                            ...current,
                            [group.name]: choice,
                          }));
                          setVariantError('');
                        }}
                        type="button"
                      >
                        {choice}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {variantError && (
              <div className="rs-shop-modal-error">
                {variantError}
              </div>
            )}

            <button
              className="rs-shop-modal-confirm"
              disabled={Boolean(busy)}
              onClick={confirmVariantSelection}
              type="button"
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

export default ShopPage;

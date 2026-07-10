import { NextResponse } from "next/server";
import type {
  ProductSearchPreference,
  ProductSearchResult,
} from "@/types/productSearch";

type NaverShoppingItem = {
  title: string;
  link: string;
  image: string;
  lprice: string;
  hprice: string;
  mallName: string;
  productId: string;
  productType: string;
  brand: string;
  maker: string;
  category1: string;
  category2: string;
  category3: string;
  category4: string;
};

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();
}

function toNullableNumber(value: string) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

function getPreferenceQuery(preference: ProductSearchPreference | null) {
  if (preference === "quality") return "저자극 성분 좋은";
  if (preference === "bulk") return "대용량 가성비";

  return "";
}

function normalizeSearchText(value: string) {
  return stripHtml(value)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function isHairDyeQuery(value: string) {
  return /(염색약|염모제|헤어컬러|헤어칼라|새치염색|새치염모)/.test(value);
}

function getAccessoryTerms(productName: string) {
  if (isHairDyeQuery(productName)) {
    return [
      "염색볼",
      "염색통",
      "믹싱볼",
      "염색그릇",
      "염색용기",
      "염색도구",
      "염색솔",
      "염색붓",
      "브러쉬",
      "브러시",
      "빗",
      "꼬리빗",
      "귀마개",
      "장갑",
      "케이프",
      "보울",
      "볼",
      "공병",
    ];
  }

  return ["케이스", "파우치", "커버", "거치대", "리필용기", "부품"];
}

function hasMainProductKeyword(productName: string, title: string) {
  if (isHairDyeQuery(productName)) {
    return /(염색약|염모제|헤어컬러|헤어칼라|새치염색|새치커버|크림염색|버블염색)/.test(
      title
    );
  }

  const normalizedProductName = normalizeSearchText(productName);
  const normalizedTitle = normalizeSearchText(title);

  return (
    normalizedProductName.length < 2 ||
    normalizedTitle.includes(normalizedProductName)
  );
}

function getProductMatchScore({
  productName,
  color,
  product,
  index,
}: {
  productName: string;
  color: string;
  product: ProductSearchResult;
  index: number;
}) {
  const normalizedTitle = normalizeSearchText(product.title);
  const normalizedColor = normalizeSearchText(color);
  let score = 100 - index;

  if (hasMainProductKeyword(productName, product.title)) {
    score += 80;
  }

  if (normalizedColor && normalizedTitle.includes(normalizedColor)) {
    score += 25;
  }

  if (/쿠팡|coupang/i.test(product.mallName)) {
    score += 12;
  }

  if (product.lowestPriceKrw && product.lowestPriceKrw < 1000) {
    score -= 60;
  }

  return score;
}

function isLikelyMainProduct({
  productName,
  product,
}: {
  productName: string;
  product: ProductSearchResult;
}) {
  const normalizedTitle = normalizeSearchText(product.title);
  const accessoryTerms = getAccessoryTerms(productName);
  const hasAccessoryOnlyTerm = accessoryTerms.some((term) => {
    return normalizedTitle.includes(normalizeSearchText(term));
  });

  if (hasAccessoryOnlyTerm) return false;

  return hasMainProductKeyword(productName, product.title);
}

function createFallbackProducts(query: string): ProductSearchResult[] {
  const encodedQuery = encodeURIComponent(query);

  return [
    {
      id: `fallback-coupang-${encodedQuery}`,
      title: `${query} 쿠팡 검색 결과 보기`,
      link: `https://www.coupang.com/np/search?q=${encodedQuery}`,
      image: null,
      mallName: "쿠팡 검색",
      brand: null,
      maker: null,
      lowestPriceKrw: null,
      category: "검색 링크",
      provider: "fallback",
      matchLabel: "검색 링크",
    },
  ];
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const productName = requestUrl.searchParams.get("product")?.trim() ?? "";
  const color = requestUrl.searchParams.get("color")?.trim() ?? "";
  const preference = requestUrl.searchParams.get(
    "preference"
  ) as ProductSearchPreference | null;
  const budgetText = requestUrl.searchParams.get("budget")?.trim() ?? "";
  const maxBudget = budgetText ? Number(budgetText) : null;

  if (!productName) {
    return NextResponse.json(
      {
        error: "상품명이 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  const query = [productName, color, getPreferenceQuery(preference)]
    .filter(Boolean)
    .join(" ");
  const naverClientId = process.env.NAVER_CLIENT_ID;
  const naverClientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!naverClientId || !naverClientSecret) {
    return NextResponse.json({
      products: createFallbackProducts(query),
      source: "fallback",
      message:
        "네이버 쇼핑 검색 키가 없어 쿠팡 검색 링크를 대신 보여줍니다.",
    });
  }

  const naverUrl = new URL("https://openapi.naver.com/v1/search/shop.json");
  naverUrl.searchParams.set("query", query);
  naverUrl.searchParams.set("display", "30");
  naverUrl.searchParams.set("start", "1");
  naverUrl.searchParams.set("sort", "sim");

  const response = await fetch(naverUrl, {
    headers: {
      "X-Naver-Client-Id": naverClientId,
      "X-Naver-Client-Secret": naverClientSecret,
    },
  });

  if (!response.ok) {
    return NextResponse.json({
      products: createFallbackProducts(query),
      source: "fallback",
      message: "네이버 쇼핑 검색에 실패해 쿠팡 검색 링크를 대신 보여줍니다.",
    });
  }

  const data = (await response.json()) as {
    items?: NaverShoppingItem[];
  };
  const normalizedProducts = (data.items ?? []).map((item, index) => {
    const lowestPriceKrw = toNullableNumber(item.lprice);

    const product: ProductSearchResult = {
      id: item.productId || item.link,
      title: stripHtml(item.title),
      link: item.link,
      image: item.image || null,
      mallName: stripHtml(item.mallName),
      brand: stripHtml(item.brand) || null,
      maker: stripHtml(item.maker) || null,
      lowestPriceKrw,
      category: [item.category1, item.category2, item.category3, item.category4]
        .filter(Boolean)
        .join(" > "),
      provider: "naver-shopping",
      matchLabel: "추천순 본상품 후보",
    };

    return {
      product,
      score: getProductMatchScore({
        productName,
        color,
        product,
        index,
      }),
    };
  });

  const mainProductCandidates = normalizedProducts
    .filter(({ product }) => {
      return isLikelyMainProduct({
        productName,
        product,
      });
    })
    .filter(({ product }) => {
      if (!maxBudget || !Number.isFinite(maxBudget)) return true;
      if (!product.lowestPriceKrw) return true;

      return product.lowestPriceKrw <= maxBudget;
    });
  const candidatePool =
    mainProductCandidates.length > 0
      ? mainProductCandidates
      : isHairDyeQuery(productName)
        ? []
        : normalizedProducts.slice(0, 12);
  const products = candidatePool
    .sort((a, b) => {
      if (preference !== "lowest-price") {
        return b.score - a.score;
      }

      const aPrice = a.product.lowestPriceKrw ?? Number.MAX_SAFE_INTEGER;
      const bPrice = b.product.lowestPriceKrw ?? Number.MAX_SAFE_INTEGER;

      if (aPrice !== bPrice) return aPrice - bPrice;

      return b.score - a.score;
    })
    .map(({ product }, index) => ({
      ...product,
      matchLabel:
        preference === "lowest-price"
          ? index === 0
            ? "추천순 후보 중 최저가"
            : "추천순 후보"
          : product.matchLabel,
    }))
    .slice(0, 5);

  return NextResponse.json({
    products: products.length > 0 ? products : createFallbackProducts(query),
    source: products.length > 0 ? "naver-shopping" : "fallback",
    message:
      products.length > 0
        ? preference === "lowest-price"
          ? "추천순 본상품 후보를 먼저 거른 뒤 그 안에서 낮은 가격순으로 정렬했습니다."
          : "추천순 본상품 후보를 보여줍니다."
        : "조건에 맞는 쇼핑 결과가 없어 검색 링크를 보여줍니다.",
  });
}

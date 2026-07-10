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
  if (preference === "lowest-price") return "최저가";
  if (preference === "bulk") return "대용량 가성비";

  return "";
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
  naverUrl.searchParams.set("display", "10");
  naverUrl.searchParams.set("start", "1");
  naverUrl.searchParams.set(
    "sort",
    preference === "lowest-price" ? "asc" : "sim"
  );

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
  const products = (data.items ?? [])
    .map((item): ProductSearchResult => {
      const lowestPriceKrw = toNullableNumber(item.lprice);

      return {
        id: item.productId || item.link,
        title: stripHtml(item.title),
        link: item.link,
        image: item.image || null,
        mallName: stripHtml(item.mallName),
        brand: stripHtml(item.brand) || null,
        maker: stripHtml(item.maker) || null,
        lowestPriceKrw,
        category: [
          item.category1,
          item.category2,
          item.category3,
          item.category4,
        ]
          .filter(Boolean)
          .join(" > "),
        provider: "naver-shopping",
      };
    })
    .filter((product) => {
      if (!maxBudget || !Number.isFinite(maxBudget)) return true;
      if (!product.lowestPriceKrw) return true;

      return product.lowestPriceKrw <= maxBudget;
    })
    .slice(0, 5);

  return NextResponse.json({
    products: products.length > 0 ? products : createFallbackProducts(query),
    source: products.length > 0 ? "naver-shopping" : "fallback",
    message:
      products.length > 0
        ? "네이버 쇼핑 검색 결과입니다."
        : "조건에 맞는 쇼핑 결과가 없어 검색 링크를 보여줍니다.",
  });
}

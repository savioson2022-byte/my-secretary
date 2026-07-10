export type ProductSearchPreference = "quality" | "lowest-price" | "bulk";

export type ProductSearchResult = {
  id: string;
  title: string;
  link: string;
  image: string | null;
  mallName: string;
  brand: string | null;
  maker: string | null;
  lowestPriceKrw: number | null;
  category: string;
  provider: "naver-shopping" | "fallback";
};

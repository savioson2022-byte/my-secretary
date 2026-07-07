import { NextResponse } from "next/server";
import { inferSavedPlaceType } from "@/lib/placeStorage";

type KakaoPlaceDocument = {
  id: string;
  place_name: string;
  category_name: string;
  category_group_code: string;
  category_group_name: string;
  phone: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
  place_url: string;
};

type NaverLocalItem = {
  title: string;
  link: string;
  category: string;
  description: string;
  telephone: string;
  address: string;
  roadAddress: string;
  mapx: string;
  mapy: string;
};

type NormalizedPlaceSearchResult = {
  provider: "kakao" | "naver";
  providerPlaceId: string | null;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  categoryName: string;
  phone: string;
  placeUrl: string;
  placeType: ReturnType<typeof inferSavedPlaceType>;
  businessHoursStart?: string;
  businessHoursEnd?: string;
};

function getDefaultBusinessHours(placeType: ReturnType<typeof inferSavedPlaceType>) {
  if (placeType === "gym") {
    return {
      businessHoursStart: "06:00",
      businessHoursEnd: "23:00",
    };
  }

  if (placeType === "salon" || placeType === "shop") {
    return {
      businessHoursStart: "10:00",
      businessHoursEnd: "20:00",
    };
  }

  return {
    businessHoursStart: undefined,
    businessHoursEnd: undefined,
  };
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();
}

function parseNaverCoordinate(value: string, kind: "latitude" | "longitude") {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return null;

  const scaledValue = numericValue / 10_000_000;
  const candidateValues = [numericValue, scaledValue];
  const min = kind === "latitude" ? -90 : -180;
  const max = kind === "latitude" ? 90 : 180;
  const validValue = candidateValues.find((candidate) => {
    return candidate >= min && candidate <= max;
  });

  return validValue ?? null;
}

function uniquePlaces(places: NormalizedPlaceSearchResult[]) {
  const placeMap = new Map<string, NormalizedPlaceSearchResult>();

  places.forEach((place) => {
    const key = `${place.name.trim().toLowerCase()}|${place.address
      .trim()
      .toLowerCase()}`;

    if (!placeMap.has(key)) {
      placeMap.set(key, place);
      return;
    }

    const existingPlace = placeMap.get(key);

    if (existingPlace?.provider === "naver" && place.provider === "kakao") {
      placeMap.set(key, place);
    }
  });

  return Array.from(placeMap.values());
}

async function searchKakaoPlaces(query: string) {
  const kakaoRestApiKey = process.env.KAKAO_REST_API_KEY;

  if (!kakaoRestApiKey) {
    return {
      places: [] as NormalizedPlaceSearchResult[],
      missing: "KAKAO_REST_API_KEY",
    };
  }

  const kakaoUrl = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
  kakaoUrl.searchParams.set("query", query);
  kakaoUrl.searchParams.set("size", "10");

  const response = await fetch(kakaoUrl, {
    headers: {
      Authorization: `KakaoAK ${kakaoRestApiKey}`,
    },
  });

  if (!response.ok) {
    return {
      places: [] as NormalizedPlaceSearchResult[],
      error: "카카오 장소 검색에 실패했습니다.",
    };
  }

  const data = (await response.json()) as {
    documents?: KakaoPlaceDocument[];
  };

  return {
    places: (data.documents ?? []).map((place) => {
      const placeType = inferSavedPlaceType(
        `${place.place_name} ${place.category_name}`,
        place.category_group_name
      );
      const defaultHours = getDefaultBusinessHours(placeType);

      return {
        provider: "kakao" as const,
        providerPlaceId: place.id,
        name: place.place_name,
        address: place.road_address_name || place.address_name,
        latitude: Number(place.y) || null,
        longitude: Number(place.x) || null,
        categoryName: place.category_name,
        phone: place.phone,
        placeUrl: place.place_url,
        placeType,
        businessHoursStart: defaultHours.businessHoursStart,
        businessHoursEnd: defaultHours.businessHoursEnd,
      };
    }),
  };
}

async function searchNaverPlaces(query: string) {
  const naverClientId = process.env.NAVER_CLIENT_ID;
  const naverClientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!naverClientId || !naverClientSecret) {
    return {
      places: [] as NormalizedPlaceSearchResult[],
      missing: "NAVER_CLIENT_ID/NAVER_CLIENT_SECRET",
    };
  }

  const naverUrl = new URL("https://openapi.naver.com/v1/search/local.json");
  naverUrl.searchParams.set("query", query);
  naverUrl.searchParams.set("display", "5");
  naverUrl.searchParams.set("start", "1");
  naverUrl.searchParams.set("sort", "random");

  const response = await fetch(naverUrl, {
    headers: {
      "X-Naver-Client-Id": naverClientId,
      "X-Naver-Client-Secret": naverClientSecret,
    },
  });

  if (!response.ok) {
    return {
      places: [] as NormalizedPlaceSearchResult[],
      error: "네이버 지역 검색에 실패했습니다.",
    };
  }

  const data = (await response.json()) as {
    items?: NaverLocalItem[];
  };

  return {
    places: (data.items ?? []).map((item) => {
      const name = stripHtml(item.title);
      const categoryName = stripHtml(item.category);
      const placeType = inferSavedPlaceType(`${name} ${categoryName}`, item.description);
      const defaultHours = getDefaultBusinessHours(placeType);

      return {
        provider: "naver" as const,
        providerPlaceId: item.link || `${name}-${item.roadAddress || item.address}`,
        name,
        address: item.roadAddress || item.address,
        latitude: parseNaverCoordinate(item.mapy, "latitude"),
        longitude: parseNaverCoordinate(item.mapx, "longitude"),
        categoryName,
        phone: item.telephone,
        placeUrl: item.link,
        placeType,
        businessHoursStart: defaultHours.businessHoursStart,
        businessHoursEnd: defaultHours.businessHoursEnd,
      };
    }),
  };
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const query = requestUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json(
      {
        error: "검색어가 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  const [kakaoResult, naverResult] = await Promise.all([
    searchKakaoPlaces(query),
    searchNaverPlaces(query),
  ]);
  const places = uniquePlaces([
    ...kakaoResult.places,
    ...naverResult.places,
  ]).slice(0, 12);
  const missingKeys = [kakaoResult.missing, naverResult.missing].filter(
    (key): key is string => Boolean(key)
  );
  const errors = [kakaoResult.error, naverResult.error].filter(
    (error): error is string => Boolean(error)
  );

  if (places.length === 0 && missingKeys.length === 2) {
    return NextResponse.json(
      {
        error:
          "장소 검색 API 키가 설정되지 않았습니다. KAKAO_REST_API_KEY 또는 NAVER_CLIENT_ID/NAVER_CLIENT_SECRET이 필요합니다.",
        missingKeys,
      },
      {
        status: 503,
      }
    );
  }

  return NextResponse.json({
    places,
    missingKeys,
    errors,
  });
}

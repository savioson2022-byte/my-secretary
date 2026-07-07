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

export async function GET(request: Request) {
  const kakaoRestApiKey = process.env.KAKAO_REST_API_KEY;
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

  if (!kakaoRestApiKey) {
    return NextResponse.json(
      {
        error: "KAKAO_REST_API_KEY가 설정되지 않았습니다.",
      },
      {
        status: 503,
      }
    );
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
    return NextResponse.json(
      {
        error: "카카오 장소 검색에 실패했습니다.",
      },
      {
        status: response.status,
      }
    );
  }

  const data = (await response.json()) as {
    documents?: KakaoPlaceDocument[];
  };

  return NextResponse.json({
    places: (data.documents ?? []).map((place) => {
      const placeType = inferSavedPlaceType(
        `${place.place_name} ${place.category_name}`,
        place.category_group_name
      );
      const defaultHours = getDefaultBusinessHours(placeType);

      return {
        provider: "kakao",
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
  });
}

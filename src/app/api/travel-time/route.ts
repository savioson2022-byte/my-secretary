import { NextResponse } from "next/server";
import { TravelMode } from "@/types/calendar";

type TravelTimeRequest = {
  fromPlaceName?: string;
  toPlaceName?: string;
  fromAddress?: string;
  toAddress?: string;
  departureTime?: string;
  mode?: TravelMode;
};

type KakaoAddressDocument = {
  x: string;
  y: string;
};

type OdsayPath = {
  info?: {
    totalTime?: number;
  };
};

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
const ODSAY_API_KEY = process.env.ODSAY_API_KEY;

function badRequest(message: string) {
  return NextResponse.json(
    {
      ok: false,
      reason: message,
    },
    {
      status: 400,
    }
  );
}

async function geocodeAddress(address: string) {
  if (!KAKAO_REST_API_KEY) {
    return null;
  }

  const url = new URL("https://dapi.kakao.com/v2/local/search/address.json");
  url.searchParams.set("query", address);

  const response = await fetch(url, {
    headers: {
      Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    documents?: KakaoAddressDocument[];
  };
  const firstDocument = data.documents?.[0];

  if (!firstDocument) {
    return null;
  }

  return {
    longitude: Number(firstDocument.x),
    latitude: Number(firstDocument.y),
  };
}

async function getTransitMinutes({
  fromAddress,
  toAddress,
}: {
  fromAddress: string;
  toAddress: string;
}) {
  if (!KAKAO_REST_API_KEY || !ODSAY_API_KEY) {
    return null;
  }

  const [from, to] = await Promise.all([
    geocodeAddress(fromAddress),
    geocodeAddress(toAddress),
  ]);

  if (!from || !to) {
    return null;
  }

  const url = new URL("https://api.odsay.com/v1/api/searchPubTransPathT");
  url.searchParams.set("SX", String(from.longitude));
  url.searchParams.set("SY", String(from.latitude));
  url.searchParams.set("EX", String(to.longitude));
  url.searchParams.set("EY", String(to.latitude));
  url.searchParams.set("apiKey", ODSAY_API_KEY);

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    result?: {
      path?: OdsayPath[];
    };
  };
  const minutes = data.result?.path?.[0]?.info?.totalTime;

  if (!Number.isFinite(minutes) || !minutes) {
    return null;
  }

  return Math.round(minutes);
}

export async function POST(request: Request) {
  let body: TravelTimeRequest;

  try {
    body = (await request.json()) as TravelTimeRequest;
  } catch {
    return badRequest("요청 형식이 올바르지 않습니다.");
  }

  const fromAddress = body.fromAddress?.trim();
  const toAddress = body.toAddress?.trim();
  const mode = body.mode;

  if (!fromAddress || !toAddress || !mode) {
    return badRequest("출발 주소, 도착 주소, 이동수단이 필요합니다.");
  }

  if (mode !== "transit") {
    return NextResponse.json({
      ok: false,
      reason: "현재 서버 API는 대중교통 계산만 지원합니다.",
    });
  }

  if (!KAKAO_REST_API_KEY || !ODSAY_API_KEY) {
    return NextResponse.json({
      ok: false,
      reason:
        "KAKAO_REST_API_KEY와 ODSAY_API_KEY가 설정되면 대중교통 이동시간을 계산합니다.",
    });
  }

  const minutes = await getTransitMinutes({
    fromAddress,
    toAddress,
  });

  if (!minutes) {
    return NextResponse.json({
      ok: false,
      reason: "대중교통 이동시간을 찾지 못했습니다.",
    });
  }

  return NextResponse.json({
    ok: true,
    provider: "odsay+kakao",
    minutes,
  });
}

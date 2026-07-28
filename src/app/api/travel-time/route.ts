import { NextResponse } from "next/server";
import { TravelMode } from "@/types/calendar";

type TravelTimeRequest = {
  fromPlaceName?: string;
  toPlaceName?: string;
  fromAddress?: string;
  toAddress?: string;
  departureTime?: string;
  mode?: TravelMode;
  fromLatitude?: number;
  fromLongitude?: number;
  toLatitude?: number;
  toLongitude?: number;
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

type Coordinates = {
  latitude: number;
  longitude: number;
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
  from,
  to,
}: {
  from: Coordinates;
  to: Coordinates;
}) {
  if (!ODSAY_API_KEY) {
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

function getDistanceMeters(from: Coordinates, to: Coordinates) {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const startLatitude = toRadians(from.latitude);
  const endLatitude = toRadians(to.latitude);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return Math.round(
    earthRadiusMeters * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
  );
}

async function getCarRoute({
  from,
  to,
}: {
  from: Coordinates;
  to: Coordinates;
}) {
  if (!KAKAO_REST_API_KEY) return null;

  const url = new URL("https://apis-navi.kakaomobility.com/v1/directions");
  url.searchParams.set("origin", `${from.longitude},${from.latitude}`);
  url.searchParams.set("destination", `${to.longitude},${to.latitude}`);
  url.searchParams.set("priority", "RECOMMEND");

  const response = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
    cache: "no-store",
  });
  if (!response.ok) return null;

  const data = (await response.json()) as {
    routes?: Array<{ summary?: { duration?: number; distance?: number } }>;
  };
  const summary = data.routes?.[0]?.summary;
  if (!summary?.duration) return null;

  return {
    minutes: Math.max(1, Math.ceil(summary.duration / 60)),
    distanceMeters: summary.distance,
    provider: "kakao-mobility",
  };
}

function getCoordinate(body: TravelTimeRequest, prefix: "from" | "to") {
  const latitude =
    prefix === "from" ? body.fromLatitude : body.toLatitude;
  const longitude =
    prefix === "from" ? body.fromLongitude : body.toLongitude;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude: Number(latitude), longitude: Number(longitude) };
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

  if (!mode) {
    return badRequest("이동수단이 필요합니다.");
  }

  const from =
    getCoordinate(body, "from") ??
    (fromAddress ? await geocodeAddress(fromAddress) : null);
  const to =
    getCoordinate(body, "to") ??
    (toAddress ? await geocodeAddress(toAddress) : null);

  if (!from || !to) {
    return badRequest("출발지와 도착지 좌표를 확인하지 못했습니다.");
  }

  const straightDistanceMeters = getDistanceMeters(from, to);
  if (straightDistanceMeters <= 300) {
    return NextResponse.json({
      ok: true,
      provider: "device-location",
      minutes: 0,
      distanceMeters: straightDistanceMeters,
      atDestination: true,
    });
  }

  if (mode === "car") {
    const route = await getCarRoute({ from, to });
    if (route) {
      return NextResponse.json({
        ok: true,
        ...route,
        distanceMeters: route.distanceMeters ?? straightDistanceMeters,
        atDestination: false,
      });
    }
  }

  const transitMinutes =
    mode === "transit" ? await getTransitMinutes({ from, to }) : null;
  const estimatedRoadDistance =
    mode === "walk"
      ? straightDistanceMeters * 1.2
      : straightDistanceMeters * 1.35;
  const fallbackSpeedMetersPerMinute =
    mode === "walk" ? 75 : mode === "car" ? 500 : 250;
  const minutes =
    transitMinutes ??
    Math.max(1, Math.ceil(estimatedRoadDistance / fallbackSpeedMetersPerMinute));

  return NextResponse.json({
    ok: true,
    provider: transitMinutes ? "odsay" : `${mode}-distance-estimate`,
    minutes,
    distanceMeters: straightDistanceMeters,
    atDestination: false,
  });
}

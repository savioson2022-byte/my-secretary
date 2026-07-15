function parseHeaders(rawHeaders: string) {
  const headers = new Map<string, string>();
  const unfolded = rawHeaders.replace(/\r?\n[ \t]+/g, " ");

  unfolded.split(/\r?\n/).forEach((line) => {
    const separatorIndex = line.indexOf(":");

    if (separatorIndex <= 0) return;

    const name = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();

    headers.set(name, value);
  });

  return headers;
}

function splitHeaderAndBody(raw: string) {
  const match = raw.match(/\r?\n\r?\n/);

  if (!match || typeof match.index !== "number") {
    return {
      headers: new Map<string, string>(),
      body: raw,
    };
  }

  return {
    headers: parseHeaders(raw.slice(0, match.index)),
    body: raw.slice(match.index + match[0].length),
  };
}

function getHeaderParam(headerValue: string | undefined, name: string) {
  if (!headerValue) return null;

  const pattern = new RegExp(`${name}="?([^";\\r\\n]+)"?`, "i");
  const match = headerValue.match(pattern);

  return match?.[1]?.trim() ?? null;
}

function decodeBuffer(buffer: Buffer, charset: string | null) {
  const normalizedCharset = charset?.trim().toLowerCase() ?? "utf-8";
  const decoderLabels = [
    normalizedCharset,
    normalizedCharset === "ks_c_5601-1987" ? "euc-kr" : "",
    normalizedCharset === "ks_c_5601-1987" ? "windows-949" : "",
    "utf-8",
  ].filter(Boolean);

  for (const label of decoderLabels) {
    try {
      return new TextDecoder(label).decode(buffer);
    } catch {
      // Try the next likely label.
    }
  }

  return buffer.toString("utf8");
}

function decodeQuotedPrintableToBuffer(value: string) {
  const normalized = value.replace(/=\r?\n/g, "");
  const bytes: number[] = [];

  for (let index = 0; index < normalized.length; index += 1) {
    const current = normalized[index];
    const hex = normalized.slice(index + 1, index + 3);

    if (current === "=" && /^[0-9a-f]{2}$/i.test(hex)) {
      bytes.push(Number.parseInt(hex, 16));
      index += 2;
      continue;
    }

    bytes.push(normalized.charCodeAt(index) & 0xff);
  }

  return Buffer.from(bytes);
}

function encodeStringAsBinaryBuffer(value: string) {
  return Buffer.from(value, "binary");
}

function decodeTransferEncodedBody({
  body,
  encoding,
  charset,
}: {
  body: string;
  encoding: string | null;
  charset: string | null;
}) {
  const normalizedEncoding = encoding?.toLowerCase() ?? "";

  if (normalizedEncoding.includes("base64")) {
    return decodeBuffer(
      Buffer.from(body.replace(/\s+/g, ""), "base64"),
      charset
    );
  }

  if (normalizedEncoding.includes("quoted-printable")) {
    return decodeBuffer(decodeQuotedPrintableToBuffer(body), charset);
  }

  return decodeBuffer(encodeStringAsBinaryBuffer(body), charset);
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replace(/&#([0-9]+);/g, (_, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, 10))
    );
}

function stripHtml(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/\s(?:alt|title|aria-label)="([^"]{2,200})"/gi, "\n$1\n")
      .replace(/\s(?:alt|title|aria-label)='([^']{2,200})'/gi, "\n$1\n")
      .replace(
        /<(br|p|div|tr|td|th|table|tbody|thead|li|ul|ol|a|span|h[1-6])\b[^>]*>/gi,
        "\n"
      )
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s+/g, "\n")
  ).trim();
}

function splitMultipartBody(body: string, boundary: string) {
  const delimiter = `--${boundary}`;

  return body
    .split(delimiter)
    .map((part) => part.replace(/^\r?\n/, "").trim())
    .filter((part) => part && part !== "--" && !part.startsWith("--"));
}

function extractMimeText(raw: string, depth = 0): string[] {
  if (depth > 8) return [];

  const { headers, body } = splitHeaderAndBody(raw);
  const contentType = headers.get("content-type") ?? "text/plain";
  const transferEncoding = headers.get("content-transfer-encoding") ?? null;
  const charset = getHeaderParam(contentType, "charset");
  const boundary = getHeaderParam(contentType, "boundary");

  if (/multipart\//i.test(contentType) && boundary) {
    return splitMultipartBody(body, boundary).flatMap((part) =>
      extractMimeText(part, depth + 1)
    );
  }

  if (!/text\/(plain|html)/i.test(contentType)) {
    return [];
  }

  const decoded = decodeTransferEncodedBody({
    body,
    encoding: transferEncoding,
    charset,
  });

  return [/text\/html/i.test(contentType) ? stripHtml(decoded) : decoded];
}

export function extractReadableMailTextFromRawSource(rawSource: string | Buffer) {
  const rawText = Buffer.isBuffer(rawSource)
    ? rawSource.toString("binary")
    : rawSource;
  const extracted = extractMimeText(rawText)
    .map((text) => text.trim())
    .filter(Boolean)
    .join("\n\n");

  const fallback = stripHtml(rawText);
  const text = extracted || fallback;

  return text
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 80000);
}

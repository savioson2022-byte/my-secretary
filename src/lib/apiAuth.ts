import type { User } from "@supabase/supabase-js";
import {
  createSupabaseAdminClient,
  createSupabaseUserServerClient,
} from "@/lib/supabase/server";

export async function getUserFromAuthorization(request: Request): Promise<{
  accessToken: string;
  user: User;
} | null> {
  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();

  if (!accessToken) return null;

  const supabase = createSupabaseUserServerClient(accessToken);

  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return null;

  return {
    accessToken,
    user: data.user,
  };
}

export async function getAuthedSupabaseForRequest(request: Request) {
  const auth = await getUserFromAuthorization(request);

  if (!auth) return null;

  return {
    auth,
    supabase:
      createSupabaseAdminClient() ??
      createSupabaseUserServerClient(auth.accessToken),
  };
}

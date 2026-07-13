import type { SupabaseClient, User } from "@supabase/supabase-js";
import type {
  AccountIdentity,
  AppLoginCredential,
  AppAccount,
  UnifiedAccountState,
} from "@/types/unifiedAccount";

function getUserDisplayName(user: User) {
  const metadata = user.user_metadata ?? {};
  const name =
    metadata.full_name ??
    metadata.name ??
    metadata.preferred_username ??
    metadata.nickname;

  if (typeof name === "string" && name.trim()) {
    return name.trim();
  }

  return user.email?.split("@")[0] ?? "사용자";
}

function getProvider(user: User) {
  const provider = user.app_metadata?.provider;

  if (typeof provider === "string" && provider.trim()) {
    return provider.trim();
  }

  return "email";
}

function getProviderSubject(user: User, provider: string) {
  const identities = user.identities ?? [];
  const matchingIdentity =
    identities.find((identity) => identity.provider === provider) ??
    identities[0];

  return matchingIdentity?.identity_id ?? user.id;
}

export async function ensureUnifiedAccount({
  supabase,
  user,
  loginId,
}: {
  supabase: SupabaseClient;
  user: User;
  loginId?: string;
}): Promise<UnifiedAccountState | null> {
  const provider = getProvider(user);
  const providerSubject = getProviderSubject(user, provider);
  const displayName = getUserDisplayName(user);
  const email = user.email ?? "";
  const now = new Date().toISOString();
  const normalizedLoginId = loginId?.trim() || null;

  async function upsertLoginCredential(account: AppAccount) {
    if (!normalizedLoginId || !email) return;

    const { error } = await supabase
      .from("app_login_credentials")
      .upsert(
        {
          app_account_id: account.id,
          auth_user_id: user.id,
          login_id: normalizedLoginId,
          email,
          updated_at: now,
        },
        {
          onConflict: "auth_user_id",
        }
      )
      .select()
      .single<AppLoginCredential>();

    if (error) {
      throw error;
    }
  }

  const { data: existingIdentity, error: identityError } = await supabase
    .from("account_identities")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle<AccountIdentity>();

  if (identityError) {
    throw identityError;
  }

  if (existingIdentity) {
    const { data: account, error: accountError } = await supabase
      .from("app_accounts")
      .select("*")
      .eq("id", existingIdentity.app_account_id)
      .maybeSingle<AppAccount>();

    if (accountError) {
      throw accountError;
    }

    const { data: identity, error: updateError } = await supabase
      .from("account_identities")
      .update({
        provider,
        provider_subject: providerSubject,
        email,
        display_name: displayName,
        last_sign_in_at: now,
        updated_at: now,
      })
      .eq("id", existingIdentity.id)
      .select()
      .single<AccountIdentity>();

    if (updateError) {
      throw updateError;
    }

    if (account && normalizedLoginId && account.login_id !== normalizedLoginId) {
      const { data: updatedAccount, error: accountUpdateError } = await supabase
        .from("app_accounts")
        .update({
          login_id: normalizedLoginId,
          updated_at: now,
        })
        .eq("id", account.id)
        .select()
        .single<AppAccount>();

      if (accountUpdateError) {
        throw accountUpdateError;
      }

      await upsertLoginCredential(updatedAccount);
      return identity ? { account: updatedAccount, identity } : null;
    }

    if (account) {
      await upsertLoginCredential(account);
    }

    return account && identity ? { account, identity } : null;
  }

  const { data: account, error: accountInsertError } = await supabase
    .from("app_accounts")
    .insert({
      primary_auth_user_id: user.id,
      login_id: normalizedLoginId,
      display_name: displayName,
      primary_email: email,
      status: "active",
      updated_at: now,
    })
    .select()
    .single<AppAccount>();

  if (accountInsertError) {
    throw accountInsertError;
  }

  const { data: identity, error: identityInsertError } = await supabase
    .from("account_identities")
    .insert({
      app_account_id: account.id,
      auth_user_id: user.id,
      provider,
      provider_subject: providerSubject,
      email,
      display_name: displayName,
      last_sign_in_at: now,
      updated_at: now,
    })
    .select()
    .single<AccountIdentity>();

  if (identityInsertError) {
    throw identityInsertError;
  }

  await upsertLoginCredential(account);

  return { account, identity };
}

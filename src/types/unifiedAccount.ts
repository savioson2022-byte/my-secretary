export type AppAccount = {
  id: string;
  primary_auth_user_id: string | null;
  display_name: string;
  primary_email: string;
  status: "active" | "disabled" | string;
  created_at: string;
  updated_at: string;
};

export type AccountIdentity = {
  id: string;
  app_account_id: string;
  auth_user_id: string;
  provider: string;
  provider_subject: string | null;
  email: string | null;
  display_name: string | null;
  last_sign_in_at: string;
  created_at: string;
  updated_at: string;
};

export type UnifiedAccountState = {
  account: AppAccount;
  identity: AccountIdentity;
};

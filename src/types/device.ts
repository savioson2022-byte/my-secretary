export type RegisteredDevice = {
  id: string;
  user_id: string;
  device_name: string;
  device_type: string;
  user_agent: string;
  trusted: boolean;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
};

export type UserProfileRecord = {
  id: string;
  display_name: string;
  classification_preference: string;
  created_at: string;
  updated_at: string;
};

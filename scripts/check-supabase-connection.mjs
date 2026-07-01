import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url) {
  console.error("NEXT_PUBLIC_SUPABASE_URL is missing.");
  process.exit(1);
}

if (!publishableKey || publishableKey.includes("...")) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing."
  );
  process.exit(1);
}

const supabase = createClient(url, publishableKey);
const { data, error } = await supabase.auth.getSession();

if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log("Supabase connection OK");
console.log(`Session: ${data.session ? "signed in" : "not signed in"}`);

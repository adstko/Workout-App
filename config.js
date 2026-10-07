// config.js — where the online features (accounts, friends, leaderboard) connect.
// The URL and the "anon" key are public by design: the privacy rules in supabase/setup.sql are what protect the data.
// NEVER put the "service_role" / "secret" key in this file.

const ONLINE_CONFIG = window.__ONLINE_CONFIG || {   // (the tests swap this for a local copy)
  url: "https://opqnvrpqgbrguoxanjap.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wcW52cnBxZ2JyZ3VveGFuamFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MDIzNzcsImV4cCI6MjEwNjk3ODM3N30.cC4BP1T27wZE4qYC3LmMCnd1FJZhJ_rSSpWerlgUVLY",
  // Accounts are a nickname + password. Supabase wants an email-shaped login, so each nickname becomes nickname@this-domain.
  // Nothing is ever sent to that address.
  emailDomain: "workout-tracker.invalid",
};

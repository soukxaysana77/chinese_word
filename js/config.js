// Server connection (Supabase) — see SERVER_SETUP.md.
//
// Both values are meant to be public: they let the website READ the word
// list and call the admin functions. The admin PIN is checked on the
// server, not here, so nobody can change words without it.
//
// Leave them empty to run without a server (the game then uses the
// built-in list in data/questions.js and the admin page is disabled).
const SERVER_CONFIG = {
  supabaseUrl: "",  // e.g. "https://abcdefghijkl.supabase.co"
  supabaseKey: ""   // the "anon public" (or "publishable") API key
};

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const supabase = isSupabaseConfigured
	? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
	: null;

module.exports = {
	supabase,
	isSupabaseConfigured
};

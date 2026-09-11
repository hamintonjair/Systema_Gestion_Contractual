import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'kelias12@hotmail.com',
    password: '123456',
  });
  console.log("Auth error code:", error?.code, "Message:", error?.message);
}
run();

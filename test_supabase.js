import { createClient } from '@supabase/supabase-js';
const url = 'https://xliprucicnickwqoqtpa.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsaXBydWNpY25pY2t3cW9xdHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyODk2MTMsImV4cCI6MjA4NTg2NTYxM30.ThDX7tleJf7Ty9XAn4dSXTC4p9slCizSUwffoWeU2HA';

const supabase = createClient(url, key);

async function test() {
  const { data, error } = await supabase.from('ev_logs').select('*').limit(1);
  if (error) {
    console.error("Connection failed:", error.message);
  } else {
    console.log("Connection successful! Data:", data);
  }
}
test();

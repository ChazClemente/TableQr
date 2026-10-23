import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xoxmowmxvtjafkcxefhk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_l9wKKlbV-yTQs1A_v-RTYw_cw78VehF';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
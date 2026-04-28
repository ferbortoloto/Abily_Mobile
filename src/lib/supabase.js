import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { secureStorage } from './secureStorage';

const SUPABASE_URL = 'https://zyhqmetfnqptjjxdfvuj.supabase.co';
const SUPABASE_ANON_KEY = 'SUPABASE_KEY_REMOVIDA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: secureStorage,      // Keychain (iOS) / Keystore (Android) em vez de AsyncStorage
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

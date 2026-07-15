import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { seedLogs, type EvLog } from '../data/seedData';

// Storage keys
const STORAGE_KEY_LOGS = 'ev_logs_local';
const STORAGE_KEY_CONFIG = 'ev_tracker_supabase_config';

interface SupabaseConfig {
  url: string;
  anonKey: string;
}

// Global supabase client instance
let supabaseClient: SupabaseClient | null = null;
let currentConfig: SupabaseConfig | null = null;

// Initialize config from localStorage or Environment Variables
try {
  const savedConfig = localStorage.getItem(STORAGE_KEY_CONFIG);
  let envUrl = import.meta.env.VITE_SUPABASE_URL;
  let envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (savedConfig) {
    const config = JSON.parse(savedConfig) as SupabaseConfig;
    if (config.url && config.anonKey) {
      currentConfig = config;
      supabaseClient = createClient(config.url, config.anonKey);
    }
  } else if (envUrl && envKey) {
    currentConfig = { url: envUrl, anonKey: envKey };
    supabaseClient = createClient(envUrl, envKey);
    // Also save to localStorage for consistent state in Settings tab
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(currentConfig));
  }
} catch (e) {
  console.error('Failed to parse Supabase config from localStorage', e);
}

// Get the local storage logs, initialized with seed data if empty
export const getLocalLogs = (): EvLog[] => {
  const local = localStorage.getItem(STORAGE_KEY_LOGS);
  if (!local) {
    // Seed with initial historical logs
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(seedLogs));
    return seedLogs;
  }
  try {
    return JSON.parse(local) as EvLog[];
  } catch (e) {
    return seedLogs;
  }
};

// Set local storage logs
export const setLocalLogs = (logs: EvLog[]) => {
  localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs));
};

// Test Supabase connection
export const testSupabaseConnection = async (url: string, anonKey: string): Promise<boolean> => {
  try {
    const testClient = createClient(url, anonKey);
    const { error } = await testClient.from('ev_logs').select('id').limit(1);
    return !error;
  } catch (e) {
    return false;
  }
};

// Save Supabase credentials and initialize client
export const saveSupabaseConfig = (url: string, anonKey: string): boolean => {
  if (!url || !anonKey) {
    localStorage.removeItem(STORAGE_KEY_CONFIG);
    supabaseClient = null;
    currentConfig = null;
    return true;
  }

  try {
    const config = { url, anonKey };
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
    currentConfig = config;
    supabaseClient = createClient(url, anonKey);
    return true;
  } catch (e) {
    return false;
  }
};

// Get Supabase credentials
export const getSupabaseConfig = (): SupabaseConfig | null => {
  return currentConfig;
};

// Check if currently connected to Supabase
export const isSupabaseConnected = (): boolean => {
  return supabaseClient !== null;
};

// Core database query functions (fallback to local if not connected)
export const fetchLogs = async (): Promise<EvLog[]> => {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('ev_logs')
        .select('*')
        .order('date', { ascending: false })
        .order('id', { ascending: false });
      
      if (!error && data) {
        // Sync local storage with what we got from Supabase
        const dbLogs = data as EvLog[];
        setLocalLogs(dbLogs);
        return dbLogs;
      }
      console.warn('Supabase fetch failed, falling back to localStorage:', error);
    } catch (e) {
      console.warn('Supabase exception, falling back to localStorage:', e);
    }
  }
  
  // Local storage fallback (sorted by date desc)
  const localLogs = getLocalLogs();
  return [...localLogs].sort((a, b) => {
    const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (dateCompare !== 0) return dateCompare;
    return b.id - a.id;
  });
};

export const createLog = async (logData: Omit<EvLog, 'id' | 'created_at'>): Promise<EvLog> => {
  const newId = Date.now();
  const newCreatedAt = new Date().toISOString();
  const newLog: EvLog = {
    ...logData,
    id: newId,
    created_at: newCreatedAt
  };

  // 1. Write to local storage first
  const logs = getLocalLogs();
  logs.unshift(newLog);
  setLocalLogs(logs);

  // 2. Write to Supabase if connected
  if (supabaseClient) {
    try {
      // Omit ID to let Supabase auto-increment or use the current one
      const { data, error } = await supabaseClient
        .from('ev_logs')
        .insert([{
          type: logData.type,
          date: logData.date,
          start_soc: logData.start_soc,
          end_soc: logData.end_soc,
          units: logData.units,
          cost: logData.cost,
          station_name: logData.station_name
        }])
        .select();

      if (!error && data && data.length > 0) {
        // Update local log with the actual Supabase record (which has database ID and created_at)
        const dbLog = data[0] as EvLog;
        const updatedLogs = getLocalLogs().map(l => l.id === newId ? dbLog : l);
        setLocalLogs(updatedLogs);
        return dbLog;
      }
      console.warn('Failed to insert in Supabase, kept in local storage:', error);
    } catch (e) {
      console.warn('Exception during Supabase insert:', e);
    }
  }

  return newLog;
};

export const updateLog = async (id: number, logData: Omit<EvLog, 'id' | 'created_at'>): Promise<EvLog | null> => {
  // 1. Update local storage
  const logs = getLocalLogs();
  const updated = logs.map(l => l.id === id ? { ...l, ...logData } : l);
  setLocalLogs(updated);

  // 2. Update in Supabase if connected
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('ev_logs')
        .update({
          type: logData.type,
          date: logData.date,
          start_soc: logData.start_soc,
          end_soc: logData.end_soc,
          units: logData.units,
          cost: logData.cost,
          station_name: logData.station_name,
        })
        .eq('id', id)
        .select();

      if (!error && data && data.length > 0) {
        return data[0] as EvLog;
      }
      console.warn('Failed to update in Supabase, kept locally:', error);
    } catch (e) {
      console.warn('Exception during Supabase update:', e);
    }
  }

  return updated.find(l => l.id === id) || null;
};

export const deleteLogsByMonth = async (year: number, month: number): Promise<{ success: boolean; count: number; error?: string }> => {
  const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate(); // month is 1-indexed here
  const endStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const logs = getLocalLogs();
  const toDelete = logs.filter(l => l.date >= startStr && l.date <= endStr);
  const remaining = logs.filter(l => !(l.date >= startStr && l.date <= endStr));

  // Update local first
  setLocalLogs(remaining);

  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from('ev_logs')
        .delete()
        .gte('date', startStr)
        .lte('date', endStr);

      if (error) {
        setLocalLogs(logs); // rollback
        return { success: false, count: 0, error: error.message };
      }
    } catch (e: any) {
      setLocalLogs(logs); // rollback
      return { success: false, count: 0, error: e.message };
    }
  }

  return { success: true, count: toDelete.length };
};

export const deleteLog = async (id: number): Promise<boolean> => {
  // 1. Delete from local storage
  const logs = getLocalLogs();
  const updatedLogs = logs.filter(log => log.id !== id);
  setLocalLogs(updatedLogs);

  // 2. Delete from Supabase if connected
  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from('ev_logs')
        .delete()
        .eq('id', id);

      if (error) {
        console.warn('Failed to delete from Supabase, log remains deleted locally:', error);
        return false;
      }
    } catch (e) {
      console.warn('Exception during Supabase delete:', e);
      return false;
    }
  }
  return true;
};

// Sync local logs to Supabase
export const syncLocalToSupabase = async (): Promise<{ success: boolean; count: number; error?: string }> => {
  if (!supabaseClient) {
    return { success: false, count: 0, error: 'Supabase is not configured' };
  }

  try {
    // 1. Fetch current IDs from Supabase to prevent duplicates
    const { data: dbData, error: dbError } = await supabaseClient.from('ev_logs').select('id');
    if (dbError) {
      return { success: false, count: 0, error: dbError.message };
    }

    const existingIds = new Set(dbData.map(row => row.id));
    const localLogs = getLocalLogs();

    // 2. Filter logs that do not exist in Supabase
    // Note: Local logs generated during mock mode have ID as timestamp.
    // If they aren't in Supabase, we push them.
    const toUpload = localLogs.filter(log => !existingIds.has(log.id));

    if (toUpload.length === 0) {
      return { success: true, count: 0 };
    }

    // 3. Prepare data (clean up IDs that might conflict or insert with our IDs if allowed)
    // In Supabase, if generated by default is identity, we can insert our own IDs if we include them.
    // Or we let Supabase generate them. Let's send the records.
    const rowsToInsert = toUpload.map(log => ({
      type: log.type,
      date: log.date,
      start_soc: log.start_soc,
      end_soc: log.end_soc,
      units: log.units,
      cost: log.cost,
      station_name: log.station_name,
      created_at: log.created_at
    }));

    const { error: insertError } = await supabaseClient.from('ev_logs').insert(rowsToInsert);

    if (insertError) {
      return { success: false, count: 0, error: insertError.message };
    }

    // 4. Re-fetch all from Supabase to sync local storage with actual database states
    const { data: finalData, error: finalError } = await supabaseClient
      .from('ev_logs')
      .select('*')
      .order('date', { ascending: false });

    if (!finalError && finalData) {
      setLocalLogs(finalData as EvLog[]);
    }

    return { success: true, count: toUpload.length };
  } catch (e: any) {
    return { success: false, count: 0, error: e.message || 'Unknown error' };
  }
};

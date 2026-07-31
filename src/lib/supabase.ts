/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';
import { TrafficTicket, InfractionType, UserProfile, UserRole, AuthorizedEmail } from '../types';
import { DEFAULT_INFRACTIONS } from './infractionsData';

// Safe storage wrapper helper to prevent page crash on strict browsers/iframes without localStorage access
export const safeStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('localStorage is not accessible, using memory fallback:', e);
      return (window as any).__mem_storage?.[key] || null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('localStorage is not accessible, using memory fallback:', e);
      if (!(window as any).__mem_storage) {
        (window as any).__mem_storage = {};
      }
      (window as any).__mem_storage[key] = value;
    }
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('localStorage is not accessible, using memory fallback:', e);
      if ((window as any).__mem_storage) {
        delete (window as any).__mem_storage[key];
      }
    }
  }
};

const sanitizeUrl = (urlStr: any): string => {
  if (!urlStr || typeof urlStr !== 'string') return '';
  let trimmed = urlStr.trim();
  if (
    trimmed === '' || 
    trimmed === 'undefined' || 
    trimmed === 'null' || 
    trimmed.startsWith('sb_publishable_') ||
    trimmed.startsWith('eyJ') ||
    !trimmed.includes('.') ||
    trimmed === 'your-supabase-project.supabase.co' || 
    trimmed === 'https://your-supabase-project.supabase.co'
  ) {
    return '';
  }
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    trimmed = 'https://' + trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname.includes('.')) {
      return trimmed;
    }
  } catch (_) {
    // ignore
  }
  return '';
};

const DEFAULT_SUPABASE_URL = 'https://yanvopffwhhfadlxcbkg.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_4_fnl9gzrpte3y5cfuywla_kygmnkdp';

// Read environmental variables with local storage dynamic configuration fallback
const getSupabaseConfig = () => {
  let url = (import.meta as any).env?.VITE_SUPABASE_URL || safeStorage.getItem('VITE_SUPABASE_URL') || '';
  let anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || safeStorage.getItem('VITE_SUPABASE_ANON_KEY') || '';

  let sanitizedUrl = sanitizeUrl(url);

  if (!sanitizedUrl || !sanitizedUrl.includes('.') || sanitizedUrl.includes('your-supabase-project')) {
    sanitizedUrl = DEFAULT_SUPABASE_URL;
  }

  if (!anonKey || anonKey === 'your-supabase-anon-key' || anonKey === 'undefined' || anonKey === 'null' || anonKey.trim() === '') {
    anonKey = DEFAULT_SUPABASE_ANON_KEY;
  }

  // If using default URL and no custom key was explicitly stored in safeStorage, pair with DEFAULT_SUPABASE_ANON_KEY
  if (sanitizedUrl === DEFAULT_SUPABASE_URL && !safeStorage.getItem('VITE_SUPABASE_ANON_KEY')) {
    anonKey = DEFAULT_SUPABASE_ANON_KEY;
  }

  return { url: sanitizedUrl, anonKey };
};

let { url: supabaseUrl, anonKey: supabaseAnonKey } = getSupabaseConfig();

let isSupabaseDisabledDueToInvalidKey = false;

export function markSupabaseKeyInvalid(err?: any) {
  if (!err) return;
  const msg = typeof err === 'string' ? err : (err.message || err.error_description || JSON.stringify(err));
  const hint = err.hint || '';
  if (
    msg.includes('Invalid API key') || 
    msg.includes('JWT') ||
    msg.includes('401')
  ) {
    if (!isSupabaseDisabledDueToInvalidKey) {
      isSupabaseDisabledDueToInvalidKey = true;
      console.info('Supabase API Key é inválida ou o projeto está desativado.');
    }
  }
}

// Check if Supabase credentials are validly configured
export const isSupabaseConfigured = () => Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.includes('.') &&
  !supabaseUrl.includes('your-supabase-project')
);

export const isSupabaseActive = () => isSupabaseConfigured() && supabaseClient !== null;

// Real Supabase instance initialized directly
let client: any = null;
if (supabaseUrl && supabaseAnonKey) {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey);
    console.log('Supabase conectado diretamente em:', supabaseUrl);
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
  }
}
export let supabaseClient = client;

export function updateRuntimeSupabaseConfig(url: string, anonKey: string) {
  const cleanUrl = sanitizeUrl(url) || (url.startsWith('http') ? url.trim() : `https://${url.trim()}`);
  const cleanKey = anonKey.trim();

  safeStorage.setItem('VITE_SUPABASE_URL', cleanUrl);
  safeStorage.setItem('VITE_SUPABASE_ANON_KEY', cleanKey);

  supabaseUrl = cleanUrl;
  supabaseAnonKey = cleanKey;
  isSupabaseDisabledDueToInvalidKey = false;

  try {
    supabaseClient = createClient(cleanUrl, cleanKey);
    console.log('Runtime Supabase client updated successfully:', cleanUrl);

    // Notify backend server to update its Supabase client as well
    fetch('/api/config/supabase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: cleanUrl, anonKey: cleanKey })
    }).catch(err => {
      console.warn('Could not post Supabase config to backend server:', err);
    });
  } catch (e) {
    console.warn('Failed to update runtime Supabase client:', e);
  }
}

// Seed list of initially authorized emails
const DEFAULT_AUTHORIZED_EMAILS: AuthorizedEmail[] = [
  {
    email: 'sttpojucaba@gmail.com',
    role: UserRole.ADMIN,
    name: 'STT Pojuca Admin',
    lastLoginAt: '2026-07-23T10:00:00.000Z'
  },
  {
    email: 'luizemerson17@gmail.com',
    role: UserRole.ADMIN,
    name: 'Emerson Mares',
    lastLoginAt: new Date().toISOString()
  }
];

// LOCAL DATABASE STORAGE KEYS
export const STORAGE_KEYS = {
  TICKETS: 'sgait_tickets_db',
  DELETED_TICKETS: 'sgait_deleted_tickets_db',
  INFRACTIONS: 'sgait_infractions_db',
  AUTHORIZED: 'sgait_authorized_emails_db',
  CURRENT_USER: 'sgait_current_user_db'
};

const ALWAYS_DELETED_KEYS: string[] = [];

export function getDeletedTicketKeys(): string[] {
  try {
    const raw = safeStorage.getItem(STORAGE_KEYS.DELETED_TICKETS);
    const stored: string[] = raw ? JSON.parse(raw) : [];
    // Only return keys explicitly deleted by user (filtering out any legacy auto-tombstoned sample AITs)
    const cleanStored = stored.filter(k => {
      if (!k) return false;
      const upper = String(k).toUpperCase();
      if (upper.startsWith('AIT001234') || upper.startsWith('TICKET-DEMO') || upper.startsWith('TICKET-')) return false;
      return true;
    });
    return Array.from(new Set(cleanStored));
  } catch (e) {
    return [];
  }
}

export function addDeletedTicketKeys(keys: (string | undefined | null)[]) {
  try {
    const current = getDeletedTicketKeys();
    const cleanKeys = keys.filter(Boolean).map(k => String(k).toUpperCase().trim());
    const updated = Array.from(new Set([...current, ...cleanKeys]));
    safeStorage.setItem(STORAGE_KEYS.DELETED_TICKETS, JSON.stringify(updated));
  } catch (e) {}
}

export function isKeyDeleted(idOrAit: string | undefined | null, deletedKeys: string[]): boolean {
  if (!idOrAit) return false;
  const norm = String(idOrAit).toUpperCase().trim();
  return deletedKeys.includes(norm);
}

// Custom events name for simulated realtime channel
const REALTIME_EVENT_NAME = 'sgait_realtime_sync';

export interface RealtimeMessage {
  type: 'INSERT' | 'UPDATE' | 'DELETE' | 'SYSTEM';
  table: 'tickets' | 'authorized_emails' | 'infractions';
  data: any;
}

// Ensure local storage is seeded with initial mock data if empty
const initializeLocalStorage = () => {
  const localInfractionStr = safeStorage.getItem(STORAGE_KEYS.INFRACTIONS);
  let localInfractionsList: InfractionType[] = [];
  if (localInfractionStr) {
    try {
      localInfractionsList = JSON.parse(localInfractionStr);
    } catch (e) {}
  }
  if (!Array.isArray(localInfractionsList) || localInfractionsList.length === 0) {
    safeStorage.setItem(STORAGE_KEYS.INFRACTIONS, JSON.stringify(DEFAULT_INFRACTIONS));
  }
  
  const localAuth = safeStorage.getItem(STORAGE_KEYS.AUTHORIZED);
  if (!localAuth) {
    safeStorage.setItem(STORAGE_KEYS.AUTHORIZED, JSON.stringify(DEFAULT_AUTHORIZED_EMAILS));
  } else {
    try {
      const parsed = JSON.parse(localAuth);
      if (Array.isArray(parsed)) {
        // Keep only emails that are either luizemerson17@gmail.com or other custom added emails (remove removed defaults)
        const removedEmails = ['sttpojuca@gmail.com', 'diretoria@sgait.gov.br', 'agente.silva@sgait.gov.br', 'agente.souza@sgait.gov.br'];
        const filtered = parsed.filter(item => !removedEmails.includes(item.email));
        safeStorage.setItem(STORAGE_KEYS.AUTHORIZED, JSON.stringify(filtered));
      }
    } catch (e) {
      safeStorage.setItem(STORAGE_KEYS.AUTHORIZED, JSON.stringify(DEFAULT_AUTHORIZED_EMAILS));
    }
  }

  // Clear current user if it is sttpojuca@gmail.com
  const currUserStr = safeStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  if (currUserStr) {
    try {
      const parsedUser = JSON.parse(currUserStr);
      if (parsedUser && parsedUser.email === 'sttpojuca@gmail.com') {
        safeStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      }
    } catch (e) {}
  }
  
  // Clear legacy tombstone keys from localStorage
  const legacyDeleted = safeStorage.getItem(STORAGE_KEYS.DELETED_TICKETS);
  if (legacyDeleted) {
    try {
      const parsedDeleted = JSON.parse(legacyDeleted);
      if (Array.isArray(parsedDeleted)) {
        const cleaned = parsedDeleted.filter((k: string) => {
          if (!k) return false;
          const upper = String(k).toUpperCase();
          if (upper.startsWith('AIT001234') || upper.startsWith('TICKET-DEMO') || upper.startsWith('TICKET-')) return false;
          return true;
        });
        safeStorage.setItem(STORAGE_KEYS.DELETED_TICKETS, JSON.stringify(cleaned));
      }
    } catch (e) {}
  }

  // Ensure tickets array is initialized in local storage
  const existingTickets = safeStorage.getItem(STORAGE_KEYS.TICKETS);
  if (!existingTickets || existingTickets === 'undefined') {
    safeStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify([]));
  } else {
    try {
      const parsed = JSON.parse(existingTickets);
      if (!Array.isArray(parsed)) {
        safeStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify([]));
      }
    } catch (e) {
      safeStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify([]));
    }
  }
};

initializeLocalStorage();

// Dispatch simulated real-time messages
const dispatchRealtimeMessage = (type: 'INSERT' | 'UPDATE' | 'DELETE', table: 'tickets' | 'authorized_emails' | 'infractions', data: any) => {
  const message: RealtimeMessage = { type, table, data };
  const event = new CustomEvent(REALTIME_EVENT_NAME, { detail: message });
  window.dispatchEvent(event);
};

/**
 * Função que determina o papel do usuário (ADMINISTRADOR ou AGENTE).
 * Qualquer conta logada via Google ou e-mail que não seja o admin principal (luizemerson17@gmail.com)
 * ou não possua autorização prévia de ADMINISTRADOR na tabela sgait_authorized_emails
 * é classificada estritamente como AGENTE de trânsito.
 */
export async function determineUserRole(email: string): Promise<UserRole> {
  if (!email) return UserRole.AGENTE;
  
  const cleanEmail = email.trim().toLowerCase();

  // 1. Os e-mails dos Administradores do Sistema
  if (cleanEmail === 'luizemerson17@gmail.com' || cleanEmail === 'sttpojucaba@gmail.com') {
    return UserRole.ADMIN;
  }

  // 2. Consulta tabela de permissões no Supabase (se ativo)
  if (isSupabaseActive()) {
    try {
      const { data, error } = await supabaseClient
        .from('sgait_authorized_emails')
        .select('role')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (!error && data && data.role) {
        return data.role === UserRole.ADMIN ? UserRole.ADMIN : UserRole.AGENTE;
      }
    } catch (e) {
      console.warn('determineUserRole: Erro ao consultar Supabase:', e);
    }
  }

  // 3. Consulta lista de e-mails autorizados em cache local
  try {
    const localAuthRaw = safeStorage.getItem(STORAGE_KEYS.AUTHORIZED);
    if (localAuthRaw) {
      const localAuthList: AuthorizedEmail[] = JSON.parse(localAuthRaw);
      const match = localAuthList.find(ae => ae.email.toLowerCase() === cleanEmail);
      if (match && match.role) {
        return match.role === UserRole.ADMIN ? UserRole.ADMIN : UserRole.AGENTE;
      }
    }
  } catch (e) {
    console.warn('determineUserRole: Erro ao consultar storage local:', e);
  }

  // 4. Por padrão, qualquer usuário que faça login entra como AGENTE DE TRÂNSITO
  return UserRole.AGENTE;
}

export function mapRowToTicket(row: any): TrafficTicket {
  if (!row) return row;
  
  let rawDateStr = row.infraction_date || row.infractionDate || '';
  let cleanInfractionDate = '';
  if (rawDateStr) {
    cleanInfractionDate = String(rawDateStr).substring(0, 10);
  } else {
    const d = new Date();
    cleanInfractionDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  return {
    id: row.id || `ticket-${Math.random().toString(36).substring(2, 9)}`,
    aitNumber: row.ait_number || row.aitNumber || '',
    infractionDate: cleanInfractionDate,
    infractionTime: row.infraction_time || row.infractionTime || new Date().toTimeString().substring(0, 5),
    location: row.location || '',
    plate: (row.plate || '').toUpperCase(),
    vehicleType: row.vehicle_type || row.vehicleType || 'Passeio',
    infractionCode: row.infraction_code || row.infractionCode || '',
    infractionDescription: row.infraction_description || row.infractionDescription || '',
    framing: row.framing || '',
    article: row.article || '',
    nature: row.nature || 'Média',
    fineValue: row.fine_value !== undefined ? Number(row.fine_value) : Number(row.fineValue || 0),
    score: row.score !== undefined ? Number(row.score) : Number(row.score || 0),
    adminMeasure: row.admin_measure || row.adminMeasure || '',
    additionalInfractions: row.additional_infractions || row.additionalInfractions || [],
    infractions: row.infractions || row.additional_infractions || row.additionalInfractions || [],
    detectionType: row.detection_type || row.detectionType || 'In Loco',
    observations: row.observations || '',
    photos: row.photos || [],
    agentId: row.agent_id || row.agentId || '',
    agentName: row.agent_name || row.agentName || 'Agente de Trânsito',
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || row.updatedAt || new Date().toISOString()
  };
}

// APP ACTIONS LAYER - Handles both Supabase and simulated localStorage modes
export const dbService = {
  /**
   * Expõe a função de determinação de papéis no serviço central.
   */
  async determineUserRole(email: string): Promise<UserRole> {
    return determineUserRole(email);
  },

  // ==========================================
  // AUTH METHODS
  // ==========================================
  
  /**
   * Triggers the Google OAuth Sign In flow.
   * If real Supabase keys exist, uses Supabase Auth.
   * Otherwise, provides a fallback simulation.
   */
  async signInWithGoogle(simulatedEmail?: string): Promise<{ user: UserProfile | null; error: string | null }> {
    const emailToUse = (simulatedEmail || 'luizemerson17@gmail.com').trim().toLowerCase();
    const role = await determineUserRole(emailToUse);

    const authorizedEmails: AuthorizedEmail[] = JSON.parse(safeStorage.getItem(STORAGE_KEYS.AUTHORIZED) || '[]');
    let authRecord = authorizedEmails.find(ae => ae.email.toLowerCase() === emailToUse);

    const defaultName = emailToUse === 'sttpojucaba@gmail.com' ? 'STT Pojuca Admin' :
                        emailToUse === 'luizemerson17@gmail.com' ? 'Emerson Mares' :
                        emailToUse.split('@')[0];

    const userName = authRecord?.name || defaultName;
    const nowIso = new Date().toISOString();

    if (!authRecord) {
      authRecord = {
        email: emailToUse,
        name: userName,
        role: role,
        lastLoginAt: nowIso
      };
      authorizedEmails.push(authRecord);
    } else {
      authRecord.lastLoginAt = nowIso;
      if (!authRecord.name || authRecord.name === authRecord.email.split('@')[0]) {
        authRecord.name = userName;
      }
    }
    safeStorage.setItem(STORAGE_KEYS.AUTHORIZED, JSON.stringify(authorizedEmails));

    // Post/update to server backend store
    try {
      fetch('/api/authorized-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authRecord)
      }).catch(() => {});
    } catch (e) {}

    const mockUserProfile: UserProfile = {
      id: `user-id-${emailToUse.replace(/[^a-zA-Z0-9]/g, '')}`,
      email: emailToUse,
      name: userName,
      avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(userName)}`,
      role: role,
      googleId: `google-id-${emailToUse.substring(0, 5)}`,
      firstAccessAt: authRecord.lastLoginAt || nowIso,
      lastLoginAt: nowIso
    };

    // Save active session locally
    safeStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(mockUserProfile));

    // Async sync with Supabase tables if active
    if (isSupabaseActive()) {
      (async () => {
        try {
          await supabaseClient.from('sgait_authorized_emails').upsert({
            email: authRecord.email,
            name: authRecord.name,
            role: authRecord.role,
            last_login_at: authRecord.lastLoginAt
          }, { onConflict: 'email' });

          await supabaseClient.from('sgait_profiles').upsert({
            id: mockUserProfile.id,
            email: mockUserProfile.email,
            name: mockUserProfile.name,
            avatar_url: mockUserProfile.avatarUrl,
            role: mockUserProfile.role,
            google_id: mockUserProfile.googleId,
            last_login_at: mockUserProfile.lastLoginAt
          }, { onConflict: 'email' });
        } catch (e) {}
      })();
    }

    return { user: mockUserProfile, error: null };
  },

  /**
   * Sign in with Email and Password (always enabled by default on Supabase)
   */
  async signInWithEmail(email: string, password: string): Promise<{ user: UserProfile | null; error: string | null }> {
    if (isSupabaseConfigured() && supabaseClient) {
      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;

        if (!data.user) {
          throw new Error('Usuário ou senha incorretos.');
        }

        const userProfile = await this.getCurrentUser();
        if (!userProfile) {
          const fallbackProfile: UserProfile = {
            id: data.user.id,
            email: data.user.email!,
            name: data.user.user_metadata?.full_name || data.user.email!.split('@')[0],
            avatarUrl: data.user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(data.user.email!)}`,
            role: data.user.user_metadata?.role || UserRole.ADMIN,
            googleId: data.user.id,
            firstAccessAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString()
          };
          return { user: fallbackProfile, error: null };
        }

        return { user: userProfile, error: null };
      } catch (err: any) {
        return { user: null, error: err.message || 'Erro ao realizar login.' };
      }
    } else {
      // Local simulation
      return this.signInWithGoogle(email);
    }
  },

  /**
   * Sign up with Email and Password
   */
  async signUpWithEmail(email: string, password: string, name: string, role: UserRole = UserRole.AGENTE): Promise<{ user: UserProfile | null; error: string | null }> {
    if (isSupabaseConfigured() && supabaseClient) {
      try {
        const { data, error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
              role: role
            }
          }
        });
        if (error) throw error;

        if (!data.user) {
          throw new Error('Não foi possível registrar o usuário.');
        }

        // Add to authorized_emails in database
        try {
          await supabaseClient.from('sgait_authorized_emails').insert({
            email: email,
            name: name,
            role: role
          });
        } catch (e) {
          console.warn('Erro ao inserir em authorized_emails:', e);
        }

        const profileData: UserProfile = {
          id: data.user.id,
          email: email,
          name: name,
          avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}`,
          role: role,
          googleId: data.user.id,
          firstAccessAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        };

        // Try to insert directly in profiles
        try {
          await supabaseClient.from('sgait_profiles').insert({
            id: profileData.id,
            email: profileData.email,
            name: profileData.name,
            avatar_url: profileData.avatarUrl,
            role: profileData.role,
            google_id: profileData.googleId,
            last_login_at: profileData.lastLoginAt
          });
        } catch (e) {
          console.warn('Erro ao salvar no sgait_profiles:', e);
        }

        return { user: profileData, error: null };
      } catch (err: any) {
        return { user: null, error: err.message || 'Erro ao registrar nova conta.' };
      }
    } else {
      // Local simulation registration
      const authorizedEmails: AuthorizedEmail[] = JSON.parse(safeStorage.getItem(STORAGE_KEYS.AUTHORIZED) || '[]');
      if (!authorizedEmails.some(ae => ae.email.toLowerCase() === email.toLowerCase())) {
        authorizedEmails.push({ email, name, role });
        safeStorage.setItem(STORAGE_KEYS.AUTHORIZED, JSON.stringify(authorizedEmails));
      }
      return this.signInWithGoogle(email);
    }
  },

  async signOut(): Promise<{ error: string | null }> {
    if (isSupabaseConfigured() && supabaseClient) {
      try {
        await supabaseClient.auth.signOut();
      } catch (e) {
        console.warn('Erro ao deslogar do Supabase auth:', e);
      }
      safeStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      return { error: null };
    } else {
      safeStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      return { error: null };
    }
  },

  async getCurrentUser(): Promise<UserProfile | null> {
    if (isSupabaseConfigured() && supabaseClient) {
      try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
          // Clean hash error if returning from failed OAuth redirect
          if (typeof window !== 'undefined' && (window.location.hash.includes('error=') || window.location.search.includes('error='))) {
            try { window.history.replaceState(null, '', window.location.pathname); } catch (e) {}
          }
          // Fallback to local session even if Supabase is active
          const stored = safeStorage.getItem(STORAGE_KEYS.CURRENT_USER);
          return stored ? JSON.parse(stored) : null;
        }

        const cleanEmail = (user.email || '').trim().toLowerCase();

        // Check if user has an authorized profile in Supabase
        let authorizedUser = null;
        try {
          const { data, error: authError } = await supabaseClient
            .from('sgait_authorized_emails')
            .select('*')
            .eq('email', cleanEmail)
            .single();
          
          if (!authError && data) {
            authorizedUser = data;
          } else {
            // Check designated admin emails
            if (cleanEmail === 'sttpojucaba@gmail.com' || cleanEmail === 'luizemerson17@gmail.com') {
              authorizedUser = { 
                email: cleanEmail, 
                name: cleanEmail === 'sttpojucaba@gmail.com' ? 'STT Pojuca Admin' : 'Emerson Mares', 
                role: UserRole.ADMIN 
              };
            } else {
              // Any other user is automatically classified as Agente
              authorizedUser = { email: cleanEmail, name: user.user_metadata?.full_name || cleanEmail.split('@')[0], role: UserRole.AGENTE };
            }
          }
        } catch (e) {
          console.warn('Failed to query sgait_authorized_emails:', e);
          const role = await determineUserRole(cleanEmail);
          authorizedUser = { email: cleanEmail, name: user.user_metadata?.full_name || cleanEmail.split('@')[0], role };
        }

        // Fetch or create profile
        let profile = null;
        try {
          const { data, error: profileError } = await supabaseClient
            .from('sgait_profiles')
            .select('*')
            .eq('email', user.email)
            .single();
          profile = data;
        } catch (e) {
          console.warn('Failed to query sgait_profiles:', e);
        }

        const userRole = (authorizedUser?.role) || await determineUserRole(user.email!);

        const profileData: UserProfile = profile ? {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatar_url,
          role: profile.role,
          googleId: profile.google_id,
          firstAccessAt: profile.created_at,
          lastLoginAt: new Date().toISOString()
        } : {
          id: user.id,
          email: user.email!,
          name: user.user_metadata?.full_name || user.email!.split('@')[0],
          avatarUrl: user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(user.email!)}`,
          role: userRole,
          googleId: user.id,
          firstAccessAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        };

        // Always sync user profile to local session storage as well
        safeStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(profileData));

        // Write profile back to database if it didn't exist or needs update
        try {
          if (!profile) {
            await supabaseClient.from('sgait_profiles').insert({
              id: profileData.id,
              email: profileData.email,
              name: profileData.name,
              avatar_url: profileData.avatarUrl,
              role: profileData.role,
              google_id: profileData.googleId,
              last_login_at: profileData.lastLoginAt
            });
          } else {
            await supabaseClient.from('sgait_profiles').update({
              last_login_at: profileData.lastLoginAt
            }).eq('id', profile.id);
          }
        } catch (e) {
          console.warn('Could not persist profile in sgait_profiles table:', e);
        }

        return profileData;
      } catch (err) {
        console.error('Error in getCurrentUser:', err);
        const stored = safeStorage.getItem(STORAGE_KEYS.CURRENT_USER);
        return stored ? JSON.parse(stored) : null;
      }
    } else {
      const stored = safeStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      return stored ? JSON.parse(stored) : null;
    }
  },

  // ==========================================
  // TRAFFIC TICKETS (AUTOS DE INFRAÇÃO)
  // ==========================================
  
  async getTickets(): Promise<TrafficTicket[]> {
    let serverTickets: TrafficTicket[] = [];
    
    // 1. Fetch from central backend server API
    try {
      const res = await fetch('/api/tickets');
      if (res.ok) {
        const rawList = await res.json();
        if (Array.isArray(rawList)) {
          serverTickets = rawList.map(mapRowToTicket);
        }
      }
    } catch (e) {
      console.warn('Backend server /api/tickets error:', e);
    }

    // 2. Fetch from Supabase client if configured
    let supabaseTickets: TrafficTicket[] = [];
    if (isSupabaseActive()) {
      try {
        const { data, error } = await supabaseClient
          .from('sgait_autos')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          markSupabaseKeyInvalid(error);
        } else if (data) {
          supabaseTickets = data.map(mapRowToTicket);
        }
      } catch (err) {
        markSupabaseKeyInvalid(err);
      }
    }

    // 3. Local storage fallback cache
    const deletedKeys = getDeletedTicketKeys();
    const rawLocal: any[] = JSON.parse(safeStorage.getItem(STORAGE_KEYS.TICKETS) || '[]');
    const localTickets: TrafficTicket[] = rawLocal.map(mapRowToTicket);

    const isDeleted = (t: TrafficTicket) => {
      if (!t) return true;
      if (t.id && isKeyDeleted(t.id, deletedKeys)) return true;
      if (t.aitNumber && isKeyDeleted(t.aitNumber, deletedKeys)) return true;
      return false;
    };

    // Merge all sources into one unified collection
    const mergedMap = new Map<string, TrafficTicket>();
    
    const addOrMergeTicket = (t: TrafficTicket) => {
      if (!t || isDeleted(t)) return;
      const key = (t.aitNumber && t.aitNumber.trim().toUpperCase()) || t.id;
      if (!key) return;
      const existing = mergedMap.get(key);
      if (!existing) {
        mergedMap.set(key, t);
      } else {
        const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        const tTime = new Date(t.updatedAt || t.createdAt || 0).getTime();
        if (tTime >= existingTime) {
          mergedMap.set(key, { ...existing, ...t });
        } else {
          mergedMap.set(key, { ...t, ...existing });
        }
      }
    };

    for (const t of localTickets) addOrMergeTicket(t);
    for (const t of serverTickets) addOrMergeTicket(t);
    for (const t of supabaseTickets) addOrMergeTicket(t);

    const mergedList = Array.from(mergedMap.values())
      .filter(t => !isDeleted(t))
      .sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );

    // Save clean unified tickets to local cache
    safeStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(mergedList));

    // Send unpushed local tickets to server if needed
    if (mergedList.length > 0) {
      fetch('/api/tickets/bulk-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickets: mergedList })
      }).catch(() => {});
    }

    return mergedList;
  },

  async insertTicket(ticket: Omit<TrafficTicket, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ data: TrafficTicket | null; error: string | null }> {
    const id = `ticket-${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();
    const newTicket: TrafficTicket = {
      ...ticket,
      id,
      createdAt: now,
      updatedAt: now
    };

    // 1. Update local storage cache immediately
    const current: TrafficTicket[] = JSON.parse(safeStorage.getItem(STORAGE_KEYS.TICKETS) || '[]');
    const existingIdx = current.findIndex(t => t.aitNumber.toUpperCase() === newTicket.aitNumber.toUpperCase());
    if (existingIdx >= 0) {
      current[existingIdx] = newTicket;
    } else {
      current.unshift(newTicket);
    }
    safeStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(current));

    // 2. Post to central Express backend server
    try {
      await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTicket)
      });
    } catch (e) {
      console.warn('Could not post ticket to backend API:', e);
    }

    // 3. Post/Upsert to Supabase if active
    if (isSupabaseActive()) {
      try {
        if (newTicket.infractionCode) {
          try {
            await supabaseClient.from('sgait_infractions_table').upsert({
              code: String(newTicket.infractionCode).trim(),
              description: newTicket.infractionDescription || 'Infração de trânsito',
              framing: newTicket.framing || 'Art. CTB',
              article: newTicket.article || 'CTB',
              nature: newTicket.nature || 'Média',
              fine_value: Number(newTicket.fineValue) || 0,
              score: Number(newTicket.score) || 0,
              admin_measure: newTicket.adminMeasure || 'Nenhuma'
            }, { onConflict: 'code' });
          } catch (e) {}
        }

        // Sanitize values for Supabase DB schema compatibility
        let cleanDate = newTicket.infractionDate || '';
        if (cleanDate.includes('T')) cleanDate = cleanDate.split('T')[0];
        if (!cleanDate || !cleanDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          cleanDate = new Date().toISOString().split('T')[0];
        }

        let cleanTime = newTicket.infractionTime || '00:00';
        if (cleanTime.includes('T')) cleanTime = cleanTime.split('T')[1].substring(0, 5);
        if (cleanTime.length > 8) cleanTime = cleanTime.substring(0, 5);
        if (!cleanTime || !cleanTime.includes(':')) cleanTime = '00:00';

        let cleanNature = 'Média';
        const rawNature = String(newTicket.nature || '').toLowerCase();
        if (rawNature.includes('gravissim') || rawNature.includes('gravíssim')) cleanNature = 'Gravíssima';
        else if (rawNature.includes('grave')) cleanNature = 'Grave';
        else if (rawNature.includes('media') || rawNature.includes('méd')) cleanNature = 'Média';
        else if (rawNature.includes('leve')) cleanNature = 'Leve';

        const addInfList = Array.isArray(newTicket.additionalInfractions) ? newTicket.additionalInfractions : (Array.isArray(newTicket.infractions) ? newTicket.infractions : []);

        const dbPayload: any = {
          ait_number: String(newTicket.aitNumber).trim().toUpperCase(),
          infraction_date: cleanDate,
          infraction_time: cleanTime,
          location: newTicket.location || '',
          plate: String(newTicket.plate || '').trim().toUpperCase(),
          vehicle_type: newTicket.vehicleType || 'Passeio',
          infraction_code: newTicket.infractionCode ? String(newTicket.infractionCode).trim() : null,
          infraction_description: newTicket.infractionDescription || '',
          framing: newTicket.framing || '',
          article: newTicket.article || '',
          nature: cleanNature,
          fine_value: Number(newTicket.fineValue) || 0,
          score: Number(newTicket.score) || 0,
          admin_measure: newTicket.adminMeasure || 'Nenhuma',
          observations: newTicket.observations || '',
          photos: Array.isArray(newTicket.photos) ? newTicket.photos : [],
          agent_id: String(newTicket.agentId || 'agent-0'),
          agent_name: newTicket.agentName || 'Agente',
          additional_infractions: addInfList,
          infractions: addInfList,
          detection_type: newTicket.detectionType || 'In Loco'
        };

        let { error } = await supabaseClient
          .from('sgait_autos')
          .upsert(dbPayload, { onConflict: 'ait_number' });

        if (error && (error.code === '42703' || (error.message && (error.message.toLowerCase().includes('column') || error.message.toLowerCase().includes('does not exist'))))) {
          delete dbPayload.additional_infractions;
          delete dbPayload.infractions;
          delete dbPayload.detection_type;
          const retryCol = await supabaseClient
            .from('sgait_autos')
            .upsert(dbPayload, { onConflict: 'ait_number' });
          error = retryCol.error;
        }

        if (error && (error.code === '23503' || (error.message && error.message.toLowerCase().includes('foreign key')))) {
          dbPayload.infraction_code = null;
          const retryFk = await supabaseClient
            .from('sgait_autos')
            .upsert(dbPayload, { onConflict: 'ait_number' });
          error = retryFk.error;
        }

        if (error && (error.code === '42P10' || (error.message && error.message.toLowerCase().includes('conflict')))) {
          const { data: existingRow } = await supabaseClient
            .from('sgait_autos')
            .select('id')
            .eq('ait_number', dbPayload.ait_number)
            .maybeSingle();

          if (existingRow && existingRow.id) {
            const updateRes = await supabaseClient.from('sgait_autos').update(dbPayload).eq('ait_number', dbPayload.ait_number);
            error = updateRes.error;
          } else {
            const insertRes = await supabaseClient.from('sgait_autos').insert(dbPayload);
            error = insertRes.error;
          }
        }

        if (error) {
          console.warn('Supabase upsert warning in insertTicket:', error);
        }
      } catch (err: any) {
        console.warn('Supabase insertTicket exception:', err);
      }
    }

    dispatchRealtimeMessage('INSERT', 'tickets', newTicket);
    return { data: newTicket, error: null };
  },

  async updateTicket(id: string, ticket: Partial<TrafficTicket>): Promise<{ data: TrafficTicket | null; error: string | null }> {
    const now = new Date().toISOString();

    // 1. Update local storage
    const current: TrafficTicket[] = JSON.parse(safeStorage.getItem(STORAGE_KEYS.TICKETS) || '[]');
    const index = current.findIndex(t => t.id === id || (ticket.aitNumber && t.aitNumber.toUpperCase() === ticket.aitNumber.toUpperCase()));
    let updatedTicket: TrafficTicket;

    if (index >= 0) {
      updatedTicket = { ...current[index], ...ticket, updatedAt: now };
      current[index] = updatedTicket;
    } else {
      updatedTicket = { ...(ticket as TrafficTicket), id, updatedAt: now };
      current.unshift(updatedTicket);
    }
    safeStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(current));

    // 2. Put to central backend
    try {
      await fetch(`/api/tickets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticket)
      });
    } catch (e) {
      console.warn('Could not put ticket to backend API:', e);
    }

    // 3. Put to Supabase if active
    if (isSupabaseActive()) {
      try {
        const payload: any = {};
        if (ticket.aitNumber !== undefined) payload.ait_number = String(ticket.aitNumber).trim().toUpperCase();
        if (ticket.infractionDate !== undefined) {
          let cleanD = ticket.infractionDate;
          if (cleanD.includes('T')) cleanD = cleanD.split('T')[0];
          payload.infraction_date = cleanD;
        }
        if (ticket.infractionTime !== undefined) {
          let cleanT = ticket.infractionTime;
          if (cleanT.includes('T')) cleanT = cleanT.split('T')[1].substring(0, 5);
          if (cleanT.length > 8) cleanT = cleanT.substring(0, 5);
          payload.infraction_time = cleanT;
        }
        if (ticket.location !== undefined) payload.location = ticket.location;
        if (ticket.plate !== undefined) payload.plate = String(ticket.plate).trim().toUpperCase();
        if (ticket.vehicleType !== undefined) payload.vehicle_type = ticket.vehicleType;
        if (ticket.infractionCode !== undefined) payload.infraction_code = ticket.infractionCode ? String(ticket.infractionCode).trim() : null;
        if (ticket.infractionDescription !== undefined) payload.infraction_description = ticket.infractionDescription;
        if (ticket.framing !== undefined) payload.framing = ticket.framing;
        if (ticket.article !== undefined) payload.article = ticket.article;
        if (ticket.nature !== undefined) payload.nature = ticket.nature;
        if (ticket.fineValue !== undefined) payload.fine_value = Number(ticket.fineValue) || 0;
        if (ticket.score !== undefined) payload.score = Number(ticket.score) || 0;
        if (ticket.adminMeasure !== undefined) payload.admin_measure = ticket.adminMeasure;
        if (ticket.observations !== undefined) payload.observations = ticket.observations;
        if (ticket.photos !== undefined) payload.photos = Array.isArray(ticket.photos) ? ticket.photos : [];

        if (ticket.aitNumber) {
          await supabaseClient.from('sgait_autos').update(payload).eq('ait_number', ticket.aitNumber);
        } else {
          await supabaseClient.from('sgait_autos').update(payload).eq('id', id);
        }
      } catch (err: any) {
        console.warn('Supabase updateTicket exception:', err);
      }
    }

    dispatchRealtimeMessage('UPDATE', 'tickets', updatedTicket);
    return { data: updatedTicket, error: null };
  },

  async deleteTicket(id: string): Promise<{ success: boolean; error: string | null }> {
    // 1. Find ticket in local storage to get AIT number
    const current: TrafficTicket[] = JSON.parse(safeStorage.getItem(STORAGE_KEYS.TICKETS) || '[]');
    const ticketToDelete = current.find(
      t => t.id === id || (t.aitNumber && t.aitNumber.toUpperCase() === id.toUpperCase())
    );

    // 2. Add keys to tombstone deleted registry immediately
    const keysToAdd = [id];
    if (ticketToDelete?.id) keysToAdd.push(ticketToDelete.id);
    if (ticketToDelete?.aitNumber) keysToAdd.push(ticketToDelete.aitNumber);
    addDeletedTicketKeys(keysToAdd);

    // 3. Remove from local storage
    const filtered = current.filter(
      t => t.id !== id && (!ticketToDelete?.aitNumber || t.aitNumber !== ticketToDelete.aitNumber)
    );
    safeStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(filtered));

    // 4. Delete from central Express backend
    try {
      await fetch(`/api/tickets/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (ticketToDelete?.aitNumber && ticketToDelete.aitNumber !== id) {
        await fetch(`/api/tickets/${encodeURIComponent(ticketToDelete.aitNumber)}`, { method: 'DELETE' });
      }
    } catch (e) {
      console.warn('Could not delete ticket from backend API:', e);
    }

    // 5. Delete from Supabase
    if (isSupabaseActive()) {
      try {
        if (ticketToDelete?.aitNumber) {
          await supabaseClient.from('sgait_autos').delete().eq('ait_number', ticketToDelete.aitNumber);
        }
        await supabaseClient.from('sgait_autos').delete().eq('id', id);
      } catch (err: any) {
        console.warn('Supabase deleteTicket exception:', err);
      }
    }

    dispatchRealtimeMessage('DELETE', 'tickets', { id, aitNumber: ticketToDelete?.aitNumber });
    return { success: true, error: null };
  },

  async deleteInfraction(code: string): Promise<{ success: boolean; error: string | null }> {
    const cleanCode = code.trim();

    // 1. Remove from local storage
    const current: InfractionType[] = JSON.parse(safeStorage.getItem(STORAGE_KEYS.INFRACTIONS) || '[]');
    const filtered = current.filter(i => i.code.trim().toLowerCase() !== cleanCode.toLowerCase());
    safeStorage.setItem(STORAGE_KEYS.INFRACTIONS, JSON.stringify(filtered));

    // 2. Delete from central Express server
    try {
      await fetch(`/api/infractions/${encodeURIComponent(cleanCode)}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Could not delete infraction from backend API:', e);
    }

    // 3. Delete from Supabase
    if (isSupabaseActive()) {
      try {
        await supabaseClient.from('sgait_infractions_table').delete().ilike('code', cleanCode);
      } catch (err: any) {
        console.warn('Supabase deleteInfraction exception:', err);
      }
    }

    dispatchRealtimeMessage('DELETE', 'infractions', { code: cleanCode });
    return { success: true, error: null };
  },

  // ==========================================
  // INFRACTIONS CATALOG
  // ==========================================
  
  async getInfractions(): Promise<InfractionType[]> {
    let list: InfractionType[] = [];

    // 1. Try server endpoint
    try {
      const res = await fetch('/api/infractions');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          list = data;
        }
      }
    } catch (e) {
      // ignore
    }

    // 2. Try Supabase if configured and server returned empty
    if (list.length === 0 && isSupabaseActive()) {
      try {
        const { data, error } = await supabaseClient
          .from('sgait_infractions_table')
          .select('*')
          .order('code', { ascending: true });

        if (!error && data && data.length > 0) {
          list = data;
        }
      } catch (err) {
        markSupabaseKeyInvalid(err);
      }
    }

    // 3. Try Local Storage
    if (list.length === 0) {
      try {
        const local = safeStorage.getItem(STORAGE_KEYS.INFRACTIONS);
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) {
            list = parsed;
          }
        }
      } catch (e) {}
    }

    // 4. Default fallback: DEFAULT_INFRACTIONS (all 412 CTB infractions)
    if (list.length === 0) {
      list = [...DEFAULT_INFRACTIONS];
      safeStorage.setItem(STORAGE_KEYS.INFRACTIONS, JSON.stringify(DEFAULT_INFRACTIONS));
      
      try {
        fetch('/api/infractions/bulk-sync', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ infractions: DEFAULT_INFRACTIONS })
        }).catch(() => {});
      } catch (e) {}
    }

    return list;
  },

  async insertInfraction(infraction: InfractionType): Promise<{ data: InfractionType | null; error: string | null }> {
    if (isSupabaseConfigured() && supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('sgait_infractions_table')
          .insert(infraction)
          .select()
          .single();

        if (error) {
          console.warn('Supabase insertInfraction failed, falling back to local storage:', error);
          const current: InfractionType[] = JSON.parse(safeStorage.getItem(STORAGE_KEYS.INFRACTIONS) || '[]');
          if (current.some(i => i.code === infraction.code)) {
            return { data: null, error: 'Infração já cadastrada com este código.' };
          }
          const updated = [...current, infraction];
          safeStorage.setItem(STORAGE_KEYS.INFRACTIONS, JSON.stringify(updated));
          dispatchRealtimeMessage('INSERT', 'infractions', infraction);
          return { data: infraction, error: null };
        }
        return { data, error: null };
      } catch (err: any) {
        console.warn('Supabase insertInfraction exception, falling back to local storage:', err);
        const current: InfractionType[] = JSON.parse(safeStorage.getItem(STORAGE_KEYS.INFRACTIONS) || '[]');
        if (current.some(i => i.code === infraction.code)) {
          return { data: null, error: 'Infração já cadastrada com este código.' };
        }
        const updated = [...current, infraction];
        safeStorage.setItem(STORAGE_KEYS.INFRACTIONS, JSON.stringify(updated));
        dispatchRealtimeMessage('INSERT', 'infractions', infraction);
        return { data: infraction, error: null };
      }
    } else {
      const current: InfractionType[] = JSON.parse(safeStorage.getItem(STORAGE_KEYS.INFRACTIONS) || '[]');
      if (current.some(i => i.code === infraction.code)) {
        return { data: null, error: 'Infração já cadastrada com este código.' };
      }
      const updated = [...current, infraction];
      safeStorage.setItem(STORAGE_KEYS.INFRACTIONS, JSON.stringify(updated));
      
      dispatchRealtimeMessage('INSERT', 'infractions', infraction);
      return { data: infraction, error: null };
    }
  },

  async saveAllInfractions(list: InfractionType[]): Promise<{ success: boolean; error: string | null }> {
    if (isSupabaseConfigured() && supabaseClient) {
      try {
        // Delete all first to do a full sync with the spreadsheet
        const { error: deleteError } = await supabaseClient
          .from('sgait_infractions_table')
          .delete()
          .neq('code', ''); // Delete all rows
        
        if (deleteError) throw deleteError;

        // Batch insert in chunks of 50 to avoid payload size limit if the list is large
        const chunkSize = 50;
        for (let i = 0; i < list.length; i += chunkSize) {
          const chunk = list.slice(i, i + chunkSize);
          const { error: insertError } = await supabaseClient
            .from('sgait_infractions_table')
            .insert(chunk);
          if (insertError) throw insertError;
        }

        return { success: true, error: null };
      } catch (err: any) {
        console.warn('Supabase saveAllInfractions failed, falling back to local storage:', err);
        safeStorage.setItem(STORAGE_KEYS.INFRACTIONS, JSON.stringify(list));
        dispatchRealtimeMessage('UPDATE', 'infractions', list);
        return { success: true, error: null };
      }
    } else {
      safeStorage.setItem(STORAGE_KEYS.INFRACTIONS, JSON.stringify(list));
      dispatchRealtimeMessage('UPDATE', 'infractions', list);
      return { success: true, error: null };
    }
  },

  // ==========================================
  // AUTHORIZED EMAILS SYSTEM
  // ==========================================
  
  async getAuthorizedEmails(): Promise<AuthorizedEmail[]> {
    const localAuthorized: AuthorizedEmail[] = JSON.parse(safeStorage.getItem(STORAGE_KEYS.AUTHORIZED) || '[]');
    
    // 1. Express Server fetch
    try {
      const res = await fetch('/api/authorized-emails');
      if (res.ok) {
        const serverList = await res.json();
        if (Array.isArray(serverList) && serverList.length > 0) {
          safeStorage.setItem(STORAGE_KEYS.AUTHORIZED, JSON.stringify(serverList));
          return serverList;
        }
      }
    } catch (e) {
      // ignore
    }

    // 2. Supabase fetch
    if (isSupabaseActive()) {
      try {
        const { data, error } = await supabaseClient
          .from('sgait_authorized_emails')
          .select('*')
          .order('name', { ascending: true });

        if (error) {
          markSupabaseKeyInvalid(error);
          return localAuthorized;
        }

        const supabaseList = data || [];
        safeStorage.setItem(STORAGE_KEYS.AUTHORIZED, JSON.stringify(supabaseList));
        return supabaseList;
      } catch (err) {
        markSupabaseKeyInvalid(err);
        return localAuthorized;
      }
    } else {
      return localAuthorized;
    }
  },

  async updateAuthorizedRole(email: string, newRole: UserRole): Promise<{ success: boolean; error: string | null }> {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Update local storage list
    const current: AuthorizedEmail[] = JSON.parse(safeStorage.getItem(STORAGE_KEYS.AUTHORIZED) || '[]');
    const idx = current.findIndex(c => c.email.trim().toLowerCase() === cleanEmail);
    if (idx >= 0) {
      current[idx].role = newRole;
      safeStorage.setItem(STORAGE_KEYS.AUTHORIZED, JSON.stringify(current));
    }

    // 2. Update stored current user role if email matches
    const storedUserRaw = safeStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (storedUserRaw) {
      try {
        const stored = JSON.parse(storedUserRaw);
        if (stored && stored.email && stored.email.trim().toLowerCase() === cleanEmail) {
          stored.role = newRole;
          safeStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(stored));
        }
      } catch (e) {}
    }

    // 3. Post to Express backend
    try {
      await fetch('/api/authorized-emails/role', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, role: newRole })
      });
    } catch (e) {
      console.warn('Backend API role update error:', e);
    }

    // 4. Update Supabase
    if (isSupabaseActive()) {
      try {
        await supabaseClient
          .from('sgait_authorized_emails')
          .update({ role: newRole })
          .ilike('email', cleanEmail);

        await supabaseClient
          .from('sgait_profiles')
          .update({ role: newRole })
          .ilike('email', cleanEmail);
      } catch (e) {
        console.warn('Supabase role update warning:', e);
      }
    }

    dispatchRealtimeMessage('UPDATE', 'authorized_emails', { email: cleanEmail, role: newRole });
    return { success: true, error: null };
  },

  async addAuthorizedEmail(auth: AuthorizedEmail): Promise<{ data: AuthorizedEmail | null; error: string | null }> {
    const cleanAuth: AuthorizedEmail = {
      ...auth,
      email: auth.email.trim().toLowerCase(),
      name: auth.name.trim()
    };

    const current: AuthorizedEmail[] = JSON.parse(safeStorage.getItem(STORAGE_KEYS.AUTHORIZED) || '[]');
    if (!current.some(c => c.email.trim().toLowerCase() === cleanAuth.email)) {
      const updated = [...current, cleanAuth];
      safeStorage.setItem(STORAGE_KEYS.AUTHORIZED, JSON.stringify(updated));
    }

    try {
      await fetch('/api/authorized-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanAuth)
      });
    } catch (e) {
      console.warn('Could not post authorized email to backend API:', e);
    }

    if (isSupabaseActive()) {
      try {
        const { data, error } = await supabaseClient
          .from('sgait_authorized_emails')
          .insert(cleanAuth)
          .select()
          .single();

        if (error) {
          console.warn('Supabase addAuthorizedEmail failed:', error);
          dispatchRealtimeMessage('INSERT', 'authorized_emails', cleanAuth);
          return { data: cleanAuth, error: null };
        }
        dispatchRealtimeMessage('INSERT', 'authorized_emails', data || cleanAuth);
        return { data: data || cleanAuth, error: null };
      } catch (err: any) {
        console.warn('Supabase addAuthorizedEmail exception:', err);
        dispatchRealtimeMessage('INSERT', 'authorized_emails', cleanAuth);
        return { data: cleanAuth, error: null };
      }
    } else {
      dispatchRealtimeMessage('INSERT', 'authorized_emails', cleanAuth);
      return { data: cleanAuth, error: null };
    }
  },

  async removeAuthorizedEmail(email: string): Promise<{ success: boolean; error: string | null }> {
    const cleanEmail = email.trim().toLowerCase();

    // Remove from local storage cache
    const current: AuthorizedEmail[] = JSON.parse(safeStorage.getItem(STORAGE_KEYS.AUTHORIZED) || '[]');
    const filtered = current.filter(c => c.email.trim().toLowerCase() !== cleanEmail);
    safeStorage.setItem(STORAGE_KEYS.AUTHORIZED, JSON.stringify(filtered));

    // Clear saved session if current logged user matches deleted account
    const storedUserRaw = safeStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (storedUserRaw) {
      try {
        const storedUser = JSON.parse(storedUserRaw);
        if (storedUser && storedUser.email && storedUser.email.trim().toLowerCase() === cleanEmail) {
          safeStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        }
      } catch (e) {
        // ignore
      }
    }

    try {
      await fetch(`/api/authorized-emails/${encodeURIComponent(cleanEmail)}`, {
        method: 'DELETE'
      });
    } catch (e) {
      console.warn('Could not delete authorized email from backend API:', e);
    }

    if (isSupabaseActive()) {
      try {
        // Attempt deletion using ilike for case insensitivity
        const { error: err1 } = await supabaseClient
          .from('sgait_authorized_emails')
          .delete()
          .ilike('email', cleanEmail);

        if (err1) {
          console.warn('ilike delete on sgait_authorized_emails failed, trying eq match:', err1);
          await supabaseClient
            .from('sgait_authorized_emails')
            .delete()
            .eq('email', email.trim());
        }

        // Delete from sgait_profiles table as well
        try {
          await supabaseClient
            .from('sgait_profiles')
            .delete()
            .ilike('email', cleanEmail);
        } catch (pErr) {
          console.warn('Could not delete from sgait_profiles:', pErr);
        }

        dispatchRealtimeMessage('DELETE', 'authorized_emails', { email: cleanEmail });
        return { success: true, error: null };
      } catch (err: any) {
        console.warn('Supabase removeAuthorizedEmail exception:', err);
        dispatchRealtimeMessage('DELETE', 'authorized_emails', { email: cleanEmail });
        return { success: true, error: null };
      }
    } else {
      dispatchRealtimeMessage('DELETE', 'authorized_emails', { email: cleanEmail });
      return { success: true, error: null };
    }
  },

  // ==========================================
  // STORAGE (FOTOGRAFIAS)
  // ==========================================
  
  async uploadPhoto(file: File): Promise<{ url: string | null; error: string | null }> {
    if (isSupabaseActive()) {
      try {
        const fileExt = file.name.split('.').pop() || 'jpg';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `infraction-photos/${fileName}`;

        // List of candidate bucket names the user might have created in Supabase
        const candidateBuckets = [
          'sgait-storage',
          'sgait-photos',
          'sgait_photos',
          'photos',
          'registros',
          'infraction-photos',
          'sgait',
          'images',
          'autos'
        ];

        let lastErr: any = null;
        for (const bucketName of candidateBuckets) {
          try {
            const { data, error } = await supabaseClient.storage
              .from(bucketName)
              .upload(filePath, file, { upsert: true });

            if (!error && data) {
              const { data: { publicUrl } } = supabaseClient.storage
                .from(bucketName)
                .getPublicUrl(filePath);

              return { url: publicUrl, error: null };
            } else if (error) {
              lastErr = error;
            }
          } catch (e: any) {
            lastErr = e;
          }
        }

        console.warn('Supabase Storage upload failed for all buckets, falling back to data URL:', lastErr);
        // Fallback to data URL if bucket is not created or RLS blocks
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve({ url: reader.result as string, error: null });
          };
          reader.onerror = () => {
            resolve({ url: null, error: 'Falha ao converter imagem para URL local.' });
          };
          reader.readAsDataURL(file);
        });
      } catch (err: any) {
        console.warn('Supabase uploadPhoto exception, falling back to data URL:', err);
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve({ url: reader.result as string, error: null });
          };
          reader.onerror = () => {
            resolve({ url: null, error: 'Falha ao processar arquivo de imagem.' });
          };
          reader.readAsDataURL(file);
        });
      }
    } else {
      // Simulation mode: Convert File to Base64 data URL
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({ url: reader.result as string, error: null });
        };
        reader.onerror = () => {
          resolve({ url: null, error: 'Falha ao ler o arquivo de imagem.' });
        };
        reader.readAsDataURL(file);
      });
    }
  },

  // ==========================================
  // PROFILE MANAGEMENT
  // ==========================================
  
  async updateUserProfile(email: string, newName: string): Promise<{ user: UserProfile | null; error: string | null }> {
    if (!email || !newName.trim()) {
      return { user: null, error: 'E-mail e Nome Completo são obrigatórios.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = newName.trim();
    const newAvatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(cleanName)}`;

    // 1. Update local storage current user
    let updatedUser: UserProfile | null = null;
    const storedUserRaw = safeStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (storedUserRaw) {
      try {
        const stored = JSON.parse(storedUserRaw);
        if (stored && stored.email && stored.email.toLowerCase() === cleanEmail) {
          updatedUser = {
            ...stored,
            name: cleanName,
            avatarUrl: newAvatar
          };
        }
      } catch (e) {
        console.warn('Error parsing current user in storage:', e);
      }
    }

    if (!updatedUser) {
      const userRole = await determineUserRole(cleanEmail);
      updatedUser = {
        id: `user-${cleanEmail.replace(/[^a-zA-Z0-9]/g, '')}`,
        email: cleanEmail,
        name: cleanName,
        avatarUrl: newAvatar,
        role: userRole,
        googleId: `google-${cleanEmail}`,
        firstAccessAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };
    }

    safeStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));

    // 2. Update local authorized email list cache
    const authorizedEmails: AuthorizedEmail[] = JSON.parse(safeStorage.getItem(STORAGE_KEYS.AUTHORIZED) || '[]');
    const authMatch = authorizedEmails.find(ae => ae.email.toLowerCase() === cleanEmail);
    if (authMatch) {
      authMatch.name = cleanName;
      safeStorage.setItem(STORAGE_KEYS.AUTHORIZED, JSON.stringify(authorizedEmails));
    }

    // 3. Post profile update to central Express backend server
    try {
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, name: cleanName })
      });
    } catch (e) {
      console.warn('Backend API profile update warning:', e);
    }

    // 4. Update Supabase tables
    if (isSupabaseActive()) {
      try {
        await supabaseClient
          .from('sgait_profiles')
          .update({ name: cleanName, avatar_url: newAvatar })
          .ilike('email', cleanEmail);

        await supabaseClient
          .from('sgait_authorized_emails')
          .update({ name: cleanName })
          .ilike('email', cleanEmail);
      } catch (e) {
        console.warn('Supabase profile update warning:', e);
      }
    }

    dispatchRealtimeMessage('UPDATE', 'authorized_emails', { email: cleanEmail, name: cleanName });

    return { user: updatedUser, error: null };
  },

  // ==========================================
  // REALTIME SYNCHRONIZATION
  // ==========================================
  
  subscribeTickets(callback: (message: RealtimeMessage) => void): () => void {
    const unsubscribes: (() => void)[] = [];

    // 1. Supabase Postgres Realtime subscription for ALL tables
    if (isSupabaseActive()) {
      try {
        const channel = supabaseClient
          .channel('sgait-all-tables-changes')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'sgait_autos' },
            (payload) => {
              let mappedType: 'INSERT' | 'UPDATE' | 'DELETE' = 'INSERT';
              if (payload.eventType === 'UPDATE') mappedType = 'UPDATE';
              if (payload.eventType === 'DELETE') mappedType = 'DELETE';

              let rawData = payload.new;
              if (payload.eventType === 'DELETE') rawData = payload.old;

              const mappedData = mapRowToTicket(rawData);

              callback({
                type: mappedType,
                table: 'tickets',
                data: mappedData
              });
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'sgait_authorized_emails' },
            (payload) => {
              let mappedType: 'INSERT' | 'UPDATE' | 'DELETE' = 'INSERT';
              if (payload.eventType === 'UPDATE') mappedType = 'UPDATE';
              if (payload.eventType === 'DELETE') mappedType = 'DELETE';

              const rawData = payload.new || payload.old;
              callback({
                type: mappedType,
                table: 'authorized_emails',
                data: rawData
              });
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'sgait_infractions_table' },
            (payload) => {
              let mappedType: 'INSERT' | 'UPDATE' | 'DELETE' = 'INSERT';
              if (payload.eventType === 'UPDATE') mappedType = 'UPDATE';
              if (payload.eventType === 'DELETE') mappedType = 'DELETE';

              const rawData = payload.new || payload.old;
              callback({
                type: mappedType,
                table: 'infractions',
                data: rawData
              });
            }
          )
          .subscribe();

        unsubscribes.push(() => {
          supabaseClient.removeChannel(channel);
        });
      } catch (err) {
        console.warn('Supabase Realtime subscription error:', err);
      }
    }

    // 2. Local window CustomEvents
    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<RealtimeMessage>;
      if (customEvent.detail) {
        callback(customEvent.detail);
      }
    };
    window.addEventListener(REALTIME_EVENT_NAME, handleSync);
    unsubscribes.push(() => {
      window.removeEventListener(REALTIME_EVENT_NAME, handleSync);
    });

    // 3. Express Backend SSE (Server-Sent Events) stream for real-time multi-device sync
    if (typeof window !== 'undefined' && typeof EventSource !== 'undefined') {
      try {
        const es = new EventSource('/api/events');
        es.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed && parsed.table && parsed.type) {
              let data = parsed.data;
              if (parsed.table === 'tickets' && data) {
                data = mapRowToTicket(data);
              }
              callback({
                type: parsed.type,
                table: parsed.table,
                data
              });
            }
          } catch (err) {
            // silent parse error
          }
        };
        unsubscribes.push(() => {
          es.close();
        });
      } catch (e) {
        console.warn('SSE EventSource setup warning:', e);
      }
    }

    return () => {
      unsubscribes.forEach(fn => fn());
    };
  }
};

// SQL SCHEMA DOCUMENTATION
// Provides the database setup queries for users to paste directly into Supabase SQL Editor.
export const SUPABASE_SQL_SETUP = `-- SGAIT - SISTEMA DE GESTÃO DE AUTOS DE INFRAÇÃO DE TRÂNSITO
-- SCRIPT DE CRIAÇÃO DO BANCO DE DADOS (SUPABASE SQL EDITOR)

-- 1. Habilitar UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabela de E-mails Autorizados (Whitelist)
CREATE TABLE IF NOT EXISTS sgait_authorized_emails (
    email TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'AGENTE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Tabela de Perfis de Usuários (Integrado com Supabase Auth)
CREATE TABLE IF NOT EXISTS sgait_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'AGENTE')),
    google_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    last_login_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 4. Tabela do Catálogo de Infrações (Código de Trânsito Brasileiro)
CREATE TABLE IF NOT EXISTS sgait_infractions_table (
    code TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    framing TEXT NOT NULL,
    article TEXT NOT NULL,
    nature TEXT NOT NULL CHECK (nature IN ('Leve', 'Média', 'Grave', 'Gravíssima')),
    fine_value NUMERIC(10, 2) NOT NULL,
    score INTEGER NOT NULL,
    admin_measure TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. Tabela de Autos de Infração de Trânsito (AIT)
CREATE TABLE IF NOT EXISTS sgait_autos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ait_number TEXT UNIQUE NOT NULL,
    infraction_date DATE NOT NULL,
    infraction_time TIME NOT NULL,
    location TEXT NOT NULL,
    plate TEXT NOT NULL,
    vehicle_type TEXT NOT NULL,
    infraction_code TEXT REFERENCES sgait_infractions_table(code),
    infraction_description TEXT NOT NULL,
    framing TEXT NOT NULL,
    article TEXT NOT NULL,
    nature TEXT NOT NULL CHECK (nature IN ('Leve', 'Média', 'Grave', 'Gravíssima')),
    fine_value NUMERIC(10, 2) NOT NULL,
    score INTEGER NOT NULL,
    admin_measure TEXT NOT NULL,
    observations TEXT,
    photos TEXT[] DEFAULT '{}'::text[] NOT NULL,
    agent_id TEXT NOT NULL, -- UUID do Perfil ou ID de simulação
    agent_name TEXT NOT NULL,
    additional_infractions JSONB DEFAULT '[]'::jsonb,
    infractions JSONB DEFAULT '[]'::jsonb,
    detection_type TEXT DEFAULT 'In Loco',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Garantir que tabelas existentes recebam as novas colunas
ALTER TABLE sgait_autos ADD COLUMN IF NOT EXISTS additional_infractions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE sgait_autos ADD COLUMN IF NOT EXISTS infractions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE sgait_autos ADD COLUMN IF NOT EXISTS detection_type TEXT DEFAULT 'In Loco';

-- Criar Índices para otimizar pesquisas frequentes se não existirem
CREATE INDEX IF NOT EXISTS idx_sgait_autos_plate ON sgait_autos(plate);
CREATE INDEX IF NOT EXISTS idx_sgait_autos_date ON sgait_autos(infraction_date);
CREATE INDEX IF NOT EXISTS idx_sgait_autos_agent ON sgait_autos(agent_id);

-- 6. Configurar Row Level Security (RLS)
ALTER TABLE sgait_authorized_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgait_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgait_infractions_table ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgait_autos ENABLE ROW LEVEL SECURITY;

-- Remover políticas se já existirem antes de criar para evitar erros de duplicidade
DROP POLICY IF EXISTS "Qualquer usuário logado pode visualizar emails autorizados" ON sgait_authorized_emails;
DROP POLICY IF EXISTS "Somente Administradores podem gerenciar emails autorizados" ON sgait_authorized_emails;
DROP POLICY IF EXISTS "Perfis visíveis por todos os autenticados" ON sgait_profiles;
DROP POLICY IF EXISTS "Usuário pode atualizar seu próprio perfil" ON sgait_profiles;
DROP POLICY IF EXISTS "Catálogo visível para todos os autenticados" ON sgait_infractions_table;
DROP POLICY IF EXISTS "Somente Administradores podem gerenciar o catálogo" ON sgait_infractions_table;
DROP POLICY IF EXISTS "Visualização de Autos por todos os agentes autorizados" ON sgait_autos;
DROP POLICY IF EXISTS "Inserção de Autos por qualquer usuário logado" ON sgait_autos;
DROP POLICY IF EXISTS "Edição por Administradores ou pelo próprio Agente autor" ON sgait_autos;
DROP POLICY IF EXISTS "Exclusão permitida apenas a Administradores" ON sgait_autos;

-- Políticas para sgait_authorized_emails
CREATE POLICY "Acesso aos emails autorizados"
ON sgait_authorized_emails FOR ALL TO public USING (true) WITH CHECK (true);

-- Políticas para sgait_profiles
CREATE POLICY "Acesso aos perfis"
ON sgait_profiles FOR ALL TO public USING (true) WITH CHECK (true);

-- Políticas para sgait_infractions_table
CREATE POLICY "Acesso ao catálogo de infrações"
ON sgait_infractions_table FOR ALL TO public USING (true) WITH CHECK (true);

-- Políticas para sgait_autos (AIT)
CREATE POLICY "Acesso total aos autos de infração"
ON sgait_autos FOR ALL TO public USING (true) WITH CHECK (true);

-- 7. Inserir Dados Iniciais (Catálogo e Emails)
INSERT INTO sgait_authorized_emails (email, name, role) VALUES
('luizemerson17@gmail.com', 'Luiz Emerson (Administrador)', 'ADMIN')
ON CONFLICT (email) DO NOTHING;

INSERT INTO sgait_infractions_table (code, description, framing, article, nature, fine_value, score, admin_measure) VALUES
${DEFAULT_INFRACTIONS.map(inf => {
  const desc = inf.description.replace(/'/g, "''");
  const admin = inf.adminMeasure.replace(/'/g, "''");
  const framing = inf.framing.replace(/'/g, "''");
  const art = inf.article.replace(/'/g, "''");
  return `('${inf.code}', '${desc}', '${framing}', '${art}', '${inf.nature}', ${inf.fineValue}, ${inf.score}, '${admin}')`;
}).join(',\n')}
ON CONFLICT (code) DO NOTHING;

-- 8. Configuração de Storage Buckets no Supabase para Imagens dos Registros
INSERT INTO storage.buckets (id, name, public) VALUES
('sgait-storage', 'sgait-storage', true),
('sgait-photos', 'sgait-photos', true),
('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Acesso público fotos sgait-storage" ON storage.objects;
DROP POLICY IF EXISTS "Acesso público fotos sgait-photos" ON storage.objects;
DROP POLICY IF EXISTS "Acesso público fotos photos" ON storage.objects;

CREATE POLICY "Acesso público fotos sgait-storage" ON storage.objects FOR ALL TO public USING (bucket_id = 'sgait-storage') WITH CHECK (bucket_id = 'sgait-storage');
CREATE POLICY "Acesso público fotos sgait-photos" ON storage.objects FOR ALL TO public USING (bucket_id = 'sgait-photos') WITH CHECK (bucket_id = 'sgait-photos');
CREATE POLICY "Acesso público fotos photos" ON storage.objects FOR ALL TO public USING (bucket_id = 'photos') WITH CHECK (bucket_id = 'photos');
`;

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { DEFAULT_INFRACTIONS } from './src/lib/infractionsData';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const app = express();

app.use(express.json({ limit: '10mb' }));

// Memory Data Store
interface ServerStore {
  tickets: any[];
  authorizedEmails: any[];
  infractions: any[];
  deletedTicketKeys: string[];
  supabaseUrl?: string;
  supabaseKey?: string;
}

const DEFAULT_SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const DEFAULT_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';

function getEnvSupabaseConfig() {
  const envUrl = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ''
  ).trim();

  const envKey = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    ''
  ).trim();

  return { envUrl, envKey };
}

function isValidUrl(urlStr: any): boolean {
  if (!urlStr || typeof urlStr !== 'string') return false;
  const trimmed = urlStr.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null' || trimmed.includes('your-supabase-project')) return false;
  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname.includes('.');
  } catch (_) {
    return false;
  }
}

let supabase: any = null;
let store: ServerStore;

function initSupabaseClient(url?: string, key?: string) {
  const { envUrl, envKey } = getEnvSupabaseConfig();

  let targetUrl = url || envUrl || (store && store.supabaseUrl) || DEFAULT_SUPABASE_URL;
  let targetKey = key || envKey || (store && store.supabaseKey) || DEFAULT_SUPABASE_ANON_KEY;

  if (!isValidUrl(targetUrl) || !targetKey || targetKey.trim().length < 5 || targetKey.includes('your-supabase')) {
    supabase = null;
    return false;
  }

  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl.trim();
  }

  if (targetUrl && targetKey) {
    try {
      supabase = createClient(targetUrl, targetKey, {
        global: {
          headers: {
            'apikey': targetKey,
            'Authorization': `Bearer ${targetKey}`
          }
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
      console.log(`Server: Client Supabase ativado para: ${targetUrl} com apikey/Authorization configurados.`);
      return true;
    } catch (e) {
      console.warn('Server: Supabase client initialization error:', e);
      supabase = null;
      return false;
    }
  } else {
    supabase = null;
    return false;
  }
}

// SSE (Server-Sent Events) clients registry for instant cross-device updates
let sseClients: express.Response[] = [];

function broadcastRealtimeEvent(table: string, type: 'INSERT' | 'UPDATE' | 'DELETE', data: any) {
  const payload = JSON.stringify({ table, type, data });
  sseClients.forEach(client => {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch (e) {
      // client disconnected
    }
  });
}

const FAKE_TICKET_KEYS: string[] = [];

function normalizeAgentName(rawName?: string, rawId?: string): string {
  let name = (rawName || '').trim();
  if (!name && rawId) {
    name = rawId.trim();
  }
  if (!name) return 'Agente de Trânsito';

  const lower = name.toLowerCase();

  // Alias mapping: "Leandro Souza" and "Leandro Santos Souza" are the same person
  if (lower === 'leandro souza' || lower === 'leandro santos souza') {
    return 'Leandro Santos Souza';
  }

  return name;
}

const INITIAL_SAMPLE_TICKETS = [
  {
    id: 'ticket-sample-101',
    aitNumber: 'AIT202600101',
    infractionDate: '2026-07-20',
    infractionTime: '14:35',
    location: 'Av. Mário Leal Silva, Centro, Pojuca - BA',
    plate: 'JQK-8A21',
    vehicleType: 'Automóvel',
    infractionCode: '518-51',
    infractionDescription: 'Deixar o condutor de usar o cinto de segurança.',
    framing: 'Art. 167. do CTB',
    article: '167',
    nature: 'Grave',
    fineValue: 195.23,
    score: 5,
    adminMeasure: 'Retenção do veículo até colocação do cinto pelo infrator',
    detectionType: 'In Loco',
    observations: 'Condutor trafegava sem utilizar o cinto de segurança.',
    photos: [],
    agentId: 'agent-emerson-17',
    agentName: 'Emerson Mares',
    createdAt: '2026-07-20T14:35:00.000Z',
    updatedAt: '2026-07-20T14:35:00.000Z'
  },
  {
    id: 'ticket-sample-102',
    aitNumber: 'AIT202600102',
    infractionDate: '2026-07-22',
    infractionTime: '09:15',
    location: 'Rua JJ Seabra, Pojuca - BA',
    plate: 'OUB-4920',
    vehicleType: 'Motocicleta',
    infractionCode: '501-00',
    infractionDescription: 'Dirigir veículo sem possuir CNH, PPD ou ACC.',
    framing: 'Art. 162, I. do CTB',
    article: '162, I',
    nature: 'Gravíssima',
    fineValue: 1467.35,
    score: 7,
    adminMeasure: 'Retenção do veículo até a apresentação de condutor habilitado',
    detectionType: 'In Loco',
    observations: 'Condutor abordado em fiscalização de rotina sem habilitação.',
    photos: [],
    agentId: 'agent-emerson-17',
    agentName: 'Emerson Mares',
    createdAt: '2026-07-22T09:15:00.000Z',
    updatedAt: '2026-07-22T09:15:00.000Z'
  },
  {
    id: 'ticket-sample-103',
    aitNumber: 'AIT202600103',
    infractionDate: '2026-07-23',
    infractionTime: '16:50',
    location: 'Praça Antônio Carlos Magalhães, Pojuca - BA',
    plate: 'PKM-1102',
    vehicleType: 'Automóvel',
    infractionCode: '545-21',
    infractionDescription: 'Estacionar no passeio.',
    framing: 'Art. 181, VIII. do CTB',
    article: '181, VIII',
    nature: 'Grave',
    fineValue: 195.23,
    score: 5,
    adminMeasure: 'Remoção do veículo',
    detectionType: 'In Loco',
    observations: 'Veículo estacionado sobre o passeio impedindo trânsito de pedestres.',
    photos: [],
    agentId: 'agent-emerson-17',
    agentName: 'Emerson Mares',
    createdAt: '2026-07-23T16:50:00.000Z',
    updatedAt: '2026-07-23T16:50:00.000Z'
  }
];

// Local JSON persistence file path
const DATA_FILE = path.join(process.cwd(), 'sgait_server_data.json');

store = {
  tickets: [...INITIAL_SAMPLE_TICKETS],
  authorizedEmails: [
    {
      email: 'sttpojucaba@gmail.com',
      role: 'ADMIN',
      name: 'STT Pojuca Admin'
    },
    {
      email: 'luizemerson17@gmail.com',
      role: 'ADMIN',
      name: 'Emerson Mares'
    }
  ],
  infractions: [...DEFAULT_INFRACTIONS],
  deletedTicketKeys: []
};

// Load saved store from disk if exists
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.tickets && Array.isArray(parsed.tickets) && parsed.tickets.length > 0) {
      store.tickets = parsed.tickets.map((t: any) => ({
        ...t,
        agentName: normalizeAgentName(t.agentName, t.agentId)
      }));
    } else {
      store.tickets = [...INITIAL_SAMPLE_TICKETS];
    }
    if (parsed.authorizedEmails && Array.isArray(parsed.authorizedEmails)) store.authorizedEmails = parsed.authorizedEmails;
    if (parsed.infractions && Array.isArray(parsed.infractions) && parsed.infractions.length > 0) {
      store.infractions = parsed.infractions;
    } else {
      store.infractions = [...DEFAULT_INFRACTIONS];
    }
    if (parsed.deletedTicketKeys && Array.isArray(parsed.deletedTicketKeys)) {
      // Keep only user deleted keys, stripping away any legacy auto-tombstoned patterns
      store.deletedTicketKeys = parsed.deletedTicketKeys.filter((k: string) => {
        if (!k) return false;
        const upper = String(k).toUpperCase();
        if (upper.startsWith('AIT001234') || upper.startsWith('TICKET-DEMO') || upper.startsWith('TICKET-')) return false;
        return true;
      });
    }
    if (parsed.supabaseUrl) store.supabaseUrl = parsed.supabaseUrl;
    if (parsed.supabaseKey) store.supabaseKey = parsed.supabaseKey;
    if (store.supabaseUrl && store.supabaseKey) {
      initSupabaseClient(store.supabaseUrl, store.supabaseKey);
    }
    store.tickets = store.tickets.filter((t: any) => !isTicketDeleted(t));
    console.log(`Server: Loaded ${store.tickets.length} tickets and ${store.infractions.length} cataloged infractions.`);
  }

  // Filter out any unwanted default email
  store.authorizedEmails = store.authorizedEmails.filter(e => e.email.trim().toLowerCase() !== 'sttpojuca@gmail.com');

  // Ensure default admin emails are always guaranteed in store
  const ensureAdmin = (email: string, name: string) => {
    const exists = store.authorizedEmails.find(e => e.email.trim().toLowerCase() === email.toLowerCase());
    if (exists) {
      exists.role = 'ADMIN';
    } else {
      store.authorizedEmails.push({ email, role: 'ADMIN', name });
    }
  };
  ensureAdmin('sttpojucaba@gmail.com', 'STT Pojuca Admin');
  ensureAdmin('luizemerson17@gmail.com', 'Emerson Mares');
  initSupabaseClient();
  saveStore();
} catch (e) {
  console.warn('Server: Error loading data file from disk:', e);
}

function isTicketDeleted(t: any): boolean {
  if (!t || !store.deletedTicketKeys || store.deletedTicketKeys.length === 0) return false;
  const tId = t.id ? String(t.id).toUpperCase() : '';
  const tAit = t.aitNumber ? String(t.aitNumber).toUpperCase() : '';
  return store.deletedTicketKeys.some(k => {
    const normK = String(k).toUpperCase();
    return (tId && tId === normK) || (tAit && tAit === normK);
  });
}

// Helper to save store to disk
function saveStore() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Server: Error saving store to disk:', e);
  }
}

async function pushTicketToSupabase(ticket: any) {
  if (!supabase || !ticket || !ticket.aitNumber) {
    return { success: false, error: 'Supabase não conectado' };
  }

  try {
    let cleanDate = ticket.infractionDate || '';
    if (cleanDate.includes('T')) cleanDate = cleanDate.split('T')[0];
    if (!cleanDate || !cleanDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      cleanDate = new Date().toISOString().split('T')[0];
    }

    let cleanTime = ticket.infractionTime || '00:00';
    if (cleanTime.includes('T')) cleanTime = cleanTime.split('T')[1].substring(0, 5);
    if (cleanTime.length > 8) cleanTime = cleanTime.substring(0, 5);
    if (!cleanTime || !cleanTime.includes(':')) cleanTime = '00:00';

    let cleanNature = 'Média';
    const rawNature = String(ticket.nature || '').toLowerCase();
    if (rawNature.includes('gravissim') || rawNature.includes('gravíssim')) cleanNature = 'Gravíssima';
    else if (rawNature.includes('grave')) cleanNature = 'Grave';
    else if (rawNature.includes('media') || rawNature.includes('méd')) cleanNature = 'Média';
    else if (rawNature.includes('leve')) cleanNature = 'Leve';

    // 1. Ensure primary infraction exists in sgait_infractions_table
    if (ticket.infractionCode) {
      try {
        await supabase.from('sgait_infractions_table').upsert({
          code: String(ticket.infractionCode).trim(),
          description: ticket.infractionDescription || 'Infração de trânsito',
          framing: ticket.framing || 'Art. CTB',
          article: ticket.article || 'CTB',
          nature: cleanNature,
          fine_value: Number(ticket.fineValue) || 0,
          score: Number(ticket.score) || 0,
          admin_measure: ticket.adminMeasure || 'Nenhuma'
        }, { onConflict: 'code' });
      } catch (fkErr) {}
    }

    // 2. Ensure all additional infractions exist in sgait_infractions_table
    const addInfList = Array.isArray(ticket.additionalInfractions) ? ticket.additionalInfractions : (Array.isArray(ticket.infractions) ? ticket.infractions : []);
    for (const inf of addInfList) {
      if (inf && inf.code) {
        try {
          let infNature = 'Média';
          const rN = String(inf.nature || '').toLowerCase();
          if (rN.includes('gravissim') || rN.includes('gravíssim')) infNature = 'Gravíssima';
          else if (rN.includes('grave')) infNature = 'Grave';
          else if (rN.includes('media') || rN.includes('méd')) infNature = 'Média';
          else if (rN.includes('leve')) infNature = 'Leve';

          await supabase.from('sgait_infractions_table').upsert({
            code: String(inf.code).trim(),
            description: inf.description || 'Infração de trânsito',
            framing: inf.framing || 'Art. CTB',
            article: inf.article || 'CTB',
            nature: infNature,
            fine_value: Number(inf.fineValue) || 0,
            score: Number(inf.score) || 0,
            admin_measure: inf.adminMeasure || 'Nenhuma'
          }, { onConflict: 'code' });
        } catch (e) {}
      }
    }

    // 3. Prepare full payload for sgait_autos
    const payload: any = {
      ait_number: String(ticket.aitNumber).trim().toUpperCase(),
      infraction_date: cleanDate,
      infraction_time: cleanTime,
      location: ticket.location || '',
      plate: String(ticket.plate || '').trim().toUpperCase(),
      vehicle_type: ticket.vehicleType || 'Passeio',
      infraction_code: ticket.infractionCode ? String(ticket.infractionCode).trim() : null,
      infraction_description: ticket.infractionDescription || '',
      framing: ticket.framing || '',
      article: ticket.article || '',
      nature: cleanNature,
      fine_value: Number(ticket.fineValue) || 0,
      score: Number(ticket.score) || 0,
      admin_measure: ticket.adminMeasure || 'Nenhuma',
      observations: ticket.observations || '',
      photos: Array.isArray(ticket.photos) ? ticket.photos : [],
      agent_id: String(ticket.agentId || 'agent-0'),
      agent_name: ticket.agentName || 'Agente',
      additional_infractions: addInfList,
      infractions: addInfList,
      detection_type: ticket.detectionType || 'In Loco',
      educational_action_number: ticket.educationalActionNumber || null
    };

    let res: any;
    try {
      res = await supabase.from('sgait_autos').upsert(payload, { onConflict: 'ait_number' });
    } catch (upsertErr: any) {
      const msg = String(upsertErr?.message || upsertErr);
      if (msg.includes('fetch failed') || msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED')) {
        return { success: false, error: 'Supabase offline/indisponível' };
      }
      res = { error: { message: msg } };
    }

    let { data, error } = res || {};

    if (error && String(error.message || error).includes('fetch failed')) {
      return { success: false, error: 'Supabase offline/indisponível' };
    }

    if (error && (error.code === '42P01' || (error.message && error.message.toLowerCase().includes('does not exist')))) {
      console.warn('Server: Tabela sgait_autos ainda não foi criada no Supabase.');
      return { success: false, needsTables: true, error: 'Tabela sgait_autos não existe no Supabase. Execute o script SQL no Supabase.' };
    }

    // Retry 1: If optional jsonb, detection_type, or educational_action_number columns don't exist in user DB schema
    const isColumnError = (err: any) => {
      if (!err) return false;
      const msg = String(err.message || err).toLowerCase();
      const code = String(err.code || '');
      return code === '42703' || code === 'PGRST204' || msg.includes('column') || msg.includes('schema cache') || msg.includes('does not exist');
    };

    if (error && isColumnError(error)) {
      delete payload.additional_infractions;
      delete payload.infractions;
      delete payload.detection_type;
      delete payload.educational_action_number;
      try {
        const retryCol = await supabase.from('sgait_autos').upsert(payload, { onConflict: 'ait_number' });
        error = retryCol.error;
        data = retryCol.data;
      } catch (colErr: any) {
        error = { message: String(colErr?.message || colErr) };
      }
    }

    // Retry 2: If foreign key constraint is violated
    if (error && (error.code === '23503' || (error.message && error.message.toLowerCase().includes('foreign key')))) {
      payload.infraction_code = null;
      try {
        const retryFk = await supabase.from('sgait_autos').upsert(payload, { onConflict: 'ait_number' });
        error = retryFk.error;
        data = retryFk.data;
      } catch (fkRetryErr: any) {
        error = { message: String(fkRetryErr?.message || fkRetryErr) };
      }
    }

    // Retry 3: If ON CONFLICT constraint matching ait_number is missing
    if (error && (error.code === '42P10' || (error.message && error.message.toLowerCase().includes('conflict')))) {
      try {
        const { data: existingRow } = await supabase
          .from('sgait_autos')
          .select('id')
          .eq('ait_number', payload.ait_number)
          .maybeSingle();

        if (existingRow && existingRow.id) {
          const updateRes = await supabase.from('sgait_autos').update(payload).eq('ait_number', payload.ait_number);
          error = updateRes.error;
        } else {
          const insertRes = await supabase.from('sgait_autos').insert(payload);
          error = insertRes.error;
        }
      } catch (conflictErr: any) {
        error = { message: String(conflictErr?.message || conflictErr) };
      }
    }

    if (error) {
      const errMsg = String(error.message || error);
      if (errMsg.toLowerCase().includes('invalid api key') || error.code === '401') {
        console.warn('Server: Supabase API Key é inválida ou expirou. Sincronização remota desativada.');
        supabase = null;
        return { success: false, error: 'Chave do Supabase inválida.' };
      }
      if (!errMsg.includes('fetch failed')) {
        console.warn('Server: Supabase upsert error for AIT', ticket.aitNumber, ':', error.message || error);
      }
      return { success: false, error: error.message || String(error) };
    }

    return { success: true, data };
  } catch (err: any) {
    console.warn('Server: Exception in pushTicketToSupabase:', err);
    return { success: false, error: err.message || String(err) };
  }
}

async function syncAllToSupabase() {
  if (!supabase) return { success: false, error: 'Supabase não está conectado.' };

  let syncedTickets = 0;
  let syncedInfractions = 0;
  let syncedEmails = 0;

  // 1. Sync Infractions Catalog
  for (const inf of store.infractions) {
    try {
      const { error } = await supabase.from('sgait_infractions_table').upsert({
        code: String(inf.code).trim(),
        description: inf.description,
        framing: inf.framing,
        article: inf.article,
        nature: inf.nature,
        fine_value: Number(inf.fineValue) || 0,
        score: Number(inf.score) || 0,
        admin_measure: inf.adminMeasure || 'Nenhuma'
      }, { onConflict: 'code' });
      if (!error) syncedInfractions++;
    } catch (e) {}
  }

  // 2. Sync Whitelist Emails
  for (const em of store.authorizedEmails) {
    try {
      const { error } = await supabase.from('sgait_authorized_emails').upsert({
        email: em.email.toLowerCase().trim(),
        name: em.name,
        role: em.role
      }, { onConflict: 'email' });
      if (!error) syncedEmails++;
    } catch (e) {}
  }

  // 3. Sync Active Tickets
  const activeTickets = store.tickets.filter(t => !isTicketDeleted(t));
  for (const ticket of activeTickets) {
    const res = await pushTicketToSupabase(ticket);
    if (res.success) syncedTickets++;
  }

  return {
    success: true,
    syncedTickets,
    syncedInfractions,
    syncedEmails,
    totalTickets: activeTickets.length
  };
}

// Attempt to load tickets from Supabase on startup
async function syncFromSupabase() {
  if (!supabase) return;
  try {
    const { data: remoteTickets, error } = await supabase
      .from('sgait_autos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      const errMsg = String(error.message || error);
      if (errMsg.toLowerCase().includes('invalid api key')) {
        console.warn('Server: Supabase API Key é inválida. Desativando cliente Supabase.');
        supabase = null;
        return;
      }
    }

    if (!error && remoteTickets && remoteTickets.length > 0) {
      const mapped = remoteTickets.map((row: any) => ({
        id: row.id || `ticket-${row.ait_number}`,
        aitNumber: row.ait_number,
        infractionDate: row.infraction_date ? String(row.infraction_date).substring(0, 10) : new Date().toLocaleDateString('sv-SE'),
        infractionTime: row.infraction_time,
        location: row.location,
        plate: row.plate,
        vehicleType: row.vehicle_type,
        infractionCode: row.infraction_code,
        infractionDescription: row.infraction_description,
        framing: row.framing,
        article: row.article,
        nature: row.nature,
        fineValue: Number(row.fine_value),
        score: Number(row.score),
        adminMeasure: row.admin_measure,
        additionalInfractions: row.additional_infractions || row.additionalInfractions || [],
        infractions: row.infractions || row.additional_infractions || row.additionalInfractions || [],
        detectionType: row.detection_type || row.detectionType || 'In Loco',
        educationalActionNumber: row.educational_action_number || row.educationalActionNumber || undefined,
        observations: row.observations,
        photos: row.photos || [],
        agentId: row.agent_id,
        agentName: normalizeAgentName(row.agent_name || row.agentName, row.agent_id || row.agentId),
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || new Date().toISOString()
      }));

      // Merge remote tickets into local store keyed by AIT number, filtering deleted ones
      const localMap = new Map();
      for (const t of store.tickets) {
        if (t && t.aitNumber && !isTicketDeleted(t)) localMap.set(t.aitNumber.toUpperCase(), t);
      }
      for (const rTicket of mapped) {
        if (rTicket && rTicket.aitNumber && !isTicketDeleted(rTicket)) {
          localMap.set(rTicket.aitNumber.toUpperCase(), rTicket);
        }
      }
      store.tickets = Array.from(localMap.values()).filter(t => !isTicketDeleted(t)).sort(
        (a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      saveStore();
    }
  } catch (err) {
    console.warn('Server: Error syncing from Supabase:', err);
  }
}

syncFromSupabase();

// =========================================================
// REST API ROUTES & SSE REALTIME
// =========================================================

// SSE Realtime connection endpoint
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);

  sseClients.push(res);

  req.on('close', () => {
    sseClients = sseClients.filter(c => c !== res);
  });
});

// Periodic SSE keep-alive ping and 100% automatic background bidirectional sync (every 10 seconds)
setInterval(async () => {
  sseClients.forEach(client => {
    try {
      client.write(': ping\n\n');
    } catch (e) {
      // client disconnected
    }
  });

  if (supabase) {
    try {
      await syncFromSupabase();
      await syncAllToSupabase();
    } catch (e) {
      // fail silent in background
    }
  }
}, 10000);

app.get('/api/config/supabase', async (req, res) => {
  const isConfigured = Boolean(supabase && store.supabaseUrl);
  let tablesExist = false;
  if (supabase) {
    try {
      const { error } = await supabase.from('sgait_autos').select('count', { count: 'exact', head: true });
      if (!error || error.code === 'PGRST116') {
        tablesExist = true;
      }
    } catch (e) {}
  }
  res.json({
    configured: isConfigured,
    url: store.supabaseUrl || process.env.VITE_SUPABASE_URL || 'https://rsxxddutkfctmyrsutsr.supabase.co',
    hasKey: Boolean(store.supabaseKey || process.env.VITE_SUPABASE_ANON_KEY),
    active: Boolean(supabase),
    tablesExist,
    totalTickets: store.tickets.filter(t => !isTicketDeleted(t)).length,
    totalInfractions: store.infractions.length,
    totalAuthorized: store.authorizedEmails.length
  });
});

app.post('/api/config/supabase', async (req, res) => {
  const { url, anonKey } = req.body;
  if (!url || !anonKey || !url.includes('.')) {
    return res.status(400).json({ error: 'URL do projeto e Chave de API do Supabase são obrigatórias.' });
  }

  const cleanUrl = url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`;
  const cleanKey = anonKey.trim();

  try {
    const testClient = createClient(cleanUrl, cleanKey, {
      global: {
        headers: {
          'apikey': cleanKey,
          'Authorization': `Bearer ${cleanKey}`
        }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    // Test query against Supabase
    const { error } = await testClient.from('sgait_autos').select('count', { count: 'exact', head: true });

    let tablesExist = true;
    if (error) {
      if (error.code === '42P01' || (error.message && error.message.toLowerCase().includes('does not exist'))) {
        tablesExist = false;
      } else if (error.message.includes('Invalid API key') || error.message.includes('JWT') || error.hint?.includes('API key')) {
        return res.status(400).json({ error: `Chave de API Inválida do Supabase: ${error.message}` });
      }
    }

    supabase = testClient;
    store.supabaseUrl = cleanUrl;
    store.supabaseKey = cleanKey;
    saveStore();

    // Trigger immediate push to Supabase if tables exist
    let syncRes: any = { success: false, syncedTickets: 0 };
    if (tablesExist) {
      syncRes = await syncAllToSupabase();
    }

    res.json({
      success: true,
      tablesExist,
      message: tablesExist
        ? 'Conexão com o Supabase estabelecida e dados sincronizados com sucesso!'
        : 'Conexão com o Supabase estabelecida com sucesso! As tabelas do sistema ainda não existem no seu banco. Copie o script SQL abaixo e execute no SQL Editor do Supabase.',
      syncDetails: syncRes
    });
  } catch (err: any) {
    res.status(500).json({ error: `Falha ao conectar ao Supabase: ${err.message || String(err)}` });
  }
});

app.post('/api/config/supabase/sync', async (req, res) => {
  if (!supabase) {
    return res.status(400).json({ error: 'Supabase não está configurado no servidor.' });
  }
  try {
    await syncFromSupabase();
    const syncRes = await syncAllToSupabase();
    res.json({
      success: true,
      message: 'Sincronização bidirecional com o Supabase concluída!',
      syncDetails: syncRes
    });
  } catch (err: any) {
    res.status(500).json({ error: `Erro durante sincronização: ${err.message || String(err)}` });
  }
});

app.get('/api/health', (req, res) => {
  const activeTickets = store.tickets.filter(t => !isTicketDeleted(t));
  res.json({ status: 'ok', ticketCount: activeTickets.length, timestamp: new Date().toISOString() });
});

// GET all tickets
app.get('/api/tickets', async (req, res) => {
  // Sync from Supabase in background if possible
  syncFromSupabase().catch(() => {});
  const activeTickets = store.tickets.filter(t => !isTicketDeleted(t));
  res.json(activeTickets);
});

// POST new ticket
app.post('/api/tickets', async (req, res) => {
  try {
    const ticket = req.body;
    if (!ticket.aitNumber) {
      return res.status(400).json({ error: 'Número do AIT é obrigatório' });
    }

    if (isTicketDeleted(ticket)) {
      return res.status(400).json({ error: 'Este Auto de Infração consta como excluído.' });
    }

    // Check if ticket already exists by id or AIT number
    const existingIndex = store.tickets.findIndex(
      t => t.id === ticket.id || (t.aitNumber && t.aitNumber.toUpperCase() === ticket.aitNumber.toUpperCase())
    );

    let eventType: 'INSERT' | 'UPDATE' = 'INSERT';
    if (existingIndex >= 0) {
      eventType = 'UPDATE';
      store.tickets[existingIndex] = { ...store.tickets[existingIndex], ...ticket, updatedAt: new Date().toISOString() };
    } else {
      store.tickets.unshift(ticket);
    }

    saveStore();

    // Broadcast instant event to all connected SSE clients across devices
    broadcastRealtimeEvent('tickets', eventType, ticket);

    // Push to Supabase asynchronously
    if (supabase) {
      pushTicketToSupabase(ticket).catch(err => {
        console.warn('Server: Supabase async push failed:', err);
      });
    }

    res.json({ success: true, ticket });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao salvar auto de infração' });
  }
});

// POST bulk sync tickets from client
app.post('/api/tickets/bulk-sync', (req, res) => {
  try {
    const clientTickets = req.body.tickets || [];
    if (Array.isArray(clientTickets) && clientTickets.length > 0) {
      const map = new Map();
      for (const t of store.tickets) {
        if (!isTicketDeleted(t)) {
          const k = (t.aitNumber && t.aitNumber.trim().toUpperCase()) || t.id;
          if (k) map.set(k, t);
        }
      }
      for (const ct of clientTickets) {
        if (!isTicketDeleted(ct)) {
          const k = (ct.aitNumber && ct.aitNumber.trim().toUpperCase()) || ct.id;
          if (k) {
            const existing = map.get(k);
            if (!existing) {
              map.set(k, ct);
            } else {
              const exTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
              const ctTime = new Date(ct.updatedAt || ct.createdAt || 0).getTime();
              if (ctTime >= exTime) {
                map.set(k, { ...existing, ...ct });
              }
            }
          }
        }
      }
      store.tickets = Array.from(map.values()).sort(
        (a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      saveStore();

      if (supabase) {
        syncAllToSupabase().catch(() => {});
      }
    }
    const activeTickets = store.tickets.filter(t => !isTicketDeleted(t));
    res.json({ success: true, tickets: activeTickets });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update ticket
app.put('/api/tickets/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const index = store.tickets.findIndex(t => t.id === id || (t.aitNumber && t.aitNumber.toUpperCase() === id.toUpperCase()));

    if (index === -1) {
      return res.status(404).json({ error: 'Auto de infração não encontrado' });
    }

    const updated = {
      ...store.tickets[index],
      ...updateData,
      updatedAt: new Date().toISOString()
    };

    store.tickets[index] = updated;
    saveStore();

    broadcastRealtimeEvent('tickets', 'UPDATE', updated);

    if (supabase) {
      pushTicketToSupabase(updated).catch(err => {
        console.warn('Server: Supabase update warning in PUT ticket:', err);
      });
    }

    res.json({ success: true, ticket: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE ticket
app.delete('/api/tickets/:id', (req, res) => {
  try {
    const { id } = req.params;
    const cleanId = String(id).trim();

    // Find all matching tickets by ID or AIT Number
    const matches = store.tickets.filter(
      t => t.id === cleanId || (t.aitNumber && t.aitNumber.toUpperCase() === cleanId.toUpperCase())
    );

    // Track deleted keys permanently in tombstones
    if (!store.deletedTicketKeys) store.deletedTicketKeys = [];
    store.deletedTicketKeys.push(cleanId.toUpperCase());
    matches.forEach(m => {
      if (m.id) store.deletedTicketKeys.push(String(m.id).toUpperCase());
      if (m.aitNumber) store.deletedTicketKeys.push(String(m.aitNumber).toUpperCase());
    });

    // Deduplicate deleted keys
    store.deletedTicketKeys = Array.from(new Set(store.deletedTicketKeys));

    // Remove matching tickets from server memory store
    store.tickets = store.tickets.filter(t => !isTicketDeleted(t));
    saveStore();

    const mainAit = matches[0]?.aitNumber || cleanId;
    broadcastRealtimeEvent('tickets', 'DELETE', { id: cleanId, aitNumber: mainAit });

    if (supabase) {
      (async () => {
        try {
          if (mainAit) {
            await supabase.from('sgait_autos').delete().eq('ait_number', mainAit);
          }
          await supabase.from('sgait_autos').delete().eq('id', cleanId);
        } catch (e: any) {
          console.warn('Server: Supabase delete warning:', e);
        }
      })();
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE infraction catalog item
app.delete('/api/infractions/:code', (req, res) => {
  try {
    const code = decodeURIComponent(req.params.code).trim();
    store.infractions = store.infractions.filter(i => i.code.trim().toLowerCase() !== code.toLowerCase());
    saveStore();

    broadcastRealtimeEvent('infractions', 'DELETE', { code });

    if (supabase) {
      (async () => {
        try {
          await supabase.from('sgait_infractions_table').delete().ilike('code', code);
        } catch (e: any) {
          console.warn('Server: Supabase delete infraction warning:', e);
        }
      })();
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update user profile name
app.put('/api/profile', (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email || !name) return res.status(400).json({ error: 'E-mail e nome são obrigatórios' });

    const clean = email.trim().toLowerCase();
    const cleanName = name.trim();

    const index = store.authorizedEmails.findIndex(e => e.email.trim().toLowerCase() === clean);
    let updatedObj = { email: clean, name: cleanName, role: 'AGENTE' };
    if (index >= 0) {
      store.authorizedEmails[index].name = cleanName;
      updatedObj = store.authorizedEmails[index];
    } else {
      store.authorizedEmails.push(updatedObj);
    }
    saveStore();

    broadcastRealtimeEvent('authorized_emails', 'UPDATE', updatedObj);

    if (supabase) {
      (async () => {
        try {
          await supabase.from('sgait_profiles').update({ name: cleanName }).eq('email', clean);
          await supabase.from('sgait_authorized_emails').update({ name: cleanName }).eq('email', clean);
        } catch (e) {}
      })();
    }

    res.json({ success: true, user: updatedObj });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET authorized emails
app.get('/api/authorized-emails', (req, res) => {
  res.json(store.authorizedEmails);
});

// POST authorized email
app.post('/api/authorized-emails', (req, res) => {
  const newEmail = req.body;
  if (!newEmail.email) return res.status(400).json({ error: 'E-mail é obrigatório' });

  const clean = newEmail.email.trim().toLowerCase();
  const index = store.authorizedEmails.findIndex(e => e.email.trim().toLowerCase() === clean);

  const existing = index >= 0 ? store.authorizedEmails[index] : {};
  const savedRecord = {
    ...existing,
    email: clean,
    name: newEmail.name || existing.name || clean.split('@')[0],
    role: newEmail.role || existing.role || 'AGENTE',
    lastLoginAt: newEmail.lastLoginAt || existing.lastLoginAt || new Date().toISOString()
  };

  if (index >= 0) {
    store.authorizedEmails[index] = savedRecord;
  } else {
    store.authorizedEmails.push(savedRecord);
  }

  saveStore();
  broadcastRealtimeEvent('authorized_emails', index >= 0 ? 'UPDATE' : 'INSERT', savedRecord);

  if (supabase) {
    (async () => {
      try {
        await supabase.from('sgait_authorized_emails').upsert(savedRecord, { onConflict: 'email' });
      } catch (e) {}
    })();
  }

  res.json({ success: true, email: savedRecord });
});

// PUT update user role (ADMIN / AGENTE)
app.put('/api/authorized-emails/role', (req, res) => {
  try {
    const { email, role } = req.body;
    if (!email || !role) return res.status(400).json({ error: 'E-mail e role são obrigatórios' });

    const clean = email.trim().toLowerCase();
    const index = store.authorizedEmails.findIndex(e => e.email.trim().toLowerCase() === clean);

    let updatedObj = { email: clean, name: clean.split('@')[0], role };
    if (index >= 0) {
      store.authorizedEmails[index].role = role;
      updatedObj = store.authorizedEmails[index];
    } else {
      store.authorizedEmails.push(updatedObj);
    }

    saveStore();
    broadcastRealtimeEvent('authorized_emails', 'UPDATE', updatedObj);

    if (supabase) {
      (async () => {
        try {
          await supabase.from('sgait_authorized_emails').upsert({ email: clean, name: updatedObj.name, role }, { onConflict: 'email' });
          await supabase.from('sgait_profiles').update({ role }).eq('email', clean);
        } catch (e) {}
      })();
    }

    res.json({ success: true, email: clean, role });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE authorized email
app.delete('/api/authorized-emails/:email', (req, res) => {
  const clean = decodeURIComponent(req.params.email).trim().toLowerCase();
  store.authorizedEmails = store.authorizedEmails.filter(e => e.email.trim().toLowerCase() !== clean);
  saveStore();

  broadcastRealtimeEvent('authorized_emails', 'DELETE', { email: clean });

  if (supabase) {
    (async () => {
      try {
        await supabase.from('sgait_authorized_emails').delete().eq('email', clean);
        await supabase.from('sgait_profiles').delete().eq('email', clean);
      } catch (e) {}
    })();
  }

  res.json({ success: true });
});

// GET infractions
app.get('/api/infractions', (req, res) => {
  if (!store.infractions || store.infractions.length === 0) {
    store.infractions = [...DEFAULT_INFRACTIONS];
    saveStore();
  }
  res.json(store.infractions);
});

// POST infraction
app.post('/api/infractions', (req, res) => {
  const inf = req.body;
  if (!inf.code) return res.status(400).json({ error: 'Código é obrigatório' });

  const idx = store.infractions.findIndex(i => i.code === inf.code);
  if (idx >= 0) {
    store.infractions[idx] = { ...store.infractions[idx], ...inf };
  } else {
    store.infractions.push(inf);
  }

  saveStore();
  broadcastRealtimeEvent('infractions', idx >= 0 ? 'UPDATE' : 'INSERT', inf);
  res.json({ success: true, infraction: inf });
});

// PUT infractions bulk sync
app.put('/api/infractions/bulk-sync', (req, res) => {
  const list = req.body.infractions || [];
  if (Array.isArray(list)) {
    store.infractions = list;
    saveStore();
    broadcastRealtimeEvent('infractions', 'UPDATE', list);
  }
  res.json({ success: true, count: store.infractions.length });
});

// =========================================================
// VITE & STATIC FILES MIDDLEWARE
// =========================================================

// Health & Version Endpoint for Deployment Verification
app.get('/api/health', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json({ status: 'ok', updated: new Date().toISOString(), app: 'SGAIT' });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    
    // Serve hashed static assets with immutable caching, but disable automatic index.html serving
    app.use(express.static(distPath, {
      index: false,
      etag: true,
      lastModified: true,
      setHeaders: (res, filepath) => {
        if (filepath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
          res.setHeader('Surrogate-Control', 'no-store');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        } else if (filepath.includes('/assets/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    }));

    // SPA handler for all HTML routes (including root) - guarantee fresh index.html on every page load
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.setHeader('Surrogate-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('X-SGAIT-Deployed-At', new Date().toISOString());
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SGAIT Full-Stack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

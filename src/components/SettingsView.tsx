/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Settings, 
  UserPlus, 
  Plus, 
  Trash2, 
  Database, 
  Key, 
  CheckCircle, 
  AlertTriangle,
  Clipboard,
  BookOpen,
  Mail,
  Shield,
  FileText,
  DollarSign,
  Info,
  FileSpreadsheet,
  RefreshCw,
  DownloadCloud,
  Sparkles,
  Search,
  Users,
  UserCheck,
  Clock,
  ShieldAlert
} from 'lucide-react';
import { UserProfile, UserRole, AuthorizedEmail, InfractionType } from '../types';
import { dbService, isSupabaseConfigured, isSupabaseActive, updateRuntimeSupabaseConfig, SUPABASE_SQL_SETUP } from '../lib/supabase';

interface SettingsViewProps {
  user: UserProfile;
  authorizedEmails: AuthorizedEmail[];
  infractions: InfractionType[];
  onReloadNeeded: () => void;
}

export default function SettingsView({ user, authorizedEmails, infractions, onReloadNeeded }: SettingsViewProps) {
  // Whitelist Add form state
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>(UserRole.AGENTE);
  
  // Custom Infraction Add form state
  const [newInfCode, setNewInfCode] = useState('');
  const [newInfDesc, setNewInfDesc] = useState('');
  const [newInfFraming, setNewInfFraming] = useState('');
  const [newInfArticle, setNewInfArticle] = useState('');
  const [newInfNature, setNewInfNature] = useState<'Leve' | 'Média' | 'Grave' | 'Gravíssima'>('Média');
  const [newInfFineValue, setNewInfFineValue] = useState('');
  const [newInfScore, setNewInfScore] = useState('');
  const [newInfAdminMeasure, setNewInfAdminMeasure] = useState('Nenhuma');

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [sqlCopied, setSqlCopied] = useState(false);

  const [activeTab, setActiveTab] = useState<'whitelist' | 'infractions' | 'google-sheets' | 'supabase'>('whitelist');

  // Supabase Connection state
  const [supabaseUrlInput, setSupabaseUrlInput] = useState('');
  const [supabaseKeyInput, setSupabaseKeyInput] = useState('');
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);
  const [sbServerConfig, setSbServerConfig] = useState<{
    configured: boolean;
    url: string;
    hasKey: boolean;
    active: boolean;
    totalTickets: number;
    totalInfractions: number;
    totalAuthorized: number;
  } | null>(null);

  const fetchSbConfig = async () => {
    try {
      const res = await fetch('/api/config/supabase');
      if (res.ok) {
        const data = await res.json();
        setSbServerConfig(data);
        if (data.url && !supabaseUrlInput) setSupabaseUrlInput(data.url);
      }
    } catch (e) {}
  };

  React.useEffect(() => {
    fetchSbConfig();
  }, []);

  const handleSaveSupabase = async () => {
    if (!supabaseUrlInput.trim() || !supabaseKeyInput.trim()) {
      setFormError('Por favor informe a URL do Projeto e a Chave de API (Anon Key) do Supabase.');
      return;
    }
    setIsTestingSupabase(true);
    setFormError(null);
    setFormSuccess(null);
    try {
      const cleanUrl = supabaseUrlInput.trim().startsWith('http') ? supabaseUrlInput.trim() : `https://${supabaseUrlInput.trim()}`;
      const cleanKey = supabaseKeyInput.trim();

      // Update runtime client
      updateRuntimeSupabaseConfig(cleanUrl, cleanKey);

      // Post to backend
      const res = await fetch('/api/config/supabase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleanUrl, anonKey: cleanKey })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao conectar com o Supabase');
      }

      setFormSuccess('Conexão com o Supabase estabelecida com sucesso e dados sincronizados!');
      setSupabaseKeyInput('');
      fetchSbConfig();
      onReloadNeeded();
    } catch (err: any) {
      setFormError(err.message || 'Erro ao conectar ao Supabase.');
    } finally {
      setIsTestingSupabase(false);
    }
  };

  const handleForceSyncSupabase = async () => {
    setIsSyncingSupabase(true);
    setFormError(null);
    setFormSuccess(null);
    try {
      if (isSupabaseActive()) {
        const localTickets = JSON.parse(localStorage.getItem('sgait_traffic_tickets') || '[]');
        for (const t of localTickets) {
          await dbService.insertTicket(t);
        }
      }

      const res = await fetch('/api/config/supabase/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao sincronizar dados com o Supabase.');
      }

      const details = data.syncDetails || {};
      setFormSuccess(
        `Sincronização bidirecional concluída! ${details.syncedTickets || 0} de ${details.totalTickets || 0} autos salvos na tabela sgait_autos no Supabase.`
      );
      fetchSbConfig();
      onReloadNeeded();
    } catch (err: any) {
      setFormError(err.message || 'Erro ao sincronizar com o Supabase.');
    } finally {
      setIsSyncingSupabase(false);
    }
  };

  // User Management Search & Filtering
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Computed user stats
  const userStats = useMemo(() => {
    const total = authorizedEmails.length;
    const admins = authorizedEmails.filter(e => e.role === UserRole.ADMIN).length;
    const agentes = authorizedEmails.filter(e => e.role === UserRole.AGENTE).length;
    const loggedIn = authorizedEmails.filter(e => !!e.lastLoginAt).length;
    return { total, admins, agentes, loggedIn };
  }, [authorizedEmails]);

  // Filtered users list
  const filteredAuthorizedEmails = useMemo(() => {
    if (!userSearchQuery.trim()) return authorizedEmails;
    const query = userSearchQuery.trim().toLowerCase();
    return authorizedEmails.filter(ae => 
      ae.email.toLowerCase().includes(query) || 
      ae.name.toLowerCase().includes(query)
    );
  }, [authorizedEmails, userSearchQuery]);

  const formatLastLogin = (isoString?: string) => {
    if (!isoString) return 'Aguardando 1º Acesso';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return 'Aguardando 1º Acesso';
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'Aguardando 1º Acesso';
    }
  };

  // Google Sheets Synchronization state
  const [sheetUrl, setSheetUrl] = useState('');
  const [pasteCsv, setPasteCsv] = useState('');
  const [importMethod, setImportMethod] = useState<'url' | 'paste'>('url');
  const [parsedCsvLines, setParsedCsvLines] = useState<string[][]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<{
    code: number;
    description: number;
    framing: number;
    article: number;
    nature: number;
    fineValue: number;
    score: number;
    adminMeasure: number;
  }>({
    code: -1,
    description: -1,
    framing: -1,
    article: -1,
    nature: -1,
    fineValue: -1,
    score: -1,
    adminMeasure: -1
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // CSV Parser Helper
  const parseCSVContent = (text: string): string[][] => {
    const lines: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let entry = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          entry += '"';
          i++; // skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' || char === ';') {
        if (!inQuotes) {
          row.push(entry.trim());
          entry = '';
        } else {
          entry += char;
        }
      } else if (char === '\n' || char === '\r') {
        if (!inQuotes) {
          if (char === '\r' && nextChar === '\n') {
            i++; // skip \n
          }
          row.push(entry.trim());
          if (row.length > 0 && row.some(cell => cell !== '')) {
            lines.push(row);
          }
          row = [];
          entry = '';
        } else {
          entry += char;
        }
      } else {
        entry += char;
      }
    }
    
    if (entry || row.length > 0) {
      row.push(entry.trim());
      if (row.some(cell => cell !== '')) {
        lines.push(row);
      }
    }

    return lines;
  };

  const handleAnalyze = async () => {
    setFormError(null);
    setFormSuccess(null);
    setParsedCsvLines([]);
    setCsvHeaders([]);
    
    let csvText = '';

    if (importMethod === 'url') {
      if (!sheetUrl.trim()) {
        setFormError('Por favor, informe a URL da planilha Google Sheets.');
        return;
      }

      setIsAnalyzing(true);
      try {
        let targetUrl = sheetUrl.trim();
        const sheetIdMatch = targetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (sheetIdMatch) {
          const id = sheetIdMatch[1];
          targetUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;
          const gidMatch = sheetUrl.match(/[#&?]gid=([0-9]+)/);
          if (gidMatch) {
            targetUrl += `&gid=${gidMatch[1]}`;
          }
        }

        const response = await fetch(targetUrl);
        if (!response.ok) {
          throw new Error('Não foi possível carregar a planilha. Verifique se o link está público ou compartilhado como "Qualquer pessoa com o link pode ler".');
        }
        csvText = await response.text();
      } catch (err: any) {
        setFormError(err.message || 'Erro ao carregar a planilha de infrações. Certifique-se de que o link esteja público.');
        setIsAnalyzing(false);
        return;
      }
    } else {
      if (!pasteCsv.trim()) {
        setFormError('Por favor, cole o conteúdo CSV no campo de texto.');
        return;
      }
      csvText = pasteCsv;
    }

    const lines = parseCSVContent(csvText);
    if (lines.length < 2) {
      setFormError('O CSV analisado parece vazio ou não contém linhas de dados suficientes.');
      setIsAnalyzing(false);
      return;
    }

    const headers = lines[0];
    setCsvHeaders(headers);
    setParsedCsvLines(lines);

    // Intelligent mapping
    const matchHeader = (keywords: string[]): number => {
      return headers.findIndex(h => {
        const normalized = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // remove accents
        return keywords.some(k => normalized.includes(k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
      });
    };

    setMapping({
      code: matchHeader(['codigo', 'cod', 'enquadramento_codigo']),
      description: matchHeader(['descricao', 'infracao', 'tipeficao', 'tipo', 'nome', 'detalhe']),
      framing: matchHeader(['enquadramento', 'amparo', 'legal', 'base']),
      article: matchHeader(['artigo', 'art', 'ctb']),
      nature: matchHeader(['gravidade', 'natureza', 'grau', 'tipo_gravidade']),
      fineValue: matchHeader(['valor', 'multa', 'preco', 'r$', 'custo']),
      score: matchHeader(['pontos', 'pontuacao', 'pontos_cnh', 'score', 'cnh']),
      adminMeasure: matchHeader(['medida', 'administrativa', 'medida_adm', 'providencia'])
    });

    setFormSuccess('Planilha analisada com sucesso! Verifique e ajuste o mapeamento das colunas abaixo.');
    setIsAnalyzing(false);
  };

  // Preview the processed records
  const previewRows = useMemo(() => {
    if (parsedCsvLines.length < 2) return [];
    
    // Process first 5 data rows
    return parsedCsvLines.slice(1, 6).map((row, idx) => {
      const getVal = (index: number) => (index !== -1 && index < row.length) ? row[index] : '';
      
      const natureStr = getVal(mapping.nature).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      let nature: 'Leve' | 'Média' | 'Grave' | 'Gravíssima' = 'Média';
      if (natureStr.includes('gravissima')) nature = 'Gravíssima';
      else if (natureStr.includes('grave')) nature = 'Grave';
      else if (natureStr.includes('media')) nature = 'Média';
      else if (natureStr.includes('leve')) nature = 'Leve';

      const fineRaw = getVal(mapping.fineValue);
      let fineValue = 0;
      if (fineRaw) {
        const clean = fineRaw.replace(/[R$\s]/g, '');
        if (clean.includes('.') && clean.includes(',')) {
          fineValue = Number(clean.replace(/\./g, '').replace(',', '.'));
        } else if (clean.includes(',')) {
          fineValue = Number(clean.replace(',', '.'));
        } else {
          fineValue = Number(clean);
        }
        if (isNaN(fineValue)) fineValue = 0;
      }

      const scoreRaw = getVal(mapping.score);
      const score = scoreRaw ? parseInt(scoreRaw.replace(/\D/g, ''), 10) || 0 : 0;

      return {
        code: getVal(mapping.code) || `CODE-${idx + 1}`,
        description: getVal(mapping.description) || 'Sem descrição',
        framing: getVal(mapping.framing) || (getVal(mapping.article) ? `Art. ${getVal(mapping.article)} do CTB` : 'Artigo não informado'),
        article: getVal(mapping.article) || 'Não informado',
        nature,
        fineValue,
        score,
        adminMeasure: getVal(mapping.adminMeasure) || 'Nenhuma'
      };
    });
  }, [parsedCsvLines, mapping]);

  const handleSyncGoogleSheets = async () => {
    setFormError(null);
    setFormSuccess(null);

    if (user.role !== UserRole.ADMIN) {
      setFormError('Apenas administradores podem atualizar o catálogo de infrações.');
      return;
    }

    if (parsedCsvLines.length < 2) {
      setFormError('Nenhum dado para sincronizar. Por favor, analise a planilha primeiro.');
      return;
    }

    if (mapping.code === -1 || mapping.description === -1) {
      setFormError('As colunas de "Código" e "Descrição" são obrigatórias para o mapeamento.');
      return;
    }

    setIsSyncing(true);
    try {
      const infractionsToSync: InfractionType[] = parsedCsvLines.slice(1).map((row, idx) => {
        const getVal = (index: number) => (index !== -1 && index < row.length) ? row[index] : '';
        
        const natureStr = getVal(mapping.nature).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        let nature: 'Leve' | 'Média' | 'Grave' | 'Gravíssima' = 'Média';
        if (natureStr.includes('gravissima')) nature = 'Gravíssima';
        else if (natureStr.includes('grave')) nature = 'Grave';
        else if (natureStr.includes('media')) nature = 'Média';
        else if (natureStr.includes('leve')) nature = 'Leve';

        const fineRaw = getVal(mapping.fineValue);
        let fineValue = 0;
        if (fineRaw) {
          const clean = fineRaw.replace(/[R$\s]/g, '');
          if (clean.includes('.') && clean.includes(',')) {
            fineValue = Number(clean.replace(/\./g, '').replace(',', '.'));
          } else if (clean.includes(',')) {
            fineValue = Number(clean.replace(',', '.'));
          } else {
            fineValue = Number(clean);
          }
          if (isNaN(fineValue)) fineValue = 0;
        }

        const scoreRaw = getVal(mapping.score);
        const score = scoreRaw ? parseInt(scoreRaw.replace(/\D/g, ''), 10) || 0 : 0;

        const codeVal = getVal(mapping.code).trim();

        return {
          code: codeVal || `ERR-${idx + 1}`,
          description: getVal(mapping.description).trim() || 'Descrição não especificada',
          framing: getVal(mapping.framing).trim() || (getVal(mapping.article) ? `Art. ${getVal(mapping.article).trim()} do CTB` : 'Art. não informado'),
          article: getVal(mapping.article).trim() || 'Não especificado',
          nature,
          fineValue,
          score,
          adminMeasure: getVal(mapping.adminMeasure).trim() || 'Nenhuma'
        };
      }).filter(inf => inf.code && inf.code.length > 1);

      if (infractionsToSync.length === 0) {
        throw new Error('Nenhuma infração válida foi gerada a partir do mapeamento.');
      }

      const { success, error } = await dbService.saveAllInfractions(infractionsToSync);
      if (error) throw new Error(error);

      setFormSuccess(`Sincronização concluída! ${infractionsToSync.length} infrações foram importadas e salvas com sucesso no catálogo.`);
      setParsedCsvLines([]);
      setCsvHeaders([]);
      onReloadNeeded();
    } catch (err: any) {
      setFormError(err.message || 'Erro ao sincronizar infrações com o banco de dados.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteInfraction = async (code: string) => {
    if (user.role !== UserRole.ADMIN) {
      setFormError('Apenas administradores podem excluir enquadramentos do catálogo.');
      return;
    }

    if (!confirm(`Deseja realmente excluir permanentemente a infração código ${code} do catálogo legal?`)) {
      return;
    }

    setIsLoading(true);
    setFormError(null);
    setFormSuccess(null);
    try {
      const { success, error } = await dbService.deleteInfraction(code);
      if (error) throw new Error(error);
      setFormSuccess(`Infração código ${code} excluída com sucesso do catálogo.`);
      onReloadNeeded();
    } catch (err: any) {
      setFormError(err.message || 'Erro ao excluir infração.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDemoLink = () => {
    setImportMethod('url');
    setSheetUrl('https://docs.google.com/spreadsheets/d/1_C7msc_ZgZq7C7C3Yf3p8i7rXnO2L46D08g0Yf9Z0-g/edit?usp=sharing');
  };

  const loadDemoCsv = () => {
    setImportMethod('paste');
    setPasteCsv(
`Código;Descrição;Artigo Legal;Enquadramento;Gravidade;Valor Multa;Pontuação CNH;Medida Administrativa
501-00;Dirigir veículo sem possuir CNH ou PPD;162, I;Art. 162, I do CTB;Gravíssima;R$ 880,41;7;Retenção do veículo até a apresentação de condutor habilitado
516-91;Dirigir sob a influência de álcool ou substâncias psicoativas;165;Art. 165 do CTB;Gravíssima;R$ 2.934,70;7;Retenção do veículo e recolhimento da CNH
518-51;Deixar o condutor ou passageiro de usar o cinto de segurança;167;Art. 167 do CTB;Grave;R$ 195,23;5;Retenção do veículo até colocação do cinto pelo infrator
605-01;Avançar o sinal vermelho do semáforo ou o de parada obrigatória;208;Art. 208 do CTB;Gravíssima;R$ 293,47;7;Nenhuma
763-31;Dirigir o veículo manuseando ou utilizando telefone celular;252, VI;Art. 252, VI Parágrafo Único do CTB;Gravíssima;R$ 293,47;7;Nenhuma
545-21;Estacionar em desacordo com as condições regulamentadas (Zona Azul);181, XVII;Art. 181, XVII do CTB;Grave;R$ 195,23;5;Remoção do veículo
745-50;Transitar em velocidade superior à máxima permitida em até 20%;218, I;Art. 218, I do CTB;Média;R$ 130,16;4;Nenhuma`
    );
  };

  // Add email to whitelist handler
  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (user.role !== UserRole.ADMIN) {
      setFormError('Apenas administradores podem gerenciar e-mails autorizados.');
      return;
    }

    if (!newEmail.trim() || !newName.trim()) {
      setFormError('Preencha o e-mail e o nome completo.');
      return;
    }

    setIsLoading(true);
    try {
      const payload: AuthorizedEmail = {
        email: newEmail.trim().toLowerCase(),
        name: newName.trim(),
        role: newRole
      };

      const { data, error } = await dbService.addAuthorizedEmail(payload);
      if (error) throw new Error(error);

      setFormSuccess(`E-mail ${newEmail} autorizado com sucesso!`);
      setNewEmail('');
      setNewName('');
      setNewRole(UserRole.AGENTE);
      onReloadNeeded();
    } catch (err: any) {
      setFormError(err.message || 'Erro ao autorizar e-mail.');
    } finally {
      setIsLoading(false);
    }
  };

  // Update user role handler (Admin selects AGENTE or ADMINISTRADOR)
  const handleUpdateRole = async (targetEmail: string, newRole: UserRole) => {
    setFormError(null);
    setFormSuccess(null);

    if (user.role !== UserRole.ADMIN) {
      setFormError('Apenas administradores podem alterar o nível de acesso.');
      return;
    }

    setIsLoading(true);
    try {
      const { success, error } = await dbService.updateAuthorizedRole(targetEmail, newRole);
      if (error) throw new Error(error);
      setFormSuccess(`Nível de acesso de ${targetEmail} alterado para ${newRole === UserRole.ADMIN ? 'ADMINISTRADOR' : 'AGENTE'} com sucesso!`);
      onReloadNeeded();
    } catch (err: any) {
      setFormError(err.message || 'Erro ao atualizar nível de acesso.');
    } finally {
      setIsLoading(false);
    }
  };

  // Remove email from whitelist handler
  const handleRemoveEmail = async (emailToRemove: string) => {
    setFormError(null);
    setFormSuccess(null);

    if (user.role !== UserRole.ADMIN) {
      setFormError('Apenas administradores podem remover e-mails autorizados.');
      return;
    }

    if (emailToRemove.trim().toLowerCase() === user.email.trim().toLowerCase()) {
      setFormError('Você não pode remover seu próprio e-mail da lista de autorização.');
      return;
    }

    if (!confirm(`Deseja realmente remover a autorização de acesso e o perfil do e-mail ${emailToRemove}?`)) {
      return;
    }

    setIsLoading(true);
    try {
      const { success, error } = await dbService.removeAuthorizedEmail(emailToRemove);
      if (error) throw new Error(error);
      setFormSuccess(`Conta e autorização para ${emailToRemove} foram removidas com sucesso.`);
      onReloadNeeded();
    } catch (err: any) {
      setFormError(err.message || 'Erro ao remover autorização.');
    } finally {
      setIsLoading(false);
    }
  };

  // Add custom infraction handler
  const handleAddInfraction = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (user.role !== UserRole.ADMIN) {
      setFormError('Apenas administradores podem gerenciar a tabela de infrações.');
      return;
    }

    if (!newInfCode.trim() || !newInfDesc.trim() || !newInfFraming.trim() || !newInfArticle.trim() || !newInfFineValue || !newInfScore) {
      setFormError('Por favor, preencha todos os campos obrigatórios da infração.');
      return;
    }

    setIsLoading(true);
    try {
      const payload: InfractionType = {
        code: newInfCode.trim(),
        description: newInfDesc.trim(),
        framing: newInfFraming.trim(),
        article: newInfArticle.trim(),
        nature: newInfNature,
        fineValue: Number(newInfFineValue),
        score: Number(newInfScore),
        adminMeasure: newInfAdminMeasure.trim()
      };

      const { data, error } = await dbService.insertInfraction(payload);
      if (error) throw new Error(error);

      setFormSuccess(`Infração ${newInfCode} adicionada com sucesso ao catálogo!`);
      // Reset infraction form
      setNewInfCode('');
      setNewInfDesc('');
      setNewInfFraming('');
      setNewInfArticle('');
      setNewInfNature('Média');
      setNewInfFineValue('');
      setNewInfScore('');
      setNewInfAdminMeasure('Nenhuma');
      onReloadNeeded();
    } catch (err: any) {
      setFormError(err.message || 'Erro ao inserir infração.');
    } finally {
      setIsLoading(false);
    }
  };

  // Clipboard copy SQL setup code block helper
  const copySqlSchema = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SETUP);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 2000);
  };

  return (
    <div className="space-y-6" id="settings-container">
      {/* Settings Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Parâmetros do Sistema</h1>
        <p className="text-sm text-slate-500">Gerenciamento de operadores autorizados e consulta ao catálogo de infrações de trânsito.</p>
      </div>

      {/* TABS BUTTON BAR */}
      <div className="flex flex-wrap border-b-2 border-slate-200 gap-1">
        <button
          id="tab-whitelist"
          onClick={() => { setActiveTab('whitelist'); setFormError(null); setFormSuccess(null); }}
          className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-4 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'whitelist' 
              ? 'border-amber-500 text-amber-600 font-black' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Users size={15} />
          Usuários, Logins & Níveis de Acesso
        </button>
        <button
          id="tab-infractions"
          onClick={() => { setActiveTab('infractions'); setFormError(null); setFormSuccess(null); }}
          className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-4 transition-all cursor-pointer ${
            activeTab === 'infractions' 
              ? 'border-amber-500 text-amber-600 font-black' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Catálogo de Infrações
        </button>
        <button
          id="tab-google-sheets"
          onClick={() => { setActiveTab('google-sheets'); setFormError(null); setFormSuccess(null); }}
          className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-4 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'google-sheets' 
              ? 'border-amber-500 text-amber-600 font-black' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <FileSpreadsheet size={15} />
          Importar Planilha
        </button>
        <button
          id="tab-supabase"
          onClick={() => { setActiveTab('supabase'); setFormError(null); setFormSuccess(null); fetchSbConfig(); }}
          className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-4 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'supabase' 
              ? 'border-amber-500 text-amber-600 font-black' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Database size={15} />
          Conexão Supabase / Banco
        </button>
      </div>

      {/* Global Success / Error feedback */}
      {formSuccess && (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-4 rounded-xl text-xs flex items-center gap-2.5">
          <CheckCircle className="text-emerald-500" size={16} />
          <span>{formSuccess}</span>
        </div>
      )}

      {formError && (
        <div className="bg-rose-50 text-rose-800 border border-rose-200 p-4 rounded-xl text-xs flex items-center gap-2.5">
          <AlertTriangle className="text-rose-500" size={16} />
          <span>{formError}</span>
        </div>
      )}

      {/* TAB CONTENT: WHITELIST / USER MANAGEMENT */}
      {activeTab === 'whitelist' && (
        <div className="space-y-6 animate-fade-in">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border-2 border-slate-200 shadow-2xs flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 text-amber-700 rounded-lg shrink-0">
                <Users size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Registrados</p>
                <p className="text-lg font-black text-slate-900">{userStats.total}</p>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border-2 border-slate-200 shadow-2xs flex items-center gap-3">
              <div className="p-2.5 bg-amber-500 text-slate-950 rounded-lg shrink-0">
                <Shield size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Administradores (ADM)</p>
                <p className="text-lg font-black text-slate-900">{userStats.admins}</p>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border-2 border-slate-200 shadow-2xs flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 text-blue-700 rounded-lg shrink-0">
                <UserCheck size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Agentes de Trânsito</p>
                <p className="text-lg font-black text-slate-900">{userStats.agentes}</p>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border-2 border-slate-200 shadow-2xs flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
                <Clock size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Acessos Efetuados</p>
                <p className="text-lg font-black text-slate-900">{userStats.loggedIn}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left panel: Add form (Only admins) */}
            <div className="lg:col-span-1 bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-xs space-y-4 self-start text-slate-700">
              <div>
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <UserPlus size={16} className="text-amber-500 stroke-[2.5]" />
                  Autorizar Novo E-mail
                </h2>
                <p className="text-xxs font-semibold text-slate-400 mt-1">Insira e-mails institucionais de operadores para pré-liberar acesso ao sistema SGAIT.</p>
              </div>

              {user.role === UserRole.ADMIN ? (
                <form onSubmit={handleAddEmail} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">E-mail do operador</label>
                    <input
                      id="new-email-input"
                      type="email"
                      placeholder="operador@sgait.gov.br"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">Nome Completo</label>
                    <input
                      id="new-name-input"
                      type="text"
                      placeholder="Agente Silveira"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">Perfil de Acesso (Cargo)</label>
                    <select
                      id="new-role-select"
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500"
                    >
                      <option value={UserRole.AGENTE}>Agente de Trânsito</option>
                      <option value={UserRole.ADMIN}>Administrador</option>
                    </select>
                  </div>

                  <button
                    id="btn-add-whitelist"
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 disabled:text-slate-500 text-slate-950 font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={14} className="stroke-[2.5]" />
                    Autorizar Operador
                  </button>
                </form>
              ) : (
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-xxs leading-relaxed text-slate-500 flex items-start gap-2">
                  <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                  <p><b>Apenas Administradores</b> possuem privilégios para adicionar novos operadores ou alterar papéis de acesso no sistema.</p>
                </div>
              )}
            </div>

            {/* Right panel: Users & Logins Management table */}
            <div className="lg:col-span-2 bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Mail size={16} className="text-amber-500" />
                    Gerenciamento de E-mails & Logins
                  </h2>
                  <p className="text-xxs font-semibold text-slate-500">Acompanhe quem fez login e administre quem é Agente ou Administrador.</p>
                </div>

                {/* Quick Search */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="user-search-input"
                    type="text"
                    placeholder="Buscar nome ou e-mail..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-amber-500 w-full sm:w-56"
                  />
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-left border-collapse text-slate-700">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-2.5 px-4">Operador / Nome</th>
                      <th className="py-2.5 px-4">E-mail de Login</th>
                      <th className="py-2.5 px-4">Último Login</th>
                      <th className="py-2.5 px-4">Nível de Acesso</th>
                      <th className="py-2.5 px-4 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredAuthorizedEmails.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 font-semibold text-xs">
                          Nenhum usuário encontrado para a busca especificada.
                        </td>
                      </tr>
                    ) : (
                      filteredAuthorizedEmails.map((ae, idx) => {
                        const isLogged = !!ae.lastLoginAt;
                        const isSelf = ae.email.toLowerCase() === user.email.toLowerCase();

                        return (
                          <tr key={`ae-row-${ae.email || idx}-${idx}`} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3 px-4 font-bold text-slate-800">
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(ae.name)}`}
                                  alt={ae.name}
                                  className="w-7 h-7 rounded-full bg-amber-100 border border-slate-200 shrink-0"
                                />
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-extrabold text-slate-900">{ae.name}</span>
                                    {isSelf && (
                                      <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-1.5 py-0.2 rounded uppercase">Você</span>
                                    )}
                                  </div>
                                  <div className="mt-0.5">
                                    {isLogged ? (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                        Acessou o Sistema
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                                        Pré-Cadastrado
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-4 font-mono text-slate-600 text-xs font-medium">
                              {ae.email}
                            </td>

                            <td className="py-3 px-4 font-semibold text-slate-500 text-xs whitespace-nowrap">
                              {formatLastLogin(ae.lastLoginAt)}
                            </td>

                            <td className="py-3 px-4">
                              {user.role === UserRole.ADMIN ? (
                                <select
                                  id={`select-role-${ae.email}`}
                                  value={ae.role}
                                  onChange={(e) => handleUpdateRole(ae.email, e.target.value as UserRole)}
                                  className={`text-xs font-black px-2.5 py-1.5 rounded-lg border focus:outline-none transition-all cursor-pointer shadow-2xs ${
                                    ae.role === UserRole.ADMIN
                                      ? 'bg-amber-500 text-slate-950 border-amber-600 font-extrabold'
                                      : 'bg-slate-100 text-slate-700 border-slate-300 font-bold hover:bg-slate-200'
                                  }`}
                                >
                                  <option value={UserRole.AGENTE}>AGENTE DE TRÂNSITO</option>
                                  <option value={UserRole.ADMIN}>ADMINISTRADOR</option>
                                </select>
                              ) : (
                                <span className={`inline-block text-[10px] font-black px-2.5 py-1 rounded font-mono ${
                                  ae.role === UserRole.ADMIN ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {ae.role === UserRole.ADMIN ? 'ADMIN' : 'AGENTE'}
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-center">
                              <button
                                id={`btn-remove-whitelist-${ae.email}`}
                                onClick={() => handleRemoveEmail(ae.email)}
                                disabled={user.role !== UserRole.ADMIN || isSelf}
                                className={`p-1.5 rounded-lg hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer ${
                                  user.role === UserRole.ADMIN && !isSelf
                                    ? 'text-slate-400'
                                    : 'text-slate-200 cursor-not-allowed'
                                }`}
                                title={isSelf ? 'Você não pode revogar seu próprio acesso' : 'Remover autorização'}
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: INFRACTIONS */}
      {activeTab === 'infractions' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          {/* Left panel: Add Custom Infraction Form */}
          <div className="lg:col-span-1 bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-xs space-y-4 self-start text-slate-700">
            <div>
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <BookOpen size={16} className="text-amber-500 stroke-[2.5]" />
                Registrar Novo Enquadramento
              </h2>
              <p className="text-xxs font-semibold text-slate-400 mt-1">Insira novas tipificações e penas do Código de Trânsito Brasileiro (CTB) para disponibilizar no preenchimento automático do auto.</p>
            </div>

            {user.role === UserRole.ADMIN ? (
              <form onSubmit={handleAddInfraction} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Código da Infração</label>
                  <input
                    id="new-inf-code"
                    type="text"
                    placeholder="Ex: 501-00"
                    value={newInfCode}
                    onChange={(e) => setNewInfCode(e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Artigo legal</label>
                  <input
                    id="new-inf-article"
                    type="text"
                    placeholder="Ex: 162, I"
                    value={newInfArticle}
                    onChange={(e) => setNewInfArticle(e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-xs font-mono font-semibold focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Enquadramento CTB</label>
                  <input
                    id="new-inf-framing"
                    type="text"
                    placeholder="Ex: Art. 162, I do CTB"
                    value={newInfFraming}
                    onChange={(e) => setNewInfFraming(e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Gravidade (Natureza)</label>
                  <select
                    id="new-inf-nature"
                    value={newInfNature}
                    onChange={(e) => setNewInfNature(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500"
                  >
                    <option value="Leve">Leve</option>
                    <option value="Média">Média</option>
                    <option value="Grave">Grave</option>
                    <option value="Gravíssima">Gravíssima</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">Multa (R$)</label>
                    <input
                      id="new-inf-fine"
                      type="number"
                      step="0.01"
                      placeholder="880.41"
                      value={newInfFineValue}
                      onChange={(e) => setNewInfFineValue(e.target.value)}
                      className="w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-xs font-mono font-semibold focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">Pontos CNH</label>
                    <input
                      id="new-inf-score"
                      type="number"
                      placeholder="7"
                      value={newInfScore}
                      onChange={(e) => setNewInfScore(e.target.value)}
                      className="w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-xs font-mono font-semibold focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Medida Administrativa</label>
                  <input
                    id="new-inf-measure"
                    type="text"
                    placeholder="Ex: Retenção do veículo"
                    value={newInfAdminMeasure}
                    onChange={(e) => setNewInfAdminMeasure(e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Descrição Legal</label>
                  <textarea
                    id="new-inf-desc"
                    rows={3}
                    placeholder="Dirigir veículo sem possuir Carteira de Habilitação..."
                    value={newInfDesc}
                    onChange={(e) => setNewInfDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500"
                    required
                  />
                </div>

                <button
                  id="btn-add-infraction"
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 disabled:text-slate-500 text-slate-950 font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} className="stroke-[2.5]" />
                  Inserir Enquadramento
                </button>
              </form>
            ) : (
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-xxs leading-relaxed text-slate-500 flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                <p><b>Apenas Administradores</b> possuem permissão de escrita para alterar, expandir ou excluir a Tabela Nacional de enquadramentos de trânsito.</p>
              </div>
            )}
          </div>

          {/* Right panel: Infractions List Table */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <FileText size={16} className="text-slate-600" />
                Catálogo Legal de Infrações Cadastradas
              </h2>
              <p className="text-xxs font-semibold text-slate-500">Enquadramentos legais disponíveis para preenchimento de autos no SGAIT.</p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-100 max-h-[500px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-slate-700">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider sticky top-0">
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Descrição Resumida</th>
                    <th className="py-2.5 px-3">Enquadramento</th>
                    <th className="py-2.5 px-3">Gravidade</th>
                    <th className="py-2.5 px-3 text-right">Valor</th>
                    <th className="py-2.5 px-3 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xxs">
                  {infractions.map((inf, idx) => (
                    <tr key={`setting-inf-row-${inf.code}-${idx}`} className="hover:bg-slate-50/40 transition-colors">
                      <td className="py-2 px-3 font-mono font-bold text-slate-800">{inf.code}</td>
                      <td className="py-2 px-3 max-w-[150px] truncate font-semibold" title={inf.description}>{inf.description}</td>
                      <td className="py-2 px-3 font-mono font-semibold text-slate-500">{inf.article}</td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-full ${
                          inf.nature === 'Gravíssima' ? 'bg-rose-50 text-rose-700' :
                          inf.nature === 'Grave' ? 'bg-amber-100 text-amber-800' :
                          inf.nature === 'Média' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {inf.nature}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-black text-slate-900">
                        R$ {inf.fineValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {user.role === UserRole.ADMIN && (
                          <button
                            id={`btn-del-inf-${inf.code}`}
                            onClick={() => handleDeleteInfraction(inf.code)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Excluir do catálogo"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: GOOGLE SHEETS */}
      {activeTab === 'google-sheets' && (
        <div className="bg-white p-6 rounded-2xl border-2 border-slate-200 shadow-xs space-y-6 animate-fade-in text-slate-700">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="text-emerald-600" size={18} />
              Importação do Catálogo de Infrações
            </h2>
            <p className="text-xs text-slate-500 mt-1">Carregue ou cole dados de enquadramentos de trânsito em lote no formato CSV / Google Sheets.</p>
          </div>

          <div className="flex gap-4 border-b border-slate-100 pb-3">
            <button
              onClick={() => setImportMethod('url')}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                importMethod === 'url' ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 text-slate-600'
              }`}
            >
              Link do Google Sheets
            </button>
            <button
              onClick={() => setImportMethod('paste')}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                importMethod === 'paste' ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 text-slate-600'
              }`}
            >
              Colar Texto CSV
            </button>
          </div>

          {importMethod === 'url' ? (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 block">URL da Planilha Pública (Google Sheets)</label>
              <input
                type="url"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/.../edit?usp=sharing"
                className="w-full px-3 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={loadDemoLink}
                className="text-xxs font-bold text-amber-600 hover:underline cursor-pointer"
              >
                Carregar Exemplo Modelo
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 block">Conteúdo CSV (com cabeçalho)</label>
              <textarea
                rows={6}
                value={pasteCsv}
                onChange={(e) => setPasteCsv(e.target.value)}
                placeholder="codigo;descricao;artigo;gravidade;valor..."
                className="w-full px-3 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={loadDemoCsv}
                className="text-xxs font-bold text-amber-600 hover:underline cursor-pointer"
              >
                Preencher CSV Modelo
              </button>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2"
            >
              <Sparkles size={14} className="text-amber-400" />
              {isAnalyzing ? 'Analisando...' : 'Analisar Estrutura do Arquivo'}
            </button>
          </div>

          {parsedCsvLines.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs text-amber-900 font-bold flex items-center justify-between">
                <span>Total de Linhas Identificadas: {parsedCsvLines.length}</span>
                <button
                  onClick={handleSyncGoogleSheets}
                  disabled={isSyncing}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
                >
                  {isSyncing ? 'Importando...' : 'Confirmar Importação de Infrações'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: SUPABASE DATABASE MANAGEMENT */}
      {activeTab === 'supabase' && (
        <div className="space-y-6 animate-fade-in">
          {/* Missing Tables Notice Banner if connected but tables missing */}
          {sbServerConfig?.active && sbServerConfig?.tablesExist === false && (
            <div className="bg-amber-500/10 border-2 border-amber-500/40 p-5 rounded-2xl space-y-3 animate-fade-in text-slate-800">
              <div className="flex items-center gap-2.5 text-amber-900 font-extrabold text-sm">
                <AlertTriangle className="text-amber-600 shrink-0" size={22} />
                <span>Conexão Supabase Ativa — Criação das Tabelas Necessária (Apenas 1 Clique)</span>
              </div>
              <p className="text-xs text-slate-700 font-medium leading-relaxed">
                Seu projeto do Supabase está conectado com sucesso! Como o projeto é novo, as tabelas do sistema (<code>sgait_autos</code>, <code>sgait_infractions_table</code> e <code>sgait_authorized_emails</code>) ainda não existem nele. Basta executar o script SQL abaixo para que a sincronização automática passe a rodar instantaneamente!
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  onClick={copySqlSchema}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-all"
                >
                  <Clipboard size={15} />
                  {sqlCopied ? 'Script SQL Copiado!' : '1. Copiar Script SQL de Criação (1-Clique)'}
                </button>
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  2. Abrir Supabase Dashboard → SQL Editor ↗
                </a>
              </div>
            </div>
          )}

          {/* Status Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border-2 border-slate-100 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xxs font-black tracking-wider text-slate-400 uppercase">Status da Conexão</span>
                <Database className={sbServerConfig?.active ? 'text-emerald-500' : 'text-amber-500'} size={18} />
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${sbServerConfig?.active ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                <span className="text-sm font-black text-slate-800">
                  {sbServerConfig?.active 
                    ? (sbServerConfig.tablesExist === false ? 'Conectado (Tabelas Pendentes)' : 'Conectado & Sincronizando') 
                    : 'Modo Local / Não Conectado'}
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border-2 border-slate-100 shadow-sm space-y-1">
              <span className="text-xxs font-black tracking-wider text-slate-400 uppercase">Autos (sgait_autos)</span>
              <div className="text-xl font-black text-slate-800">
                {sbServerConfig?.totalTickets !== undefined ? sbServerConfig.totalTickets : infractions.length}
              </div>
              <span className="text-xxs text-slate-500 font-medium">Registros na base central</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border-2 border-slate-100 shadow-sm space-y-1">
              <span className="text-xxs font-black tracking-wider text-slate-400 uppercase">Catálogo (sgait_infractions_table)</span>
              <div className="text-xl font-black text-slate-800">
                {sbServerConfig?.totalInfractions !== undefined ? sbServerConfig.totalInfractions : infractions.length}
              </div>
              <span className="text-xxs text-slate-500 font-medium">Infrações cadastradas</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border-2 border-slate-100 shadow-sm space-y-1">
              <span className="text-xxs font-black tracking-wider text-slate-400 uppercase">Acessos Autorizados</span>
              <div className="text-xl font-black text-slate-800">
                {sbServerConfig?.totalAuthorized !== undefined ? sbServerConfig.totalAuthorized : authorizedEmails.length}
              </div>
              <span className="text-xxs text-slate-500 font-medium">Emails em Whitelist</span>
            </div>
          </div>

          {/* Connection Settings Card */}
          <div className="bg-white p-6 rounded-2xl border-2 border-slate-100 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                  <Key className="text-amber-500" size={16} />
                  Configuração de Credenciais Supabase
                </h3>
                <p className="text-xs text-slate-500">
                  Informe a URL do seu projeto e a chave anon/public do Supabase para que os autos sejam salvos diretamente nas tabelas online.
                </p>
              </div>
              {sbServerConfig?.url && (
                <span className="px-3 py-1 bg-slate-100 text-slate-700 font-mono text-xxs font-bold rounded-full">
                  URL Atual: {sbServerConfig.url.replace('https://', '')}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">URL do Projeto Supabase</label>
                <input
                  type="text"
                  value={supabaseUrlInput}
                  onChange={(e) => setSupabaseUrlInput(e.target.value)}
                  placeholder="https://seu-projeto.supabase.co"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Chave de API Pública (Anon Key)</label>
                <input
                  type="password"
                  value={supabaseKeyInput}
                  onChange={(e) => setSupabaseKeyInput(e.target.value)}
                  placeholder={sbServerConfig?.hasKey ? '•••••••••••••••• (Chave gravada)' : 'eyJhbGciOiJIUzI1NiIsInR5cCI6...'}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                onClick={handleSaveSupabase}
                disabled={isTestingSupabase}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-900 font-black text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-2"
              >
                <RefreshCw size={14} className={isTestingSupabase ? 'animate-spin' : ''} />
                {isTestingSupabase ? 'Testando Conexão...' : 'Salvar e Conectar Supabase'}
              </button>

              <button
                onClick={handleForceSyncSupabase}
                disabled={isSyncingSupabase}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-2"
              >
                <DownloadCloud size={14} className={isSyncingSupabase ? 'animate-bounce' : 'text-amber-400'} />
                {isSyncingSupabase ? 'Sincronizando Com Supabase...' : 'Sincronizar Todos os Registros Agora'}
              </button>
            </div>
          </div>

          {/* SQL Setup Script & RLS Fix Instructions Card */}
          <div className="bg-slate-900 text-slate-100 p-6 rounded-2xl shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="text-amber-400" size={20} />
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                    Script SQL para Resolução de Permissões RLS no Supabase
                  </h3>
                  <p className="text-xs text-slate-400">
                    Se os autos não estão aparecendo no painel do Supabase, execute este script no <strong>SQL Editor do Supabase</strong> para liberar a visualização e inserção na tabela <code>sgait_autos</code>.
                  </p>
                </div>
              </div>
              <button
                onClick={copySqlSchema}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <Clipboard size={14} />
                {sqlCopied ? 'Copiado!' : 'Copiar Script SQL Completo'}
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-x-auto max-h-60 font-mono text-xxs text-emerald-400 space-y-1">
              <pre>{SUPABASE_SQL_SETUP}</pre>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

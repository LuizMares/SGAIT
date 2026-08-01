/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import { 
  FileText, 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp, 
  Award, 
  Car,
  Users
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar,
  Legend
} from 'recharts';
import { TrafficTicket } from '../types';

interface DashboardViewProps {
  tickets: TrafficTicket[];
}

export default function DashboardView({ tickets }: DashboardViewProps) {
  // 1. Calculate time-based and general statistics
  const stats = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    // Helper for week boundary
    const startOfWeek = new Date();
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let todayCount = 0;
    let weekCount = 0;
    let monthCount = 0;
    let yearCount = 0;
    let totalFine = 0;

    tickets.forEach(ticket => {
      const cleanDateStr = (ticket.infractionDate || '').substring(0, 10);
      const cleanCreatedStr = (ticket.createdAt || '').substring(0, 10);
      const ticketDate = new Date((cleanDateStr || todayStr) + 'T00:00:00');

      if (cleanDateStr === todayStr || cleanCreatedStr === todayStr) {
        todayCount++;
      }
      if (ticketDate >= startOfWeek) {
        weekCount++;
      }
      if (ticketDate.getMonth() === currentMonth && ticketDate.getFullYear() === currentYear) {
        monthCount++;
      }
      if (ticketDate.getFullYear() === currentYear) {
        yearCount++;
      }
      totalFine += Number(ticket.fineValue || 0);
    });

    return {
      total: tickets.length,
      today: todayCount,
      week: weekCount,
      month: monthCount,
      year: yearCount,
      totalFine
    };
  }, [tickets]);

  // 2. Data for: Tickets Over Time (Last 7 Days)
  const chartDataOverTime = useMemo(() => {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d;
    }).reverse();

    return last7Days.map(date => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const count = tickets.filter(t => (t.infractionDate || '').substring(0, 10) === dateStr).length;
      return {
        dayName: days[date.getDay()],
        dateStr: `${d}/${m}`,
        'Autos Registrados': count
      };
    });
  }, [tickets]);

  // 3. Data for: Tickets by Vehicle Type
  const vehicleTypeData = useMemo(() => {
    const counts: Record<string, number> = {};
    tickets.forEach(t => {
      counts[t.vehicleType] = (counts[t.vehicleType] || 0) + 1;
    });

    const colors = [
      '#f59e0b', '#475569', '#10b981', '#dc2626', '#8b5cf6', 
      '#ec4899', '#14b8a6', '#6366f1', '#334155', '#06b6d4'
    ];

    return Object.entries(counts)
      .map(([name, value], i) => ({
        name,
        value,
        color: colors[i % colors.length]
      }))
      .sort((a, b) => b.value - a.value);
  }, [tickets]);

  // 4. Data for: Infraction Rankings (Top 5)
  const infractionRankings = useMemo(() => {
    const counts: Record<string, { desc: string, count: number, code: string, nature: string }> = {};
    tickets.forEach(t => {
      if (!counts[t.infractionCode]) {
        counts[t.infractionCode] = {
          code: t.infractionCode,
          desc: t.infractionDescription,
          count: 0,
          nature: t.nature
        };
      }
      counts[t.infractionCode].count++;
    });

    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [tickets]);

  // 5. Data for: Agent Rankings
  const agentRankings = useMemo(() => {
    const counts: Record<string, { name: string, count: number, fineSum: number }> = {};
    tickets.forEach(t => {
      if (!counts[t.agentId]) {
        counts[t.agentId] = { name: t.agentName, count: 0, fineSum: 0 };
      }
      counts[t.agentId].count++;
      counts[t.agentId].fineSum += t.fineValue;
    });

    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [tickets]);

  // 6. Data for: Tickets by Infraction Nature
  const natureData = useMemo(() => {
    const counts = { Leve: 0, Média: 0, Grave: 0, Gravíssima: 0 };
    tickets.forEach(t => {
      if (t.nature in counts) {
        counts[t.nature as keyof typeof counts]++;
      }
    });

    return [
      { name: 'Leve', value: counts.Leve, color: '#64748b' }, // Slate
      { name: 'Média', value: counts.Média, color: '#f59e0b' }, // Amber
      { name: 'Grave', value: counts.Grave, color: '#d97706' }, // Dark Amber/Orange
      { name: 'Gravíssima', value: counts.Gravíssima, color: '#ef4444' } // Red
    ].filter(item => item.value > 0);
  }, [tickets]);

  return (
    <div className="space-y-6" id="dashboard-container">
      {/* Dashboard Heading */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight">Painel de Monitoramento</h1>
          <p className="text-sm font-semibold text-slate-400">Acompanhamento operacional em tempo real de infrações registradas em campo.</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-950 text-amber-400 text-xs font-black px-3.5 py-2 rounded-xl border border-slate-800 self-start md:self-auto shadow-md">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
          </span>
          Sincronização Ativa (Realtime)
        </div>
      </div>

      {/* KPI Cards Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card: Total */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800/80 shadow-md flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Geral</span>
            <h3 className="text-3xl font-black text-slate-100 tracking-tight font-mono">{stats.total}</h3>
            <p className="text-xxs text-slate-500 font-bold">Autos registrados</p>
          </div>
          <div className="bg-slate-900 p-3 rounded-xl text-amber-400 border border-slate-800">
            <FileText size={22} className="stroke-[2.5]" />
          </div>
        </div>

        {/* Card: Hoje */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-amber-500/30 shadow-md flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
          <div className="space-y-1 relative z-10">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">Hoje</span>
            <h3 className="text-3xl font-black text-amber-400 tracking-tight font-mono">{stats.today}</h3>
            <p className="text-xxs text-amber-400/80 font-bold">Novos hoje</p>
          </div>
          <div className="bg-amber-500/15 p-3 rounded-xl text-amber-400 border border-amber-500/30 relative z-10">
            <Clock size={22} className="stroke-[2.5]" />
          </div>
        </div>

        {/* Card: Semana */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800/80 shadow-md flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Semana</span>
            <h3 className="text-3xl font-black text-slate-100 tracking-tight font-mono">{stats.week}</h3>
            <p className="text-xxs text-slate-500 font-bold">Últimos 7 dias</p>
          </div>
          <div className="bg-slate-900 p-3 rounded-xl text-slate-300 border border-slate-800">
            <Calendar size={22} className="stroke-[2.5]" />
          </div>
        </div>

        {/* Card: Mês */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800/80 shadow-md flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Mês Atual</span>
            <h3 className="text-3xl font-black text-slate-100 tracking-tight font-mono">{stats.month}</h3>
            <p className="text-xxs text-slate-500 font-bold">Acumulado do mês</p>
          </div>
          <div className="bg-slate-900 p-3 rounded-xl text-emerald-400 border border-slate-800">
            <CheckCircle size={22} className="stroke-[2.5]" />
          </div>
        </div>

        {/* Card: Ano */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800/80 shadow-md flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Ano Atual</span>
            <h3 className="text-3xl font-black text-slate-100 tracking-tight font-mono">{stats.year}</h3>
            <p className="text-xxs text-slate-500 font-bold">Acumulado do ano</p>
          </div>
          <div className="bg-slate-900 p-3 rounded-xl text-blue-400 border border-slate-800">
            <TrendingUp size={22} className="stroke-[2.5]" />
          </div>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart: Evolution of AITs (Last 7 Days) */}
        <div className="lg:col-span-2 bg-slate-950 p-5 rounded-2xl border border-slate-800/80 shadow-md flex flex-col h-[360px]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-100">Evolução de Registro</h2>
              <p className="text-xs font-medium text-slate-400">Volume de autuações nos últimos 7 dias</p>
            </div>
            <div className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">AIT / Dia</div>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartDataOverTime} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTickets" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis dataKey="dateStr" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#020617', borderRadius: '12px', border: '1px solid #334155', color: '#f8fafc' }}
                  labelStyle={{ fontWeight: 'bold', fontSize: '11px', color: '#fbbf24' }}
                  itemStyle={{ fontSize: '13px' }}
                />
                <Area type="monotone" dataKey="Autos Registrados" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorTickets)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart: Nature of Infractions */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800/80 shadow-md flex flex-col h-[360px]">
          <div>
            <h2 className="text-base font-bold text-slate-100">Distribuição por Natureza</h2>
            <p className="text-xs font-medium text-slate-400">Classificação legal das penalidades aplicadas</p>
          </div>
          <div className="flex-1 flex items-center justify-center min-h-0 relative">
            {natureData.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono">Sem dados para exibir</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={natureData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {natureData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#020617', borderRadius: '12px', border: '1px solid #334155', color: '#f8fafc', fontSize: '12px' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    iconSize={10} 
                    iconType="circle"
                    formatter={(value) => <span className="text-xs font-medium text-slate-300 font-sans">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Stats Lists & Rankings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Top Infractions */}
        <div className="lg:col-span-2 bg-slate-950 p-5 rounded-2xl border border-slate-800/80 shadow-md space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-400 stroke-[2.5]" />
              Ranking de Infrações Recorrentes
            </h2>
            <p className="text-xs font-medium text-slate-400">Os 5 enquadramentos mais autuados pelos agentes em campo</p>
          </div>
          
          <div className="space-y-4 pt-1">
            {infractionRankings.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-sm">Nenhuma infração registrada no período.</div>
            ) : (
              infractionRankings.map((inf, idx) => {
                const percentage = stats.total > 0 ? (inf.count / stats.total) * 100 : 0;
                
                return (
                  <div key={`inf-rank-${inf.code}-${idx}`} className="space-y-1.5">
                    <div className="flex items-start justify-between text-xs gap-3">
                      <div className="font-semibold text-slate-200 min-w-0 flex-1">
                        <span className="font-mono bg-amber-500/20 px-2 py-0.5 rounded text-xxs text-amber-400 font-black mr-2 border border-amber-500/30">{inf.code}</span>
                        {inf.desc}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-black text-slate-100 font-mono">{inf.count} AITs</span>
                        <span className="text-slate-400 text-xxs ml-2 font-mono">({percentage.toFixed(0)}%)</span>
                      </div>
                    </div>
                    <div className="relative w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          inf.nature === 'Gravíssima' ? 'bg-rose-500' :
                          inf.nature === 'Grave' ? 'bg-amber-500' :
                          inf.nature === 'Média' ? 'bg-amber-400' : 'bg-slate-400'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Leaderboard of active agents */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800/80 shadow-md space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Award size={18} className="text-amber-400 stroke-[2.5]" />
              Produtividade dos Agentes
            </h2>
            <p className="text-xs font-medium text-slate-400">Classificação por quantidade de autuações</p>
          </div>

          <div className="divide-y divide-slate-900">
            {agentRankings.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-sm">Nenhum agente registrou autuações ainda.</div>
            ) : (
              agentRankings.map((agent, index) => {
                const badgeColors = [
                  'bg-amber-500 text-slate-950 font-black', 
                  'bg-slate-700 text-white', 
                  'bg-slate-800 text-slate-300', 
                  'bg-slate-800 text-slate-400', 
                  'bg-slate-900 text-slate-500'
                ];

                return (
                  <div key={`agent-rank-${agent.name}-${index}`} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Rank badge */}
                      <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xxs font-black font-mono shrink-0 ${badgeColors[index] || 'bg-slate-900'}`}>
                        {index + 1}
                      </span>
                      {/* Avatar initial bubble */}
                      <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center font-black text-xs text-amber-400 tracking-wider shrink-0">
                        {agent.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-200 truncate">{agent.name}</h4>
                        <p className="text-xxs text-slate-400 font-mono">
                          Multas: R$ {agent.fineSum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <span className="text-xs font-black font-mono bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-lg border border-amber-500/30">
                        {agent.count}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Chart: Tickets by Vehicle Type */}
      <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800/80 shadow-md flex flex-col h-[340px]">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Car size={18} className="text-amber-400 stroke-[2.5]" />
            Autuações por Tipo de Veículo
          </h2>
          <p className="text-xs font-medium text-slate-400 font-sans">Proporção de infrações registradas por modalidade de transporte</p>
        </div>
        <div className="flex-1 min-h-0 pt-4">
          {vehicleTypeData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">Nenhum registro para mapear.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vehicleTypeData.slice(0, 8)} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip 
                  cursor={{ fill: '#0f172a' }}
                  contentStyle={{ backgroundColor: '#020617', borderRadius: '12px', border: '1px solid #334155', color: '#f8fafc', fontSize: '12px' }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={45}>
                  {vehicleTypeData.slice(0, 8).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

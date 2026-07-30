/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  FileText, 
  Calendar, 
  MapPin, 
  Tag, 
  User, 
  Eye, 
  Edit2, 
  Trash2, 
  X, 
  Info, 
  AlertCircle, 
  Check, 
  Download,
  AlertTriangle,
  Clock,
  Car,
  Layers
} from 'lucide-react';
import { TrafficTicket, UserProfile, UserRole, InfractionType } from '../types';
import { dbService } from '../lib/supabase';

interface TicketListViewProps {
  user: UserProfile;
  tickets: TrafficTicket[];
  infractions: InfractionType[];
  onReloadNeeded: () => void;
}

export default function TicketListView({ user, tickets, infractions, onReloadNeeded }: TicketListViewProps) {
  // 1. Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlate, setFilterPlate] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const [filterVehicleType, setFilterVehicleType] = useState('');
  const [filterNature, setFilterNature] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest, value-desc, value-asc
  const [showFilters, setShowFilters] = useState(false);

  // 2. Active Selected Ticket Detail Modal State
  const [selectedTicket, setSelectedTicket] = useState<TrafficTicket | null>(null);
  
  // 3. Edit Ticket Modal State
  const [editingTicket, setEditingTicket] = useState<TrafficTicket | null>(null);
  const [editLocation, setEditLocation] = useState('');
  const [editPlate, setEditPlate] = useState('');
  const [editVehicleType, setEditVehicleType] = useState('');
  const [editObservations, setEditObservations] = useState('');
  const [editInfractionCode, setEditInfractionCode] = useState('');
  
  // UI states
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // List of unique agents present in the current tickets for the agent filter
  const uniqueAgents = useMemo(() => {
    const agentsMap = new Map<string, string>();
    tickets.forEach(t => agentsMap.set(t.agentId, t.agentName));
    return Array.from(agentsMap.entries()).map(([id, name]) => ({ id, name }));
  }, [tickets]);

  // List of unique vehicle types for dropdowns
  const VEHICLE_TYPES = [
    'Automóvel',
    'Motocicleta',
    'Caminhonete',
    'Caminhão',
    'Ônibus',
    'Micro-ônibus',
    'Reboque',
    'Semirreboque',
    'Trator',
    'Ciclomotor',
    'Bicicleta',
    'Outro'
  ];

  // 4. Apply Filters & Sorting
  const filteredTickets = useMemo(() => {
    let result = [...tickets];

    // Search by AIT number or general text
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      result = result.filter(t => 
        t.aitNumber.toLowerCase().includes(term) ||
        t.infractionDescription.toLowerCase().includes(term) ||
        t.location.toLowerCase().includes(term)
      );
    }

    // Filter by Plate
    if (filterPlate.trim() !== '') {
      const p = filterPlate.toUpperCase();
      result = result.filter(t => t.plate.includes(p));
    }

    // Filter by Date
    if (filterDate !== '') {
      result = result.filter(t => (t.infractionDate || '').substring(0, 10) === filterDate);
    }

    // Filter by Agent
    if (filterAgent !== '') {
      result = result.filter(t => t.agentId === filterAgent);
    }

    // Filter by Vehicle Type
    if (filterVehicleType !== '') {
      result = result.filter(t => t.vehicleType === filterVehicleType);
    }

    // Filter by Nature
    if (filterNature !== '') {
      result = result.filter(t => t.nature === filterNature);
    }

    // Sorting logic
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === 'value-desc') {
        return b.fineValue - a.fineValue;
      }
      if (sortBy === 'value-asc') {
        return a.fineValue - b.fineValue;
      }
      return 0;
    });

    return result;
  }, [tickets, searchTerm, filterPlate, filterDate, filterAgent, filterVehicleType, filterNature, sortBy]);

  // 5. Delete Action Handler
  const handleDelete = async (id: string) => {
    if (user.role !== UserRole.ADMIN) {
      alert('Apenas administradores podem excluir Autos de Infração.');
      return;
    }
    
    if (!confirm('Deseja realmente excluir permanentemente este Auto de Infração (AIT)? Esta ação é irreversível.')) {
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    try {
      const { success, error } = await dbService.deleteTicket(id);
      if (error) throw new Error(error);
      
      // Close detail view if open
      if (selectedTicket?.id === id) {
        setSelectedTicket(null);
      }
      onReloadNeeded();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao deletar auto.');
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Inline Edit Action Handlers
  const handleStartEdit = (ticket: TrafficTicket) => {
    // Permission check
    // Admin can edit any. Agent can edit ONLY theirs
    const isOwner = ticket.agentId === user.id;
    const canEdit = user.role === UserRole.ADMIN || isOwner;

    if (!canEdit) {
      alert('Você não possui permissão para editar este Auto de Infração.');
      return;
    }

    setEditingTicket(ticket);
    setEditLocation(ticket.location);
    setEditPlate(ticket.plate);
    setEditVehicleType(ticket.vehicleType);
    setEditObservations(ticket.observations || '');
    setEditInfractionCode(ticket.infractionCode);
    setErrorMessage(null);
  };

  const handleSaveEdit = async () => {
    if (!editingTicket) return;

    if (!editPlate.trim() || editPlate.length < 7) {
      setErrorMessage('Digite uma placa válida com pelo menos 7 caracteres.');
      return;
    }
    if (!editLocation.trim()) {
      setErrorMessage('O local da infração é obrigatório.');
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);

    try {
      const updateData: Partial<TrafficTicket> = {
        plate: editPlate.trim().toUpperCase(),
        location: editLocation.trim(),
        vehicleType: editVehicleType,
        observations: editObservations.trim() || undefined
      };

      // If infraction code changed, load corresponding infraction details
      if (editInfractionCode !== editingTicket.infractionCode) {
        const matchingInfrac = infractions.find(inf => inf.code === editInfractionCode);
        if (matchingInfrac) {
          updateData.infractionCode = matchingInfrac.code;
          updateData.infractionDescription = matchingInfrac.description;
          updateData.framing = matchingInfrac.framing;
          updateData.article = matchingInfrac.article;
          updateData.nature = matchingInfrac.nature;
          updateData.fineValue = matchingInfrac.fineValue;
          updateData.score = matchingInfrac.score;
          updateData.adminMeasure = matchingInfrac.adminMeasure;
        }
      }

      const { data, error } = await dbService.updateTicket(editingTicket.id, updateData);
      if (error) throw new Error(error);

      setEditingTicket(null);
      // Update selected ticket in view if it was opened
      if (selectedTicket?.id === editingTicket.id && data) {
        setSelectedTicket(data);
      }
      onReloadNeeded();
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao atualizar o auto de infração.');
    } finally {
      setActionLoading(false);
    }
  };

  // Helper: Export current filtered ticket list to a simple printable view
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6" id="tickets-list-container">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Consulta de Autos de Infração</h1>
          <p className="text-sm text-slate-500">Consulte, pesquise, edite e exporte os Autos de Infração de Trânsito cadastrados.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="btn-print"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 shadow-sm transition-all cursor-pointer"
          >
            <Download size={15} />
            Imprimir Relatório
          </button>
        </div>
      </div>

      {/* SEARCH AND FILTERS TOOLBAR */}
      <div className="bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Main Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              id="search-main"
              type="text"
              placeholder="Pesquisar por AIT, descrição da multa ou local..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 text-slate-800 font-semibold transition-all"
            />
          </div>

          {/* Quick sorting dropdown */}
          <div className="flex gap-2">
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3.5 py-2.5 bg-white border-2 border-slate-200 text-slate-700 text-xs font-bold rounded-xl focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500"
            >
              <option value="newest">Mais Recentes</option>
              <option value="oldest">Mais Antigos</option>
              <option value="value-desc">Maior Valor</option>
              <option value="value-asc">Menor Valor</option>
            </select>

            {/* Toggle Advanced Filters Button */}
            <button
              id="btn-toggle-filters"
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl border-2 transition-all cursor-pointer ${
                showFilters 
                  ? 'bg-amber-500 border-amber-500 text-slate-950' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Filter size={15} />
              Filtros Avançados
            </button>
          </div>
        </div>

        {/* ADVANCED FILTER DRAWER */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t border-slate-100 animate-fade-in text-slate-700">
            {/* Filter: Plate */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Filtrar Placa</label>
              <input
                id="filter-plate"
                type="text"
                placeholder="Ex: ABC-1234"
                value={filterPlate}
                onChange={(e) => setFilterPlate(e.target.value.toUpperCase())}
                className="w-full px-3 py-2.5 bg-slate-50 border-2 border-slate-200 text-xs rounded-xl font-bold uppercase tracking-wider focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Filter: Date */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Filtrar Data</label>
              <input
                id="filter-date"
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border-2 border-slate-200 text-xs rounded-xl font-bold focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Filter: Agent */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Filtrar Agente</label>
              <select
                id="filter-agent"
                value={filterAgent}
                onChange={(e) => setFilterAgent(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border-2 border-slate-200 text-xs rounded-xl font-bold focus:outline-none focus:border-amber-500"
              >
                <option value="">Todos</option>
                {uniqueAgents.map(ag => (
                  <option key={ag.id} value={ag.id}>{ag.name}</option>
                ))}
              </select>
            </div>

            {/* Filter: Vehicle Type */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Tipo de Veículo</label>
              <select
                id="filter-vehicle-type"
                value={filterVehicleType}
                onChange={(e) => setFilterVehicleType(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border-2 border-slate-200 text-xs rounded-xl font-bold focus:outline-none focus:border-amber-500"
              >
                <option value="">Todos</option>
                {VEHICLE_TYPES.map(vt => (
                  <option key={vt} value={vt}>{vt}</option>
                ))}
              </select>
            </div>

            {/* Filter: Nature */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Gravidade</label>
              <select
                id="filter-nature"
                value={filterNature}
                onChange={(e) => setFilterNature(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border-2 border-slate-200 text-xs rounded-xl font-bold focus:outline-none focus:border-amber-500"
              >
                <option value="">Todas</option>
                <option value="Leve">Leve</option>
                <option value="Média">Média</option>
                <option value="Grave">Grave</option>
                <option value="Gravíssima">Gravíssima</option>
              </select>
            </div>

            {/* Clear filters trigger */}
            <div className="sm:col-span-2 md:col-span-5 flex justify-end gap-2 pt-1">
              <button
                id="btn-clear-filters"
                onClick={() => {
                  setFilterPlate('');
                  setFilterDate('');
                  setFilterAgent('');
                  setFilterVehicleType('');
                  setFilterNature('');
                  setSearchTerm('');
                }}
                className="text-xxs font-black text-amber-600 hover:text-amber-700 underline uppercase cursor-pointer"
              >
                Limpar Todos os Filtros
              </button>
            </div>
          </div>
        )}
      </div>

      {/* TICKETS RESPONSIVE TABLE / MOBILE CARDS GRID */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredTickets.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <FileText size={40} className="mx-auto text-slate-300" />
            <h3 className="text-sm font-semibold text-slate-700">Nenhum Auto de Infração encontrado</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">Tente alterar os termos de pesquisa ou remover os filtros aplicados para listar os registros.</p>
          </div>
        ) : (
          <div>
            {/* MOBILE CARDS VIEW (md:hidden) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {filteredTickets.map((ticket) => {
                const isAuthoredByMe = ticket.agentId === user.id;
                const canEdit = user.role === UserRole.ADMIN || isAuthoredByMe;

                return (
                  <div key={ticket.id} className="p-4 hover:bg-slate-50/60 transition-colors space-y-3 text-slate-800">
                    {/* Header line: AIT number & Nature Badge */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-extrabold text-sm text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          {ticket.aitNumber}
                        </span>
                        <span className="text-xxs font-mono text-slate-400">
                          {new Date(ticket.infractionDate + 'T00:00:00').toLocaleDateString('pt-BR')} às {ticket.infractionTime}
                        </span>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        ticket.nature === 'Gravíssima' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        ticket.nature === 'Grave' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        ticket.nature === 'Média' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                        'bg-slate-50 text-slate-600 border border-slate-200'
                      }`}>
                        {ticket.nature}
                      </span>
                    </div>

                    {/* Middle info: Plate, Vehicle, Location */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                      <div>
                        <span className="text-[9px] font-black uppercase text-slate-400 block">Placa / Veículo</span>
                        <div className="font-mono font-extrabold text-slate-900 tracking-wider uppercase mt-0.5">
                          {ticket.plate} <span className="text-[10px] font-sans font-semibold text-slate-500 lowercase">({ticket.vehicleType})</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase text-slate-400 block">Valor Multa</span>
                        <div className="font-mono font-black text-amber-600 mt-0.5">
                          R$ {ticket.fineValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div className="col-span-2 border-t border-slate-200/60 pt-1.5 mt-0.5">
                        <span className="text-[9px] font-black uppercase text-slate-400 block">Local</span>
                        <p className="text-xs font-semibold text-slate-700 truncate">{ticket.location}</p>
                      </div>
                    </div>

                    {/* Description & Code */}
                    <div className="text-xs space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono bg-amber-500/10 text-amber-700 px-1.5 py-0.5 rounded text-xxs font-black">
                          {ticket.infractionCode}
                        </span>
                        <span className="text-xxs font-bold text-slate-500 font-mono">Art. {ticket.article}</span>
                      </div>
                      <p className="text-xs text-slate-600 font-medium line-clamp-2 leading-tight">
                        {ticket.infractionDescription}
                      </p>
                    </div>

                    {/* Action buttons bar */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-[10px] text-slate-400 font-mono">
                        Agente: <b className="text-slate-600">{ticket.agentName}</b>
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          id={`btn-view-mob-${ticket.id}`}
                          onClick={() => setSelectedTicket(ticket)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                        >
                          <Eye size={14} />
                          <span>Ver</span>
                        </button>

                        <button
                          id={`btn-edit-mob-${ticket.id}`}
                          onClick={() => handleStartEdit(ticket)}
                          disabled={!canEdit}
                          className={`p-2 rounded-lg transition-colors cursor-pointer ${
                            canEdit 
                              ? 'bg-amber-500/10 text-amber-700 hover:bg-amber-500/20' 
                              : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                          }`}
                          title="Editar Auto"
                        >
                          <Edit2 size={14} />
                        </button>

                        {user.role === UserRole.ADMIN && (
                          <button
                            id={`btn-delete-mob-${ticket.id}`}
                            onClick={() => handleDelete(ticket.id)}
                            className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                            title="Excluir Auto"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP TABLE VIEW (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-slate-700">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100 text-xxs font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-4 px-5">AIT</th>
                    <th className="py-4 px-5">Data/Hora</th>
                    <th className="py-4 px-5">Placa</th>
                    <th className="py-4 px-5">Local</th>
                    <th className="py-4 px-5">Código/Multa</th>
                    <th className="py-4 px-5">Gravidade</th>
                    <th className="py-4 px-5">Valor</th>
                    <th className="py-4 px-5 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredTickets.map((ticket) => {
                    const isAuthoredByMe = ticket.agentId === user.id;
                    const canEdit = user.role === UserRole.ADMIN || isAuthoredByMe;

                    return (
                      <tr key={ticket.id} className="hover:bg-slate-50/40 transition-colors">
                        {/* AIT Number */}
                        <td className="py-4 px-5 font-mono font-bold text-slate-800">
                          {ticket.aitNumber}
                        </td>

                        {/* Date / Time */}
                        <td className="py-4 px-5 whitespace-nowrap">
                          <div className="font-semibold text-slate-700">
                            {new Date(ticket.infractionDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </div>
                          <div className="text-xxs text-slate-400 font-mono mt-0.5">{ticket.infractionTime}</div>
                        </td>

                        {/* Plate */}
                        <td className="py-4 px-5 whitespace-nowrap font-mono font-bold tracking-wider text-slate-700 uppercase">
                          {ticket.plate}
                        </td>

                        {/* Location */}
                        <td className="py-4 px-5 max-w-xs truncate text-slate-500" title={ticket.location}>
                          {ticket.location}
                        </td>

                        {/* Code / Description */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="font-mono bg-slate-100 text-slate-600 px-1 py-0.5 rounded text-xxs font-bold">{ticket.infractionCode}</span>
                            {((ticket.additionalInfractions && ticket.additionalInfractions.length > 0) || (ticket.infractions && ticket.infractions.length > 1)) && (
                              <span className="bg-amber-500/10 text-amber-700 font-bold text-[9px] px-1.5 py-0.5 rounded font-mono border border-amber-500/20">
                                +{ticket.additionalInfractions?.length || ((ticket.infractions?.length || 1) - 1)}
                              </span>
                            )}
                          </div>
                          <span className="text-slate-500 text-xxs truncate inline-block max-w-[140px] align-middle mt-0.5" title={ticket.infractionDescription}>
                            {ticket.infractionDescription}
                          </span>
                        </td>

                        {/* Nature / Points */}
                        <td className="py-4 px-5 whitespace-nowrap">
                          <span className={`inline-block text-xxs font-black uppercase px-2 py-0.5 rounded-full ${
                            ticket.nature === 'Gravíssima' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                            ticket.nature === 'Grave' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            ticket.nature === 'Média' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                            'bg-slate-50 text-slate-600 border border-slate-200'
                          }`}>
                            {ticket.nature}
                          </span>
                        </td>

                        {/* Fine Value */}
                        <td className="py-4 px-5 font-mono font-extrabold text-slate-800">
                          R$ {ticket.fineValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Inspect button */}
                            <button
                              id={`btn-view-${ticket.id}`}
                              onClick={() => setSelectedTicket(ticket)}
                              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                              title="Visualizar Auto de Infração"
                            >
                              <Eye size={15} />
                            </button>

                            {/* Edit button */}
                            <button
                              id={`btn-edit-${ticket.id}`}
                              onClick={() => handleStartEdit(ticket)}
                              disabled={!canEdit}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                canEdit 
                                  ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' 
                                  : 'text-slate-200 cursor-not-allowed'
                              }`}
                              title={canEdit ? "Editar Auto" : "Sem permissão para editar"}
                            >
                              <Edit2 size={15} />
                            </button>

                            {/* Delete button (Only Admin) */}
                            <button
                              id={`btn-delete-${ticket.id}`}
                              onClick={() => handleDelete(ticket.id)}
                              disabled={user.role !== UserRole.ADMIN}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                user.role === UserRole.ADMIN 
                                  ? 'text-slate-400 hover:text-red-600 hover:bg-red-50' 
                                  : 'text-slate-200 cursor-not-allowed'
                              }`}
                              title={user.role === UserRole.ADMIN ? "Excluir Auto" : "Apenas administradores podem excluir"}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* DETAIL MODAL OVERLAY */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-slate-700">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="text-amber-500" size={20} />
                <h3 className="font-bold text-base text-slate-800">Auto de Infração: {selectedTicket.aitNumber}</h3>
              </div>
              <button 
                id="btn-close-detail"
                onClick={() => setSelectedTicket(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1 text-sm">
              {/* Top summary box */}
              <div className="bg-slate-50 p-4 rounded-xl border-2 border-slate-200 grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <span className="text-xxs font-bold text-slate-400 uppercase tracking-wider block">Data</span>
                  <span className="font-bold text-slate-700 block mt-0.5">
                    {new Date(selectedTicket.infractionDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div>
                  <span className="text-xxs font-bold text-slate-400 uppercase tracking-wider block">Horário</span>
                  <span className="font-bold text-slate-700 block mt-0.5 font-mono">{selectedTicket.infractionTime}</span>
                </div>
                <div>
                  <span className="text-xxs font-bold text-slate-400 uppercase tracking-wider block">Placa</span>
                  <span className="font-mono font-bold text-slate-700 uppercase block mt-0.5 tracking-wider">{selectedTicket.plate}</span>
                </div>
                <div>
                  <span className="text-xxs font-bold text-slate-400 uppercase tracking-wider block">Tipo de Veículo</span>
                  <span className="font-bold text-slate-700 block mt-0.5">{selectedTicket.vehicleType}</span>
                </div>
                <div>
                  <span className="text-xxs font-bold text-slate-400 uppercase tracking-wider block">Constatação</span>
                  <span className="font-bold text-amber-700 block mt-0.5">{selectedTicket.detectionType || 'In Loco'}</span>
                </div>
              </div>

              {/* Physical Location */}
              <div className="space-y-1">
                <span className="text-xxs font-bold text-slate-400 uppercase tracking-wider block">Local do Fato</span>
                <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <MapPin size={16} className="text-amber-500 shrink-0" />
                  <span className="text-slate-700 font-medium">{selectedTicket.location}</span>
                </div>
              </div>

              {/* Legal Framing Box / Multi-Infractions */}
              {(() => {
                const list = (selectedTicket.infractions && selectedTicket.infractions.length > 0)
                  ? selectedTicket.infractions
                  : [
                      {
                        code: selectedTicket.infractionCode,
                        description: selectedTicket.infractionDescription,
                        framing: selectedTicket.framing,
                        article: selectedTicket.article,
                        nature: selectedTicket.nature,
                        fineValue: selectedTicket.fineValue,
                        score: selectedTicket.score,
                        adminMeasure: selectedTicket.adminMeasure
                      },
                      ...(selectedTicket.additionalInfractions || [])
                    ];

                return (
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <Layers size={14} className="text-amber-500" />
                      Enquadramento Legal ({list.length} {list.length === 1 ? 'Infração Registrada' : 'Infrações Registradas'})
                    </span>

                    {list.map((inf, idx) => (
                      <div key={`${inf.code}-${idx}`} className="border-2 border-slate-950 bg-slate-900 text-slate-100 p-4 rounded-2xl space-y-3 shadow-sm">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                          <span className={`text-[10px] font-black uppercase font-mono px-2 py-0.5 rounded-md ${
                            idx === 0 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-amber-400 border border-slate-700'
                          }`}>
                            {idx === 0 ? '1ª Infração (Principal)' : `${idx + 1}ª Infração (Adicional)`}
                          </span>
                          <span className="font-mono font-extrabold text-amber-400 text-xs bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                            {inf.code}
                          </span>
                        </div>

                        <div>
                          <span className="text-xxs font-bold text-amber-400 uppercase tracking-wider block">Descrição</span>
                          <span className="font-bold text-white block text-xs mt-0.5 leading-relaxed">
                            {inf.description}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-slate-800 pt-2 text-xxs">
                          <div>
                            <span className="text-amber-400 font-bold uppercase block">Enquadramento</span>
                            <span className="font-mono font-bold text-slate-300">{inf.framing}</span>
                          </div>
                          <div>
                            <span className="text-amber-400 font-bold uppercase block">Artigo CTB</span>
                            <span className="font-bold text-slate-300">Art. {inf.article}</span>
                          </div>
                          <div>
                            <span className="text-amber-400 font-bold uppercase block">Pontuação</span>
                            <span className="font-bold text-slate-300">{inf.score} pontos</span>
                          </div>
                          <div>
                            <span className="text-amber-400 font-bold uppercase block">Natureza</span>
                            <div>
                              <span className={`inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                                inf.nature === 'Gravíssima' ? 'bg-rose-500 text-white' :
                                inf.nature === 'Grave' ? 'bg-amber-500 text-slate-950' :
                                inf.nature === 'Média' ? 'bg-amber-400 text-slate-950' :
                                'bg-slate-700 text-white'
                              }`}>
                                {inf.nature}
                              </span>
                            </div>
                          </div>
                          <div>
                            <span className="text-amber-400 font-bold uppercase block">Valor da Multa</span>
                            <span className="font-mono font-extrabold text-white">
                              R$ {inf.fineValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        {inf.adminMeasure && (
                          <div className="border-t border-slate-800 pt-2 text-xxs text-slate-300">
                            <span className="text-amber-400 font-bold uppercase mr-1">Medida Adm:</span>
                            {inf.adminMeasure}
                          </div>
                        )}
                      </div>
                    ))}

                    {list.length > 1 && (
                      <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl flex items-center justify-between font-mono text-xs text-slate-900 font-bold">
                        <span>Total Consolidado ({list.length} infrações):</span>
                        <div className="flex gap-4">
                          <span>{selectedTicket.score} PONTOS</span>
                          <span className="text-amber-700 font-extrabold">
                            R$ {selectedTicket.fineValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Observations */}
              <div className="space-y-1">
                <span className="text-xxs font-bold text-slate-400 uppercase tracking-wider block">Observações do Agente</span>
                <p className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-slate-600 text-xs italic leading-relaxed">
                  {selectedTicket.observations || 'Nenhuma observação inserida.'}
                </p>
              </div>

              {/* Photos Evidence */}
              <div className="space-y-1.5">
                <span className="text-xxs font-bold text-slate-400 uppercase tracking-wider block">Fotografias Comprobatórias</span>
                {selectedTicket.photos.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Nenhum registro fotográfico anexado.</p>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {selectedTicket.photos.map((url, idx) => (
                      <a 
                        key={idx} 
                        href={url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="relative w-32 h-32 rounded-xl overflow-hidden border border-slate-200 hover:scale-[1.03] transition-transform shadow-xs block"
                      >
                        <img referrerPolicy="no-referrer" src={url} alt={`Evidência ${idx + 1}`} className="w-full h-full object-cover" />
                        <span className="absolute bottom-1 right-1 bg-black/60 text-white text-xxs px-1.5 py-0.5 rounded font-mono">Zoom 🔍</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Agent Audit Footer */}
              <div className="border-t border-slate-100 pt-4 flex items-center justify-between text-xxs text-slate-400 font-mono">
                <span>Registrado por: <b>{selectedTicket.agentName}</b> (ID: {selectedTicket.agentId})</span>
                <span>Inserção: {new Date(selectedTicket.createdAt).toLocaleString('pt-BR')}</span>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
              <button 
                id="btn-close-modal-footer"
                onClick={() => setSelectedTicket(null)}
                className="px-5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL OVERLAY */}
      {editingTicket && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-slate-700">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2 text-amber-600">
                <Edit2 size={18} />
                <h3 className="font-bold text-base text-slate-800">Editar Auto: {editingTicket.aitNumber}</h3>
              </div>
              <button 
                id="btn-close-edit"
                onClick={() => setEditingTicket(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {errorMessage && (
                <div className="bg-rose-50 text-rose-800 border border-rose-200 p-3 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle size={15} />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Informational banner */}
              <div className="bg-amber-50 text-amber-800 border border-amber-100 p-3 rounded-xl text-xxs leading-relaxed flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <p>Alterações no auto de infração são registradas no histórico. Certifique-se de realizar edições conforme os preceitos regulamentares da Superintendência.</p>
              </div>

              {/* Edit: Plate */}
              {/* Edit: Plate */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block uppercase tracking-wide">Placa do Veículo</label>
                <input
                  id="edit-plate"
                  type="text"
                  value={editPlate}
                  onChange={(e) => setEditPlate(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                  className="w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-sm font-mono font-extrabold tracking-widest uppercase focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500"
                />
              </div>

              {/* Edit: Vehicle Type */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block uppercase tracking-wide">Tipo de Veículo</label>
                <select
                  id="edit-vehicle-type"
                  value={editVehicleType}
                  onChange={(e) => setEditVehicleType(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 font-bold"
                >
                  {VEHICLE_TYPES.map(vt => (
                    <option key={vt} value={vt}>{vt}</option>
                  ))}
                </select>
              </div>

              {/* Edit: Location */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block uppercase tracking-wide">Local da Infração</label>
                <input
                  id="edit-location"
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 font-bold"
                />
              </div>

              {/* Edit: Infraction code change */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block uppercase tracking-wide">Código da Infração (Enquadramento)</label>
                <select
                  id="edit-infraction-code"
                  value={editInfractionCode}
                  onChange={(e) => setEditInfractionCode(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 font-mono text-slate-700 font-bold"
                >
                  {infractions.map(inf => (
                    <option key={inf.code} value={inf.code}>{inf.code} - {inf.description.substring(0, 50)}...</option>
                  ))}
                </select>
              </div>

              {/* Edit: Observations */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block uppercase tracking-wide">Observações adicionais</label>
                <textarea
                  id="edit-observations"
                  rows={3}
                  value={editObservations}
                  onChange={(e) => setEditObservations(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 font-bold"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
              <button
                id="btn-cancel-edit-modal"
                onClick={() => setEditingTicket(null)}
                className="px-4 py-2 rounded-xl border-2 border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                id="btn-save-edit-modal"
                onClick={handleSaveEdit}
                disabled={actionLoading}
                className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-black hover:bg-amber-600 disabled:bg-slate-300 disabled:text-slate-500 flex items-center gap-1 shadow-xs cursor-pointer"
              >
                {actionLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check size={14} className="stroke-[2.5]" />
                    Salvar Alterações
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

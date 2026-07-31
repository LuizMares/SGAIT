/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FilePlus, 
  MapPin, 
  Tag, 
  FileText, 
  Camera, 
  Trash2, 
  Info, 
  Calendar, 
  Clock, 
  CheckCircle,
  AlertCircle,
  Navigation,
  Video,
  Eye,
  Loader2,
  Layers,
  Plus,
  Save,
  RotateCcw
} from 'lucide-react';
import { TrafficTicket, InfractionType, UserProfile } from '../types';
import { dbService, safeStorage } from '../lib/supabase';

interface TicketFormViewProps {
  user: UserProfile;
  infractions: InfractionType[];
  onSuccessSubmit: () => void;
}

export default function TicketFormView({ user, infractions, onSuccessSubmit }: TicketFormViewProps) {
  // 1. Prefilled & Automatically generated values
  const [aitNumber, setAitNumber] = useState('');
  
  // 2. Form state fields
  const [detectionType, setDetectionType] = useState<'In Loco' | 'Videomonitoramento'>('In Loco');
  const [infractionDate, setInfractionDate] = useState('');
  const [infractionTime, setInfractionTime] = useState('');
  const [location, setLocation] = useState('');
  const [plate, setPlate] = useState('');
  const [vehicleType, setVehicleType] = useState('Automóvel');
  
  // Multi-infraction state
  const [selectedInfractions, setSelectedInfractions] = useState<InfractionType[]>([]);
  
  const [observations, setObservations] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  
  // UI states
  const [isLoading, setIsLoading] = useState(false);
  const [isGettingGps, setIsGettingGps] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Searchable infraction states
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredInfractions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return infractions;
    return infractions.filter(inf => 
      inf.code.toLowerCase().includes(q) || 
      inf.description.toLowerCase().includes(q) ||
      inf.framing.toLowerCase().includes(q)
    );
  }, [searchQuery, infractions]);

  // Draft persistence states
  const [isDraftRestored, setIsDraftRestored] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  const draftKey = useMemo(() => `sgait_ait_draft_${user?.id || 'default'}`, [user?.id]);

  // Function to initialize clean default form values
  const initFreshForm = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(100000 + Math.random() * 900000);
    setAitNumber(`AIT${year}${random}`);

    const now = new Date();
    const localYear = now.getFullYear();
    const localMonth = String(now.getMonth() + 1).padStart(2, '0');
    const localDay = String(now.getDate()).padStart(2, '0');
    const localDate = `${localYear}-${localMonth}-${localDay}`;
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    setDetectionType('In Loco');
    setInfractionDate(localDate);
    setInfractionTime(`${hours}:${minutes}`);
    setLocation('');
    setPlate('');
    setVehicleType('Automóvel');
    setSelectedInfractions([]);
    setObservations('');
    setPhotoUrls([]);
    setIsDraftRestored(false);
    setDraftSavedAt(null);
  };

  // Check for saved draft on mount & restore automatically if present
  useEffect(() => {
    const savedDraft = safeStorage.getItem(draftKey);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (parsed && typeof parsed === 'object') {
          let hasMeaningfulContent = false;
          if (parsed.aitNumber) setAitNumber(parsed.aitNumber);
          if (parsed.detectionType) setDetectionType(parsed.detectionType);
          if (parsed.infractionDate) setInfractionDate(parsed.infractionDate);
          if (parsed.infractionTime) setInfractionTime(parsed.infractionTime);
          if (parsed.location !== undefined) setLocation(parsed.location);
          if (parsed.plate !== undefined) setPlate(parsed.plate);
          if (parsed.vehicleType) setVehicleType(parsed.vehicleType);
          if (Array.isArray(parsed.selectedInfractions)) setSelectedInfractions(parsed.selectedInfractions);
          if (parsed.observations !== undefined) setObservations(parsed.observations);
          if (Array.isArray(parsed.photoUrls)) setPhotoUrls(parsed.photoUrls);

          if (parsed.updatedAt) {
            const dateObj = new Date(parsed.updatedAt);
            if (!isNaN(dateObj.getTime())) {
              setDraftSavedAt(dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
            }
          }

          if (parsed.plate || parsed.location || (parsed.selectedInfractions && parsed.selectedInfractions.length > 0) || parsed.observations || (parsed.photoUrls && parsed.photoUrls.length > 0)) {
            hasMeaningfulContent = true;
          }

          if (hasMeaningfulContent) {
            setIsDraftRestored(true);
            return;
          }
        }
      } catch (e) {
        console.warn('Erro ao restaurar rascunho de Auto de Infração:', e);
      }
    }

    // Default initialization when no draft is present
    initFreshForm();
  }, [draftKey]);

  // Auto-save draft whenever form state changes
  useEffect(() => {
    const hasContent = 
      plate.trim().length > 0 || 
      location.trim().length > 0 || 
      selectedInfractions.length > 0 || 
      observations.trim().length > 0 || 
      photoUrls.length > 0;

    if (hasContent && aitNumber) {
      const draftData = {
        aitNumber,
        detectionType,
        infractionDate,
        infractionTime,
        location,
        plate,
        vehicleType,
        selectedInfractions,
        observations,
        photoUrls,
        updatedAt: new Date().toISOString()
      };
      safeStorage.setItem(draftKey, JSON.stringify(draftData));
      const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setDraftSavedAt(nowTime);
    }
  }, [
    aitNumber,
    detectionType,
    infractionDate,
    infractionTime,
    location,
    plate,
    vehicleType,
    selectedInfractions,
    observations,
    photoUrls,
    draftKey
  ]);

  // Handler to discard current draft and reset form
  const handleDiscardDraft = () => {
    if (window.confirm('Deseja realmente descartar o rascunho salvo e limpar todos os campos do formulário?')) {
      safeStorage.removeItem(draftKey);
      initFreshForm();
      setSuccessMsg('Rascunho descartado com sucesso. Novo Auto de Infração em branco iniciado.');
      setTimeout(() => setSuccessMsg(null), 3500);
    }
  };

  // Multi-infraction handlers
  const handleAddInfraction = (inf: InfractionType) => {
    const alreadyExists = selectedInfractions.some(item => item.code === inf.code);
    if (alreadyExists) {
      setErrorMsg(`A infração código ${inf.code} já foi vinculada a este Auto.`);
      setIsDropdownOpen(false);
      return;
    }
    setSelectedInfractions(prev => [...prev, inf]);
    setSearchQuery('');
    setIsDropdownOpen(false);
    setErrorMsg(null);
  };

  const handleRemoveInfraction = (codeToRemove: string) => {
    setSelectedInfractions(prev => prev.filter(item => item.code !== codeToRemove));
  };

  // Totals calculations
  const totalFineValue = useMemo(() => {
    return selectedInfractions.reduce((sum, item) => sum + Number(item.fineValue || 0), 0);
  }, [selectedInfractions]);

  const totalScore = useMemo(() => {
    return selectedInfractions.reduce((sum, item) => sum + Number(item.score || 0), 0);
  }, [selectedInfractions]);

  // Vehicle types dropdown list
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

  // Auto-uppercase plate as the agent types
  const handlePlateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (raw.length > 7) {
      raw = raw.substring(0, 8);
    }
    setPlate(raw);
  };

  // Photo uploading handler
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setUploadingPhoto(true);
    setErrorMsg(null);
    try {
      const file = e.target.files[0];
      const { url, error } = await dbService.uploadPhoto(file);
      
      if (error) {
        throw new Error(error);
      }
      
      if (url) {
        setPhotoUrls(prev => [...prev, url]);
      }
    } catch (err: any) {
      setErrorMsg(`Erro de upload: ${err.message || 'Não foi possível carregar a imagem.'}`);
    } finally {
      setUploadingPhoto(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const removePhoto = (indexToRemove: number) => {
    setPhotoUrls(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // GPS Handler
  const handleGetGpsLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocalização (GPS) não é suportada por este navegador.');
      return;
    }

    setIsGettingGps(true);
    setErrorMsg(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const latFixed = latitude.toFixed(6);
        const lonFixed = longitude.toFixed(6);

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            { headers: { 'Accept-Language': 'pt-BR' } }
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            const road = addr.road || addr.pedestrian || addr.suburb || addr.neighbourhood || addr.city_district || '';
            const city = addr.city || addr.town || addr.municipality || 'Pojuca';
            
            let formattedAddr = '';
            if (road) {
              formattedAddr = `${road}, ${city} - BA (GPS: ${latFixed}, ${lonFixed})`;
            } else if (data.display_name) {
              formattedAddr = `${data.display_name.split(',').slice(0, 3).join(',')} (GPS: ${latFixed}, ${lonFixed})`;
            } else {
              formattedAddr = `Coordenadas GPS: ${latFixed}, ${lonFixed}`;
            }
            setLocation(formattedAddr);
          } else {
            setLocation(`Coordenadas GPS: ${latFixed}, ${lonFixed}`);
          }
        } catch (e) {
          setLocation(`Coordenadas GPS: ${latFixed}, ${lonFixed}`);
        } finally {
          setIsGettingGps(false);
        }
      },
      (err) => {
        setIsGettingGps(false);
        let msg = 'Erro ao obter localização GPS.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Permissão de GPS negada. Por favor, permita o acesso à localização no seu navegador.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'Sinal de GPS indisponível no momento.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Tempo limite esgotado ao buscar sinal GPS.';
        }
        setErrorMsg(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Form Validations
    if (!aitNumber) return setErrorMsg('Número do AIT ausente.');
    if (!infractionDate) return setErrorMsg('Selecione a data da infração.');
    if (!infractionTime) return setErrorMsg('Selecione o horário da infração.');
    if (!location.trim()) return setErrorMsg('Informe o local da infração.');
    if (!plate.trim()) return setErrorMsg('Digite a placa do veículo.');
    if (plate.length < 7) return setErrorMsg('A placa deve conter pelo menos 7 caracteres.');
    if (selectedInfractions.length === 0) return setErrorMsg('Adicione pelo menos uma infração ao Auto de Infração.');

    setIsLoading(true);

    try {
      const primary = selectedInfractions[0];
      const additional = selectedInfractions.slice(1);

      const ticketPayload = {
        aitNumber,
        infractionDate,
        infractionTime,
        location: location.trim(),
        plate: plate.trim(),
        vehicleType,
        infractionCode: primary.code,
        infractionDescription: primary.description,
        framing: primary.framing,
        article: primary.article,
        nature: primary.nature,
        fineValue: totalFineValue,
        score: totalScore,
        adminMeasure: primary.adminMeasure,
        additionalInfractions: additional,
        infractions: selectedInfractions,
        detectionType,
        observations: observations.trim() || undefined,
        photos: photoUrls,
        agentId: user.id,
        agentName: user.name
      };

      const { data, error } = await dbService.insertTicket(ticketPayload);
      if (error) {
        throw new Error(error);
      }

      // Clear persistent draft on successful submission
      safeStorage.removeItem(draftKey);

      setSuccessMsg(`Auto de Infração ${aitNumber} registrado com sucesso com ${selectedInfractions.length} infração(ões)!`);
      
      // Reset form variables to fresh state
      initFreshForm();
      setSearchQuery('');

      // Auto scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Trigger list reload
      setTimeout(() => {
        onSuccessSubmit();
      }, 1500);

    } catch (err: any) {
      setErrorMsg(err.message || 'Ocorreu um erro ao salvar o registro de trânsito.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6" id="ticket-form-container">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Lavratura de Auto de Infração (AIT)</h1>
        <p className="text-sm text-slate-500">Insira as informações registradas em campo pelo Agente Autuador para lavrar o auto de infração.</p>
      </div>

      {/* Banner de Rascunho Restaurado */}
      {isDraftRestored && (
        <div className="bg-amber-50 text-amber-950 border-2 border-amber-300/80 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-800 rounded-xl shrink-0 mt-0.5">
              <Save size={18} />
            </div>
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-amber-900">Rascunho do Auto de Infração Recuperado</h4>
              <p className="text-xs text-amber-800 mt-0.5">
                Os dados preenchidos anteriormente foram recuperados automaticamente para você continuar a lavratura sem perder informações.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDiscardDraft}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-700 bg-rose-100 hover:bg-rose-200/90 rounded-xl transition-colors border border-rose-200 shrink-0 cursor-pointer"
          >
            <Trash2 size={14} />
            Descartar Rascunho
          </button>
        </div>
      )}

      {/* Banner de status */}
      {successMsg && (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-4 rounded-xl flex items-start gap-3 shadow-sm animate-fade-in">
          <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={18} />
          <div>
            <h4 className="font-semibold text-sm">Sucesso!</h4>
            <p className="text-xs">{successMsg}</p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 text-rose-800 border border-rose-200 p-4 rounded-xl flex items-start gap-3 shadow-sm animate-fade-in">
          <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={18} />
          <div>
            <h4 className="font-semibold text-sm">Preenchimento Incompleto</h4>
            <p className="text-xs">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border-2 border-slate-200/80 shadow-xs p-6 md:p-8 space-y-8">
        
        {/* SECTION 1: HEADER & AUTO-FILLS */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-2 gap-2">
            <h3 className="text-sm font-semibold text-slate-800">1. Identificação Geral do Auto</h3>
            <div className="flex items-center gap-2">
              {draftSavedAt && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full">
                  <Save size={12} /> Salvo {draftSavedAt}
                </span>
              )}
              <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                AIT: <strong className="text-amber-600">{aitNumber}</strong>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Detection Type */}
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold text-slate-700 block uppercase tracking-wide">Forma de Constatação / Detecção</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDetectionType('In Loco')}
                  className={`py-3 px-4 rounded-xl border-2 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    detectionType === 'In Loco'
                      ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Navigation size={16} />
                  In Loco (Presencial)
                </button>
                <button
                  type="button"
                  onClick={() => setDetectionType('Videomonitoramento')}
                  className={`py-3 px-4 rounded-xl border-2 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    detectionType === 'Videomonitoramento'
                      ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Video size={16} />
                  Videomonitoramento
                </button>
              </div>
            </div>

            {/* Date */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block flex items-center gap-1.5 uppercase tracking-wide">
                <Calendar size={14} className="text-slate-500" />
                Data da Infração
              </label>
              <input 
                id="field-date"
                type="date" 
                value={infractionDate}
                onChange={(e) => setInfractionDate(e.target.value)}
                className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 text-slate-800 font-semibold shadow-xs min-h-[48px]"
                required
              />
            </div>

            {/* Time */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block flex items-center gap-1.5 uppercase tracking-wide">
                <Clock size={14} className="text-slate-500" />
                Horário
              </label>
              <input 
                id="field-time"
                type="time" 
                value={infractionTime}
                onChange={(e) => setInfractionTime(e.target.value)}
                className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 text-slate-800 font-semibold shadow-xs min-h-[48px]"
                required
              />
            </div>

            {/* Vehicle Plate */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block uppercase tracking-wide">Placa do Veículo</label>
              <input 
                id="field-plate"
                type="text" 
                placeholder="Ex: ABC1D23 ou ABC1234"
                value={plate}
                onChange={handlePlateChange}
                maxLength={8}
                className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 text-slate-800 font-extrabold tracking-wider font-mono uppercase shadow-xs min-h-[48px]"
                required
              />
            </div>

            {/* Vehicle Type */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block uppercase tracking-wide">Tipo de Veículo</label>
              <select 
                id="field-vehicle-type"
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 text-slate-800 font-semibold shadow-xs min-h-[48px]"
              >
                {VEHICLE_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Location with GPS Helper */}
            <div className="space-y-1 md:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 block flex items-center gap-1.5 uppercase tracking-wide">
                  <MapPin size={14} className="text-slate-500" />
                  Local da Infração (Via / Bairro / Referência)
                </label>
                <button
                  type="button"
                  onClick={handleGetGpsLocation}
                  disabled={isGettingGps}
                  className="text-xxs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200/80 transition-all flex items-center gap-1 cursor-pointer"
                  title="Capturar endereço do agente via GPS"
                >
                  {isGettingGps ? (
                    <>
                      <Loader2 size={12} className="animate-spin text-amber-600" />
                      <span>Obtendo GPS...</span>
                    </>
                  ) : (
                    <>
                      <Navigation size={12} className="text-amber-600" />
                      <span>Obter Localização GPS</span>
                    </>
                  )}
                </button>
              </div>
              <input 
                id="field-location"
                type="text" 
                placeholder="Ex: Av. Salvador, Centro - Pojuca, BA (ou use o botão GPS)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 text-slate-800 font-semibold shadow-xs min-h-[48px]"
                required
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: MULTI-INFRACTION SELECTOR & LIST */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">2. Enquadramento Legal e Infrações</h3>
              <p className="text-xxs text-slate-500 font-medium">Você pode incluir uma ou mais infrações no mesmo Auto de Infração (AIT).</p>
            </div>
            {selectedInfractions.length > 0 && (
              <span className="bg-amber-500/10 text-amber-700 border border-amber-500/30 font-bold text-xs px-2.5 py-1 rounded-lg font-mono flex items-center gap-1.5">
                <Layers size={14} className="text-amber-600" />
                {selectedInfractions.length} {selectedInfractions.length === 1 ? 'Infração Selecionada' : 'Infrações Selecionadas'}
              </span>
            )}
          </div>
          
          <div className="space-y-3">
            {/* Search Box to Add Infraction */}
            <div className="space-y-1 relative" ref={dropdownRef}>
              <label className="text-xs font-bold text-slate-700 block uppercase tracking-wide">
                Pesquisar e Adicionar Infração ao AIT
              </label>
              
              <div className="relative">
                <input
                  id="field-infraction-search"
                  type="text"
                  inputMode="search"
                  autoCorrect="off"
                  placeholder="Digite código (ex: 501-00) ou palavras-chave (cinto, celular, velocidade)..."
                  value={searchQuery}
                  onFocus={() => setIsDropdownOpen(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 text-slate-800 font-semibold shadow-xs font-sans min-h-[48px]"
                />
              </div>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute left-0 right-0 mt-1.5 bg-white border-2 border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto divide-y divide-slate-100 z-50">
                  {filteredInfractions.length > 0 ? (
                    filteredInfractions.map((inf) => {
                      const isAlreadyAdded = selectedInfractions.some(item => item.code === inf.code);
                      return (
                        <button
                          key={inf.code}
                          type="button"
                          onClick={() => handleAddInfraction(inf)}
                          className={`w-full text-left px-4 py-3 hover:bg-amber-500/5 transition-colors flex flex-col gap-1 cursor-pointer ${
                            isAlreadyAdded ? 'opacity-50 bg-slate-50' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-extrabold text-xs text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                              {inf.code}
                              {isAlreadyAdded && <span className="text-[9px] text-slate-500 font-sans font-bold">(Já vinculada)</span>}
                            </span>
                            <span className={`text-xxs font-black uppercase tracking-wider font-mono ${
                              inf.nature === 'Gravíssima' ? 'text-rose-600' :
                              inf.nature === 'Grave' ? 'text-amber-600' :
                              inf.nature === 'Média' ? 'text-amber-500' :
                              'text-slate-600'
                            }`}>
                              {inf.nature}
                            </span>
                          </div>
                          <p className="text-xs text-slate-800 font-bold line-clamp-2 leading-snug">
                            {inf.description}
                          </p>
                          <div className="flex items-center justify-between text-xxs text-slate-500 font-mono">
                            <span>{inf.framing} (Art. {inf.article})</span>
                            <span className="font-bold text-slate-700">
                              R$ {inf.fineValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-500">
                      Nenhuma infração encontrada para a busca "{searchQuery}".
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* LIST OF ADDED INFRACTIONS */}
            {selectedInfractions.length === 0 ? (
              <div className="bg-slate-100 border-2 border-dashed border-slate-300 p-6 rounded-2xl text-center space-y-2">
                <div className="w-10 h-10 bg-slate-200 text-slate-500 rounded-full flex items-center justify-center mx-auto">
                  <Layers size={20} />
                </div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Nenhuma infração vinculada ao AIT</h4>
                <p className="text-xxs text-slate-500 max-w-sm mx-auto">
                  Utilize o campo de busca acima para pesquisar e selecionar uma ou mais infrações no catálogo do CTB.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedInfractions.map((inf, idx) => (
                  <div key={`${inf.code}-${idx}`} className="bg-slate-900 text-slate-100 p-4 rounded-2xl border-2 border-slate-950 space-y-3 shadow-md relative group">
                    {/* Top row */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase font-mono px-2 py-0.5 rounded-md ${
                          idx === 0 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-amber-400 border border-slate-700'
                        }`}>
                          {idx === 0 ? '1ª Infração (Principal)' : `${idx + 1}ª Infração (Adicional)`}
                        </span>
                        <span className="font-mono font-black text-xs text-amber-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                          {inf.code}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveInfraction(inf.code)}
                        className="text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 p-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xxs font-bold uppercase tracking-wider"
                        title="Remover esta infração do registro"
                      >
                        <Trash2 size={14} />
                        <span className="hidden sm:inline">Remover</span>
                      </button>
                    </div>

                    {/* Content */}
                    <div className="space-y-1">
                      <span className="text-xxs font-bold uppercase tracking-wider text-slate-400">Descrição</span>
                      <p className="text-xs font-bold text-slate-100 leading-snug">{inf.description}</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xxs border-t border-slate-800 pt-2">
                      <div>
                        <span className="text-slate-400 font-bold uppercase block">Enquadramento</span>
                        <span className="font-mono font-bold text-slate-300">{inf.framing}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold uppercase block">Artigo CTB</span>
                        <span className="font-bold text-slate-300">Art. {inf.article}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold uppercase block">Natureza / Pontos</span>
                        <span className="font-bold text-slate-300">{inf.nature} ({inf.score} pts)</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold uppercase block">Valor da Multa</span>
                        <span className="font-mono font-black text-amber-400">
                          R$ {inf.fineValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {inf.adminMeasure && (
                      <div className="text-xxs border-t border-slate-800/80 pt-2 text-slate-400">
                        <b className="text-amber-400">Medida Adm:</b> {inf.adminMeasure}
                      </div>
                    )}
                  </div>
                ))}

                {/* SUMMARY CARD FOR MULTI-INFRACTIONS */}
                <div className="bg-amber-500/10 border-2 border-amber-500/40 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-900 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-amber-500 text-slate-950 rounded-xl flex items-center justify-center font-black text-sm shrink-0">
                      {selectedInfractions.length}
                    </div>
                    <div>
                      <h4 className="font-black text-xs uppercase tracking-wide text-slate-900">Resumo Consolidado do AIT</h4>
                      <p className="text-xxs text-slate-600 font-medium">Valores e pontuação somados para o auto</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 font-mono">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Pontuação Total</span>
                      <span className="font-black text-xs text-slate-900">{totalScore} PONTOS</span>
                    </div>
                    <div className="h-8 w-px bg-amber-500/30" />
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Valor Total</span>
                      <span className="font-black text-sm text-slate-950">
                        R$ {totalFineValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 4: OBSERVATIONS & PHOTOS */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 uppercase tracking-wide">3. Observações e Evidências Fotográficas</h3>

          {/* Observations */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 block flex items-center gap-1.5 uppercase tracking-wide">
              <FileText size={14} className="text-slate-500" />
              Observações / Detalhes de Campo
            </label>
            <textarea 
              id="field-observations"
              rows={4}
              placeholder="Ex: Condutor recusou assinar o auto. Clima chuvoso, veículo estacionado atrapalhando a circulação do transporte coletivo."
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 text-slate-800 font-semibold shadow-xs"
            />
          </div>

          {/* Photographs upload */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-700 block uppercase tracking-wide">Fotografias Comprobatórias (Opcional)</span>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Trigger Camera capture */}
              <div 
                onClick={() => cameraInputRef.current?.click()}
                className="border-2 border-dashed border-amber-500/40 hover:border-amber-500 bg-amber-500/5 rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:bg-amber-500/10 transition-all group min-h-[56px]"
              >
                <div className="bg-amber-500 text-slate-950 p-2.5 rounded-xl shrink-0 shadow-sm">
                  <Camera size={20} />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 block leading-tight">Capturar pela Câmera</span>
                  <span className="text-xxs text-slate-500 block mt-0.5">Dispara câmera do dispositivo</span>
                </div>
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment"
                  ref={cameraInputRef}
                  className="hidden" 
                  onChange={handlePhotoSelect}
                />
              </div>

              {/* Trigger Gallery pick */}
              <div 
                onClick={() => galleryInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-slate-400 bg-slate-50 rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-100 transition-all group min-h-[56px]"
              >
                <div className="bg-slate-200 text-slate-700 p-2.5 rounded-xl shrink-0">
                  <Camera size={20} />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 block leading-tight">Escolher da Galeria</span>
                  <span className="text-xxs text-slate-500 block mt-0.5">Selecione foto armazenada</span>
                </div>
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={galleryInputRef}
                  className="hidden" 
                  onChange={handlePhotoSelect}
                />
              </div>
            </div>

            {/* Uploading loading indicator */}
            {uploadingPhoto && (
              <div className="border-2 border-slate-200 rounded-2xl p-4 bg-slate-50 flex items-center justify-center gap-3 animate-pulse">
                <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Carregando e otimizando imagem...</span>
              </div>
            )}

            {/* Preview Gallery */}
            {photoUrls.length > 0 && (
              <div className="flex flex-wrap gap-3 border border-slate-200 p-3 rounded-2xl bg-slate-50/50">
                {photoUrls.map((url, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 shadow-sm group">
                    <img referrerPolicy="no-referrer" src={url} alt={`Evidência ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity duration-100 cursor-pointer"
                      title="Remover fotografia"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Form Actions - Desktop standard & Mobile Sticky Bottom Bar */}
        <div className="pt-6 border-t-2 border-slate-100">
          <div className="hidden md:flex items-center justify-end gap-3">
            {(draftSavedAt || isDraftRestored) && (
              <button 
                type="button"
                onClick={handleDiscardDraft}
                className="px-4 py-3 rounded-xl border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 text-xs uppercase font-bold transition-colors cursor-pointer flex items-center gap-1.5 mr-auto"
              >
                <Trash2 size={14} />
                Limpar Rascunho
              </button>
            )}

            <button 
              id="btn-cancel-ticket"
              type="button"
              onClick={() => onSuccessSubmit()}
              className="px-5 py-3 rounded-xl border-2 border-slate-200 text-slate-600 text-xs uppercase tracking-wider hover:bg-slate-50 font-bold transition-colors cursor-pointer"
            >
              Voltar para Consulta
            </button>
            
            <button 
              id="btn-submit-ticket"
              type="submit"
              disabled={isLoading || uploadingPhoto || selectedInfractions.length === 0}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 disabled:text-slate-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <FilePlus size={16} className="stroke-[2.5]" />
                  Lavrar Auto de Infração ({selectedInfractions.length})
                </>
              )}
            </button>
          </div>

          {/* MOBILE STICKY BOTTOM ACTION BAR */}
          <div className="md:hidden fixed bottom-14 left-0 right-0 p-3 bg-slate-950/95 border-t border-slate-800 backdrop-blur-md z-30 flex items-center justify-between gap-2 shadow-2xl">
            {(draftSavedAt || isDraftRestored) && (
              <button 
                type="button"
                onClick={handleDiscardDraft}
                className="p-3 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-300 text-xs font-bold cursor-pointer shrink-0"
                title="Descartar Rascunho"
              >
                <Trash2 size={16} />
              </button>
            )}

            <button 
              id="btn-cancel-ticket-mob"
              type="button"
              onClick={() => onSuccessSubmit()}
              className="px-3 py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs uppercase font-extrabold cursor-pointer"
            >
              Voltar
            </button>
            
            <button 
              id="btn-submit-ticket-mob"
              type="submit"
              disabled={isLoading || uploadingPhoto || selectedInfractions.length === 0}
              className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  Lavrando AIT...
                </>
              ) : (
                <>
                  <FilePlus size={16} className="stroke-[2.5]" />
                  Lavrar Auto ({selectedInfractions.length})
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

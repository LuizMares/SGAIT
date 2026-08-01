/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  Menu, 
  Wifi, 
  WifiOff, 
  Calendar,
  LayoutDashboard,
  FilePlus,
  FileText,
  TrendingUp,
  Settings,
  Plus,
  User,
  X,
  ShieldCheck,
  CheckCircle2,
  Edit3,
  RefreshCw
} from 'lucide-react';

import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import TicketFormView from './components/TicketFormView';
import TicketListView from './components/TicketListView';
import ProjectionsView from './components/ProjectionsView';
import SettingsView from './components/SettingsView';
import LoginView from './components/LoginView';

import { dbService, isSupabaseConfigured, supabaseClient, safeStorage, STORAGE_KEYS, addDeletedTicketKeys } from './lib/supabase';
import { UserProfile, TrafficTicket, InfractionType, AuthorizedEmail, UserRole } from './types';

export default function App() {
  // Global States
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [tickets, setTickets] = useState<TrafficTicket[]>([]);
  const [infractions, setInfractions] = useState<InfractionType[]>([]);
  const [authorizedEmails, setAuthorizedEmails] = useState<AuthorizedEmail[]>([]);
  
  // App Shell UI States
  const [currentView, setCurrentView] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [loadingApp, setLoadingApp] = useState(true);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);

  // Profile Edit Modal States
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMessage, setProfileSuccessMessage] = useState<string | null>(null);

  const handleOpenProfileModal = () => {
    if (currentUser) {
      setProfileNameInput(currentUser.name);
      setProfileSuccessMessage(null);
      setShowProfileModal(true);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !profileNameInput.trim()) return;

    setIsSavingProfile(true);
    try {
      const { user: updated, error } = await dbService.updateUserProfile(currentUser.email, profileNameInput.trim());
      if (updated) {
        setCurrentUser(updated);
        setProfileSuccessMessage('Nome completo atualizado e sincronizado com sucesso!');
        addNotification(`Nome de perfil atualizado para "${updated.name}".`);
        await loadData();
        setTimeout(() => {
          setShowProfileModal(false);
        }, 1200);
      } else if (error) {
        alert(error);
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar nome.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Helper to clean OAuth or error URL parameters after auth processing
  const cleanUrlAuthParams = () => {
    if (typeof window !== 'undefined') {
      const href = window.location.href;
      if (
        href.includes('access_token') ||
        href.includes('code=') ||
        href.includes('error=') ||
        href.includes('refresh_token=') ||
        href.includes('error_description=')
      ) {
        try {
          window.history.replaceState(null, '', window.location.pathname);
        } catch (e) {
          console.warn('Erro ao limpar parâmetros de URL:', e);
        }
      }
    }
  };

  // Load profile and seed data on launch with explicit OAuth callback handling
  useEffect(() => {
    let isMounted = true;
    let authFinished = false;

    // Helper to detect if browser URL currently has OAuth return parameters or codes
    const isOAuthCallbackUrl = () => {
      if (typeof window === 'undefined') return false;
      const { hash, search, href } = window.location;
      return (
        hash.includes('access_token') ||
        hash.includes('refresh_token') ||
        hash.includes('type=recovery') ||
        hash.includes('error=') ||
        search.includes('code=') ||
        search.includes('error=') ||
        href.includes('access_token') ||
        href.includes('code=')
      );
    };

    const hasOAuthParams = isOAuthCallbackUrl();

    // Process user profile and complete login
    const handleLoginUser = async (userObj: any) => {
      try {
        const userProfile = await dbService.getCurrentUser(userObj);
        if (isMounted && userProfile) {
          setCurrentUser(userProfile);
          await loadData(userProfile);
          cleanUrlAuthParams();
          return true;
        }
      } catch (err) {
        console.error('Erro ao processar perfil do usuário:', err);
      }
      return false;
    };

    // Finalize auth checking phase when no session was obtained
    const finalizeUnauthenticatedState = async () => {
      if (!isMounted || authFinished) return;
      authFinished = true;

      if (typeof window !== 'undefined' && window.location.href.includes('error=')) {
        cleanUrlAuthParams();
      }

      // Check cached local profile fallback
      const cachedUser = await dbService.getCurrentUser();
      if (isMounted && cachedUser) {
        setCurrentUser(cachedUser);
        await loadData(cachedUser);
      }

      if (isMounted) {
        setLoadingApp(false);
      }
    };

    // 1. Subscribe to Supabase auth state changes FIRST to capture OAuth callback tokens
    let authSubscription: { unsubscribe: () => void } | null = null;
    if (isSupabaseConfigured() && supabaseClient) {
      const { data } = supabaseClient.auth.onAuthStateChange(async (event, session) => {
        if (!isMounted) return;

        console.log('Supabase Auth Event:', event, session?.user?.email);

        if (session?.user) {
          authFinished = true;
          setLoadingApp(true);
          const loggedIn = await handleLoginUser(session.user);
          if (loggedIn && isMounted) {
            setLoadingApp(false);
          }
        } else if (event === 'SIGNED_OUT') {
          authFinished = true;
          if (isMounted) {
            setCurrentUser(null);
            safeStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
            cleanUrlAuthParams();
            setLoadingApp(false);
          }
        } else if (event === 'INITIAL_SESSION' && !session) {
          if (!hasOAuthParams) {
            await finalizeUnauthenticatedState();
          }
        }
      });
      authSubscription = data.subscription;
    }

    // 2. Explicitly wait for Supabase to resolve session and process OAuth return params
    const initAppAuth = async () => {
      try {
        if (isSupabaseConfigured() && supabaseClient) {
          // Check session explicitly
          const { data, error } = await supabaseClient.auth.getSession();
          if (error) {
            console.warn('Aviso em getSession():', error);
          }

          if (data?.session?.user) {
            authFinished = true;
            const loggedIn = await handleLoginUser(data.session.user);
            if (loggedIn && isMounted) {
              setLoadingApp(false);
              return;
            }
          }

          // If session is not immediately available but URL contains OAuth callback parameters:
          if (hasOAuthParams) {
            console.log('Processando parâmetros de URL do Google OAuth via Supabase...');
            let attempts = 0;
            // Poll for up to 3 seconds for session to populate from OAuth callback processing
            while (attempts < 20 && isMounted && !authFinished) {
              await new Promise(res => setTimeout(res, 150));
              attempts++;
              const retry = await supabaseClient.auth.getSession();
              if (retry.data?.session?.user) {
                authFinished = true;
                const loggedIn = await handleLoginUser(retry.data.session.user);
                if (loggedIn && isMounted) {
                  setLoadingApp(false);
                  return;
                }
              }
            }
          }
        }

        // Fallback to local user or render login
        await finalizeUnauthenticatedState();
      } catch (err) {
        console.error('Falha ao inicializar autenticação do SGAIT:', err);
        await finalizeUnauthenticatedState();
      }
    };

    initAppAuth();

    // Safety timer: Prevent staying stuck on loading screen under extreme network failures
    const safetyTimer = setTimeout(() => {
      if (isMounted && !authFinished) {
        console.warn('Safety timer ativando finalização de carregamento...');
        finalizeUnauthenticatedState();
      }
    }, 6000);

    // Browser Online/Offline listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [isSyncingData, setIsSyncingData] = useState(false);

  // Centralized data loader from DB/Local storage
  const loadData = async (userOverride?: UserProfile) => {
    try {
      const [loadedTickets, loadedInfractions, loadedEmails] = await Promise.all([
        dbService.getTickets(),
        dbService.getInfractions(),
        dbService.getAuthorizedEmails()
      ]);
      
      setTickets(loadedTickets);
      setInfractions(loadedInfractions);
      setAuthorizedEmails(loadedEmails);

      const activeUser = userOverride || currentUser;
      if (activeUser) {
        const myAuth = loadedEmails.find(e => e.email.toLowerCase() === activeUser.email.toLowerCase());
        if (myAuth) {
          if (myAuth.role !== activeUser.role || myAuth.name !== activeUser.name) {
            const updatedUser: UserProfile = {
              ...activeUser,
              role: myAuth.role,
              name: myAuth.name,
              avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(myAuth.name)}`
            };
            setCurrentUser(updatedUser);
            safeStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));
          }
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar dados do SGAIT:', err);
    }
  };

  const handleManualSync = async () => {
    setIsSyncingData(true);
    try {
      await loadData();
      addNotification('Sincronização com o Supabase concluída!');
    } catch (e) {
      console.warn('Erro na sincronização manual:', e);
    } finally {
      setTimeout(() => setIsSyncingData(false), 500);
    }
  };

  // Realtime synchronization pipeline, tab visibility triggers & periodic background sync
  useEffect(() => {
    if (!currentUser) return;

    // Fetch fresh data immediately on mount
    loadData(currentUser);

    // Re-sync when tab becomes visible or receives window focus (e.g. mobile unlock or returning to notebook tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData(currentUser);
      }
    };
    const handleFocus = () => {
      loadData(currentUser);
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Polling interval every 3.5 seconds to guarantee multi-device updates appear automatically
    const interval = setInterval(() => {
      loadData(currentUser);
    }, 3500);

    // Subscribe to multi-table updates (Supabase Realtime + SSE + CustomEvents)
    const unsubscribe = dbService.subscribeTickets((message) => {
      console.log('Realtime update captured:', message);

      if (message.table === 'tickets') {
        const payload = message.data;
        if (!payload) return;

        if (message.type === 'INSERT') {
          setTickets(prev => {
            const matchIdx = prev.findIndex(t => t.id === payload.id || (t.aitNumber && payload.aitNumber && t.aitNumber.toUpperCase() === payload.aitNumber.toUpperCase()));
            if (matchIdx >= 0) {
              const copy = [...prev];
              copy[matchIdx] = payload;
              return copy;
            }
            return [payload, ...prev];
          });
          addNotification(`Novo Auto de Infração ${payload.aitNumber || ''} registrado em tempo real.`);
        } 
        else if (message.type === 'UPDATE') {
          setTickets(prev => prev.map(t => (t.id === payload.id || (t.aitNumber && payload.aitNumber && t.aitNumber.toUpperCase() === payload.aitNumber.toUpperCase())) ? { ...t, ...payload } : t));
          addNotification(`Auto de Infração ${payload.aitNumber || ''} foi atualizado.`);
        } 
        else if (message.type === 'DELETE') {
          const keys = [payload.id, payload.aitNumber].filter(Boolean);
          addDeletedTicketKeys(keys);
          setTickets(prev => prev.filter(t => t.id !== payload.id && (!payload.aitNumber || t.aitNumber !== payload.aitNumber)));
          addNotification(`Auto de Infração removido.`);
        }
      } else if (message.table === 'authorized_emails') {
        loadData(currentUser);
      } else if (message.table === 'infractions') {
        if (message.type === 'DELETE' && message.data?.code) {
          const codeToDelete = String(message.data.code).trim().toLowerCase();
          setInfractions(prev => prev.filter(i => i.code.trim().toLowerCase() !== codeToDelete));
        } else {
          loadData(currentUser);
        }
      }
    });

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
      unsubscribe();
    };
  }, [currentUser]);

  // Handle successful login
  const handleLoginSuccess = async (user: UserProfile) => {
    safeStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    setCurrentUser(user);
    try {
      await loadData(user);
    } catch (e) {
      console.warn('Erro ao carregar dados pós-login:', e);
    }
  };

  // Sign out handler
  const handleSignOut = async () => {
    await dbService.signOut();
    setCurrentUser(null);
    setTickets([]);
    setCurrentView('dashboard');
    setNotifications([]);
  };

  // Append a notification toast
  const addNotification = (text: string) => {
    setNotifications(prev => [text, ...prev].slice(0, 8)); // keep last 8
  };

  // Active view renderer helper
  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView tickets={tickets} />;
      case 'ticket-form':
        return (
          <TicketFormView 
            user={currentUser!} 
            infractions={infractions} 
            onSuccessSubmit={() => {
              loadData(); // reload
              setCurrentView('ticket-list'); // route back
            }} 
          />
        );
      case 'ticket-list':
        return (
          <TicketListView 
            user={currentUser!} 
            tickets={tickets} 
            infractions={infractions} 
            onReloadNeeded={loadData} 
          />
        );
      case 'projections':
        return <ProjectionsView tickets={tickets} infractions={infractions} />;
      case 'settings':
        if (currentUser?.role !== UserRole.ADMIN) {
          return <DashboardView tickets={tickets} />;
        }
        return (
          <SettingsView 
            user={currentUser!} 
            authorizedEmails={authorizedEmails} 
            infractions={infractions} 
            onReloadNeeded={loadData} 
          />
        );
      default:
        return <DashboardView tickets={tickets} />;
    }
  };

  // Application preloader screen (Carregando autenticação...)
  if (loadingApp) {
    return (
      <div 
        id="auth-loading-screen"
        className="h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-slate-100 font-sans p-6 select-none"
      >
        <div className="relative mb-6">
          <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center font-black text-xs text-amber-400">
            SGAIT
          </div>
        </div>
        
        <div className="bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider px-3 py-1 rounded-xl shadow-lg mb-3">
          Superintendência de Trânsito
        </div>
        
        <h2 className="text-base font-bold tracking-wide text-slate-100">
          Carregando autenticação...
        </h2>
        
        <p className="text-xs text-slate-400 mt-1.5 max-w-xs text-center leading-relaxed">
          Verificando sessão ativa e validando credenciais com Supabase Google Auth.
        </p>

        <div className="mt-6 flex items-center gap-2 text-xxs font-mono text-amber-400/90 bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-full shadow-inner">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span>SGAIT AUTHENTICATION ENGINE</span>
        </div>
      </div>
    );
  }

  // Auth Guard: Only render main panel if currentUser is non-null
  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  // Navigation menu items for bottom tab bar
  const navTabs = [
    { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'ticket-form', label: 'Lavrar AIT', icon: FilePlus, highlight: true },
    { id: 'ticket-list', label: 'Autos AIT', icon: FileText },
    { id: 'projections', label: 'Projeções', icon: TrendingUp },
    ...(currentUser.role === UserRole.ADMIN ? [{ id: 'settings', label: 'Ajustes', icon: Settings }] : []),
  ];

  return (
    <div className="flex bg-slate-900 min-h-screen text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950" id="sgait-app-frame">
      
      {/* DESKTOP SIDEBAR */}
      <div className="hidden md:block shrink-0">
        <Sidebar 
          user={currentUser}
          currentView={currentView}
          setCurrentView={(view) => {
            setCurrentView(view);
            setMobileMenuOpen(false);
          }}
          onSignOut={handleSignOut}
          isCollapsed={sidebarCollapsed}
          setIsCollapsed={setSidebarCollapsed}
          onOpenProfile={handleOpenProfileModal}
        />
      </div>

      {/* MOBILE DRAWER OVERLAY */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            {/* Overlay mask */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" 
            />
            {/* Drawer content */}
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-80 max-w-[85vw] h-full bg-slate-950 shadow-2xl z-50 flex flex-col"
            >
              <Sidebar 
                user={currentUser}
                currentView={currentView}
                setCurrentView={(view) => {
                  setCurrentView(view);
                  setMobileMenuOpen(false);
                }}
                onSignOut={handleSignOut}
                isCollapsed={false}
                setIsCollapsed={() => {}}
                onCloseMobile={() => setMobileMenuOpen(false)}
                onOpenProfile={() => {
                  setMobileMenuOpen(false);
                  handleOpenProfileModal();
                }}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MAIN CONTENT WRAPPER */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        
        {/* TOP BAR HEADER */}
        <header className="h-16 bg-slate-950/90 border-b border-slate-800/80 px-4 md:px-6 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md shadow-md">
          
          {/* Left panel: Trigger drawer on Mobile & Date on Desktop */}
          <div className="flex items-center gap-3">
            <button
              id="btn-mobile-menu"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Abrir Menu"
            >
              <Menu size={20} />
            </button>

            {/* Mobile Brand Badge */}
            <div className="flex items-center gap-2 md:hidden">
              <div className="bg-amber-500 text-slate-950 font-black text-xs px-2 py-0.5 rounded-md tracking-tighter">
                SGAIT
              </div>
              <span className="text-xxs font-extrabold text-slate-200 tracking-tight">CONTROLE DE CAMPO</span>
            </div>

            <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-800">
              <Calendar size={14} className="text-amber-400" />
              <span>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          </div>

          {/* Right panel: Action buttons, connection status, user badge */}
          <div className="flex items-center gap-2.5 sm:gap-4">
            
            {/* Quick Action Button: Registrar AIT */}
            <button
              onClick={() => setCurrentView('ticket-form')}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-3 py-2 rounded-xl shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus size={16} strokeWidth={3} />
              <span className="hidden sm:inline">Novo AIT</span>
            </button>

            {/* Banner/Indicators if offline */}
            {!isOnline && (
              <span className="flex items-center gap-1 text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded-lg text-[10px] font-semibold animate-pulse font-mono">
                <WifiOff size={12} />
                Offline
              </span>
            )}
            {isOnline && (
              <span className="hidden lg:flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg text-[10px] font-semibold font-mono">
                <Wifi size={12} className="text-emerald-400 animate-pulse" />
                Sincronizado
              </span>
            )}

            {/* Manual Sync / Refresh Button */}
            <button
              id="btn-manual-sync"
              onClick={handleManualSync}
              disabled={isSyncingData}
              className="flex items-center gap-1.5 text-slate-300 hover:text-amber-400 bg-slate-900/80 hover:bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              title="Sincronizar dados em tempo real com o banco Supabase"
            >
              <RefreshCw size={14} className={isSyncingData ? "animate-spin text-amber-400" : "text-slate-400"} />
              <span className="hidden md:inline">{isSyncingData ? 'Atualizando...' : 'Sincronizar'}</span>
            </button>

            {/* Notification bell and dropdown */}
            <div className="relative">
              <button
                id="btn-notifications"
                onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-900 rounded-xl border border-transparent hover:border-slate-800 transition-all relative cursor-pointer"
                title="Histórico de Alertas"
              >
                <Bell size={19} />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 border-2 border-slate-950 rounded-full animate-ping" />
                )}
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 border-2 border-slate-950 rounded-full" />
                )}
              </button>

              <AnimatePresence>
                {showNotificationDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNotificationDropdown(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-80 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl py-3 z-50 text-xs text-slate-200"
                    >
                      <div className="px-4 pb-2 border-b border-slate-800 font-bold text-slate-100 flex justify-between items-center">
                        <span>Alertas Recentes (Realtime)</span>
                        {notifications.length > 0 && (
                          <button 
                            onClick={() => setNotifications([])}
                            className="text-xxs font-semibold text-amber-400 hover:underline"
                          >
                            Limpar
                          </button>
                        )}
                      </div>
                      <div className="max-h-60 overflow-y-auto pt-2 divide-y divide-slate-900">
                        {notifications.length === 0 ? (
                          <div className="p-4 text-center text-slate-500 italic text-xxs">Nenhuma notificação recente.</div>
                        ) : (
                          notifications.map((not, idx) => (
                            <div key={idx} className="p-3 hover:bg-slate-900/60 transition-colors">
                              <p className="text-xxs leading-relaxed font-medium text-slate-300">{not}</p>
                              <span className="text-[10px] text-amber-400/80 block mt-1 font-mono">Há poucos instantes</span>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Micro Badge for the Current User role */}
            <button 
              type="button"
              onClick={handleOpenProfileModal}
              className="flex items-center gap-2 border-l border-slate-800 pl-3 sm:pl-4 hover:opacity-80 transition-opacity text-left cursor-pointer group"
              title="Editar Nome do Perfil"
            >
              <span className="text-right hidden sm:block">
                <span className="text-xs font-bold text-slate-100 group-hover:text-amber-400 transition-colors block leading-tight truncate max-w-[120px]">{currentUser.name}</span>
                <span className="text-[10px] text-amber-400 font-mono block tracking-wider uppercase font-bold">
                  {currentUser.role === 'ADMIN' ? 'Administrador' : 'Agente'}
                </span>
              </span>
              <div className="w-8 h-8 rounded-full border-2 border-amber-500/80 overflow-hidden shrink-0 bg-slate-900 shadow-sm group-hover:scale-105 transition-transform">
                {currentUser.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-black text-amber-400 text-xs">
                    {currentUser.name.substring(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
            </button>

          </div>
        </header>

        {/* COMPONENT BODY VIEW PORT */}
        <main className="flex-1 overflow-y-auto p-4 pb-28 md:p-8 md:pb-8" id="view-viewport">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.15 }}
            >
              {renderCurrentView()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 border-t border-slate-800/90 backdrop-blur-md md:hidden px-2 py-1.5 flex items-center justify-around shadow-2xl">
        {navTabs.map((tab, idx) => {
          const Icon = tab.icon;
          const isActive = currentView === tab.id;
          return (
            <button
              key={`mob-tab-${tab.id}-${idx}`}
              onClick={() => setCurrentView(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all relative ${
                isActive 
                  ? 'text-amber-400 font-extrabold' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.highlight ? (
                <div className={`p-2 rounded-full -mt-4 shadow-lg border-2 ${
                  isActive 
                    ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-amber-500/30' 
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                }`}>
                  <Icon size={20} strokeWidth={2.5} />
                </div>
              ) : (
                <Icon size={20} className={isActive ? 'text-amber-400' : 'text-slate-400'} />
              )}
              <span className={`text-[10px] mt-1 font-semibold ${isActive ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>
                {tab.label}
              </span>
              {isActive && !tab.highlight && (
                <motion.div 
                  layoutId="bottomTabIndicator"
                  className="absolute bottom-0 w-8 h-0.5 bg-amber-400 rounded-full" 
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* PROFILE EDIT MODAL */}
      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowProfileModal(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl z-10 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400">
                    <User size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-100">Perfil do Agente</h3>
                    <p className="text-xs text-slate-400">Atualizar Nome Completo de Exibição</p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                >
                  <X size={18} />
                </button>
              </div>

              {profileSuccessMessage && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-2xl flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="shrink-0" />
                  <span>{profileSuccessMessage}</span>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4">
                {/* Email Readonly */}
                <div>
                  <label className="block text-xxs font-mono font-bold uppercase tracking-wider text-slate-400 mb-1">
                    E-mail Institucional (Identificador)
                  </label>
                  <input 
                    type="text" 
                    readOnly 
                    value={currentUser.email} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-slate-400 font-mono focus:outline-none cursor-not-allowed"
                  />
                </div>

                {/* Role Readonly Badge */}
                <div>
                  <label className="block text-xxs font-mono font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Nível de Acesso (RBAC)
                  </label>
                  <div className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">
                      {currentUser.role === UserRole.ADMIN ? 'Administrador do Sistema' : 'Agente de Campo'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xxs font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      {currentUser.role}
                    </span>
                  </div>
                </div>

                {/* Editable Full Name */}
                <div>
                  <label className="block text-xxs font-mono font-bold uppercase tracking-wider text-amber-400 mb-1">
                    Nome Completo *
                  </label>
                  <div className="relative">
                    <input 
                      type="text" 
                      required
                      value={profileNameInput} 
                      onChange={(e) => setProfileNameInput(e.target.value)} 
                      placeholder="Ex: Carlos Eduardo Silva"
                      className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-2xl px-4 py-3 text-sm text-slate-100 font-bold focus:outline-none transition-colors"
                    />
                    <Edit3 size={16} className="absolute right-4 top-3.5 text-slate-500" />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Este nome será utilizado em todas as lavraturas e relatórios oficiais do SGAIT.</p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setShowProfileModal(false)}
                    className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingProfile || !profileNameInput.trim()}
                    className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
                  >
                    {isSavingProfile ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

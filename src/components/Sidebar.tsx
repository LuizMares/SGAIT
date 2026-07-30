/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { 
  LayoutDashboard, 
  FilePlus, 
  FileText, 
  TrendingUp, 
  Settings, 
  LogOut, 
  ChevronLeft, 
  ChevronRight, 
  ShieldCheck, 
  ShieldAlert,
  User,
  X,
  Radio
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';

interface SidebarProps {
  user: UserProfile;
  currentView: string;
  setCurrentView: (view: string) => void;
  onSignOut: () => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  onCloseMobile?: () => void;
  onOpenProfile?: () => void;
}

export default function Sidebar({
  user,
  currentView,
  setCurrentView,
  onSignOut,
  isCollapsed,
  setIsCollapsed,
  onCloseMobile,
  onOpenProfile
}: SidebarProps) {
  
  const menuItems = [
    {
      id: 'dashboard',
      label: 'Visão Geral',
      icon: LayoutDashboard,
      roles: [UserRole.ADMIN, UserRole.AGENTE]
    },
    {
      id: 'ticket-form',
      label: 'Registrador AIT',
      icon: FilePlus,
      roles: [UserRole.ADMIN, UserRole.AGENTE]
    },
    {
      id: 'ticket-list',
      label: 'Consulta de Autos (AIT)',
      icon: FileText,
      roles: [UserRole.ADMIN, UserRole.AGENTE]
    },
    {
      id: 'projections',
      label: 'Projeções e Finanças',
      icon: TrendingUp,
      roles: [UserRole.ADMIN, UserRole.AGENTE]
    },
    {
      id: 'settings',
      label: 'Configurações e Usuários',
      icon: Settings,
      roles: [UserRole.ADMIN]
    }
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(user.role));

  return (
    <aside 
      id="sgait-sidebar"
      className={`bg-slate-950 text-slate-100 flex flex-col transition-all duration-300 border-r border-slate-800/80 ${
        isCollapsed ? 'w-20' : 'w-72'
      } h-full sticky top-0 z-30 select-none`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80 shrink-0 bg-slate-900/50">
        {!isCollapsed && (
          <div className="flex items-center gap-2.5">
            <div className="bg-amber-500 text-slate-950 font-black text-lg px-2.5 py-1 rounded-lg tracking-tighter shadow-md shadow-amber-500/20">
              SGAIT
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-xs tracking-tight leading-none text-slate-100">CONTROLE DE CAMPO</span>
              <span className="text-[9px] text-amber-400 font-mono font-bold mt-0.5 tracking-wider">SUPERINTENDÊNCIA</span>
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className="bg-amber-500 text-slate-950 font-black text-sm mx-auto px-2 py-1 rounded shadow-md tracking-tighter">
            SG
          </div>
        )}
        
        {/* Toggle Collapse Desktop */}
        <button 
          id="btn-toggle-sidebar"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        {/* Close Button on Mobile Drawer */}
        {onCloseMobile && (
          <button 
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Profile Info Card */}
      <div className="p-4 border-b border-slate-800/80 shrink-0">
        <div 
          onClick={onOpenProfile}
          className={`flex ${isCollapsed ? 'justify-center' : 'items-center gap-3'} bg-slate-900/80 p-3 rounded-2xl border border-slate-800 shadow-inner hover:border-amber-500/50 hover:bg-slate-900 transition-all cursor-pointer group`}
          title="Clique para editar o Nome do Perfil"
        >
          <div className="relative shrink-0">
            {user.avatarUrl ? (
              <img 
                referrerPolicy="no-referrer"
                src={user.avatarUrl} 
                alt={user.name} 
                className="w-10 h-10 rounded-full border-2 border-amber-500 shadow-sm object-cover group-hover:scale-105 transition-transform"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 text-amber-400 font-bold group-hover:scale-105 transition-transform">
                {user.name ? user.name.substring(0, 1).toUpperCase() : <User size={20} />}
              </div>
            )}
            <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-950 animate-pulse" />
          </div>

          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <h4 className="text-sm font-bold text-slate-100 truncate group-hover:text-amber-400 transition-colors">{user.name}</h4>
                <span className="text-[10px] text-slate-400 group-hover:text-slate-200 font-medium underline shrink-0">Editar</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                {user.role === UserRole.ADMIN ? (
                  <ShieldCheck size={12} className="text-amber-400 shrink-0" />
                ) : (
                  <ShieldAlert size={12} className="text-amber-400 shrink-0" />
                )}
                <span className="text-xxs font-mono font-bold uppercase tracking-wider text-amber-400">
                  {user.role === UserRole.ADMIN ? 'Administrador' : 'Agente de Campo'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-2 border-solid">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              id={`nav-${item.id}`}
              key={item.id}
              onClick={() => {
                setCurrentView(item.id);
                if (onCloseMobile) onCloseMobile();
              }}
              className={`w-full flex items-center ${
                isCollapsed ? 'justify-center py-3' : 'px-4 py-3'
              } gap-3.5 rounded-xl text-sm font-semibold transition-all duration-150 relative ${
                isActive 
                  ? 'bg-amber-500/15 text-amber-400 border-l-4 border-amber-500 font-bold shadow-md shadow-amber-500/5' 
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon size={19} className={isActive ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'} />
              {!isCollapsed && <span>{item.label}</span>}
              {isActive && !isCollapsed && (
                <span className="absolute right-3.5 w-2 h-2 rounded-full bg-amber-400 shadow-sm shadow-amber-400" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Cloud Status Widget */}
      {!isCollapsed && (
        <div className="px-4 py-2 my-2 mx-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xxs font-mono text-slate-400">
          <div className="flex items-center gap-1.5">
            <Radio size={12} className="text-amber-400 animate-pulse" />
            <span>Supabase Cloud</span>
          </div>
          <span className="text-emerald-400 font-bold">ON</span>
        </div>
      )}

      {/* Logout Footer Section */}
      <div className="p-3 border-t border-slate-800/80 shrink-0 bg-slate-900/40">
        <button
          id="btn-logout"
          onClick={onSignOut}
          className={`w-full flex items-center ${
            isCollapsed ? 'justify-center py-3' : 'px-4 py-3'
          } gap-3 rounded-xl text-sm font-semibold text-rose-400 hover:bg-rose-500/10 transition-all`}
          title={isCollapsed ? "Sair do Sistema" : undefined}
        >
          <LogOut size={18} />
          {!isCollapsed && <span>Sair do Sistema</span>}
        </button>
      </div>
    </aside>
  );
}

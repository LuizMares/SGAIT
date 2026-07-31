/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Database, 
  AlertOctagon, 
  CheckCircle2,
  ChevronRight,
  X,
  PlusCircle
} from 'lucide-react';
import { dbService } from '../lib/supabase';
import { UserProfile, AuthorizedEmail, UserRole } from '../types';

interface LoginViewProps {
  onLoginSuccess: (user: UserProfile) => void;
}

const GoogleLogo = () => (
  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Account Picker state
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [authorizedAccounts, setAuthorizedAccounts] = useState<AuthorizedEmail[]>([]);
  const [customEmailInput, setCustomEmailInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Load known authorized emails on mount
  useEffect(() => {
    let isMounted = true;
    dbService.getAuthorizedEmails().then(emails => {
      if (!isMounted) return;
      const defaultList: AuthorizedEmail[] = [
        {
          email: 'luizemerson17@gmail.com',
          name: 'Emerson Mares',
          role: UserRole.ADMIN
        }
      ];

      const merged = [...defaultList];
      for (const e of emails) {
        if (!merged.some(m => m.email.toLowerCase() === e.email.toLowerCase())) {
          merged.push(e);
        }
      }
      setAuthorizedAccounts(merged);
    }).catch(() => {
      setAuthorizedAccounts([
        { email: 'luizemerson17@gmail.com', name: 'Emerson Mares', role: UserRole.ADMIN }
      ]);
    });
    return () => { isMounted = false; };
  }, []);

  const handleExecuteLogin = async (emailToLogin?: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsAccountModalOpen(false);

    try {
      const emailTarget = emailToLogin || 'luizemerson17@gmail.com';
      const { user, error } = await dbService.signInWithGoogle(emailTarget);

      if (error) {
        setErrorMessage(error);
        setIsLoading(false);
        return;
      }

      if (user) {
        setSuccessMessage(`Acesso autorizado! Bem-vindo(a), ${user.name}.`);
        setTimeout(() => {
          onLoginSuccess(user);
        }, 300);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao realizar login.');
      setIsLoading(false);
    }
  };

  const handleCustomEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmailInput.trim()) return;
    handleExecuteLogin(customEmailInput.trim().toLowerCase());
  };

  return (
    <div 
      id="login-page"
      className="min-h-screen w-full flex items-center justify-center bg-slate-100 p-4 md:p-8"
      style={{
        backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(30, 41, 59, 0.03) 0%, rgba(30, 41, 59, 0.03) 90%, transparent 90%)',
        backgroundSize: '20px 20px'
      }}
    >
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden flex flex-col justify-between relative min-h-[480px]">
        
        {/* Institutional Navy Header Banner with Traffic Yellow Accent */}
        <div className="bg-slate-950 text-slate-100 px-6 py-12 text-center relative shrink-0 border-b-4 border-amber-500">
          <div className="absolute top-4 left-4 flex items-center gap-1.5 opacity-75 text-xxs font-mono tracking-wider text-amber-400 font-bold">
            <span>SISTEMA OFICIAL</span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span>SGAIT v2.0</span>
          </div>

          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="w-16 h-16 bg-amber-500 rounded-2xl mx-auto flex items-center justify-center border-2 border-slate-900 shadow-md text-slate-950 font-black text-2xl tracking-tighter mb-4"
          >
            SGAIT
          </motion.div>
          <h2 className="text-2xl font-black tracking-tight text-slate-50">SGAIT</h2>
          <p className="text-[10px] text-amber-400 font-mono tracking-widest uppercase mt-1.5 font-bold">Sistema de Gestão de Autos de Infração</p>
          <p className="text-[9px] text-slate-400 font-sans tracking-wide uppercase mt-1">Superintendência de Trânsito e Transporte Pojuca - BA</p>
        </div>

        {/* Form Body Container */}
        <div className="p-6 space-y-6 flex-1 text-slate-700 flex flex-col justify-between bg-slate-50/50">
          
          <div className="space-y-2 text-center">
            <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Acesso de Agentes de Trânsito</h3>
            <p className="text-xxs text-slate-500 max-w-xs mx-auto leading-relaxed">
              Autentique-se com sua credencial institucional do Google para iniciar o serviço de campo.
            </p>
          </div>

          {/* Messages */}
          {errorMessage && (
            <div className="bg-rose-50 text-rose-800 border border-rose-200 p-4 rounded-2xl text-xs flex items-start gap-3 animate-fade-in shadow-xs">
              <AlertOctagon className="text-rose-500 shrink-0 mt-0.5" size={18} />
              <div>
                <h4 className="font-bold">Falha no Acesso</h4>
                <p className="text-xxs mt-0.5 leading-normal">{errorMessage}</p>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-4 rounded-2xl text-xs flex items-start gap-3 animate-fade-in shadow-xs">
              <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={18} />
              <div>
                <h4 className="font-bold">Acesso Concedido</h4>
                <p className="text-xxs mt-0.5 leading-normal">{successMessage}</p>
              </div>
            </div>
          )}

          {/* GOOGLE LOGIN BUTTON & QUICK ACCOUNT PICKER */}
          <div className="py-2">
            <button
              type="button"
              onClick={() => setIsAccountModalOpen(true)}
              id="btn-login-google-direct"
              disabled={isLoading}
              className="w-full py-4 px-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-600 text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-md flex items-center justify-center gap-3 transition-all cursor-pointer hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <GoogleLogo />
                  Entrar / Selecionar Conta Google
                </>
              )}
            </button>
          </div>

          {/* Connection Info Banner */}
          <div className="flex items-center justify-center gap-1.5 text-xxs font-mono text-slate-400 pt-2 border-t border-slate-50">
            <Database size={12} className="text-emerald-500 animate-pulse" />
            <span>
              Banco de Dados: <b>Supabase Cloud (Online)</b>
            </span>
          </div>

        </div>

        {/* Footer Legal Terms Block */}
        <div className="bg-slate-50 border-t border-slate-100 p-4 text-center shrink-0">
          <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
            Ao autenticar-se, o operador declara ciência e conformidade com as regras de sigilo e responsabilidade de fiscalização de trânsito.
          </p>
        </div>

      </div>

      {/* GOOGLE ACCOUNT SELECTOR MODAL */}
      <AnimatePresence>
        {isAccountModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAccountModalOpen(false)}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden z-50 border border-slate-200"
            >
              {/* Google Header Bar */}
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 relative">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-200/60 transition-colors"
                >
                  <X size={18} />
                </button>
                <div className="flex items-center gap-2 mb-2">
                  <GoogleLogo />
                  <span className="text-xs font-bold text-slate-700">Contas Google</span>
                </div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Escolha uma Conta Google</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Selecione a conta com a qual deseja acessar o sistema:
                </p>
              </div>

              {/* Account List */}
              <div className="p-4 space-y-2 max-h-[320px] overflow-y-auto">
                {authorizedAccounts.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => handleExecuteLogin(account.email)}
                    className="w-full p-3.5 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl text-left flex items-center justify-between transition-all group hover:border-amber-400 hover:shadow-sm cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center font-bold text-sm shrink-0 border border-slate-800 shadow-xs">
                        {account.name ? account.name.substring(0, 1).toUpperCase() : 'G'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 group-hover:text-amber-600 truncate">
                          {account.name || account.email.split('@')[0]}
                        </p>
                        <p className="text-xxs font-mono text-slate-500 truncate">{account.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full uppercase">
                        {account.role === UserRole.ADMIN ? 'Admin' : 'Agente'}
                      </span>
                      <ChevronRight size={16} className="text-slate-400 group-hover:text-amber-500 transition-colors" />
                    </div>
                  </button>
                ))}

                {/* Custom Email Form Toggle */}
                {!showCustomInput ? (
                  <button
                    type="button"
                    onClick={() => setShowCustomInput(true)}
                    className="w-full p-3.5 bg-slate-50 hover:bg-amber-50/50 border border-dashed border-slate-300 rounded-2xl text-left flex items-center gap-3 transition-all text-slate-700 hover:text-amber-900 hover:border-amber-400 cursor-pointer mt-2"
                  >
                    <PlusCircle size={20} className="text-amber-500 shrink-0" />
                    <div>
                      <p className="text-xs font-bold">Usar outra conta Google...</p>
                      <p className="text-xxs text-slate-500">Digite o e-mail para autenticar-se</p>
                    </div>
                  </button>
                ) : (
                  <form onSubmit={handleCustomEmailSubmit} className="p-3.5 bg-slate-50 border border-amber-300 rounded-2xl space-y-3 mt-2 animate-fade-in">
                    <label className="block text-xxs font-bold uppercase tracking-wider text-slate-600">
                      Digite o E-mail da Conta Google:
                    </label>
                    <input
                      type="email"
                      value={customEmailInput}
                      onChange={(e) => setCustomEmailInput(e.target.value)}
                      placeholder="seu.email@gmail.com"
                      required
                      autoFocus
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowCustomInput(false)}
                        className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                      >
                        Entrar com esta Conta
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                <span className="text-[10px] text-slate-400 font-mono">
                  SGAIT Google Auth Selector
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}



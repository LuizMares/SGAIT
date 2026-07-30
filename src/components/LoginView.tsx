/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Database, 
  AlertOctagon, 
  CheckCircle2
} from 'lucide-react';
import { dbService } from '../lib/supabase';
import { UserProfile } from '../types';

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
  const handleGoogleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { user, error } = await dbService.signInWithGoogle();

      if (error) {
        setErrorMessage(error);
        setIsLoading(false);
        return;
      }

      if (user) {
        setSuccessMessage(`Acesso autorizado! Bem-vindo(a), ${user.name}.`);
        setTimeout(() => {
          onLoginSuccess(user);
        }, 600);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao realizar login.');
    } finally {
      setIsLoading(false);
    }
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

          {/* GOOGLE DIRECT LOGIN BUTTON */}
          <div className="py-2">
            <button
              type="button"
              onClick={() => handleGoogleLogin()}
              id="btn-login-google-direct"
              disabled={isLoading}
              className="w-full py-4 px-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-600 text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-md flex items-center justify-center gap-3 transition-all cursor-pointer hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <GoogleLogo />
                  Entrar com Conta Google
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
    </div>
  );
}

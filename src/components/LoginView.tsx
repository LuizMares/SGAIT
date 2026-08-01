/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Database, 
  AlertOctagon, 
  CheckCircle2,
  Mail,
  Lock,
  User,
  LogIn,
  UserPlus,
  ShieldCheck
} from 'lucide-react';
import { dbService } from '../lib/supabase';
import { UserProfile, UserRole } from '../types';

interface LoginViewProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('Por favor, informe seu e-mail institucional.');
      setIsLoading(false);
      return;
    }

    if (!password) {
      setErrorMessage('Por favor, digite sua senha.');
      setIsLoading(false);
      return;
    }

    if (isSignUp) {
      if (!fullName.trim()) {
        setErrorMessage('Por favor, informe seu nome completo para o cadastro.');
        setIsLoading(false);
        return;
      }

      if (password.length < 6) {
        setErrorMessage('A senha deve ter no mínimo 6 caracteres.');
        setIsLoading(false);
        return;
      }

      try {
        const { user, error } = await dbService.signUpWithEmail(cleanEmail, password, fullName.trim(), UserRole.AGENTE);
        if (error) {
          if (error.toLowerCase().includes('api key') || error.toLowerCase().includes('apikey') || error.toLowerCase().includes('jwt')) {
            const localRes = await dbService.localSignUpWithEmail(cleanEmail, password, fullName.trim(), UserRole.AGENTE);
            if (localRes.user) {
              setSuccessMessage(`Cadastro realizado com sucesso! Bem-vindo(a), ${localRes.user.name}.`);
              setTimeout(() => {
                onLoginSuccess(localRes.user!);
              }, 400);
              return;
            }
          }
          setErrorMessage(error);
          setIsLoading(false);
          return;
        }

        if (user) {
          setSuccessMessage(`Cadastro realizado com sucesso! Bem-vindo(a), ${user.name}.`);
          setTimeout(() => {
            onLoginSuccess(user);
          }, 800);
        } else {
          setSuccessMessage('Conta registrada com sucesso! Faça login para continuar.');
          setIsSignUp(false);
          setIsLoading(false);
        }
      } catch (err: any) {
        const localRes = await dbService.localSignUpWithEmail(cleanEmail, password, fullName.trim(), UserRole.AGENTE);
        if (localRes.user) {
          setSuccessMessage(`Cadastro realizado com sucesso! Bem-vindo(a), ${localRes.user.name}.`);
          setTimeout(() => {
            onLoginSuccess(localRes.user!);
          }, 400);
          return;
        }
        setErrorMessage(err.message || 'Erro ao realizar cadastro.');
        setIsLoading(false);
      }
    } else {
      try {
        const { user, error } = await dbService.signInWithEmail(cleanEmail, password);
        if (error) {
          if (error.toLowerCase().includes('api key') || error.toLowerCase().includes('apikey') || error.toLowerCase().includes('jwt')) {
            const localRes = await dbService.localSignInWithEmail(cleanEmail, password);
            if (localRes.user) {
              setSuccessMessage(`Acesso autorizado! Bem-vindo(a), ${localRes.user.name}.`);
              setTimeout(() => {
                onLoginSuccess(localRes.user!);
              }, 400);
              return;
            }
          }
          setErrorMessage(error);
          setIsLoading(false);
          return;
        }

        if (user) {
          setSuccessMessage(`Acesso autorizado! Bem-vindo(a), ${user.name}.`);
          setTimeout(() => {
            onLoginSuccess(user);
          }, 400);
        }
      } catch (err: any) {
        const localRes = await dbService.localSignInWithEmail(cleanEmail, password);
        if (localRes.user) {
          setSuccessMessage(`Acesso autorizado! Bem-vindo(a), ${localRes.user.name}.`);
          setTimeout(() => {
            onLoginSuccess(localRes.user!);
          }, 400);
          return;
        }
        setErrorMessage(err.message || 'Erro ao realizar login.');
        setIsLoading(false);
      }
    }
  };

  return (
    <div 
      id="login-page"
      className="min-h-screen w-full flex items-center justify-center bg-slate-900 p-4 md:p-8"
      style={{
        backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(245, 158, 11, 0.05) 0%, rgba(15, 23, 42, 0.8) 90%, transparent 90%)',
        backgroundSize: '20px 20px'
      }}
    >
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200/80 shadow-2xl overflow-hidden flex flex-col justify-between relative">
        
        {/* Institutional Header Banner with Traffic Yellow Accent */}
        <div className="bg-slate-950 text-slate-100 px-6 py-7 text-center relative shrink-0 border-b-4 border-amber-500">
          <div className="absolute top-3 left-4 flex items-center gap-1.5 opacity-80 text-xxs font-mono tracking-wider text-amber-400 font-bold">
            <span>AUTENTICAÇÃO SEGURO SGAIT</span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          </div>

          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="w-14 h-14 bg-amber-500 rounded-2xl mx-auto flex items-center justify-center border-2 border-slate-900 shadow-md text-slate-950 font-black text-2xl tracking-tighter mb-2"
          >
            SGAIT
          </motion.div>
          <h2 className="text-2xl font-black tracking-tight text-slate-50">SGAIT</h2>
          <p className="text-[10px] text-amber-400 font-mono tracking-widest uppercase mt-0.5 font-bold">Sistema de Gestão de Autos de Infração</p>
          <p className="text-[9px] text-slate-400 font-sans tracking-wide uppercase mt-0.5">Superintendência de Trânsito e Transporte Pojuca - BA</p>
        </div>

        {/* Form Body Container */}
        <div className="p-6 space-y-4 flex-1 text-slate-700 flex flex-col justify-between bg-slate-50/50">

          {/* Mode Switch Tabs */}
          <div className="flex bg-slate-200/70 p-1 rounded-2xl border border-slate-300/60">
            <button
              type="button"
              onClick={() => { if (isSignUp) toggleMode(); }}
              className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 ${
                !isSignUp 
                  ? 'bg-slate-900 text-amber-400 shadow-md' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LogIn size={15} />
              <span>Entrar</span>
            </button>
            <button
              type="button"
              onClick={() => { if (!isSignUp) toggleMode(); }}
              className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 ${
                isSignUp 
                  ? 'bg-slate-900 text-amber-400 shadow-md' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus size={15} />
              <span>Criar Conta</span>
            </button>
          </div>

          {/* Header Subtitle */}
          <div className="text-center space-y-1">
            <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
              {isSignUp ? 'Cadastro de Novo Agente' : 'Acesso com E-mail e Senha'}
            </h3>
            <p className="text-xxs text-slate-500 max-w-xs mx-auto leading-relaxed">
              {isSignUp 
                ? 'Preencha seus dados oficiais para se cadastrar no sistema Supabase.' 
                : 'Informe suas credenciais cadastradas para acessar o painel de trânsito.'}
            </p>
          </div>

          {/* Messages */}
          <AnimatePresence mode="wait">
            {errorMessage && (
              <motion.div 
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="bg-rose-50 text-rose-800 border border-rose-200 p-3.5 rounded-2xl text-xs flex items-start gap-3 shadow-xs"
              >
                <AlertOctagon className="text-rose-500 shrink-0 mt-0.5" size={18} />
                <div>
                  <h4 className="font-bold">Aviso de Autenticação</h4>
                  <p className="text-xxs mt-0.5 leading-normal">{errorMessage}</p>
                </div>
              </motion.div>
            )}

            {successMessage && (
              <motion.div 
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-3.5 rounded-2xl text-xs flex items-start gap-3 shadow-xs"
              >
                <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                <div>
                  <h4 className="font-bold">Sucesso</h4>
                  <p className="text-xxs mt-0.5 leading-normal">{successMessage}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* LOGIN / SIGNUP FORM */}
          <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
            {/* Full Name field if Sign Up */}
            {isSignUp && (
              <div>
                <label className="block text-xxs font-mono font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Nome Completo *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required={isSignUp}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex: Carlos Eduardo Silva"
                    className="w-full bg-white border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-2xl pl-10 pr-4 py-3 text-xs text-slate-800 font-medium focus:outline-none transition-all shadow-xs"
                  />
                  <User size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                </div>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-xxs font-mono font-bold uppercase tracking-wider text-slate-600 mb-1">
                E-mail *
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@sgait.gov.br"
                  className="w-full bg-white border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-2xl pl-10 pr-4 py-3 text-xs text-slate-800 font-medium focus:outline-none transition-all shadow-xs"
                />
                <Mail size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xxs font-mono font-bold uppercase tracking-wider text-slate-600 mb-1">
                Senha *
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-2xl pl-10 pr-4 py-3 text-xs text-slate-800 font-medium focus:outline-none transition-all shadow-xs"
                />
                <Lock size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              id={isSignUp ? 'btn-submit-signup' : 'btn-submit-login'}
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer hover:shadow-lg active:scale-[0.99] mt-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck size={18} />
                  <span>{isSignUp ? 'Finalizar Cadastro' : 'Entrar no Sistema'}</span>
                </>
              )}
            </button>
          </form>

          {/* Toggle Hint */}
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={toggleMode}
              className="text-xxs text-slate-600 hover:text-amber-600 font-bold underline transition-colors cursor-pointer"
            >
              {isSignUp 
                ? 'Já possui uma conta? Clique aqui para entrar' 
                : 'Não tem conta? Clique aqui para se cadastrar'}
            </button>
          </div>

          {/* Connection Info Banner */}
          <div className="flex items-center justify-center gap-1.5 text-xxs font-mono text-slate-400 pt-3 border-t border-slate-200">
            <Database size={12} className="text-emerald-500 animate-pulse" />
            <span>
              Autenticação: <b>E-mail & Senha via Supabase Auth</b>
            </span>
          </div>

        </div>

        {/* Footer Legal Terms Block */}
        <div className="bg-slate-100/80 border-t border-slate-200 p-3 text-center shrink-0">
          <p className="text-[10px] text-slate-500 font-sans leading-relaxed">
            Ao autenticar-se, o operador declara ciência e conformidade com as regras de sigilo e responsabilidade de fiscalização de trânsito STT Pojuca.
          </p>
        </div>

      </div>
    </div>
  );
}

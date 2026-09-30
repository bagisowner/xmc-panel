import React, { useEffect } from 'react';
import { Server as ServerIcon, User, Lock, ArrowRight, RefreshCw, AlertCircle, Check } from 'lucide-react';
import { BackgroundSystem, BackgroundSettings } from './BackgroundSystem';

interface LoginPageProps {
  setupNeeded: boolean;
  usernameInput: string;
  setUsernameInput: (val: string) => void;
  passwordInput: string;
  setPasswordInput: (val: string) => void;
  authError: string;
  authSuccess: string;
  authLoading: boolean;
  termsAccepted: boolean;
  setTermsAccepted: (val: boolean) => void;
  handleLogin: (e: React.FormEvent) => void;
  handleRegisterAdmin: (e: React.FormEvent) => void;
  onSwitchToRegister: () => void;
  onOAuthSuccess?: (token: string, user: any) => void;
  bgSettings: BackgroundSettings;
  panelBrandName: string;
  panelBrandLogo: string;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  setupNeeded,
  usernameInput,
  setUsernameInput,
  passwordInput,
  setPasswordInput,
  authError,
  authSuccess,
  authLoading,
  termsAccepted,
  setTermsAccepted,
  handleLogin,
  handleRegisterAdmin,
  onSwitchToRegister,
  onOAuthSuccess,
  bgSettings,
  panelBrandName,
  panelBrandLogo,
}) => {
  const handleOAuthConnect = async (provider: 'google' | 'discord') => {
    try {
      const res = await fetch(`/api/auth/oauth-url?provider=${provider}`);
      if (!res.ok) throw new Error('Failed to fetch authorization endpoint.');
      const data = await res.json();
      if (data.url) {
        window.open(data.url, 'oauth_popup', 'width=580,height=680,scrollbars=yes');
      }
    } catch {
      alert('Unable to launch OAuth popup. Please check connection.');
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.token) {
        if (onOAuthSuccess) {
          onOAuthSuccess(event.data.token, event.data.user);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onOAuthSuccess]);

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 overflow-hidden font-sans text-zinc-100">
      <BackgroundSystem settings={bgSettings} />

      <div className="app-content relative z-10 w-full max-w-md glass-modal rounded-3xl p-8 shadow-2xl">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 p-0.5 shadow-lg mb-4">
            <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center overflow-hidden">
              {panelBrandLogo ? (
                <img src={panelBrandLogo} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <ServerIcon className="w-8 h-8 text-purple-400" />
              )}
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">{panelBrandName || 'Xorvila'}</h1>
          <p className="text-xs text-zinc-400 mt-1">
            {setupNeeded
              ? 'Initial Administrator Onboarding'
              : 'Commercial Minecraft Cloud Control'}
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        {!setupNeeded && (
          <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-900/60 border border-white/10 rounded-2xl mb-6">
            <button
              type="button"
              className="py-2 text-xs font-bold rounded-xl transition-all bg-purple-600 text-white shadow-md cursor-pointer"
            >
              LOG IN
            </button>
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="py-2 text-xs font-bold rounded-xl transition-all text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
            >
              REGISTER
            </button>
          </div>
        )}

        {/* Banners */}
        {authSuccess && (
          <div className="flex items-center gap-2 p-3.5 bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-medium rounded-xl mb-6 shadow-md animate-fadeIn">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{authSuccess}</span>
          </div>
        )}

        {authError && (
          <div className="flex items-center gap-2 p-3.5 bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs font-medium rounded-xl mb-6 shadow-md animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{authError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={setupNeeded ? handleRegisterAdmin : handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
              Username or Email
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                placeholder="admin or email@example.com"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs glass-input rounded-xl text-white placeholder-zinc-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
              Security Passphrase
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs glass-input rounded-xl text-white placeholder-zinc-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5 pt-1 pb-1">
            <input
              type="checkbox"
              id="loginTermsCheckbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-900/80 text-purple-600 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer accent-purple-600 shrink-0"
            />
            <label htmlFor="loginTermsCheckbox" className="text-xs text-zinc-300 cursor-pointer select-none">
              I agree to the <span className="text-purple-400 font-medium hover:underline">Terms and Conditions</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={authLoading || !termsAccepted}
            className="w-full mt-2 py-3 px-4 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl shadow-lg shadow-purple-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {authLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>{setupNeeded ? 'INITIALIZE SUPERADMIN' : 'LOG IN'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Social OAuth Options (Google & Discord) */}
        {!setupNeeded && (
          <>
            <div className="relative my-5 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <span className="relative bg-zinc-950/90 px-3 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                Or continue with
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                type="button"
                onClick={() => handleOAuthConnect('google')}
                className="w-full py-2.5 px-4 bg-zinc-900/80 hover:bg-zinc-800/90 border border-white/10 hover:border-purple-500/40 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Google</span>
              </button>

              <button
                type="button"
                onClick={() => handleOAuthConnect('discord')}
                className="w-full py-2.5 px-4 bg-zinc-900/80 hover:bg-zinc-800/90 border border-white/10 hover:border-purple-500/40 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0 fill-current text-[#5865F2]" viewBox="0 0 127.14 96.36">
                  <path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.06 0 0 0 45.64 0a105.89 105.89 0 0 0-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2a75.57 75.57 0 0 0 64.32 0c.87.68 1.76 1.36 2.66 2a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.91-72.14zM42.45 65.69c-6.32 0-11.53-5.81-11.53-12.89s5.09-12.89 11.53-12.89c6.48 0 11.64 5.86 11.53 12.89 0 7.08-5.1 12.89-11.53 12.89zm42.24 0c-6.32 0-11.53-5.81-11.53-12.89s5.09-12.89 11.53-12.89c6.48 0 11.64 5.86 11.53 12.89 0 7.08-5.05 12.89-11.53 12.89z" />
                </svg>
                <span>Discord</span>
              </button>
            </div>
          </>
        )}

        {!setupNeeded && (
          <div className="mt-5 text-center text-xs text-zinc-400">
            <span>Don't have an account? </span>
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="text-purple-400 font-bold hover:underline cursor-pointer"
            >
              Register Account
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

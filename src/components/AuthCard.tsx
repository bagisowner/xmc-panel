import React from 'react';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';
import { BackgroundSettings } from './BackgroundSystem';

interface AuthCardProps {
  setupNeeded: boolean;
  termsAccepted: boolean;
  setTermsAccepted: (val: boolean) => void;
  usernameInput: string;
  setUsernameInput: (val: string) => void;
  passwordInput: string;
  setPasswordInput: (val: string) => void;
  authError: string;
  setAuthError: (val: string) => void;
  authSuccess: string;
  setAuthSuccess: (val: string) => void;
  authLoading: boolean;
  authMode: 'login' | 'register';
  setAuthMode: (mode: 'login' | 'register') => void;
  handleLogin: (e: React.FormEvent) => void;
  handleRegisterAdmin: (e: React.FormEvent) => void;
  handleUserRegister: (e: React.FormEvent) => void;
  checkFieldAvailability: (field: 'username' | 'email', value: string) => void;
  regUsername: string;
  setRegUsername: (val: string) => void;
  regEmail: string;
  setRegEmail: (val: string) => void;
  regPassword: string;
  setRegPassword: (val: string) => void;
  regConfirmPassword: string;
  setRegConfirmPassword: (val: string) => void;
  showRegPassword: boolean;
  setShowRegPassword: (val: boolean) => void;
  showRegConfirmPassword: boolean;
  setShowRegConfirmPassword: (val: boolean) => void;
  usernameAvailability: { checked: boolean; taken: boolean; message?: string };
  setUsernameAvailability: (val: { checked: boolean; taken: boolean; message?: string }) => void;
  emailAvailability: { checked: boolean; taken: boolean; message?: string };
  setEmailAvailability: (val: { checked: boolean; taken: boolean; message?: string }) => void;
  onOAuthSuccess?: (token: string, user: any) => void;
  bgSettings: BackgroundSettings;
  panelBrandName: string;
  panelBrandLogo: string;
  showThemeModal: boolean;
  setShowThemeModal: (val: boolean) => void;
  updateBgSettings: (updated: any) => void;
  resetBgSettings: () => void;
}

export const AuthCard: React.FC<AuthCardProps> = ({
  setupNeeded,
  termsAccepted,
  setTermsAccepted,
  usernameInput,
  setUsernameInput,
  passwordInput,
  setPasswordInput,
  authError,
  setAuthError,
  authSuccess,
  setAuthSuccess,
  authLoading,
  authMode,
  setAuthMode,
  handleLogin,
  handleRegisterAdmin,
  handleUserRegister,
  checkFieldAvailability,
  regUsername,
  setRegUsername,
  regEmail,
  setRegEmail,
  regPassword,
  setRegPassword,
  regConfirmPassword,
  setRegConfirmPassword,
  showRegPassword,
  setShowRegPassword,
  showRegConfirmPassword,
  setShowRegConfirmPassword,
  usernameAvailability,
  setUsernameAvailability,
  emailAvailability,
  setEmailAvailability,
  onOAuthSuccess,
  bgSettings,
  panelBrandName,
  panelBrandLogo,
}) => {
  const handleSwitchToLogin = () => {
    setAuthError('');
    setAuthSuccess('');
    setAuthMode('login');
  };

  const handleSwitchToRegister = () => {
    setAuthError('');
    setAuthSuccess('');
    setAuthMode('register');
  };

  if (authMode === 'register' && !setupNeeded) {
    return (
      <RegisterPage
        regUsername={regUsername}
        setRegUsername={setRegUsername}
        regEmail={regEmail}
        setRegEmail={setRegEmail}
        regPassword={regPassword}
        setRegPassword={setRegPassword}
        regConfirmPassword={regConfirmPassword}
        setRegConfirmPassword={setRegConfirmPassword}
        showRegPassword={showRegPassword}
        setShowRegPassword={setShowRegPassword}
        showRegConfirmPassword={showRegConfirmPassword}
        setShowRegConfirmPassword={setShowRegConfirmPassword}
        usernameAvailability={usernameAvailability}
        setUsernameAvailability={setUsernameAvailability}
        emailAvailability={emailAvailability}
        setEmailAvailability={setEmailAvailability}
        checkFieldAvailability={checkFieldAvailability}
        handleUserRegister={handleUserRegister}
        termsAccepted={termsAccepted}
        setTermsAccepted={setTermsAccepted}
        authLoading={authLoading}
        authError={authError}
        authSuccess={authSuccess}
        onSwitchToLogin={handleSwitchToLogin}
        onOAuthSuccess={onOAuthSuccess}
        bgSettings={bgSettings}
        panelBrandName={panelBrandName}
        panelBrandLogo={panelBrandLogo}
      />
    );
  }

  return (
    <LoginPage
      setupNeeded={setupNeeded}
      usernameInput={usernameInput}
      setUsernameInput={setUsernameInput}
      passwordInput={passwordInput}
      setPasswordInput={setPasswordInput}
      authError={authError}
      authSuccess={authSuccess}
      authLoading={authLoading}
      termsAccepted={termsAccepted}
      setTermsAccepted={setTermsAccepted}
      handleLogin={handleLogin}
      handleRegisterAdmin={handleRegisterAdmin}
      onSwitchToRegister={handleSwitchToRegister}
      onOAuthSuccess={onOAuthSuccess}
      bgSettings={bgSettings}
      panelBrandName={panelBrandName}
      panelBrandLogo={panelBrandLogo}
    />
  );
};

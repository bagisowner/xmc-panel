// Component: AdminSettings
import React, { useState, useEffect } from 'react';
import { Sliders, ImageIcon, Upload, RefreshCw, Save, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { StorageService } from '../../services/StorageService';

interface AdminSettingsProps {
  showToast?: (type: 'success' | 'error' | 'info' | 'warn', message: string) => void;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({ showToast }) => {
  const [customLogos, setCustomLogos] = useState<Record<string, string>>({});
  const [backgroundWallpaper, setBackgroundWallpaper] = useState<string>('');
  
  // Original snapshots for comparison / cancel
  const [originalLogos, setOriginalLogos] = useState<Record<string, string>>({});
  const [originalWallpaper, setOriginalWallpaper] = useState<string>('');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const storageService = StorageService.getInstance();

  const loadSettings = () => {
    storageService.getSystemSettings().then(data => {
      if (data && typeof data === 'object') {
        const mapped = {
          ...(data.customLogos || {}),
          panelBrandName: data.brandName || 'Xorvila',
          panelBrandLogo: data.brandLogo || ''
        };
        setCustomLogos(mapped);
        setOriginalLogos(mapped);

        let wp = '';
        if (data.bgSettings?.customUrl) {
          wp = data.bgSettings.customUrl;
        } else if (data.backgroundWallpaper) {
          wp = data.backgroundWallpaper;
        }
        setBackgroundWallpaper(wp);
        setOriginalWallpaper(wp);
      }
    });
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Check if there are unsaved changes
  const hasChanges = 
    JSON.stringify(customLogos) !== JSON.stringify(originalLogos) ||
    backgroundWallpaper !== originalWallpaper;

  const handleCancelChanges = () => {
    setCustomLogos({ ...originalLogos });
    setBackgroundWallpaper(originalWallpaper);
    if (showToast) {
      showToast('info', 'Changes discarded. Reverted to saved settings.');
    }
  };

  const handleSaveAll = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const payload: any = {
        brandName: customLogos.panelBrandName || 'Xorvila',
        brandLogo: customLogos.panelBrandLogo || '',
        customLogos: customLogos,
        backgroundWallpaper: backgroundWallpaper
      };

      if (backgroundWallpaper) {
        payload.bgSettings = {
          enabled: true,
          preset: 'custom',
          customUrl: backgroundWallpaper,
          opacity: 0.85,
          blur: 2,
          overlay: 'medium'
        };
      }

      await storageService.updateSystemSettings(payload);
      window.dispatchEvent(new CustomEvent('system_settings_updated', { detail: payload }));
      
      setOriginalLogos({ ...customLogos });
      setOriginalWallpaper(backgroundWallpaper);

      setIsSaving(false);
      setSaveSuccess(true);
      if (showToast) {
        showToast('success', 'System settings & branding saved successfully!');
      }
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setIsSaving(false);
      if (showToast) {
        showToast('error', err.message || 'Failed to save system settings.');
      }
    }
  };

  const handleLogoUrlChange = (softwareName: string, url: string) => {
    setCustomLogos(prev => ({ ...prev, [softwareName]: url }));
  };

  const handleLogoFileUpload = (softwareName: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        handleLogoUrlChange(softwareName, dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleWallpaperFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setBackgroundWallpaper(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetLogo = (softwareName: string) => {
    setCustomLogos(prev => {
      const next = { ...prev };
      delete next[softwareName];
      return next;
    });
  };

  const softwareList = ['Paper', 'Purpur', 'Fabric', 'Forge', 'Velocity', 'BungeeCord', 'Rust', 'Palworld', 'Valheim'];

  return (
    <form onSubmit={handleSaveAll} className="space-y-6 animate-fadeIn pb-24">
      {/* Save Action Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 glass-panel rounded-2xl border border-purple-500/40 bg-gradient-to-br from-purple-950/40 via-black/50 to-black/60 shadow-xl">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-purple-400" /> System Configuration & Branding Center
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Manage global panel branding, login/register background wallpapers, and software icons across the instance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4" /> Saved!
            </span>
          )}
          {hasChanges && (
            <button
              type="button"
              onClick={handleCancelChanges}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-zinc-300 bg-zinc-900/80 hover:bg-zinc-800 border border-white/10 rounded-xl transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
          )}
          <button
            type="submit"
            disabled={isSaving || !hasChanges}
            className={`flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white rounded-xl shadow-lg transition cursor-pointer ${
              hasChanges 
                ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/40' 
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-60'
            }`}
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving Changes...' : hasChanges ? 'Save Changes' : 'No Changes'}</span>
          </button>
        </div>
      </div>

      {/* Global Background Wallpaper Section */}
      <div className="p-6 glass-panel rounded-2xl border border-white/10 space-y-4 shadow-lg">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-purple-400" /> Global Login & Panel Background Wallpaper
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Set a custom wallpaper URL or upload an image. This background will be applied automatically to the Login, Register, and main control panel screens.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="md:col-span-2 space-y-3">
            <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block font-bold">
              Wallpaper Image URL or File Upload
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="https://example.com/minecraft-wallpaper.jpg"
                value={backgroundWallpaper.startsWith('data:') ? 'Custom uploaded image (stored)' : backgroundWallpaper}
                onChange={(e) => setBackgroundWallpaper(e.target.value)}
                className="flex-1 px-4 py-2.5 text-xs glass-input rounded-xl text-white border border-white/10 focus:border-purple-500/50 focus:outline-none"
              />
              <label className="flex items-center gap-1.5 px-4 py-2.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-xs font-bold text-purple-200 transition cursor-pointer whitespace-nowrap">
                <Upload className="w-4 h-4" />
                <span>Upload Wallpaper</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleWallpaperFileUpload}
                />
              </label>
            </div>
          </div>

          <div className="w-full h-28 rounded-2xl bg-black/60 border border-white/10 flex items-center justify-center p-2 shadow-inner overflow-hidden relative">
            {backgroundWallpaper ? (
              <img src={backgroundWallpaper} alt="Wallpaper Preview" className="w-full h-full object-cover rounded-xl" />
            ) : (
              <div className="text-center text-zinc-500 text-[11px]">
                <ImageIcon className="w-6 h-6 mx-auto mb-1 opacity-40" />
                No custom wallpaper
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global Panel Branding Section */}
      <div className="p-6 glass-panel rounded-2xl border border-white/10 space-y-5 shadow-lg">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-purple-400" /> System & Panel Branding Identity
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Configure the global identity of your control panel. This logo and name will appear on the login screen, sidebar, and browser tab.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Panel Name */}
          <div className="space-y-3">
            <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block font-bold">
              Panel Display Name
            </label>
            <input
              type="text"
              placeholder="e.g. Xorvila Control"
              value={customLogos.panelBrandName || 'Xorvila'}
              onChange={(e) => handleLogoUrlChange('panelBrandName', e.target.value)}
              className="w-full px-4 py-2.5 text-xs glass-input rounded-xl text-white border border-white/10 focus:border-purple-500/50 focus:outline-none transition"
            />
          </div>

          {/* Panel Logo */}
          <div className="space-y-3">
            <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block font-bold">
              Global Branding Logo (URL or Upload)
            </label>
            <div className="flex gap-3">
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  placeholder="https://yourdomain.com/logo.png"
                  value={customLogos.panelBrandLogo || ''}
                  onChange={(e) => handleLogoUrlChange('panelBrandLogo', e.target.value)}
                  className="w-full px-4 py-2 text-xs glass-input rounded-xl text-white border border-white/10 focus:border-purple-500/50 focus:outline-none transition"
                />
                <label className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/30 rounded-xl text-[11px] font-bold text-purple-300 transition cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Branding Logo</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleLogoFileUpload('panelBrandLogo', e)}
                  />
                </label>
              </div>
              <div className="w-20 h-20 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-center p-2 shadow-inner shrink-0 overflow-hidden">
                {customLogos.panelBrandLogo ? (
                  <img src={customLogos.panelBrandLogo} alt="Logo Preview" className="max-w-full max-h-full object-contain" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-zinc-800" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Software Logo Customizer */}
      <div className="p-5 glass-panel rounded-2xl border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-br from-purple-950/20 via-black/25 to-black/35 shadow-lg">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-purple-400" /> Deploy UI Software Logo Customizer
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Customize or upload custom icons/logos for each deployment software (Paper, Purpur, Fabric, Forge, etc.) instantly across the panel.
          </p>
        </div>
        <span className="text-[10px] font-mono bg-purple-950/80 text-purple-300 px-2.5 py-1 rounded-lg border border-purple-500/30 font-bold">
          Global Persistence Active
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {softwareList.map((sw) => {
          const currentUrl = customLogos[sw] || '';
          return (
            <div key={sw} className="glass-card rounded-2xl p-5 border border-white/10 space-y-4 hover:border-purple-500/40 transition shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-white/10 flex items-center justify-center p-1.5 shadow">
                    {currentUrl ? (
                      <img src={currentUrl} alt={sw} className="w-full h-full object-contain rounded-lg" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-purple-400" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white font-mono">{sw}</h4>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {currentUrl ? 'Custom Branded' : 'Default Vector'}
                    </span>
                  </div>
                </div>
                {currentUrl && (
                  <button
                    type="button"
                    onClick={() => handleResetLogo(sw)}
                    className="px-2 py-1 text-[10px] font-semibold text-rose-400 hover:text-rose-300 bg-rose-950/40 border border-rose-500/30 rounded-lg transition cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                  Image URL or Asset Link
                </label>
                <input
                  type="text"
                  placeholder="https://example.com/logo.png"
                  value={currentUrl}
                  onChange={(e) => handleLogoUrlChange(sw, e.target.value)}
                  className="w-full px-3 py-1.5 text-xs glass-input rounded-xl text-white placeholder-zinc-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <label className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-400/30 rounded-xl text-xs font-semibold text-purple-200 transition cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleLogoFileUpload(sw, e)}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating / Sticky Unsaved Changes Action Bar */}
      {hasChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4 animate-slideUp">
          <div className="p-4 glass-modal rounded-2xl border border-purple-500/60 bg-gradient-to-r from-purple-950/90 via-zinc-950/95 to-purple-950/90 shadow-2xl flex items-center justify-between gap-4 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Unsaved Changes</div>
                <div className="text-[11px] text-zinc-300">You have modified system settings. Save or cancel.</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleCancelChanges}
                className="px-4 py-2 text-xs font-bold text-zinc-300 bg-zinc-900/90 hover:bg-zinc-800 border border-white/15 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-lg shadow-purple-900/50 transition cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
};

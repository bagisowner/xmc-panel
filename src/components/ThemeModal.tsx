import React, { useRef } from 'react';
import {
  X, Image as ImageIcon, Sparkles, Sliders, Check, Eye,
  Upload, RotateCcw, Monitor, Move, Minimize, Zap, EyeOff
} from 'lucide-react';
import { BackgroundSettings, WALLPAPER_PRESET_OPTIONS, DEFAULT_BACKGROUND_SETTINGS } from './BackgroundSystem';

interface ThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: BackgroundSettings;
  onUpdate: (updated: Partial<BackgroundSettings>) => void;
  onReset: () => void;
}

export const ThemeModal: React.FC<ThemeModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdate,
  onReset
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        onUpdate({
          preset: 'custom',
          customUrl: dataUrl
        });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl glass-modal border border-purple-500/25 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-purple-950/50 text-zinc-100 max-h-[92vh] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
        {/* Glow Accent */}
        <div className="absolute -top-24 -right-24 w-56 h-56 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-5 border-b border-zinc-800/80 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-purple-400 shadow-inner">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Appearance & Background Settings
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-normal">
                  Arix Visual Matrix
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Full-screen atmospheric Minecraft environments & glass transparency controls
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Master Toggle */}
        <div className="flex items-center justify-between p-4 glass-panel rounded-2xl mb-6">
          <div>
            <div className="text-sm font-semibold text-white">1. Full-Screen Wallpaper</div>
            <div className="text-xs text-zinc-400">Renders the fixed Minecraft environment behind all glass UI panels</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => onUpdate({ enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>

        {settings.enabled && (
          <div className="space-y-6">
            {/* Presets Grid */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">
                Wallpaper Presets
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {WALLPAPER_PRESET_OPTIONS.map((preset) => {
                  const isSelected = settings.preset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => onUpdate({ preset: preset.id as any })}
                      className={`flex items-start gap-3 p-3.5 text-left rounded-2xl border transition-all duration-200 ${
                        isSelected
                          ? 'bg-purple-950/50 border-purple-500/80 shadow-lg shadow-purple-950/40'
                          : 'glass-card hover:border-purple-500/30'
                      }`}
                    >
                      <div
                        className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center border border-white/10 shadow-sm"
                        style={{ backgroundColor: preset.previewColor }}
                      >
                        {isSelected && <Check className="w-5 h-5 text-white" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-white truncate">{preset.name}</div>
                        <div className="text-xs text-zinc-400 line-clamp-1">{preset.subtitle}</div>
                      </div>
                    </button>
                  );
                })}

                {/* Custom Wallpaper Option */}
                <button
                  type="button"
                  onClick={() => onUpdate({ preset: 'custom' })}
                  className={`flex items-start gap-3 p-3.5 text-left rounded-2xl border transition-all duration-200 ${
                    settings.preset === 'custom'
                      ? 'bg-purple-950/50 border-purple-500/80 shadow-lg shadow-purple-950/40'
                      : 'glass-card hover:border-purple-500/30'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center bg-zinc-900 border border-white/10 text-purple-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white">Custom Upload / URL</div>
                    <div className="text-xs text-zinc-400">Use your own Minecraft artwork</div>
                  </div>
                </button>
              </div>

              {settings.preset === 'custom' && (
                <div className="mt-4 p-4 glass-panel rounded-2xl space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="url"
                      placeholder="https://example.com/minecraft-wallpaper.png"
                      value={settings.customUrl.startsWith('data:') ? 'Custom uploaded image (stored locally)' : settings.customUrl}
                      onChange={(e) => onUpdate({ customUrl: e.target.value })}
                      className="flex-1 px-3.5 py-2 text-xs glass-input rounded-xl text-white placeholder-zinc-500 focus:outline-none"
                    />
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-purple-300 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 rounded-xl transition-colors whitespace-nowrap"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload File</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 2 & 4. Opacity & Blur Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 2. Opacity */}
              <div className="p-4 glass-panel rounded-2xl space-y-2">
                <div className="flex justify-between text-xs font-semibold text-zinc-300">
                  <span>2. Wallpaper Opacity</span>
                  <span className="font-mono text-purple-400 tabular-nums">{Math.round(settings.opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={settings.opacity}
                  onChange={(e) => onUpdate({ opacity: parseFloat(e.target.value) })}
                  className="w-full accent-purple-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                />
              </div>

              {/* 4. Blur Amount */}
              <div className="p-4 glass-panel rounded-2xl space-y-2">
                <div className="flex justify-between text-xs font-semibold text-zinc-300">
                  <span>4. Depth Blur</span>
                  <span className="font-mono text-purple-400 tabular-nums">{settings.blur}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="1"
                  value={settings.blur}
                  onChange={(e) => onUpdate({ blur: parseInt(e.target.value, 10) })}
                  className="w-full accent-purple-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                />
              </div>
            </div>

            {/* 3. Overlay Darkness Shading */}
            <div className="p-4 glass-panel rounded-2xl space-y-3">
              <label className="block text-xs font-semibold text-zinc-300">
                3. Overlay Darkness (linear-gradient)
              </label>
              <div className="grid grid-cols-5 gap-2">
                {(['none', 'light', 'medium', 'dark', 'ultra'] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => onUpdate({ overlay: level })}
                    className={`py-2 px-2 text-xs font-medium rounded-xl capitalize border transition-all ${
                      settings.overlay === level
                        ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-900/30'
                        : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {/* 6 & 7. Background Position & Background Size */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 6. Background Position */}
              <div className="p-4 glass-panel rounded-2xl space-y-2">
                <label className="text-xs font-semibold text-zinc-300 block">
                  6. Background Position X/Y
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['center', 'top', 'bottom', 'left', 'right'] as const).map((pos) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => onUpdate({ position: pos })}
                      className={`py-1.5 px-2 text-[11px] font-medium rounded-lg capitalize border transition-colors ${
                        (settings.position || 'center') === pos
                          ? 'bg-purple-600 text-white border-purple-400'
                          : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>

              {/* 7. Background Size */}
              <div className="p-4 glass-panel rounded-2xl space-y-2">
                <label className="text-xs font-semibold text-zinc-300 block">
                  7. Background Size
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['cover', 'contain', '100% 100%', '115%'] as const).map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => onUpdate({ size: sz })}
                      className={`py-1.5 px-2 text-[11px] font-medium rounded-lg border transition-colors ${
                        (settings.size || 'cover') === sz
                          ? 'bg-purple-600 text-white border-purple-400'
                          : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 5, 8. Vignette & Reduce Motion Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center justify-between p-3.5 glass-panel rounded-2xl cursor-pointer hover:bg-zinc-900/80 transition-colors">
                <span className="text-xs font-semibold text-zinc-200">5. Vignette Dark Borders</span>
                <input
                  type="checkbox"
                  checked={settings.vignette}
                  onChange={(e) => onUpdate({ vignette: e.target.checked })}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 bg-zinc-800 border-zinc-700"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 glass-panel rounded-2xl cursor-pointer hover:bg-zinc-900/80 transition-colors">
                <span className="text-xs font-semibold text-zinc-200">8. Reduce Motion</span>
                <input
                  type="checkbox"
                  checked={settings.reduceMotion}
                  onChange={(e) => onUpdate({ reduceMotion: e.target.checked })}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 bg-zinc-800 border-zinc-700"
                />
              </label>
            </div>
          </div>
        )}

        {/* 10. Reset to Default & Save Footer */}
        <div className="flex items-center justify-between pt-6 border-t border-zinc-800/80 mt-6">
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>10. Reset to Default</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-lg shadow-purple-950/40 transition-colors"
          >
            Save & Apply
          </button>
        </div>
      </div>
    </div>
  );
};

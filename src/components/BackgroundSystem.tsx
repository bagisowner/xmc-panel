// Component: BackgroundSystem
import React from 'react';

export interface BackgroundSettings {
  enabled: boolean;
  preset: 'default' | 'overworld' | 'nether' | 'end' | 'night' | 'caves' | 'custom';
  customUrl: string;
  opacity: number; // 0.10 to 1.0
  blur: number; // 0 to 30px
  overlay: 'none' | 'light' | 'medium' | 'dark' | 'ultra';
  vignette: boolean;
  particles: boolean;
  position: 'center' | 'top' | 'bottom' | 'left' | 'right';
  size: 'cover' | 'contain' | '100% 100%' | '115%';
  reduceMotion: boolean;
  sidebarStyle?: 'transparent' | 'normal';
}

export const DEFAULT_BACKGROUND_SETTINGS: BackgroundSettings = {
  enabled: true,
  preset: 'custom',
  customUrl: 'https://rough-morning-940.linkyhost.com',
  opacity: 1.0,
  blur: 0,
  overlay: 'none',
  vignette: false,
  particles: false,
  position: 'center',
  size: 'cover',
  reduceMotion: false,
  sidebarStyle: 'normal'
};

// High-fidelity premium host-panel diagonal flowing ribbon metadata
const PRESET_STYLES: Record<string, {
  name: string;
  subtitle: string;
  previewColor: string;
  ribbon1Color: string;
  ribbon2Color: string;
  glowColor: string;
}> = {
  default: {
    name: 'Arix Twilight Glow (Premium)',
    subtitle: 'Premium futuristic hosting panel visual theme with elegant diagonal flowing violet ribbons',
    previewColor: '#6366f1',
    ribbon1Color: 'linear-gradient(135deg, rgba(139, 92, 246, 0.32) 0%, rgba(99, 102, 241, 0.08) 50%, transparent 100%)',
    ribbon2Color: 'linear-gradient(225deg, rgba(168, 85, 247, 0.28) 0%, rgba(236, 72, 153, 0.06) 60%, transparent 100%)',
    glowColor: 'rgba(139, 92, 246, 0.15)'
  },
  overworld: {
    name: 'Alpine Ocean (Teal & Blue)',
    subtitle: 'Refreshing professional visual theme with deep teal & ocean blue diagonal flowing ribbons',
    previewColor: '#0d9488',
    ribbon1Color: 'linear-gradient(135deg, rgba(13, 148, 136, 0.28) 0%, rgba(37, 99, 235, 0.06) 50%, transparent 100%)',
    ribbon2Color: 'linear-gradient(225deg, rgba(20, 184, 166, 0.22) 0%, rgba(56, 189, 248, 0.05) 60%, transparent 100%)',
    glowColor: 'rgba(13, 148, 136, 0.12)'
  },
  nether: {
    name: 'Nether Magma (Crimson Flow)',
    subtitle: 'Fierce and dramatic dark hosting visual theme with flowing deep red & crimson ribbons',
    previewColor: '#dc2626',
    ribbon1Color: 'linear-gradient(135deg, rgba(220, 38, 38, 0.26) 0%, rgba(234, 88, 12, 0.06) 50%, transparent 100%)',
    ribbon2Color: 'linear-gradient(225deg, rgba(153, 27, 27, 0.22) 0%, rgba(185, 28, 28, 0.05) 60%, transparent 100%)',
    glowColor: 'rgba(220, 38, 38, 0.12)'
  },
  end: {
    name: 'Celestial End (Void Magenta)',
    subtitle: 'Mystical end-inspired dark visual theme with neon magenta & glowing violet ribbons',
    previewColor: '#d946ef',
    ribbon1Color: 'linear-gradient(135deg, rgba(217, 70, 239, 0.28) 0%, rgba(147, 51, 234, 0.08) 50%, transparent 100%)',
    ribbon2Color: 'linear-gradient(225deg, rgba(236, 72, 153, 0.24) 0%, rgba(168, 85, 247, 0.05) 60%, transparent 100%)',
    glowColor: 'rgba(217, 70, 239, 0.14)'
  },
  night: {
    name: 'Midnight Aurora (Deep Indigo)',
    subtitle: 'Calm and focused dark hosting visual theme with deep indigo & starry blue ribbons',
    previewColor: '#1d4ed8',
    ribbon1Color: 'linear-gradient(135deg, rgba(29, 78, 216, 0.28) 0%, rgba(79, 70, 229, 0.06) 50%, transparent 100%)',
    ribbon2Color: 'linear-gradient(225deg, rgba(30, 58, 138, 0.24) 0%, rgba(59, 130, 246, 0.05) 60%, transparent 100%)',
    glowColor: 'rgba(29, 78, 216, 0.12)'
  },
  caves: {
    name: 'Amethyst Caves (Charcoal Purple)',
    subtitle: 'Deep subterranean underground theme with dark violet crystal & stone-grey ribbons',
    previewColor: '#7e22ce',
    ribbon1Color: 'linear-gradient(135deg, rgba(126, 34, 206, 0.26) 0%, rgba(75, 85, 99, 0.06) 50%, transparent 100%)',
    ribbon2Color: 'linear-gradient(225deg, rgba(107, 33, 168, 0.22) 0%, rgba(147, 51, 234, 0.05) 60%, transparent 100%)',
    glowColor: 'rgba(126, 34, 206, 0.12)'
  }
};

export const WALLPAPER_PRESET_OPTIONS = Object.keys(PRESET_STYLES).map(key => ({
  id: key,
  name: PRESET_STYLES[key].name,
  subtitle: PRESET_STYLES[key].subtitle,
  previewColor: PRESET_STYLES[key].previewColor
}));

interface BackgroundSystemProps {
  settings: BackgroundSettings;
}

export const BackgroundSystem: React.FC<BackgroundSystemProps> = ({ settings }) => {
  if (!settings.enabled) {
    return (
      <div className="fixed inset-0 -z-30 bg-[#030206] pointer-events-none" />
    );
  }

  // Determine overlay style - reduced dark opacity to ensure Minecraft wallpaper is clearly visible
  const getOverlayStyle = () => {
    switch (settings.overlay) {
      case 'none':
        return { background: 'transparent' };
      case 'light':
        return { background: 'linear-gradient(180deg, rgba(3, 2, 8, 0.15) 0%, rgba(2, 1, 5, 0.3) 100%)' };
      case 'medium':
        return { background: 'linear-gradient(180deg, rgba(3, 2, 8, 0.25) 0%, rgba(2, 1, 5, 0.45) 100%)' };
      case 'dark':
        return { background: 'linear-gradient(180deg, rgba(3, 2, 8, 0.45) 0%, rgba(2, 1, 5, 0.65) 100%)' };
      case 'ultra':
        return { background: 'linear-gradient(180deg, rgba(3, 2, 8, 0.65) 0%, rgba(2, 1, 5, 0.85) 100%)' };
      default:
        return { background: 'linear-gradient(180deg, rgba(3, 2, 8, 0.15) 0%, rgba(2, 1, 5, 0.3) 100%)' };
    }
  };

  const styleConfig = PRESET_STYLES[settings.preset] || PRESET_STYLES.default;

  return (
    <>
      {/* LAYER 1: Deep Near-Black Base Canvas */}
      <div className="fixed inset-0 w-full h-full -z-50 bg-[#070510]" />

      {/* LAYER 2: Clean, Symmetrical Ambient Glow (Zero side blobs or blur smudges) */}
      {settings.preset !== 'custom' ? (
        <div
          className="fixed inset-0 w-full h-full -z-40 overflow-hidden pointer-events-none select-none"
          style={{
            opacity: Math.min(settings.opacity, 0.75),
            transition: 'opacity 0.4s ease'
          }}
        >
          {/* Subtle balanced top ambient illumination */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[360px] pointer-events-none opacity-20"
            style={{
              background: `radial-gradient(ellipse 70% 50% at 50% 0%, ${styleConfig.previewColor}30 0%, transparent 70%)`
            }}
          />
        </div>
      ) : (
        /* Render Custom Image or Web Wallpaper if selected */
        <div
          className="app-background fixed inset-0 w-full h-full -z-40 overflow-hidden pointer-events-none select-none"
          style={{
            opacity: settings.opacity,
            transition: settings.reduceMotion ? 'none' : 'opacity 0.5s ease',
            backgroundPosition: settings.position || 'center',
            backgroundSize: settings.size || 'cover'
          }}
        >
          {settings.customUrl && (
            settings.customUrl.startsWith('data:') || settings.customUrl.match(/\.(png|jpg|jpeg|webp|gif|svg)$/i) ? (
              <img
                src={settings.customUrl}
                alt="Custom Atmospheric Background"
                className="w-full h-full object-cover"
                style={{
                  objectPosition: settings.position || 'center',
                  filter: settings.blur ? `blur(${settings.blur}px)` : 'none',
                  transform: settings.blur ? 'scale(1.05)' : 'none',
                  transition: 'filter 0.3s ease, transform 0.3s ease'
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <iframe
                src={settings.customUrl}
                title="Custom Background Stream"
                className="w-full h-full border-none pointer-events-none"
                style={{
                  width: '100%',
                  height: '100%',
                  transform: settings.blur ? 'scale(1.07)' : 'scale(1.02)',
                  filter: settings.blur ? `blur(${settings.blur}px)` : 'none',
                  transition: 'filter 0.3s ease, transform 0.3s ease'
                }}
              />
            )
          )}
        </div>
      )}

      {/* LAYER 3: Luminous Transparent Overlay */}
      <div
        className="background-overlay fixed inset-0 -z-30 pointer-events-none transition-colors duration-500"
        style={getOverlayStyle()}
      />

      {/* LAYER 4: Subtle Edge Contrast */}
      {settings.vignette && (
        <div
          className="fixed inset-0 pointer-events-none -z-20"
          style={{
            background: 'radial-gradient(ellipse 85% 85% at 50% 50%, transparent 65%, rgba(5, 4, 12, 0.65) 100%)'
          }}
        />
      )}

      {/* Optional Subtle Ambient Glow */}
      {settings.particles && (
        <div
          className="fixed inset-0 opacity-[0.025] pointer-events-none -z-10"
          style={{
            backgroundImage: `radial-gradient(circle, #f3e8ff 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }}
        />
      )}
    </>
  );
};

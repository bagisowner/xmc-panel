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
}

export const DEFAULT_BACKGROUND_SETTINGS: BackgroundSettings = {
  enabled: true,
  preset: 'default',
  customUrl: '',
  opacity: 0.85,
  blur: 4,
  overlay: 'medium',
  vignette: true,
  particles: true,
  position: 'center',
  size: 'cover',
  reduceMotion: false
};

// High-fidelity procedural SVG landscapes representing Minecraft environments
const WALLPAPER_PRESETS: Record<string, { name: string; subtitle: string; previewColor: string; render: () => React.ReactNode }> = {
  default: {
    name: 'Arix Dark Twilight (Reference)',
    subtitle: 'Deep navy/purple Minecraft atmospheric landscape with soft violet glow',
    previewColor: '#2b104a',
    render: () => (
      <svg className="w-full h-full object-cover" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Deep Navy/Purple Sky Gradient */}
          <linearGradient id="arixSky" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#04030d" />
            <stop offset="25%" stopColor="#09061a" />
            <stop offset="55%" stopColor="#180b33" />
            <stop offset="80%" stopColor="#2e1052" />
            <stop offset="100%" stopColor="#4c1875" />
          </linearGradient>

          {/* Atmospheric Violet Glow Orb */}
          <radialGradient id="horizonGlow" cx="60%" cy="70%" r="55%">
            <stop offset="0%" stopColor="#9333ea" stopOpacity="0.45" />
            <stop offset="35%" stopColor="#6366f1" stopOpacity="0.25" />
            <stop offset="70%" stopColor="#1e0c3b" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#04030d" stopOpacity="0" />
          </radialGradient>

          {/* Volumetric Purple Beacon Ray */}
          <linearGradient id="beaconBeam" x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stopColor="#c084fc" stopOpacity="0.6" />
            <stop offset="40%" stopColor="#a855f7" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
          </linearGradient>

          {/* Distant Mountains Gradient */}
          <linearGradient id="arixMtnFar" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#230c40" />
            <stop offset="100%" stopColor="#080314" />
          </linearGradient>

          {/* Mid Mountains Gradient */}
          <linearGradient id="arixMtnMid" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#150729" />
            <stop offset="100%" stopColor="#05020a" />
          </linearGradient>

          {/* Foreground Voxel Ridge */}
          <linearGradient id="arixMtnFore" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0b0314" />
            <stop offset="100%" stopColor="#020105" />
          </linearGradient>

          {/* River Stream Reflection */}
          <linearGradient id="arixRiver" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#6366f1" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#05020c" />
          </linearGradient>
        </defs>

        {/* Base Sky */}
        <rect width="1920" height="1080" fill="url(#arixSky)" />

        {/* Atmospheric Horizon Glow */}
        <circle cx="1150" cy="720" r="700" fill="url(#horizonGlow)" />

        {/* Subtle Voxel Moon / Light Source */}
        <rect x="1140" y="580" width="48" height="48" fill="#f3e8ff" opacity="0.85" rx="3" filter="drop-shadow(0 0 25px #c084fc)" />

        {/* Distant Stars */}
        <g opacity="0.4">
          <circle cx="150" cy="90" r="1.5" fill="#f3e8ff" />
          <circle cx="340" cy="140" r="1" fill="#e9d5ff" />
          <circle cx="620" cy="80" r="1.5" fill="#d8b4fe" />
          <circle cx="900" cy="160" r="1" fill="#f3e8ff" />
          <circle cx="1380" cy="110" r="1.5" fill="#c084fc" />
          <circle cx="1650" cy="70" r="1" fill="#f3e8ff" />
          <circle cx="1820" cy="150" r="1.5" fill="#e9d5ff" />
        </g>

        {/* Distant Voxel Mountain Layer */}
        <path d="M0,660 L140,610 L280,640 L440,550 L580,600 L740,510 L920,580 L1100,480 L1260,540 L1440,470 L1600,520 L1760,460 L1920,510 L1920,1080 L0,1080 Z" fill="url(#arixMtnFar)" opacity="0.85" />

        {/* Stepped Voxel Peaks Midground */}
        <path d="M0,730 L100,700 L220,700 L220,660 L340,660 L340,620 L460,620 L460,580 L580,580 L580,620 L700,620 L700,560 L840,560 L840,610 L980,610 L980,550 L1120,550 L1120,620 L1280,620 L1280,560 L1440,560 L1440,600 L1580,600 L1580,650 L1740,650 L1740,610 L1920,610 L1920,1080 L0,1080 Z" fill="url(#arixMtnMid)" opacity="0.95" />

        {/* Distant Beacon Tower with Light Beam */}
        <g opacity="0.8">
          <polygon points="760,560 740,0 780,0" fill="url(#beaconBeam)" />
          <rect x="750" y="560" width="20" height="50" fill="#1e0b38" />
          <circle cx="760" cy="560" r="5" fill="#e879f9" />
        </g>

        {/* Foreground Pine Silhouette & Voxel Cliffs */}
        <path d="M0,820 L80,790 L180,830 L280,770 L380,810 L480,760 L600,820 L720,780 L840,840 L960,790 L1100,850 L1240,800 L1380,830 L1520,770 L1640,810 L1760,760 L1860,800 L1920,770 L1920,1080 L0,1080 Z" fill="url(#arixMtnFore)" />

        {/* Voxel Pine Trees */}
        <g fill="#06020c">
          <polygon points="140,750 115,800 165,800" />
          <polygon points="140,730 120,770 160,770" />
          <polygon points="320,720 295,780 345,780" />
          <polygon points="320,690 300,740 340,740" />
          <polygon points="540,710 515,770 565,770" />
          <polygon points="540,680 520,730 560,730" />
          <polygon points="900,740 875,800 925,800" />
          <polygon points="900,710 880,760 920,760" />
          <polygon points="1480,720 1455,780 1505,780" />
          <polygon points="1480,690 1460,740 1500,740" />
          <polygon points="1720,710 1695,770 1745,770" />
          <polygon points="1720,680 1700,730 1740,730" />
        </g>

        {/* Winding Violet River */}
        <path d="M960,1080 C920,980 980,900 1100,850 C1220,800 1200,740 1250,680 L1280,680 C1230,750 1260,820 1140,870 C1030,920 1000,990 1020,1080 Z" fill="url(#arixRiver)" />
      </svg>
    )
  },
  overworld: {
    name: 'Overworld Alpine',
    subtitle: 'Lush taiga spruce, snow-capped voxel peaks and deep dusk',
    previewColor: '#1e293b',
    render: () => (
      <svg className="w-full h-full object-cover" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="owSky" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#070c18" />
            <stop offset="40%" stopColor="#0e1f38" />
            <stop offset="75%" stopColor="#1a3556" />
            <stop offset="100%" stopColor="#314e6b" />
          </linearGradient>
          <linearGradient id="snowPeak" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="40%" stopColor="#475569" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
        </defs>
        <rect width="1920" height="1080" fill="url(#owSky)" />
        <path d="M0,640 L160,540 L300,600 L460,460 L600,550 L800,380 L980,520 L1180,410 L1360,540 L1560,430 L1740,530 L1920,440 L1920,1080 L0,1080 Z" fill="url(#snowPeak)" />
        <path d="M0,740 L220,680 L440,730 L700,650 L960,710 L1240,640 L1520,700 L1780,650 L1920,680 L1920,1080 L0,1080 Z" fill="#09141f" opacity="0.95" />
      </svg>
    )
  },
  nether: {
    name: 'Nether Wastes & Crimson',
    subtitle: 'Lava waterfalls, glowing magma blocks and dark basalt deltas',
    previewColor: '#450a0a',
    render: () => (
      <svg className="w-full h-full object-cover" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="netherFog" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#140205" />
            <stop offset="40%" stopColor="#2e0508" />
            <stop offset="80%" stopColor="#50070d" />
            <stop offset="100%" stopColor="#831818" />
          </linearGradient>
        </defs>
        <rect width="1920" height="1080" fill="url(#netherFog)" />
        <rect x="200" y="480" width="1520" height="30" fill="#120305" />
        <rect x="360" y="480" width="50" height="300" fill="#120305" />
        <rect x="1240" y="480" width="50" height="320" fill="#120305" />
        <rect x="0" y="860" width="1920" height="220" fill="#7f1d1d" opacity="0.7" />
        <path d="M0,860 L140,780 L280,860 L420,740 L580,860 L800,760 L1020,860 L1260,770 L1480,860 L1700,750 L1920,840 L1920,1080 L0,1080 Z" fill="#080203" />
      </svg>
    )
  },
  end: {
    name: 'The End Dimension',
    subtitle: 'End stone void islands, obsidian monoliths and magenta crystal beams',
    previewColor: '#1e0538',
    render: () => (
      <svg className="w-full h-full object-cover" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="endVoid" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#030108" />
            <stop offset="50%" stopColor="#0c0217" />
            <stop offset="100%" stopColor="#1a042e" />
          </linearGradient>
        </defs>
        <rect width="1920" height="1080" fill="url(#endVoid)" />
        <rect x="420" y="440" width="70" height="420" fill="#06030a" />
        <rect x="740" y="360" width="90" height="500" fill="#06030a" />
        <rect x="1180" y="400" width="80" height="460" fill="#06030a" />
        <circle cx="785" cy="360" r="14" fill="#ec4899" opacity="0.9" />
        <path d="M250,780 C400,720 700,700 960,700 C1220,700 1520,720 1670,780 C1540,890 1200,980 960,980 C720,980 380,890 250,780 Z" fill="#2d2b1c" opacity="0.9" />
      </svg>
    )
  },
  night: {
    name: 'Midnight Village',
    subtitle: 'Starlit deep night, glowing lanterns and wooden voxel roofs',
    previewColor: '#050c1e',
    render: () => (
      <svg className="w-full h-full object-cover" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="nightSky" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#02040d" />
            <stop offset="60%" stopColor="#060d20" />
            <stop offset="100%" stopColor="#111533" />
          </linearGradient>
        </defs>
        <rect width="1920" height="1080" fill="url(#nightSky)" />
        <rect x="1460" y="180" width="70" height="70" fill="#f8fafc" rx="4" opacity="0.9" />
        <path d="M0,860 L160,820 L320,860 L500,790 L680,860 L860,810 L1040,860 L1240,780 L1440,860 L1680,800 L1920,850 L1920,1080 L0,1080 Z" fill="#030612" />
        <circle cx="500" cy="800" r="7" fill="#f59e0b" />
        <circle cx="1240" cy="790" r="7" fill="#f59e0b" />
      </svg>
    )
  },
  caves: {
    name: 'Deepslate & Amethyst',
    subtitle: 'Luminous purple crystal geodes and subterranean depths',
    previewColor: '#3b0764',
    render: () => (
      <svg className="w-full h-full object-cover" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="caveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#020005" />
            <stop offset="60%" stopColor="#0d0117" />
            <stop offset="100%" stopColor="#06000c" />
          </linearGradient>
        </defs>
        <rect width="1920" height="1080" fill="url(#caveGrad)" />
        <polygon points="500,0 560,0 530,480" fill="#07020d" />
        <polygon points="1280,0 1340,0 1310,440" fill="#07020d" />
        <polygon points="960,480 940,540 980,540" fill="#d946ef" opacity="0.85" />
        <polygon points="990,500 975,550 1005,550" fill="#a855f7" opacity="0.8" />
      </svg>
    )
  }
};

export const WALLPAPER_PRESET_OPTIONS = Object.keys(WALLPAPER_PRESETS).map(key => ({
  id: key,
  name: WALLPAPER_PRESETS[key].name,
  subtitle: WALLPAPER_PRESETS[key].subtitle,
  previewColor: WALLPAPER_PRESETS[key].previewColor
}));

interface BackgroundSystemProps {
  settings: BackgroundSettings;
}

export const BackgroundSystem: React.FC<BackgroundSystemProps> = ({ settings }) => {
  if (!settings.enabled) {
    return (
      <div className="fixed inset-0 -z-30 bg-[#05040f] pointer-events-none" />
    );
  }

  // Determine overlay style matching the user's requested linear gradient:
  // linear-gradient(180deg, rgba(5, 4, 15, 0.55), rgba(8, 5, 25, 0.72))
  const getOverlayStyle = () => {
    switch (settings.overlay) {
      case 'none':
        return { background: 'transparent' };
      case 'light':
        return { background: 'linear-gradient(180deg, rgba(5, 4, 15, 0.35), rgba(8, 5, 25, 0.50))' };
      case 'medium':
        return { background: 'linear-gradient(180deg, rgba(5, 4, 15, 0.55), rgba(8, 5, 25, 0.72))' };
      case 'dark':
        return { background: 'linear-gradient(180deg, rgba(5, 4, 15, 0.75), rgba(8, 5, 25, 0.88))' };
      case 'ultra':
        return { background: 'linear-gradient(180deg, rgba(5, 4, 15, 0.90), rgba(8, 5, 25, 0.96))' };
      default:
        return { background: 'linear-gradient(180deg, rgba(5, 4, 15, 0.55), rgba(8, 5, 25, 0.72))' };
    }
  };

  const currentPreset = WALLPAPER_PRESETS[settings.preset] || WALLPAPER_PRESETS.default;

  return (
    <>
      {/* LAYER 1: Full-Screen Fixed Wallpaper (.app-background) */}
      <div
        className="app-background fixed inset-0 w-full h-full -z-30 overflow-hidden pointer-events-none select-none"
        style={{
          opacity: settings.opacity,
          filter: settings.blur > 0 ? `blur(${settings.blur}px)` : undefined,
          transform: settings.blur > 0 ? 'scale(1.05)' : 'scale(1)',
          transition: settings.reduceMotion ? 'none' : 'opacity 0.5s ease, filter 0.5s ease',
          backgroundPosition: settings.position || 'center',
          backgroundSize: settings.size || 'cover'
        }}
      >
        {settings.preset === 'custom' && settings.customUrl ? (
          <img
            src={settings.customUrl}
            alt="Minecraft Wallpaper"
            className="w-full h-full object-cover"
            style={{
              objectPosition: settings.position || 'center'
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          currentPreset.render()
        )}
      </div>

      {/* LAYER 2: Dark Transparent Overlay (.background-overlay) */}
      <div
        className="background-overlay fixed inset-0 -z-20 pointer-events-none transition-colors duration-500"
        style={getOverlayStyle()}
      />

      {/* LAYER 3: Atmospheric Purple/Indigo Ambient Glow */}
      <div className="fixed top-0 left-1/4 w-[700px] h-[700px] bg-purple-600/10 rounded-full blur-[160px] pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-1/4 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[180px] pointer-events-none -z-10" />

      {/* Optional Vignette */}
      {settings.vignette && (
        <div
          className="fixed inset-0 pointer-events-none -z-10"
          style={{
            background: 'radial-gradient(circle at center, transparent 40%, rgba(3, 2, 8, 0.70) 100%)'
          }}
        />
      )}

      {/* Optional Subtle Particles */}
      {settings.particles && (
        <div
          className="fixed inset-0 opacity-[0.025] pointer-events-none -z-10"
          style={{
            backgroundImage: `radial-gradient(circle, #c084fc 1px, transparent 1px)`,
            backgroundSize: '36px 36px'
          }}
        />
      )}
    </>
  );
};

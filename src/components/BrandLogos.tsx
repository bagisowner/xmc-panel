import React from 'react';

// Real Minecraft 3D Isometric Grass Block with authentic pixel art texture
export const MinecraftLogo: React.FC<{ className?: string; size?: number }> = ({ className = 'w-10 h-10', size }) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size ? { width: size, height: size } : undefined}
  >
    {/* Shadow base */}
    <ellipse cx="32" cy="56" rx="24" ry="6" fill="#000000" fillOpacity="0.35" />
    
    {/* 3D Isometric Cube Faces */}
    {/* TOP FACE (Grass) */}
    <path
      d="M32 4 L58 19 L32 34 L6 19 Z"
      fill="#5b8731"
    />
    {/* Top Face Pixel Grid Details */}
    <path d="M32 4 L45 11.5 L32 19 L19 11.5 Z" fill="#6ba038" />
    <path d="M45 11.5 L58 19 L45 26.5 L32 19 Z" fill="#4d7328" />
    <path d="M19 11.5 L32 19 L19 26.5 L6 19 Z" fill="#639334" />
    <path d="M32 19 L45 26.5 L32 34 L19 26.5 Z" fill="#58832f" />
    {/* High-frequency grass highlights */}
    <polygon points="26,12 32,8 38,12 32,15" fill="#7cb342" />
    <polygon points="39,20 45,16 51,20 45,23" fill="#689f38" />
    <polygon points="13,20 19,16 25,20 19,23" fill="#7cb342" />
    <polygon points="26,27 32,23 38,27 32,30" fill="#8bc34a" />

    {/* LEFT FACE (Dirt & Overhanging Grass) */}
    <path
      d="M6 19 L32 34 L32 58 L6 43 Z"
      fill="#6d4c33"
    />
    {/* Left Face Shading and Dirt Pixels */}
    <path d="M6 19 L32 34 L32 40 L6 25 Z" fill="#4a3221" />
    {/* Left Grass Hang */}
    <path
      d="M6 19 L12 22.5 L12 27 L18 23.5 L18 30 L25 26 L25 33 L32 34 L32 28 L28 26 L28 23 L22 20 L22 23 L16 19.5 L16 23 L6 19 Z"
      fill="#4d7328"
    />
    <path
      d="M6 19 L10 21.5 L10 25 L16 22 L16 27 L22 24 L22 29 L28 26 L28 30 L32 34 L32 31 L27 28 L27 24 L21 21 L15 18 Z"
      fill="#5b8731"
    />
    {/* Left Dirt Texture Specks */}
    <rect x="12" y="36" width="4" height="4" transform="matrix(0.866 0.5 0 1 0 0)" fill="#543825" />
    <rect x="20" y="40" width="5" height="4" transform="matrix(0.866 0.5 0 1 0 0)" fill="#865e3c" />
    <rect x="8" y="32" width="3" height="3" transform="matrix(0.866 0.5 0 1 0 0)" fill="#3d2719" />
    <rect x="16" y="47" width="4" height="4" transform="matrix(0.866 0.5 0 1 0 0)" fill="#543825" />
    <rect x="26" y="44" width="3" height="4" transform="matrix(0.866 0.5 0 1 0 0)" fill="#3d2719" />

    {/* RIGHT FACE (Dirt with Light Shading & Overhanging Grass) */}
    <path
      d="M32 34 L58 19 L58 43 L32 58 Z"
      fill="#5d3f2a"
    />
    {/* Right Face Dark Base Accent */}
    <path d="M32 34 L58 19 L58 24 L32 39 Z" fill="#3f291b" />
    {/* Right Grass Hang */}
    <path
      d="M32 34 L39 30 L39 25 L45 28 L45 23 L52 27 L52 21 L58 19 L58 24 L54 26 L54 30 L48 27 L48 32 L41 29 L41 35 L32 34 Z"
      fill="#3e5d1e"
    />
    <path
      d="M32 34 L37 31 L37 27 L43 30 L43 25 L49 28 L49 23 L55 26 L58 19 L58 22 L53 24 L47 21 L41 23 L36 26 Z"
      fill="#4d7328"
    />
    {/* Right Dirt Texture Specks */}
    <rect x="36" y="24" width="4" height="4" transform="matrix(0.866 -0.5 0 1 0 0)" fill="#4a3120" />
    <rect x="44" y="28" width="5" height="4" transform="matrix(0.866 -0.5 0 1 0 0)" fill="#7a5436" />
    <rect x="38" y="36" width="4" height="3" transform="matrix(0.866 -0.5 0 1 0 0)" fill="#362215" />
    <rect x="48" y="34" width="4" height="4" transform="matrix(0.866 -0.5 0 1 0 0)" fill="#7a5436" />
    <rect x="40" y="44" width="5" height="3" transform="matrix(0.866 -0.5 0 1 0 0)" fill="#4a3120" />

    {/* Front edge lighting */}
    <line x1="32" y1="34" x2="32" y2="58" stroke="#ffffff" strokeOpacity="0.15" strokeWidth="1" />
  </svg>
);

// PaperMC Official Origami Paper Crane/Airplane Logo
export const PaperLogo: React.FC<{ className?: string; size?: number }> = ({ className = 'w-8 h-8', size }) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size ? { width: size, height: size } : undefined}
  >
    <defs>
      <linearGradient id="paperGrad1" x1="8" y1="12" x2="56" y2="52" gradientUnits="userSpaceOnUse">
        <stop stopColor="#00d2ff" />
        <stop offset="1" stopColor="#0066ff" />
      </linearGradient>
      <linearGradient id="paperGrad2" x1="16" y1="8" x2="48" y2="40" gradientUnits="userSpaceOnUse">
        <stop stopColor="#ffffff" stopOpacity="0.9" />
        <stop offset="1" stopColor="#b3e5fc" />
      </linearGradient>
      <linearGradient id="paperGrad3" x1="24" y1="20" x2="40" y2="56" gradientUnits="userSpaceOnUse">
        <stop stopColor="#0052cc" />
        <stop offset="1" stopColor="#002966" />
      </linearGradient>
    </defs>
    {/* Origami Paper Bird Geometry */}
    <path d="M8 32 L32 8 L56 32 L32 24 Z" fill="url(#paperGrad2)" />
    <path d="M8 32 L32 24 L32 56 Z" fill="url(#paperGrad1)" />
    <path d="M56 32 L32 24 L32 56 Z" fill="url(#paperGrad3)" />
    <path d="M32 24 L44 38 L32 56 Z" fill="#0080ff" fillOpacity="0.6" />
    <path d="M32 24 L20 38 L32 56 Z" fill="#00b4d8" fillOpacity="0.6" />
    <circle cx="32" cy="18" r="2.5" fill="#003366" />
  </svg>
);

// Purpur Official Shulker Purple Logo
export const PurpurLogo: React.FC<{ className?: string; size?: number }> = ({ className = 'w-8 h-8', size }) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size ? { width: size, height: size } : undefined}
  >
    <defs>
      <linearGradient id="purpurShell" x1="10" y1="6" x2="54" y2="58" gradientUnits="userSpaceOnUse">
        <stop stopColor="#bf55ec" />
        <stop offset="1" stopColor="#581845" />
      </linearGradient>
      <linearGradient id="purpurHead" x1="18" y1="20" x2="46" y2="44" gradientUnits="userSpaceOnUse">
        <stop stopColor="#9b59b6" />
        <stop offset="1" stopColor="#4a154b" />
      </linearGradient>
    </defs>
    {/* Upper Shulker Shell */}
    <path d="M12 24 C12 12, 52 12, 52 24 L52 27 L12 27 Z" fill="url(#purpurShell)" stroke="#e082ff" strokeWidth="1.5" />
    <path d="M18 16 L46 16 L46 20 L18 20 Z" fill="#df82ff" fillOpacity="0.5" />
    
    {/* Inner Peek (Head) */}
    <rect x="20" y="26" width="24" height="14" rx="4" fill="url(#purpurHead)" stroke="#300d38" strokeWidth="1.5" />
    {/* Glowing Shulker Eyes */}
    <rect x="24" y="30" width="4" height="5" rx="1" fill="#00ffff" />
    <rect x="36" y="30" width="4" height="5" rx="1" fill="#00ffff" />
    <circle cx="26" cy="32" r="1" fill="#ffffff" />
    <circle cx="38" cy="32" r="1" fill="#ffffff" />

    {/* Lower Shulker Shell */}
    <path d="M12 39 L52 39 L52 46 C52 56, 12 56, 12 46 Z" fill="url(#purpurShell)" stroke="#8e44ad" strokeWidth="1.5" />
    <path d="M16 43 L48 43" stroke="#e082ff" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// Fabric Official Mod Toolchain Logo (Cyan Loom Spool / Hexagonal Core)
export const FabricLogo: React.FC<{ className?: string; size?: number }> = ({ className = 'w-8 h-8', size }) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size ? { width: size, height: size } : undefined}
  >
    <defs>
      <linearGradient id="fabricGrad" x1="12" y1="8" x2="52" y2="56" gradientUnits="userSpaceOnUse">
        <stop stopColor="#40c4ff" />
        <stop offset="1" stopColor="#0077b6" />
      </linearGradient>
      <linearGradient id="fabricGold" x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop stopColor="#ffd166" />
        <stop offset="1" stopColor="#f77f00" />
      </linearGradient>
    </defs>
    {/* Outer Hexagon */}
    <polygon points="32,6 56,20 56,44 32,58 8,44 8,20" fill="#0b1b2b" stroke="url(#fabricGrad)" strokeWidth="3" />
    {/* Intertwined Fabric Thread / Spool */}
    <path d="M20 22 C20 18, 44 18, 44 26 C44 34, 20 30, 20 38 C20 46, 44 46, 44 42" stroke="url(#fabricGrad)" strokeWidth="4" strokeLinecap="round" />
    <path d="M32 16 L32 48" stroke="url(#fabricGold)" strokeWidth="3" strokeDasharray="3 3" />
    <circle cx="32" cy="32" r="5" fill="#ffffff" />
    <circle cx="32" cy="32" r="2.5" fill="#0077b6" />
  </svg>
);

// Forge Official Minecraft Anvil & Fire Sparks Logo
export const ForgeLogo: React.FC<{ className?: string; size?: number }> = ({ className = 'w-8 h-8', size }) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size ? { width: size, height: size } : undefined}
  >
    <defs>
      <linearGradient id="forgeFire" x1="32" y1="6" x2="32" y2="34" gradientUnits="userSpaceOnUse">
        <stop stopColor="#ffea00" />
        <stop offset="0.4" stopColor="#ff6d00" />
        <stop offset="1" stopColor="#d50000" />
      </linearGradient>
      <linearGradient id="forgeIron" x1="10" y1="26" x2="54" y2="58" gradientUnits="userSpaceOnUse">
        <stop stopColor="#78909c" />
        <stop offset="1" stopColor="#263238" />
      </linearGradient>
    </defs>
    {/* Fire Flames / Sparks from Anvil */}
    <path d="M32 6 C36 14, 44 18, 38 26 C36 22, 34 20, 32 18 C30 22, 26 24, 28 28 C22 24, 26 14, 32 6 Z" fill="url(#forgeFire)" />
    <circle cx="22" cy="14" r="1.5" fill="#ffab00" />
    <circle cx="44" cy="12" r="2" fill="#ff6d00" />
    
    {/* Anvil Horn and Top */}
    <path d="M10 30 L54 30 L54 37 L46 39 L44 47 L50 54 L14 54 L20 47 L18 39 L10 37 Z" fill="url(#forgeIron)" stroke="#90a4ae" strokeWidth="1.5" />
    <rect x="22" y="32" width="20" height="3" fill="#cfd8dc" rx="1" />
    <rect x="18" y="52" width="28" height="4" fill="#1c252a" rx="1" />
  </svg>
);

// Velocity Proxy Supersonic Cyan Wings Logo
export const VelocityLogo: React.FC<{ className?: string; size?: number }> = ({ className = 'w-8 h-8', size }) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size ? { width: size, height: size } : undefined}
  >
    <defs>
      <linearGradient id="veloGrad" x1="6" y1="12" x2="58" y2="52" gradientUnits="userSpaceOnUse">
        <stop stopColor="#00f5d4" />
        <stop offset="1" stopColor="#00bbf9" />
      </linearGradient>
    </defs>
    {/* Aerodynamic Speed Chevrons */}
    <path d="M12 16 L34 32 L12 48 L22 32 Z" fill="url(#veloGrad)" />
    <path d="M28 16 L50 32 L28 48 L38 32 Z" fill="#00f5d4" />
    <polygon points="52,32 46,28 46,36" fill="#ffffff" />
    <line x1="8" y1="32" x2="2" y2="32" stroke="#00f5d4" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// BungeeCord Hub Interconnect Logo
export const BungeeCordLogo: React.FC<{ className?: string; size?: number }> = ({ className = 'w-8 h-8', size }) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size ? { width: size, height: size } : undefined}
  >
    <defs>
      <linearGradient id="bungeeAmber" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
        <stop stopColor="#f59e0b" />
        <stop offset="1" stopColor="#b45309" />
      </linearGradient>
    </defs>
    {/* Connected Nodes / Network Portal Loop */}
    <circle cx="20" cy="20" r="10" fill="#1e1b4b" stroke="url(#bungeeAmber)" strokeWidth="3" />
    <circle cx="44" cy="44" r="10" fill="#1e1b4b" stroke="url(#bungeeAmber)" strokeWidth="3" />
    <circle cx="44" cy="20" r="7" fill="#1e1b4b" stroke="#3b82f6" strokeWidth="2.5" />
    <circle cx="20" cy="44" r="7" fill="#1e1b4b" stroke="#10b981" strokeWidth="2.5" />
    {/* Intertwined Elastic Cord */}
    <path d="M20 20 C20 44, 44 20, 44 44" stroke="url(#bungeeAmber)" strokeWidth="4" strokeLinecap="round" />
    <circle cx="32" cy="32" r="4" fill="#fbbf24" />
  </svg>
);

// Rust Game Real Cogwheel Hazard Logo
export const RustLogo: React.FC<{ className?: string; size?: number }> = ({ className = 'w-8 h-8', size }) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size ? { width: size, height: size } : undefined}
  >
    <rect x="8" y="8" width="48" height="48" rx="10" fill="#cd412b" />
    <path d="M32 14 L36 22 L45 20 L44 29 L52 32 L44 35 L45 44 L36 42 L32 50 L28 42 L19 44 L20 35 L12 32 L20 29 L19 20 L28 22 Z" fill="#ffffff" />
    <circle cx="32" cy="32" r="7" fill="#cd412b" />
    <circle cx="32" cy="32" r="3" fill="#ffffff" />
  </svg>
);

// Palworld Game Pal Sphere Logo
export const PalworldLogo: React.FC<{ className?: string; size?: number }> = ({ className = 'w-8 h-8', size }) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size ? { width: size, height: size } : undefined}
  >
    <circle cx="32" cy="32" r="24" fill="#1e293b" stroke="#38bdf8" strokeWidth="3" />
    <circle cx="32" cy="32" r="16" fill="#0284c7" />
    <path d="M32 12 L35 24 L47 24 L37 31 L41 43 L32 35 L23 43 L27 31 L17 24 L29 24 Z" fill="#facc15" />
    <circle cx="32" cy="32" r="6" fill="#ffffff" />
  </svg>
);

// Valheim Viking Shield Logo
export const ValheimLogo: React.FC<{ className?: string; size?: number }> = ({ className = 'w-8 h-8', size }) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size ? { width: size, height: size } : undefined}
  >
    <circle cx="32" cy="32" r="24" fill="#78350f" stroke="#d97706" strokeWidth="4" />
    <circle cx="32" cy="32" r="18" stroke="#451a03" strokeWidth="2" strokeDasharray="4 2" />
    <circle cx="32" cy="32" r="8" fill="#1c1917" stroke="#d97706" strokeWidth="3" />
    <circle cx="32" cy="32" r="3" fill="#fbbf24" />
    {/* Cross Straps */}
    <line x1="8" y1="32" x2="56" y2="32" stroke="#451a03" strokeWidth="2" />
    <line x1="32" y1="8" x2="32" y2="56" stroke="#451a03" strokeWidth="2" />
  </svg>
);

export const SoftwareLogo: React.FC<{
  name: string;
  defaultComponent: React.FC<{ className?: string; size?: number }>;
  className?: string;
  size?: number;
}> = ({ name, defaultComponent: DefaultComp, className, size }) => {
  const [customUrl, setCustomUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch('/api/system-settings')
      .then(res => res.json())
      .then(data => {
        if (data && data[name]) {
          setCustomUrl(data[name]);
        }
      })
      .catch(() => {});
  }, [name]);

  if (customUrl) {
    return (
      <img
        src={customUrl}
        className="w-full h-full object-cover rounded-lg"
        style={size ? { width: size, height: size } : undefined}
        alt={name}
      />
    );
  }
  return <DefaultComp className={className} size={size} />;
};


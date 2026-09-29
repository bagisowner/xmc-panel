import { StreamLanguage, LanguageSupport } from '@codemirror/language';
import { CompletionContext, CompletionResult, autocompletion } from '@codemirror/autocomplete';
import { hoverTooltip } from '@codemirror/view';
import { linter, Diagnostic } from '@codemirror/lint';

export interface PropertyDefinition {
  key: string;
  label: string;
  description: string;
  category: 'gameplay' | 'world' | 'players' | 'performance' | 'advanced';
  type: 'boolean' | 'select' | 'number' | 'text';
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  defaultVal?: string;
}

export const KNOWN_PROPERTIES: PropertyDefinition[] = [
  // Gameplay
  {
    key: 'gamemode',
    label: 'Default Game Mode',
    description: 'The game mode players will spawn in when joining for the first time.',
    category: 'gameplay',
    type: 'select',
    defaultVal: 'survival',
    options: [
      { value: 'survival', label: 'Survival' },
      { value: 'creative', label: 'Creative' },
      { value: 'adventure', label: 'Adventure' },
      { value: 'spectator', label: 'Spectator' },
    ],
  },
  {
    key: 'difficulty',
    label: 'Combat Difficulty',
    description: 'Governs combat difficulty, hunger depletion, and hostile mob attack damage.',
    category: 'gameplay',
    type: 'select',
    defaultVal: 'easy',
    options: [
      { value: 'peaceful', label: 'Peaceful' },
      { value: 'easy', label: 'Easy' },
      { value: 'normal', label: 'Normal' },
      { value: 'hard', label: 'Hard' },
    ],
  },
  {
    key: 'pvp',
    label: 'Player vs Player (PvP)',
    description: 'Enable or disable combat and friendly fire between players.',
    category: 'gameplay',
    type: 'boolean',
    defaultVal: 'true',
  },
  {
    key: 'hardcore',
    label: 'Hardcore Mode',
    description: 'Locks difficulty to Hard and permanently puts players in spectator mode upon death.',
    category: 'gameplay',
    type: 'boolean',
    defaultVal: 'false',
  },
  {
    key: 'allow-flight',
    label: 'Allow Flight',
    description: 'Permits players in Survival mode to fly using mods or elytra without being kicked.',
    category: 'gameplay',
    type: 'boolean',
    defaultVal: 'false',
  },
  {
    key: 'force-gamemode',
    label: 'Force Gamemode',
    description: 'Forces all reconnecting players to reset to the default game mode.',
    category: 'gameplay',
    type: 'boolean',
    defaultVal: 'false',
  },
  {
    key: 'enable-command-block',
    label: 'Command Blocks',
    description: 'Allow command blocks to execute server console commands.',
    category: 'gameplay',
    type: 'boolean',
    defaultVal: 'false',
  },

  // World & Spawning
  {
    key: 'level-name',
    label: 'World Folder Name',
    description: 'The name of the world directory stored in the root server folder.',
    category: 'world',
    type: 'text',
    defaultVal: 'world',
  },
  {
    key: 'level-seed',
    label: 'World Generation Seed',
    description: 'Custom seed for terrain generator. Leave blank for a random seed.',
    category: 'world',
    type: 'text',
    defaultVal: '',
  },
  {
    key: 'level-type',
    label: 'World Type',
    description: 'Specifies terrain generation type (e.g. normal, flat, large_biomes, amplified).',
    category: 'world',
    type: 'select',
    defaultVal: 'minecraft:normal',
    options: [
      { value: 'minecraft:normal', label: 'Default / Normal' },
      { value: 'minecraft:flat', label: 'Superflat' },
      { value: 'minecraft:large_biomes', label: 'Large Biomes' },
      { value: 'minecraft:amplified', label: 'Amplified' },
    ],
  },
  {
    key: 'allow-nether',
    label: 'Allow Nether Dimension',
    description: 'Enable portal teleportation and world generation for the Nether dimension.',
    category: 'world',
    type: 'boolean',
    defaultVal: 'true',
  },
  {
    key: 'generate-structures',
    label: 'Generate Structures',
    description: 'Spawns villages, dungeons, ocean monuments, and nether fortresses in generated chunks.',
    category: 'world',
    type: 'boolean',
    defaultVal: 'true',
  },
  {
    key: 'spawn-monsters',
    label: 'Spawn Monsters',
    description: 'Controls hostile mob spawning (Zombies, Skeletons, Creepers, Endermen).',
    category: 'world',
    type: 'boolean',
    defaultVal: 'true',
  },
  {
    key: 'spawn-animals',
    label: 'Spawn Animals',
    description: 'Controls passive mob spawning (Cows, Pigs, Sheep, Chickens).',
    category: 'world',
    type: 'boolean',
    defaultVal: 'true',
  },
  {
    key: 'spawn-npcs',
    label: 'Spawn Villagers / NPCs',
    description: 'Spawns villagers, wandering traders, and iron golems.',
    category: 'world',
    type: 'boolean',
    defaultVal: 'true',
  },
  {
    key: 'spawn-protection',
    label: 'Spawn Protection Radius',
    description: 'Radius in blocks around world spawn where non-operators cannot build or break blocks.',
    category: 'world',
    type: 'number',
    min: 0,
    max: 100,
    defaultVal: '16',
  },

  // Players & Access
  {
    key: 'motd',
    label: 'Message of the Day (MOTD)',
    description: 'The server description shown in the Minecraft in-game multiplayer server list.',
    category: 'players',
    type: 'text',
    defaultVal: 'A Minecraft Server',
  },
  {
    key: 'max-players',
    label: 'Max Connected Players',
    description: 'Maximum simultaneous player connections allowed on this instance.',
    category: 'players',
    type: 'number',
    min: 1,
    max: 1000,
    defaultVal: '20',
  },
  {
    key: 'online-mode',
    label: 'Online Mode (Mojang Auth)',
    description: 'Authenticates players against official Mojang/Microsoft servers. Disable for offline/cracked clients.',
    category: 'players',
    type: 'boolean',
    defaultVal: 'true',
  },
  {
    key: 'white-list',
    label: 'Enable Whitelist',
    description: 'Only players explicitly added to whitelist.json can join.',
    category: 'players',
    type: 'boolean',
    defaultVal: 'false',
  },
  {
    key: 'enforce-whitelist',
    label: 'Enforce Whitelist',
    description: 'Disconnects active players immediately if removed from the whitelist.',
    category: 'players',
    type: 'boolean',
    defaultVal: 'false',
  },
  {
    key: 'player-idle-timeout',
    label: 'AFK Idle Timeout (Minutes)',
    description: 'Kicks idle players after specified minutes. Set to 0 to disable AFK kicking.',
    category: 'players',
    type: 'number',
    min: 0,
    max: 120,
    defaultVal: '0',
  },

  // Performance & Engine
  {
    key: 'view-distance',
    label: 'View Distance (Chunks)',
    description: 'Max chunk render radius sent to clients. Lowering reduces RAM & CPU load.',
    category: 'performance',
    type: 'number',
    min: 2,
    max: 32,
    defaultVal: '10',
  },
  {
    key: 'simulation-distance',
    label: 'Simulation Distance (Chunks)',
    description: 'Max chunk radius around players where entities tick and crops grow.',
    category: 'performance',
    type: 'number',
    min: 2,
    max: 32,
    defaultVal: '10',
  },
  {
    key: 'server-port',
    label: 'Server Port',
    description: 'Network listening port for Minecraft game traffic.',
    category: 'performance',
    type: 'number',
    min: 1024,
    max: 65535,
    defaultVal: '25565',
  },
  {
    key: 'sync-chunk-writes',
    label: 'Synchronous Chunk Writes',
    description: 'Forces chunk data to write immediately to disk. Prevents world corruption upon sudden stops.',
    category: 'performance',
    type: 'boolean',
    defaultVal: 'true',
  },
  {
    key: 'network-compression-threshold',
    label: 'Compression Threshold',
    description: 'Packet size threshold (in bytes) before compression kicks in. Default 256.',
    category: 'performance',
    type: 'number',
    min: -1,
    max: 1024,
    defaultVal: '256',
  },
  {
    key: 'max-tick-time',
    label: 'Max Tick Time (Watchdog ms)',
    description: 'Max milliseconds a tick can take before the watchdog stops the server. -1 disables watchdog.',
    category: 'performance',
    type: 'number',
    min: -1,
    max: 120000,
    defaultVal: '60000',
  },
];

const KNOWN_MAP = new Map<string, PropertyDefinition>(
  KNOWN_PROPERTIES.map(p => [p.key, p])
);

// StreamLanguage parser for Minecraft server.properties & INI style files
export const propertiesLanguage = StreamLanguage.define<{ inKey: boolean }>({
  startState: () => ({ inKey: true }),
  token: (stream, state) => {
    // Whitespace
    if (stream.eatSpace()) return null;

    // Comments (# or !)
    if (stream.peek() === '#' || stream.peek() === '!') {
      stream.skipToEnd();
      return 'comment';
    }

    // Section header [Section]
    if (stream.peek() === '[') {
      stream.skipToEnd();
      return 'heading';
    }

    // Key definition before = or :
    if (state.inKey) {
      if (stream.match(/^[a-zA-Z0-9_\-.]+/)) {
        state.inKey = false;
        return 'propertyName';
      }
    }

    // Separators = or :
    if (stream.eat('=') || stream.eat(':')) {
      state.inKey = false;
      return 'operator';
    }

    // Values after = or :
    // Boolean
    if (stream.match(/^(true|false)\b/i)) {
      return 'bool';
    }
    // Number (including negative)
    if (stream.match(/^-?[0-9]+\b/)) {
      return 'number';
    }
    // Color code / Minecraft formatting e.g. §a or \u00A7
    if (stream.match(/^§[0-9a-fk-or]/i)) {
      return 'keyword';
    }
    // General string / value
    stream.skipToEnd();
    state.inKey = true;
    return 'string';
  },
  languageData: {
    commentTokens: { line: '#' },
  },
});

export function getPropertiesLanguageSupport(): LanguageSupport {
  return new LanguageSupport(propertiesLanguage);
}

// Minecraft Autocomplete Extension
export const minecraftPropertiesAutocomplete = autocompletion({
  override: [
    (context: CompletionContext): CompletionResult | null => {
      const line = context.state.doc.lineAt(context.pos);
      const textBefore = line.text.slice(0, context.pos - line.from);

      // Don't autocomplete inside comments
      if (textBefore.trim().startsWith('#') || textBefore.trim().startsWith('!')) {
        return null;
      }

      // Check if typing after an equal sign: e.g. "difficulty=" or "online-mode="
      const eqIndex = textBefore.indexOf('=');
      if (eqIndex !== -1 && context.pos - line.from > eqIndex) {
        const propKey = textBefore.slice(0, eqIndex).trim().toLowerCase();
        const valuePrefix = textBefore.slice(eqIndex + 1).trim();
        const prop = KNOWN_MAP.get(propKey);

        const completions = [];
        if (prop) {
          if (prop.type === 'boolean') {
            completions.push(
              { label: 'true', type: 'constant', detail: 'Enable' },
              { label: 'false', type: 'constant', detail: 'Disable' }
            );
          } else if (prop.type === 'select' && prop.options) {
            for (const opt of prop.options) {
              completions.push({
                label: opt.value,
                type: 'enum',
                detail: opt.label,
              });
            }
          }
        } else {
          // Generic boolean completion after =
          completions.push(
            { label: 'true', type: 'constant' },
            { label: 'false', type: 'constant' }
          );
        }

        if (completions.length > 0) {
          return {
            from: line.from + eqIndex + 1 + (textBefore.slice(eqIndex + 1).indexOf(valuePrefix) >= 0 ? textBefore.slice(eqIndex + 1).indexOf(valuePrefix) : 0),
            options: completions,
          };
        }
      }

      // Autocomplete property keys at start of line
      const word = context.matchBefore(/[a-zA-Z0-9_\-.]*/);
      if (!word || (word.from === word.to && !context.explicit)) return null;

      const options = KNOWN_PROPERTIES.map(p => ({
        label: p.key,
        type: 'property',
        detail: `[${p.category}] ${p.label}`,
        info: `${p.description}\nType: ${p.type}${p.defaultVal ? ` (Default: ${p.defaultVal})` : ''}`,
        apply: `${p.key}=`,
      }));

      return {
        from: word.from,
        options,
      };
    },
  ],
});

// Hover Documentation Tooltip
export const minecraftHoverTooltip = hoverTooltip((view, pos) => {
  const line = view.state.doc.lineAt(pos);
  const text = line.text;

  // Ignore comments
  if (text.trim().startsWith('#') || text.trim().startsWith('!')) return null;

  const eqIdx = text.indexOf('=');
  const colonIdx = text.indexOf(':');
  const sepIdx = eqIdx !== -1 ? eqIdx : colonIdx;

  if (sepIdx === -1) return null;

  const col = pos - line.from;
  // If hovering the key part before '='
  if (col <= sepIdx) {
    const key = text.slice(0, sepIdx).trim().toLowerCase();
    const prop = KNOWN_MAP.get(key);
    if (!prop) return null;

    return {
      pos: line.from,
      end: line.from + sepIdx,
      above: true,
      create() {
        const dom = document.createElement('div');
        dom.className = 'cm-tooltip-doc';
        dom.style.cssText = `
          padding: 8px 12px;
          background: #110c28;
          border: 1px solid rgba(168, 85, 247, 0.4);
          border-radius: 8px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.6);
          color: #f1f5f9;
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
          font-size: 11px;
          max-width: 320px;
          z-index: 100;
        `;

        dom.innerHTML = `
          <div style="font-weight: 700; color: #c084fc; font-family: monospace; font-size: 12px; margin-bottom: 2px;">
            ${prop.key}
          </div>
          <div style="font-weight: 600; color: #ffffff; margin-bottom: 4px;">
            ${prop.label}
          </div>
          <div style="color: #cbd5e1; line-height: 1.4; margin-bottom: 6px;">
            ${prop.description}
          </div>
          <div style="display: flex; gap: 8px; font-size: 10px; color: #a855f7; border-top: 1px solid rgba(255,255,255,0.08); pt: 4px;">
            <span><strong>Type:</strong> ${prop.type}</span>
            ${prop.defaultVal !== undefined ? `<span><strong>Default:</strong> ${prop.defaultVal}</span>` : ''}
            ${prop.min !== undefined && prop.max !== undefined ? `<span><strong>Range:</strong> ${prop.min}–${prop.max}</span>` : ''}
          </div>
        `;

        return { dom };
      },
    };
  }

  return null;
});

// Linter: Duplicate Key & Invalid Value Checker (Reliable Schema Only)
export const minecraftPropertiesLinter = linter(view => {
  const diagnostics: Diagnostic[] = [];
  const seenKeys = new Map<string, number>();

  for (let i = 1; i <= view.state.doc.lines; i++) {
    const line = view.state.doc.line(i);
    const text = line.text.trim();

    // Skip empty lines & comments
    if (!text || text.startsWith('#') || text.startsWith('!') || text.startsWith('[')) {
      continue;
    }

    const eqIdx = text.indexOf('=');
    if (eqIdx === -1) continue;

    const rawKey = text.slice(0, eqIdx).trim();
    const rawVal = text.slice(eqIdx + 1).trim();
    const keyLower = rawKey.toLowerCase();

    // Duplicate Key Detection
    if (seenKeys.has(keyLower)) {
      diagnostics.push({
        from: line.from,
        to: line.from + eqIdx,
        severity: 'warning',
        message: `Duplicate property: "${rawKey}" (previously defined on line ${seenKeys.get(keyLower)})`,
      });
    } else {
      seenKeys.set(keyLower, i);
    }

    // Validation for known properties only
    const prop = KNOWN_MAP.get(keyLower);
    if (prop) {
      const valStart = line.from + text.indexOf('=') + 1;
      const valEnd = line.to;

      if (prop.type === 'boolean') {
        const lower = rawVal.toLowerCase();
        if (lower !== 'true' && lower !== 'false') {
          diagnostics.push({
            from: valStart,
            to: valEnd,
            severity: 'error',
            message: `Invalid boolean for "${prop.key}". Expected "true" or "false", got "${rawVal}".`,
          });
        }
      } else if (prop.type === 'number') {
        const num = Number(rawVal);
        if (isNaN(num)) {
          diagnostics.push({
            from: valStart,
            to: valEnd,
            severity: 'error',
            message: `Invalid number for "${prop.key}". Expected integer, got "${rawVal}".`,
          });
        } else {
          if (prop.min !== undefined && num < prop.min) {
            diagnostics.push({
              from: valStart,
              to: valEnd,
              severity: 'error',
              message: `Value ${num} is below minimum allowed value of ${prop.min}.`,
            });
          }
          if (prop.max !== undefined && num > prop.max) {
            diagnostics.push({
              from: valStart,
              to: valEnd,
              severity: 'error',
              message: `Value ${num} exceeds maximum allowed value of ${prop.max}.`,
            });
          }
        }
      } else if (prop.type === 'select' && prop.options) {
        const validValues = prop.options.map(o => o.value.toLowerCase());
        if (!validValues.includes(rawVal.toLowerCase())) {
          diagnostics.push({
            from: valStart,
            to: valEnd,
            severity: 'warning',
            message: `"${rawVal}" is not a recognized value. Valid options: ${validValues.join(', ')}.`,
          });
        }
      }
    }
  }

  return diagnostics;
});

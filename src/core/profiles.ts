export type IniTweakProfileId = 'generic' | 'unreal-engine' | 'unreal-engine-shipping' | 'custom';

export interface IniTweakProfile {
  id: IniTweakProfileId;
  knownSections: string[];
  commentPrefixes: string[];
  supportsArrayMutation: boolean;
  duplicateKeyPolicy: 'allow' | 'warn' | 'last-wins';
  unrealCvarHeuristics: boolean;
}

export const unrealCvarPrefixes = [
  'r.',
  'sg.',
  't.',
  'au.',
  'net.',
  'gc.',
  'fx.',
  'niagara.',
  'wp.',
  'foliage.',
  'grass.',
  'p.',
  'vr.',
  'Slate.',
  'D3D',
  'Game.'
];

const commonSections = [
  'SystemSettings',
  'ConsoleVariables',
  '/Script/Engine.RendererSettings',
  '/Script/Engine.Engine',
  '/Script/Engine.GameUserSettings',
  '/Script/EngineSettings.GameMapsSettings'
];

export function getProfile(id: string | undefined): IniTweakProfile {
  if (id === 'generic') {
    return {
      id: 'generic',
      knownSections: [],
      commentPrefixes: [';', '#'],
      supportsArrayMutation: false,
      duplicateKeyPolicy: 'allow',
      unrealCvarHeuristics: false
    };
  }

  if (id === 'unreal-engine-shipping') {
    return {
      id: 'unreal-engine-shipping',
      knownSections: commonSections,
      commentPrefixes: [';', '#'],
      supportsArrayMutation: true,
      duplicateKeyPolicy: 'warn',
      unrealCvarHeuristics: true
    };
  }

  return {
    id: id === 'custom' ? 'custom' : 'unreal-engine',
    knownSections: commonSections,
    commentPrefixes: [';', '#'],
    supportsArrayMutation: true,
    duplicateKeyPolicy: 'warn',
    unrealCvarHeuristics: true
  };
}

export function looksLikeUnrealCvar(key: string): boolean {
  return unrealCvarPrefixes.some((prefix) => key.startsWith(prefix)) || /^[a-z][\w]*\.[\w.]+$/i.test(key);
}

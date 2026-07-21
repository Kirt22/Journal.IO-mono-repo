import type { AppTheme } from '../../theme/theme';

export type BrainMapColorMode = 'dark' | 'light';

export type BrainMapColors = {
  background: string;
  node: string;
  nodeHot: string;
  selectedNode: string;
  outline: string;
  edge: string;
  edgeActive: string;
  text: string;
  muted: string;
  card: string;
};

export const BRAIN_MAP_COLORS: Record<BrainMapColorMode, BrainMapColors> = {
  dark: {
    background: '#14110F',
    node: '#F0B45E',
    nodeHot: '#FFE2A8',
    selectedNode: '#E87461',
    outline: '#D2AD72',
    edge: 'rgba(240, 180, 94, 0.24)',
    edgeActive: '#F0B45E',
    text: '#FDF6EE',
    muted: '#A89C91',
    card: 'rgba(36, 32, 29, 0.88)',
  },
  light: {
    background: '#FDFCFB',
    node: '#E87461',
    nodeHot: '#F0B45E',
    selectedNode: '#7B4639',
    outline: '#B98253',
    edge: 'rgba(232, 116, 97, 0.24)',
    edgeActive: '#E87461',
    text: '#241F1C',
    muted: '#8C8178',
    card: 'rgba(255, 247, 240, 0.94)',
  },
};

export function getBrainMapColors(theme: AppTheme): BrainMapColors {
  switch (theme.preference) {
    case 'forest':
      return {
        background: theme.colors.background,
        node: '#6E8B6B',
        nodeHot: '#A9C49A',
        selectedNode: '#395E3C',
        outline: '#7F9A76',
        edge: 'rgba(110, 139, 107, 0.28)',
        edgeActive: '#6E8B6B',
        text: theme.colors.foreground,
        muted: theme.colors.mutedForeground,
        card: 'rgba(255, 255, 255, 0.94)',
      };
    case 'sky_blue':
    case 'minimal_grey':
      return {
        background: theme.colors.background,
        node: '#3B82C4',
        nodeHot: '#9FC9EC',
        selectedNode: '#2468A4',
        outline: '#75AADD',
        edge: 'rgba(59, 130, 196, 0.3)',
        edgeActive: '#3B82C4',
        text: theme.colors.foreground,
        muted: theme.colors.mutedForeground,
        card: 'rgba(255, 255, 255, 0.94)',
      };
    case 'soft_peach':
      return {
        background: theme.colors.background,
        node: '#E87461',
        nodeHot: '#F2A278',
        selectedNode: '#8E4638',
        outline: '#C98263',
        edge: 'rgba(232, 116, 97, 0.28)',
        edgeActive: '#E87461',
        text: theme.colors.foreground,
        muted: theme.colors.mutedForeground,
        card: 'rgba(255, 247, 240, 0.95)',
      };
    case 'dark':
    case 'midnight_calm':
      return BRAIN_MAP_COLORS.dark;
    case 'light':
    case 'warm_cream':
    default:
      return BRAIN_MAP_COLORS.light;
  }
}

export function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');

  if (normalized.length !== 6) {
    return hex;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

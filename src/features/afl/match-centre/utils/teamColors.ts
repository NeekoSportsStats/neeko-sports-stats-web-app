export interface TeamColors {
  primary: string;
  secondary: string;
  contrast: string;
}

const AFL_TEAM_COLORS: Record<string, TeamColors> = {
  'adelaide': {
    primary: '#002B5C',
    secondary: '#FFD100',
    contrast: '#FFFFFF',
  },
  'brisbane': {
    primary: '#7C003E',
    secondary: '#F9C300',
    contrast: '#FFFFFF',
  },
  'carlton': {
    primary: '#002A5C',
    secondary: '#FFFFFF',
    contrast: '#FFFFFF',
  },
  'collingwood': {
    primary: '#000000',
    secondary: '#FFFFFF',
    contrast: '#FFFFFF',
  },
  'essendon': {
    primary: '#C8102E',
    secondary: '#000000',
    contrast: '#FFFFFF',
  },
  'fremantle': {
    primary: '#2A1A54',
    secondary: '#FFFFFF',
    contrast: '#FFFFFF',
  },
  'geelong': {
    primary: '#003A70',
    secondary: '#FFFFFF',
    contrast: '#FFFFFF',
  },
  'gold coast': {
    primary: '#D32F2F',
    secondary: '#FFD100',
    contrast: '#FFFFFF',
  },
  'gws': {
    primary: '#F15A22',
    secondary: '#FFFFFF',
    contrast: '#FFFFFF',
  },
  'hawthorn': {
    primary: '#5D4024',
    secondary: '#F9C300',
    contrast: '#FFFFFF',
  },
  'melbourne': {
    primary: '#C8102E',
    secondary: '#002B5C',
    contrast: '#FFFFFF',
  },
  'north melbourne': {
    primary: '#003A8C',
    secondary: '#FFFFFF',
    contrast: '#FFFFFF',
  },
  'port adelaide': {
    primary: '#008C95',
    secondary: '#000000',
    contrast: '#FFFFFF',
  },
  'richmond': {
    primary: '#FFD100',
    secondary: '#000000',
    contrast: '#000000',
  },
  'st kilda': {
    primary: '#C8102E',
    secondary: '#000000',
    contrast: '#FFFFFF',
  },
  'sydney': {
    primary: '#E41E2B',
    secondary: '#FFFFFF',
    contrast: '#FFFFFF',
  },
  'west coast': {
    primary: '#002B5C',
    secondary: '#FFD100',
    contrast: '#FFFFFF',
  },
  'western bulldogs': {
    primary: '#013A9F',
    secondary: '#E31E23',
    contrast: '#FFFFFF',
  },
};

const DEFAULT_COLORS: TeamColors = {
  primary: '#F5C84C',
  secondary: '#FFFFFF',
  contrast: '#FFFFFF',
};

function normalizeTeamName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace('greater western sydney', 'gws')
    .replace('gws giants', 'gws')
    .replace('giants', 'gws')
    .replace(/\s+(tigers|blues|swans|eagles|dockers|demons|bombers|hawks|magpies|saints|kangaroos|power|cats|lions|suns|bulldogs)\s*$/i, '')
    .trim();
}

export function getTeamColors(teamName: string | null | undefined): TeamColors {
  const normalized = normalizeTeamName(teamName);
  return AFL_TEAM_COLORS[normalized] || DEFAULT_COLORS;
}

export function getTeamPair(homeTeam: string | null | undefined, awayTeam: string | null | undefined) {
  const homeColors = getTeamColors(homeTeam);
  const awayColors = getTeamColors(awayTeam);

  if (homeColors.primary === awayColors.primary) {
    return {
      home: homeColors,
      away: {
        ...awayColors,
        primary: awayColors.secondary,
      },
    };
  }

  return {
    home: homeColors,
    away: awayColors,
  };
}

export type Team = 'blue' | 'red';

export type MatchPhase =
  | 'ready'
  | 'shot'
  | 'free-kick-attacker-setup'
  | 'free-kick-defender-setup'
  | 'free-kick-shot';

export interface MatchState {
  scores: Record<Team, number>;
  activeTeam: Team;
  phase: MatchPhase;
  selectedCantaId: string | null;
  foulAwardedTo: Team | null;
  isFreeKickShot: boolean;
}

export const INITIAL_MATCH_STATE: MatchState = {
  scores: { blue: 0, red: 0 },
  activeTeam: 'blue',
  phase: 'ready',
  selectedCantaId: null,
  foulAwardedTo: null,
  isFreeKickShot: false,
};

export function otherTeam(team: Team): Team {
  return team === 'blue' ? 'red' : 'blue';
}

export function startShot(state: MatchState, cantaId: string): MatchState {
  if (state.phase !== 'ready' && state.phase !== 'free-kick-shot') return state;

  return {
    ...state,
    phase: 'shot',
    selectedCantaId: cantaId,
    foulAwardedTo: null,
    isFreeKickShot: state.phase === 'free-kick-shot',
  };
}

export function awardFoul(state: MatchState, offendingTeam: Team): MatchState {
  if (state.phase !== 'shot' || state.foulAwardedTo) return state;

  const awardedTeam = otherTeam(offendingTeam);
  return {
    ...state,
    activeTeam: awardedTeam,
    selectedCantaId: null,
    foulAwardedTo: awardedTeam,
  };
}

export function finishShot(state: MatchState): MatchState {
  if (state.phase !== 'shot') return state;

  if (state.foulAwardedTo) {
    return {
      ...state,
      phase: 'free-kick-attacker-setup',
      selectedCantaId: null,
      isFreeKickShot: false,
    };
  }

  if (state.isFreeKickShot) {
    return {
      ...state,
      activeTeam: otherTeam(state.activeTeam),
      phase: 'ready',
      selectedCantaId: null,
      foulAwardedTo: null,
      isFreeKickShot: false,
    };
  }

  return {
    ...state,
    activeTeam: otherTeam(state.activeTeam),
    phase: 'ready',
    selectedCantaId: null,
  };
}

export function advanceFreeKickSetup(state: MatchState): MatchState {
  if (state.phase === 'free-kick-attacker-setup') {
    return { ...state, phase: 'free-kick-defender-setup', selectedCantaId: null };
  }

  if (state.phase === 'free-kick-defender-setup') {
    return { ...state, phase: 'free-kick-shot', selectedCantaId: null };
  }

  return state;
}

export function teamLabel(team: Team): string {
  return team === 'blue' ? 'BLUE' : 'RED';
}

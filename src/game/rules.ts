export type Team = 'blue' | 'red';

export type MatchPhase = 'ready' | 'shot' | 'set-piece-pending';

export interface MatchState {
  scores: Record<Team, number>;
  activeTeam: Team;
  phase: MatchPhase;
  selectedCantaId: string | null;
  foulAwardedTo: Team | null;
}

export const INITIAL_MATCH_STATE: MatchState = {
  scores: { blue: 0, red: 0 },
  activeTeam: 'blue',
  phase: 'ready',
  selectedCantaId: null,
  foulAwardedTo: null,
};

export function otherTeam(team: Team): Team {
  return team === 'blue' ? 'red' : 'blue';
}

export function startShot(state: MatchState, cantaId: string): MatchState {
  if (state.phase !== 'ready') return state;

  return {
    ...state,
    phase: 'shot',
    selectedCantaId: cantaId,
    foulAwardedTo: null,
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
    return { ...state, phase: 'set-piece-pending', selectedCantaId: null };
  }

  return {
    ...state,
    activeTeam: otherTeam(state.activeTeam),
    phase: 'ready',
    selectedCantaId: null,
  };
}

export function teamLabel(team: Team): string {
  return team === 'blue' ? 'BLUE' : 'RED';
}

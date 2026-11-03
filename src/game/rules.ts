export type Team = 'blue' | 'red';

export interface MatchState {
  scores: Record<Team, number>;
  activeTeam: Team;
  selectedCantaId: string | null;
  turnLocked: boolean;
}

export const INITIAL_MATCH_STATE: MatchState = {
  scores: { blue: 0, red: 0 },
  activeTeam: 'blue',
  selectedCantaId: null,
  turnLocked: false,
};

export function otherTeam(team: Team): Team {
  return team === 'blue' ? 'red' : 'blue';
}

/** A turn changes only after a completed flick; scoring retention is handled separately. */
export function completeTurn(state: MatchState): MatchState {
  return {
    ...state,
    activeTeam: otherTeam(state.activeTeam),
    selectedCantaId: null,
    turnLocked: false,
  };
}

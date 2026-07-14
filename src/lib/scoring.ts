import type { LeagueSettings } from './types';

export interface HandResult {
  winner: 'knocker' | 'defender';
  score: number;
  isUndercut: boolean;
}

export function calculateHand(
  knockerDeadwood: number,
  defenderDeadwood: number,
  isGin: boolean,
  settings: LeagueSettings
): HandResult {
  if (isGin) {
    return {
      winner: 'knocker',
      score: defenderDeadwood + settings.ginBonus,
      isUndercut: false,
    };
  }

  // Undercut: knocker's deadwood >= defender's deadwood
  if (knockerDeadwood >= defenderDeadwood) {
    return {
      winner: 'defender',
      score: knockerDeadwood - defenderDeadwood + settings.undercutBonus,
      isUndercut: true,
    };
  }

  // Normal knock
  return {
    winner: 'knocker',
    score: defenderDeadwood - knockerDeadwood,
    isUndercut: false,
  };
}


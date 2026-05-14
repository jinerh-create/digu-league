export interface Player {
  id: string;
  name: string;
  avatar_b64: string | null;
  joined_at: string;
  active: number; // 1 = active, 0 = inactive
}

export interface Match {
  id: string;
  player1_id: string;
  player2_id: string;
  target_score: number;
  winner_id: string | null;
  started_at: string;
  completed_at: string | null;
  // team fields (optional)
  team1_name: string | null;
  team2_name: string | null;
  team1_player2_id: string | null;
  team2_player2_id: string | null;
  max_rounds: number; // 0 = score-based, >0 = rounds-based
  // joined fields
  player1_name?: string;
  player2_name?: string;
  team1_player2_name?: string;
  team2_player2_name?: string;
  winner_name?: string;
  player1_avatar?: string | null;
  player2_avatar?: string | null;
}

export interface Game {
  id: string;
  match_id: string;
  round_number: number;
  winner_id: string;
  loser_id: string;
  knocker_id: string;
  winner_deadwood: number;
  loser_deadwood: number;
  is_gin: number; // 0 or 1
  is_undercut: number; // 0 or 1
  score_awarded: number;
  timestamp: string;
  // team card counts (nullable, only for 2v2 matches)
  t1_p1_cards?: number | null;
  t1_p2_cards?: number | null;
  t2_p1_cards?: number | null;
  t2_p2_cards?: number | null;
  gin_player_id?: string | null;
}

export interface PlayerStats {
  player_id: string;
  name: string;
  avatar_b64: string | null;
  matches_played: number;
  matches_won: number;
  matches_drawn: number;
  matches_lost: number;
  games_played: number;
  games_won: number;
  total_points_scored: number;
  gin_count: number;
  undercut_count: number;
  biggest_hand: number;
  avg_points_per_game: number;
  win_rate: number;
  league_points: number;
}

export interface LeagueSettings {
  ginBonus: number;
  undercutBonus: number;
}

export const DEFAULT_SETTINGS: LeagueSettings = {
  ginBonus: 25,
  undercutBonus: 25,
};

export interface TeamStats {
  team_name: string;
  matches_played: number;
  matches_won: number;
  matches_drawn: number;
  matches_lost: number;
  league_points: number;
}

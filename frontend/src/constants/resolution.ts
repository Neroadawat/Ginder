/**
 * Human-readable labels for how a session was decided (requirement 9.7).
 *
 * Shared by the result screen and History so the same outcome never reads two
 * different ways. There is deliberately no early-termination entry: sessions
 * always run to completion (requirement 9.1).
 */

import {ResolutionType} from '@/types/api';

export const RESOLUTION_LABELS: Record<ResolutionType, string> = {
  unanimous: '🎉 Everyone agreed',
  majority: '🗳️ Most votes',
  spin_wheel_tie: '🎡 Tie broken by the wheel',
  spin_wheel_no_match: '🎡 Random pick from the wheel',
};

export const RESOLUTION_LABELS_SHORT: Record<ResolutionType, string> = {
  unanimous: '🎉 Unanimous',
  majority: '🗳️ Majority',
  spin_wheel_tie: '🎡 Wheel (tie)',
  spin_wheel_no_match: '🎡 Wheel',
};

/**
 * Human-readable labels for how a session was decided (requirement 9.7).
 *
 * Shared by the result screen and History so the same outcome never reads two
 * different ways. There is deliberately no early-termination entry: sessions
 * always run to completion (requirement 9.1).
 */

import {ResolutionType} from '@/types/api';

export const RESOLUTION_LABELS: Record<ResolutionType, string> = {
  unanimous: '🎉 ทุกคนเลือกตรงกัน',
  majority: '🗳️ คะแนนโหวตสูงสุด',
  spin_wheel_tie: '🎡 สุ่มจากร้านที่คะแนนเท่ากัน',
  spin_wheel_no_match: '🎡 สุ่มเลือกร้าน',
};

export const RESOLUTION_LABELS_SHORT: Record<ResolutionType, string> = {
  unanimous: '🎉 ทุกคนเห็นตรงกัน',
  majority: '🗳️ เสียงส่วนใหญ่',
  spin_wheel_tie: '🎡 สุ่มเมื่อคะแนนเสมอ',
  spin_wheel_no_match: '🎡 วงล้อ',
};

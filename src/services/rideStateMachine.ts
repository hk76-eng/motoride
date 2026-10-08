import { MotorideRide } from '../types/motoride';

/**
 * MotoRide Canonical Ride Status State Machine
 *
 * Allowed progression (Strictly Forward-Only):
 * 1. requested       (rank 1)
 * 2. accepted        (rank 2) [captain_accepted]
 * 3. captain_arriving (rank 3)
 * 4. captain_arrived (rank 4)
 * 5. trip_started    (rank 5) [in_progress]
 * 6. trip_completed  (rank 6) [completed]
 * 7. cancelled       (rank 99) [cancelled_by_passenger, cancelled_by_captain]
 *
 * Status can NEVER move backward to an earlier status.
 */

export const STATUS_RANK: Record<string, number> = {
  requested: 1,
  searching: 1,
  accepted: 2,
  captain_accepted: 2,
  captain_offered: 2,
  captain_arriving: 3,
  captain_assigned: 3,
  captain_arrived: 4,
  trip_started: 5,
  in_progress: 5,
  trip_completed: 6,
  completed: 6,
  cancelled: 99,
  cancelled_by_passenger: 99,
  cancelled_by_captain: 99,
};

/**
 * Get the numerical lifecycle rank of a ride status.
 */
export function getStatusRank(status: string | null | undefined): number {
  if (!status) return 0;
  return STATUS_RANK[status.toLowerCase()] ?? 0;
}

/**
 * Validates whether transitioning from `currentStatus` to `nextStatus` is permitted.
 * Status can ONLY advance forward in lifecycle or be cancelled prior to completion.
 */
export function canTransitionStatus(
  currentStatus: string | null | undefined,
  nextStatus: string | null | undefined
): boolean {
  if (!nextStatus) return false;
  if (!currentStatus) return true;

  const currentRank = getStatusRank(currentStatus);
  const nextRank = getStatusRank(nextStatus);

  // If already terminal (completed or cancelled), reject all transitions
  if (currentRank >= 6) {
    return false;
  }

  // Cancellation (rank 99) is allowed from any active pre-completion phase
  if (nextRank === 99) {
    return currentRank < 6;
  }

  // Forward-only progression: nextRank must be greater than or equal to currentRank
  return nextRank >= currentRank;
}

/**
 * Checks whether an incoming status (from Realtime, SSE, or poll) should be applied over the current status.
 * Rejects stale, out-of-order, or backwards events.
 */
export function shouldApplyIncomingStatus(
  currentStatus: string | null | undefined,
  incomingStatus: string | null | undefined
): boolean {
  if (!incomingStatus) return false;
  if (!currentStatus) return true;

  const currentRank = getStatusRank(currentStatus);
  const incomingRank = getStatusRank(incomingStatus);

  // Once completed (rank 6) or cancelled (rank 99), NEVER allow an earlier status
  if (currentRank >= 6 && incomingRank < currentRank) {
    return false;
  }

  // Stale backwards status: ignore
  if (incomingRank < currentRank) {
    return false;
  }

  return true;
}

/**
 * Resolves the authoritative state when merging two ride representations.
 * Guarantees that the higher rank status always wins and terminal states are locked.
 */
export function resolveAuthoritativeRide(
  current: MotorideRide | null | undefined,
  incoming: MotorideRide | null | undefined
): MotorideRide {
  if (!current) return (incoming ? { ...incoming } : ({} as MotorideRide));
  if (!incoming) return { ...current };

  const currentRank = getStatusRank(current.status);
  const incomingRank = getStatusRank(incoming.status);

  // Determine authoritative status
  let finalStatus = current.status;
  if (incomingRank > currentRank) {
    finalStatus = incoming.status;
  } else if (incomingRank === currentRank) {
    const curTime = new Date(current.updated_at || 0).getTime();
    const inTime = new Date(incoming.updated_at || 0).getTime();
    finalStatus = inTime >= curTime ? incoming.status : current.status;
  } else {
    // incomingRank < currentRank: STALE EVENT! Retain current status!
    finalStatus = current.status;
  }

  // Terminal states guard: once trip_completed or cancelled, NEVER revert
  if (currentRank >= 6 && incomingRank < currentRank) {
    finalStatus = current.status;
  }

  // Base merge order depends on which record is newer in the state machine
  const baseRide = incomingRank > currentRank
    ? { ...current, ...incoming }
    : incomingRank < currentRank
    ? { ...incoming, ...current }
    : (new Date(incoming.updated_at || 0).getTime() >= new Date(current.updated_at || 0).getTime()
        ? { ...current, ...incoming }
        : { ...incoming, ...current });

  const finalRide: MotorideRide = {
    ...baseRide,
    id: current.id || incoming.id,
    status: finalStatus,
    updated_at: new Date(
      Math.max(
        new Date(current.updated_at || 0).getTime(),
        new Date(incoming.updated_at || 0).getTime(),
        Date.now()
      )
    ).toISOString(),
  };

  // Ensure timestamps are preserved
  if (current.trip_started_at || incoming.trip_started_at) {
    finalRide.trip_started_at = current.trip_started_at || incoming.trip_started_at;
  }
  if (current.trip_completed_at || incoming.trip_completed_at) {
    finalRide.trip_completed_at = current.trip_completed_at || incoming.trip_completed_at;
  }

  return finalRide;
}

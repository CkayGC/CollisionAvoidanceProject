import { Agent } from '../classes/Agent';
import { getDistance } from '../utils/vectorMath';
import { AvoidanceConfig } from '../utils/AvoidanceConfig';
import { calculatePathETAs } from '../physics/TimingCalculator';

/** Resolves predicted conflicts in both position and time. */
export function resolvePathConflicts(
  agents: Agent[],
  config: AvoidanceConfig,
  safetyRadius: number = 30
): void {
  if (!config.enableMethodB) return;

  const timeTolerance = 0.25;

  for (let i = 0; i < agents.length; i++) {
    const agentA = agents[i];
    const timelineA = calculatePathETAs(agentA, agentA.path);

    for (let j = i + 1; j < agents.length; j++) {
      const agentB = agents[j];
      const timelineB = calculatePathETAs(agentB, agentB.path);
      let conflictHandled = false;

      // ETA timelines are sorted, so a moving pointer avoids comparing every
      // point with every other point unnecessarily.
      for (let a = 0, b = 0; a < timelineA.length && !conflictHandled; a++) {
        const pointA = timelineA[a];
        while (b < timelineB.length && timelineB[b].eta < pointA.eta - timeTolerance) b++;

        for (
          let candidate = b;
          candidate < timelineB.length && timelineB[candidate].eta <= pointA.eta + timeTolerance;
          candidate++
        ) {
          const pointB = timelineB[candidate];
          if (getDistance(pointA.position, pointB.position) >= safetyRadius) continue;

          // The agent with more distance remaining performs the heading
          // avoidance maneuver; neither agent is slowed.
          const avoidingAgent = getDistance(agentA.position, pointA.position) >
            getDistance(agentB.position, pointB.position) ? agentA : agentB;

          // Method B is deliberately limited to an early, small correction.
          // Normal navigation will bring the agent back to its path.
          if (config.enableMethodB && pointA.eta < 2) {
            avoidingAgent.heading = (avoidingAgent.heading + 5) % 360;
          }

          conflictHandled = true;
          break;
        }
      }
    }
  }
}

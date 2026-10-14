import { Agent } from '../classes/Agent';
import { Vector2D } from '../utils/vectorMath';

export interface TimedPosition {
  position: Vector2D;
  eta: number;
}

/** Calculates cumulative arrival times for points on a predicted path. */
export function calculatePathETAs(agent: Agent, path: Vector2D[]): TimedPosition[] {
  const result: TimedPosition[] = [];
  let elapsed = 0;
  let previous = agent.position;
  const speed = Math.max(agent.velocity, agent.minSpeed, 0.001);

  for (const point of path) {
    const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
    elapsed += distance / speed;
    result.push({ position: point, eta: elapsed });
    previous = point;
  }

  return result;
}

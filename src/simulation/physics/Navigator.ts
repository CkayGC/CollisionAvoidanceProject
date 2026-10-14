import { Agent } from '../classes/Agent';
import { Node } from '../classes/Node';
import { Vector2D } from '../utils/vectorMath';

export type CourseAction = 'LEFT' | 'RIGHT' | 'STRAIGHT';

export interface CourseCommand {
  action: CourseAction;
  angle: number;
}

function normalizeAngle(angle: number) {
  return ((angle + 180) % 360 + 360) % 360 - 180;
}

/** Returns the shortest left/right/straight correction to the target. */
export function getCourseCommand(
  currentHeading: number,
  position: Vector2D,
  target: Vector2D,
  straightThreshold = 3
): CourseCommand {
  const targetHeading = Math.atan2(target.y - position.y, target.x - position.x) * 180 / Math.PI;
  const relativeAngle = normalizeAngle(targetHeading - currentHeading);

  if (Math.abs(relativeAngle) <= straightThreshold) {
    return { action: 'STRAIGHT', angle: 0 };
  }

  return {
    action: relativeAngle < 0 ? 'LEFT' : 'RIGHT',
    angle: Math.abs(relativeAngle)
  };
}

/** Creates a direct leg; Motion applies the bounded course correction. */
export function planRoute(agent: Agent, node: Node): Vector2D[] {
  return [
    { x: agent.position.x, y: agent.position.y },
    { x: node.position.x, y: node.position.y }
  ];
}

/** Detects a projected route folding back through an earlier section. */
export function hasSelfOverlap(path: Vector2D[], minimumPointGap = 5, overlapRadius = 12) {
  if (path.length < minimumPointGap + 1) return false;

  // The predictor intentionally holds the agent at the node after
  // arrival. Those repeated terminal samples are not a route loop.
  let movingEnd = path.length - 1;
  while (
    movingEnd > 0 &&
    Math.hypot(path[movingEnd].x - path[movingEnd - 1].x, path[movingEnd].y - path[movingEnd - 1].y) < 1
  ) {
    movingEnd -= 1;
  }

  for (let i = 0; i <= movingEnd; i++) {
    for (let j = i + minimumPointGap; j <= movingEnd; j++) {
      if (Math.hypot(path[i].x - path[j].x, path[i].y - path[j].y) < overlapRadius) return true;
    }
  }
  return false;
}

/** Creates a temporary outbound leg so the agent can approach again. */
export function planRecoveryRoute(agent: Agent, node: Node): Vector2D[] {
  const toNodeX = node.position.x - agent.position.x;
  const toNodeY = node.position.y - agent.position.y;
  const distance = Math.max(1, Math.hypot(toNodeX, toNodeY));
  const awayX = -toNodeX / distance;
  const awayY = -toNodeY / distance;
  const sideX = -awayY;
  const sideY = awayX;
  const outboundDistance = Math.max(140, agent.velocity * 2);
  const recoveryPoint = {
    x: agent.position.x + awayX * outboundDistance + sideX * outboundDistance * 0.5,
    y: agent.position.y + awayY * outboundDistance + sideY * outboundDistance * 0.5
  };

  return [
    { x: agent.position.x, y: agent.position.y },
    recoveryPoint,
    { x: node.position.x, y: node.position.y }
  ];
}

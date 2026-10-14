import { Agent } from '../classes/Agent';
import { Node } from '../classes/Node';
import { projectVector, Vector2D } from '../utils/vectorMath';
import { getCourseCommand } from './Navigator';

export function updateEntityMotion(
    agent: Agent,
    targetNode: Node,
    targetVelocity: number,
    deltaTime: number,
    priorityWaypoint?: Vector2D,
    prioritySpeedLimit?: number
) {
    // A priority waypoint is used for hard safety constraints such as the
    // viewport boundary. While it is present, do not advance the normal
    // destination route: safety steering must finish before navigation can
    // resume.
    const usingPriorityWaypoint = Boolean(priorityWaypoint);
    let waypoint = priorityWaypoint ?? agent.route[agent.routeIndex] ?? targetNode.position;
    let dx = waypoint.x - agent.position.x;
    let dy = waypoint.y - agent.position.y;
    let distance = Math.hypot(dx, dy);

    // Advance through route points without requiring an exact coordinate hit.
    while (!usingPriorityWaypoint && agent.routeIndex < agent.route.length - 1 && distance <= Math.max(18, agent.velocity * deltaTime * 2)) {
        agent.routeIndex += 1;
        waypoint = agent.route[agent.routeIndex];
        dx = waypoint.x - agent.position.x;
        dy = waypoint.y - agent.position.y;
        distance = Math.hypot(dx, dy);
    }

    // A predictive simulation may already be exactly at its target. Keep it
    // there until the real engine assigns the next destination.
    if (distance < 0.001) {
        if (usingPriorityWaypoint) return;
        agent.position = { x: targetNode.position.x, y: targetNode.position.y };
        agent.velocity = 0;
        return;
    }

    // Use a simple left/right/straight course command toward the next point.
    const command = getCourseCommand(agent.heading, agent.position, waypoint);
    const maxTurn = agent.maxTurnRate * deltaTime;
    const turnAmount = Math.min(command.angle, maxTurn);
    if (command.action === 'LEFT') agent.heading -= turnAmount;
    if (command.action === 'RIGHT') agent.heading += turnAmount;
    agent.heading = (agent.heading + 360) % 360;

    // Reduce speed for large course corrections. This gives the agent a
    // smaller physical turn radius while preserving normal cruise speed on a
    // straight leg. Collision avoidance can still request a lower speed.
    const turnDemand = Math.min(1, command.angle / 90);
    const turnSpeedLimit = agent.maxSpeed * (1 - turnDemand * 0.35);
    const desiredVelocity = Math.min(
        targetVelocity,
        turnSpeedLimit,
        prioritySpeedLimit ?? Number.POSITIVE_INFINITY
    );
    const speedDelta = desiredVelocity - agent.velocity;
    agent.velocity += speedDelta < 0
        ? Math.max(-agent.maxDeceleration * deltaTime, speedDelta)
        : Math.min(agent.maxAcceleration * deltaTime, speedDelta);
    agent.velocity = Math.max(agent.minSpeed, Math.min(agent.maxSpeed, agent.velocity));

    // Distance traveled this frame = velocity * deltaTime
    const distanceMoved = agent.velocity * deltaTime;
    if (distance > 0 && distanceMoved >= distance) {
        agent.position = { x: waypoint.x, y: waypoint.y };
        if (!usingPriorityWaypoint && agent.routeIndex < agent.route.length - 1) agent.routeIndex += 1;
    } else {
        agent.position = projectVector(agent.position, agent.heading, distanceMoved);
    }
}

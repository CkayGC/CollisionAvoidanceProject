import { Agent } from '../classes/Agent';
import { Node } from '../classes/Node';
import { Vector2D } from '../utils/vectorMath';
import { updateEntityMotion } from './Motion';

/**
 * Generates an array of future coordinates outlining the agent's projected trajectory.
 */
export function generateProjectedTrajectory(
    realAgent: Agent,
    targetNode: Node,
    targetVelocity: number,
    lookAheadTime: number = 5,   // Total seconds to forecast into the future
    dotInterval: number = 0.2    // Drop a coordinate dot every 0.2 virtual seconds
): Vector2D[] {
    
    // 1. Create a deep copy / cloned snapshot of the agent's state to mutate virtually
    const virtualAgent: Agent = {
        ...realAgent,
        // Ensure positional objects are decoupled from the real agent
        position: { x: realAgent.position.x, y: realAgent.position.y },
        heading: realAgent.heading,
        velocity: realAgent.velocity,
        path: [] // Clear path array for the ghost simulation
    };

    const coordinates: Vector2D[] = [];
    
    // 2. Setup the virtual frame steps
    const virtualDeltaTime = 0.016; // Simulate a fixed, stable 60 frames per second (16ms)
    let accumulatedTime = 0;
    let timeSinceLastDot = 0;

    // 3. Look-ahead virtual simulation loop
    while (accumulatedTime < lookAheadTime) {
        
        // Advance the ghost agent by one virtual frame step
        updateEntityMotion(virtualAgent, targetNode, targetVelocity, virtualDeltaTime);
        
        // Track the progression of virtual time
        accumulatedTime += virtualDeltaTime;
        timeSinceLastDot += virtualDeltaTime;

        // 4. Interval Check: Is it time to plot a new dot?
        if (timeSinceLastDot >= dotInterval) {
            coordinates.push({
                x: virtualAgent.position.x,
                y: virtualAgent.position.y
            });
            
            // Reset the interval timer (accounting for any minor frame overflow)
            timeSinceLastDot -= dotInterval;
        }
    }

    // Return the completed timeline of future coordinate dots
    return coordinates;
}

export interface Vector2D {
  x: number;
  y: number;
}

export type AgentState = 'IDLE' | 'MOVING' | 'ALIGNING' | 'ARRIVED' | 'DEPARTING';


export interface Agent {
    id: string;

    // Telemetry Data
    position: Vector2D;
    velocity: number;
    heading: number;
    state: AgentState;

    // Route Data
    path: Vector2D[];
    route: Vector2D[];
    routeIndex: number;
    recoveryTicks: number;
    targetNodeID: string;

    // Limitation Data
    maxSpeed: number;
    minSpeed: number;
    maxAcceleration: number;
    maxDeceleration: number;
    maxTurnRate: number;
}

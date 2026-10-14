export interface Vector2D {
  x: number;
  y: number;
}

export type NodeState = 'AVAILABLE' | 'OCCUPIED' | 'CLOSED';


export interface Node  {
    id: string;
    name: string;

    // Position Data
    position: Vector2D;
    orientation: number;
    size: number;

    status: NodeState;

    // Management Data
    activeAgentID: string | null;
    queue: string[];
}

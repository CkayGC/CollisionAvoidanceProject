import { Agent } from './classes/Agent';
import { Node } from './classes/Node';
import { updateEntityMotion } from './physics/Motion';
import { generateProjectedTrajectory } from './physics/TrajectoryPredictor';
import { hasSelfOverlap, planRecoveryRoute, planRoute } from './physics/Navigator';
import { AvoidanceConfig } from './utils/AvoidanceConfig';
import { resolvePathConflicts } from './safety/SeparationSystem';
import { Vector2D } from './utils/vectorMath';

export class SimulationEngine {
  private static readonly MAX_NODES = 10;
  private static readonly MAX_AGENTS = 30;
  private static readonly AGENT_MAX_SPEED = 200;
  private static readonly AGENT_MAX_TURN_RATE = 90;

  // Simulation State Lists
  private agents: Agent[] = [];
  private nodes: Node[] = [];
  private limitsEnabled = true;
  
    // The live toggle states that your React Control Panel will update
  public avoidanceConfig: AvoidanceConfig = {
    enableMethodB: true
  };
  public showProjectedPaths = false;

  // Clock Variables
  private lastTime: number = 0;
  private animationFrameId: number | null = null;
  private isRunning: boolean = false;
  private placementPreview: Vector2D | null = null;
  private nodeToolMode: 'place' | 'remove' | null = null;
  private initialNodesPositioned = false;
  // Clearance between node centres during placement. With viewport walls
  // removed, this is only used to prevent nodes from overlapping each other.
  private static readonly NODE_CLEARANCE = 96;

  // HTML5 Canvas Context for rendering
  private ctx: CanvasRenderingContext2D | null = null;

  constructor() {
    for (let i = 0; i < 3; i++) this.addNode();
  }

  public getAgentCount() { return this.agents.length; }
  public getNodeCount() { return this.nodes.length; }
  public getNodePlacementRadius() { return SimulationEngine.NODE_CLEARANCE; }
  public areLimitsEnabled() { return this.limitsEnabled; }

  public setLimitsEnabled(enabled: boolean) {
    this.limitsEnabled = enabled;
    if (!enabled) return;

    if (this.agents.length > SimulationEngine.MAX_AGENTS) {
      this.agents.splice(SimulationEngine.MAX_AGENTS);
    }

    while (this.nodes.length > SimulationEngine.MAX_NODES) {
      const removed = this.nodes.pop();
      if (removed) this.retargetAgentsAfterNodeRemoval(removed.id);
    }
  }

  public removeAllAgents() {
    this.agents = [];
  }

  public removeAgents(amount: number) {
    const removeCount = Math.min(Math.max(0, Math.floor(amount)), this.agents.length);
    if (removeCount > 0) this.agents.splice(-removeCount, removeCount);
  }

  public addNode() {
    if (this.limitsEnabled && this.nodes.length >= SimulationEngine.MAX_NODES) return;
    const index = this.nodes.length;
    const width = this.ctx?.canvas.width ?? 1000;
    const height = this.ctx?.canvas.height ?? 600;
    for (let attempt = 0; attempt < 100; attempt++) {
      const position = {
        x: Math.random() * Math.max(1, width),
        y: Math.random() * Math.max(1, height)
      };
      if (this.placeNodeAt(position)) return;
    }
  }

  public removeNode() {
    if (this.nodes.length <= 1) return;
    const removed = this.nodes.pop();
    if (!removed) return;
    this.retargetAgentsAfterNodeRemoval(removed.id);
  }

  public setPlacementPreview(position: Vector2D | null) {
    this.placementPreview = position;
  }

  public setNodeToolMode(mode: 'place' | 'remove' | null) {
    this.nodeToolMode = mode;
    if (mode !== 'place') this.placementPreview = null;
  }

  public canPlaceNode(position: Vector2D) {
    const radius = SimulationEngine.NODE_CLEARANCE;
    if (this.limitsEnabled && this.nodes.length >= SimulationEngine.MAX_NODES) return false;
    return this.nodes.every((node) => Math.hypot(node.position.x - position.x, node.position.y - position.y) >= radius * 2);
  }

  public placeNodeAt(position: Vector2D) {
    if (!this.canPlaceNode(position)) return false;
    const index = this.nodes.length;
    this.nodes.push({
      id: `node-${Date.now()}-${index}`,
      name: `Node ${index + 1}`,
      position: { x: position.x, y: position.y },
      orientation: 0, size: 300, status: 'AVAILABLE',
      activeAgentID: null, queue: []
    });
    return true;
  }

  public removeNodeAt(position: Vector2D) {
    const nodeIndex = this.nodes.findIndex((node) =>
      Math.hypot(node.position.x - position.x, node.position.y - position.y) <= 14
    );
    if (nodeIndex < 0 || this.nodes.length <= 1) return false;
    const removed = this.nodes.splice(nodeIndex, 1)[0];
    this.retargetAgentsAfterNodeRemoval(removed.id);
    return true;
  }

  private retargetAgentsAfterNodeRemoval(removedNodeID: string) {
    if (this.nodes.length === 0) return;
    for (const agent of this.agents) {
      if (agent.targetNodeID !== removedNodeID) continue;
      const target = this.nodes[Math.floor(Math.random() * this.nodes.length)];
      agent.targetNodeID = target.id;
      agent.state = 'MOVING';
      agent.route = planRoute(agent, target);
      agent.routeIndex = 1;
      agent.path = [];
      agent.recoveryTicks = 0;
    }
  }

  private chooseLeastTargetedNode(excludedNodeID?: string): Node | null {
    const candidates = this.nodes.filter((node) => node.id !== excludedNodeID);
    if (candidates.length === 0) return null;

    let leastCount = Number.POSITIVE_INFINITY;
    let leastTargeted: Node[] = [];
    for (const node of candidates) {
      const targetCount = this.agents.filter((agent) => agent.targetNodeID === node.id).length;
      if (targetCount < leastCount) {
        leastCount = targetCount;
        leastTargeted = [node];
      } else if (targetCount === leastCount) {
        leastTargeted.push(node);
      }
    }

    return leastTargeted[Math.floor(Math.random() * leastTargeted.length)] ?? null;
  }

  public updateAvoidance(enabled: boolean) {
    this.avoidanceConfig = { enableMethodB: enabled };
  }

  public setPathVisibility(visible: boolean) {
    this.showProjectedPaths = visible;
  }

  public spawnAgents(amount: number) {
    if (this.nodes.length === 0) return;
    const requestedCount = Math.max(0, Math.floor(amount));
    const remainingCapacity = this.limitsEnabled
      ? SimulationEngine.MAX_AGENTS - this.agents.length
      : requestedCount;
    const spawnCount = Math.min(requestedCount, Math.max(0, remainingCapacity));
    if (spawnCount <= 0) return;
    const width = this.ctx?.canvas.width ?? 1000;
    const height = this.ctx?.canvas.height ?? 600;
    for (let i = 0; i < spawnCount; i++) {
      const targetNode = this.chooseLeastTargetedNode();
      if (!targetNode) return;
      this.agents.push({
        id: `agent-${this.agents.length + 1}`,
        position: {
          x: 40 + Math.random() * Math.max(40, width - 80),
          y: 40 + Math.random() * Math.max(40, height - 80)
        },
        velocity: 40 + Math.random() * 60,
        heading: Math.random() * 360,
        state: 'MOVING', path: [], route: [], routeIndex: 0, recoveryTicks: 0,
        targetNodeID: targetNode.id, maxSpeed: SimulationEngine.AGENT_MAX_SPEED, minSpeed: 20,
        maxAcceleration: 30, maxDeceleration: 40,
        maxTurnRate: SimulationEngine.AGENT_MAX_TURN_RATE
      });
      const agent = this.agents[this.agents.length - 1];
      agent.route = planRoute(agent, targetNode);
      agent.routeIndex = 1;
    }
  }

  private positionInitialNodesInCenter() {
    if (!this.ctx) return;
    const width = this.ctx.canvas.width;
    const height = this.ctx.canvas.height;
    const centralPositions = [
      { x: width * 0.35, y: height * 0.35 },
      { x: width * 0.65, y: height * 0.35 },
      { x: width * 0.5, y: height * 0.65 }
    ];

    this.nodes.slice(0, 3).forEach((node, index) => {
      const position = centralPositions[index];
      if (position) node.position = position;
    });

    // If agents were created before the canvas was connected, refresh their
    // route endpoints after the initial nodes move.
    for (const agent of this.agents) {
      const target = this.nodes.find((node) => node.id === agent.targetNodeID);
      if (!target) continue;
      agent.route = planRoute(agent, target);
      agent.routeIndex = 1;
    }
  }

  /**
   * Starts the simulation clock
   */
  public start(canvasElement: HTMLCanvasElement) {
    if (this.isRunning) return;
    
    this.ctx = canvasElement.getContext('2d');
    if (!this.initialNodesPositioned) {
      this.positionInitialNodesInCenter();
      this.initialNodesPositioned = true;
    }
    this.isRunning = true;
    
    // Initialize the timestamp right before starting the loop
    this.lastTime = performance.now();
    
    // Kick off the continuous loop
    this.animationFrameId = requestAnimationFrame((timestamp) => this.loop(timestamp));
  }

  /**
   * Stops the simulation clock
   */
  public stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  /**
   * The Core Clock Loop - Runs roughly 60 to 144+ times per second
   */
  private loop(currentTimestamp: number) {
    if (!this.isRunning) return;

    // 1. Calculate Delta Time (Time passed since the last frame in seconds)
    // performance.now() provides time in milliseconds, so dividing by 1000 converts it to seconds
    let deltaTime = (currentTimestamp - this.lastTime) / 1000;

    // Safety Cap: Protects simulation from breaking if the user switches browser tabs 
    // and returns minutes later (which would cause a massive spike in deltaTime)
    if (deltaTime > 0.1) deltaTime = 0.1;

    // Update lastTime to prepare for the upcoming frame
    this.lastTime = currentTimestamp;

    // 2. RUN SIMULATION TICKS (The Engine Actions)
    this.updateSimulationLogic(deltaTime);
    this.renderSimulationGraphics();

    // 3. Request the next clock cycle from the browser
    this.animationFrameId = requestAnimationFrame((timestamp) => this.loop(timestamp));
  }

  /**
   * Orchestrates updating the data model using your physics scripts
   */
  private updateSimulationLogic(deltaTime: number) {
    // Pass the live config configuration on every single frame tick
    resolvePathConflicts(this.agents, this.avoidanceConfig, 30);

    for (const agent of this.agents) {
      let target = this.nodes.find(node => node.id === agent.targetNodeID);
      if (!target) continue;

      const distanceToTarget = Math.hypot(
        target.position.x - agent.position.x,
        target.position.y - agent.position.y
      );
      const finalApproach = agent.route.length > 0 && agent.routeIndex >= agent.route.length - 1;
      if (finalApproach && distanceToTarget <= 8 && this.nodes.length > 1) {
        agent.position = { x: target.position.x, y: target.position.y };
        const nextTarget = this.chooseLeastTargetedNode(target.id);
        if (!nextTarget) continue;
        target = nextTarget;
        agent.targetNodeID = target.id;
        agent.state = 'MOVING';
        agent.route = planRoute(agent, target);
        agent.routeIndex = 1;
      }

      const finalTargetVelocity = agent.maxSpeed;

      agent.path = generateProjectedTrajectory(agent, target, finalTargetVelocity, 5, 0.2);
      if (agent.recoveryTicks > 0) agent.recoveryTicks -= 1;
      if (agent.recoveryTicks === 0 && hasSelfOverlap(agent.path)) {
        agent.route = planRecoveryRoute(agent, target);
        agent.routeIndex = 1;
        agent.path = [];
        agent.recoveryTicks = 120;
        continue;
      }
      updateEntityMotion(agent, target, finalTargetVelocity, deltaTime);
    }
  }

  /**
   * Clears the viewport screen and draws the newly calculated states
   */
  private renderSimulationGraphics() {
    if (!this.ctx) return;

    // Clear entire viewport canvas frame
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

    // Draw nodes.
    for (const node of this.nodes) {
      this.ctx.fillStyle = '#4ade80';
      this.ctx.beginPath();
      this.ctx.arc(node.position.x, node.position.y, 8, 0, Math.PI * 2);
      this.ctx.fill();
    }

    if (this.nodeToolMode) {
      this.ctx.save();
      this.ctx.strokeStyle = 'rgba(74, 222, 128, 0.25)';
      this.ctx.lineWidth = 1;
      for (const node of this.nodes) {
        this.ctx.beginPath();
        this.ctx.arc(node.position.x, node.position.y, SimulationEngine.NODE_CLEARANCE, 0, Math.PI * 2);
        this.ctx.stroke();
      }
      this.ctx.restore();
    }

    if (this.placementPreview && this.nodeToolMode === 'place') {
      const valid = this.canPlaceNode(this.placementPreview);
      this.ctx.save();
      this.ctx.fillStyle = valid ? 'rgba(74, 222, 128, 0.16)' : 'rgba(248, 113, 113, 0.2)';
      this.ctx.strokeStyle = valid ? '#4ade80' : '#f87171';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(this.placementPreview.x, this.placementPreview.y, SimulationEngine.NODE_CLEARANCE, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.restore();
    }

    if (this.showProjectedPaths) {
      this.ctx.save();
      this.ctx.strokeStyle = 'rgba(96, 165, 250, 0.45)';
      this.ctx.lineWidth = 1;
      this.ctx.setLineDash([4, 5]);
      for (const agent of this.agents) {
        if (agent.path.length === 0) continue;
        this.ctx.beginPath();
        this.ctx.moveTo(agent.position.x, agent.position.y);
        for (const point of agent.path) this.ctx.lineTo(point.x, point.y);
        this.ctx.stroke();
      }
      this.ctx.restore();
    }

    // Draw every simulated agent as a small heading-aware triangle.
    for (const agent of this.agents) {
      const angle = (agent.heading * Math.PI) / 180;
      const { x, y } = agent.position;
      const nose = { x: x + Math.cos(angle) * 12, y: y + Math.sin(angle) * 12 };
      const left = { x: x + Math.cos(angle + 2.5) * 8, y: y + Math.sin(angle + 2.5) * 8 };
      const right = { x: x + Math.cos(angle - 2.5) * 8, y: y + Math.sin(angle - 2.5) * 8 };

      this.ctx.fillStyle = '#60a5fa';
      this.ctx.beginPath();
      this.ctx.moveTo(nose.x, nose.y);
      this.ctx.lineTo(left.x, left.y);
      this.ctx.lineTo(right.x, right.y);
      this.ctx.closePath();
      this.ctx.fill();
    }
  }
}

import { useEffect, useRef, useState } from 'react';
import { SimulationEngine } from '../Engine';
import { Vector2D } from '../utils/vectorMath';
    
export function useSimulation() {
  // 1. Hold the core simulation engine inside a mutable Ref.
  // This keeps the engine instance alive across React renders without causing lags.
  const engineRef = useRef<SimulationEngine>(null!);
  
  // 2. Local UI states. Only used for things the Control Panel needs to look at.
  const [isSimulating, setIsSimulating] = useState(false);
  const [agentCount, setAgentCount] = useState(0);
  const [nodeCount, setNodeCount] = useState(0);
  const [limitsEnabled, setLimitsEnabledState] = useState(true);
  const [pathsVisible, setPathsVisible] = useState(false);

  // 3. Initialize the Engine instance exactly once when the component mounts.
  useEffect(() => {
    engineRef.current = new SimulationEngine();
    setNodeCount(engineRef.current.getNodeCount());

    // Cleanup: Stop the simulation clock immediately if the user leaves the page
    return () => {
      if (engineRef.current) {
        engineRef.current.stop();
      }
    };
  }, []);

  /**
   * Connects an HTML5 <canvas> element to the engine and kicks off the clock loop.
   */
  const startSimulation = (canvasElement: HTMLCanvasElement) => {
    if (!engineRef.current) return;
    engineRef.current.start(canvasElement);
    setIsSimulating(true);
  };

  /**
   * Pauses the simulation clock loop.
   */
  const stopSimulation = () => {
    if (!engineRef.current) return;
    engineRef.current.stop();
    setIsSimulating(false);
  };

  /**
   * Tells the engine to instantiate and route X number of random agents.
   */
  const spawnAgents = (amount: number) => {
    if (!engineRef.current) return;
    
    // Call the engine's internal spawning methods
    engineRef.current.spawnAgents(amount);
    
    // Sync the UI count state so the dashboard updates its display counters
    setAgentCount(engineRef.current.getAgentCount());
  };

  /**
   * Forwards toggle updates from UI checkboxes directly to the collision system config inside the engine.
   */
  const toggleAvoidance = (enabled: boolean) => {
    if (!engineRef.current) return;
    
    engineRef.current.updateAvoidance(enabled);
  };

  const addNode = () => {
    engineRef.current?.addNode();
    setNodeCount(engineRef.current?.getNodeCount() ?? 0);
  };
  const removeNode = () => {
    engineRef.current?.removeNode();
    setNodeCount(engineRef.current?.getNodeCount() ?? 0);
  };
  const setNodePreview = (position: Vector2D | null) => {
    engineRef.current?.setPlacementPreview(position);
  };
  const setNodeToolMode = (mode: 'place' | 'remove' | null) => {
    engineRef.current?.setNodeToolMode(mode);
  };
  const placeNodeAt = (position: Vector2D) => {
    const placed = engineRef.current?.placeNodeAt(position) ?? false;
    if (placed) setNodeCount(engineRef.current?.getNodeCount() ?? 0);
    return placed;
  };
  const removeNodeAt = (position: Vector2D) => {
    const removed = engineRef.current?.removeNodeAt(position) ?? false;
    if (removed) setNodeCount(engineRef.current?.getNodeCount() ?? 0);
    return removed;
  };
  const removeAllAgents = () => {
    engineRef.current?.removeAllAgents();
    setAgentCount(0);
  };
  const removeAgents = (amount: number) => {
    engineRef.current?.removeAgents(amount);
    setAgentCount(engineRef.current?.getAgentCount() ?? 0);
  };
  const setPathVisibility = (visible: boolean) => {
    engineRef.current?.setPathVisibility(visible);
    setPathsVisible(visible);
  };
  const setLimitsEnabled = (enabled: boolean) => {
    engineRef.current?.setLimitsEnabled(enabled);
    setLimitsEnabledState(enabled);
    setAgentCount(engineRef.current?.getAgentCount() ?? 0);
    setNodeCount(engineRef.current?.getNodeCount() ?? 0);
  };

  // Expose these clean handlers and states directly to your React Control Panel UI
  return {
    isSimulating,
    agentCount,
    nodeCount,
    limitsEnabled,
    pathsVisible,
    startSimulation,
    stopSimulation,
    spawnAgents,
    toggleAvoidance,
    addNode,
    removeNode,
    setNodePreview,
    setNodeToolMode,
    placeNodeAt,
    removeNodeAt,
    removeAllAgents,
    removeAgents,
    setPathVisibility,
    setLimitsEnabled,
  };
}

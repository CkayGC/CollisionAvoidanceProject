// src/App.tsx
import { useEffect, useRef, useState } from 'react';
import { useSimulation } from './simulation/hooks/useSimulation';

export default function App() {
  const canvasRef = useRef(null);
  
  // Destructure the clean bridge controllers
  const { 
    isSimulating, 
    agentCount,
    nodeCount,
    limitsEnabled,
    pathsVisible,
    startSimulation, 
    stopSimulation, 
    spawnAgents, 
    toggleAvoidance,
    removeAgents,
    setPathVisibility,
    setNodePreview,
    setNodeToolMode,
    placeNodeAt,
    removeNodeAt,
    setLimitsEnabled
  } = useSimulation();
  const [nodeToolMode, setNodeToolModeState] = useState(null);

  const getCanvasPosition = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };

  const toggleNodeTool = (mode) => {
    const nextValue = nodeToolMode === mode ? null : mode;
    setNodeToolModeState(nextValue);
    setNodeToolMode(nextValue);
    setNodePreview(null);
  };

  const handleCanvasMove = (event) => {
    if (nodeToolMode === 'place') setNodePreview(getCanvasPosition(event));
  };

  const handleCanvasClick = (event) => {
    if (nodeToolMode === 'place') placeNodeAt(getCanvasPosition(event));
    if (nodeToolMode === 'remove') removeNodeAt(getCanvasPosition(event));
  };

  // Automatically start the simulation engine once the canvas DOM node loads
  useEffect(() => {
    if (canvasRef.current) {
      startSimulation(canvasRef.current);
    }
  }, [canvasRef]);

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: '#111' }}>
      
      {/* THE CONTROL PANEL PANEL (Standard React UI) */}
      <div style={{ width: '300px', padding: '20px', color: 'white', borderRight: '1px solid #333' }}>
        <h2>Simulation Controls</h2>
        <p>Active Agents: {agentCount}</p>
        <p>Active Nodes: {nodeCount}</p>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => spawnAgents(5)}>Add 5 Agents</button>
          <button onClick={() => removeAgents(5)}>Remove 5 Agents</button>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <button onClick={() => toggleNodeTool('place')}>
            {nodeToolMode === 'place' ? 'Cancel Placement' : 'Add Node'}
          </button>
          <button onClick={() => toggleNodeTool('remove')}>
            {nodeToolMode === 'remove' ? 'Cancel Removal' : 'Remove Node'}
          </button>
        </div>
        <hr style={{ borderColor: '#333', margin: '20px 0' }} />

        <h3>Settings</h3>
        <label style={{ display: 'block', marginBottom: '10px' }}>
          <span>
            <input 
              type="checkbox" 
              defaultChecked 
              onChange={(e) => toggleAvoidance(e.target.checked)}
            />
            Avoidance
          </span>
          <small style={{ display: 'block', marginLeft: '24px', color: '#aaa', fontSize: '12px' }}>
            Adjusts agent headings to reduce predicted conflicts with other agents.
          </small>
        </label>
        <label style={{ display: 'block', marginBottom: '10px' }}>
          <span>
            <input
              type="checkbox"
              checked={pathsVisible}
              onChange={(e) => setPathVisibility(e.target.checked)}
            />
            Show Paths
          </span>
          <small style={{ display: 'block', marginLeft: '24px', color: '#aaa', fontSize: '12px' }}>
            Displays each agent's projected trajectory on the canvas.
          </small>
        </label>
        <label style={{ display: 'block', marginBottom: '10px' }}>
          <span>
            <input
              type="checkbox"
              checked={limitsEnabled}
              onChange={(e) => setLimitsEnabled(e.target.checked)}
            />
            Limits
          </span>
          <small style={{ display: 'block', marginLeft: '24px', color: '#aaa', fontSize: '12px' }}>
            Caps the simulation at 30 agents and 10 nodes when enabled.
          </small>
        </label>
        
        <button onClick={isSimulating ? stopSimulation : () => canvasRef.current && startSimulation(canvasRef.current)}>
          {isSimulating ? 'Pause Simulation' : 'Resume Simulation'}
        </button>
      </div>

      {/* THE VIEWPORT LAYER (High-Performance HTML5 Canvas) */}
      <div style={{ flex: 1, position: 'relative' }}>
        <canvas 
          ref={canvasRef} 
          onMouseMove={handleCanvasMove}
          onMouseLeave={() => nodeToolMode === 'place' && setNodePreview(null)}
          onClick={handleCanvasClick}
          width={window.innerWidth - 300} 
          height={window.innerHeight} 
          style={{ display: 'block', cursor: nodeToolMode ? 'crosshair' : 'default' }}
        />
      </div>

    </div>
  );
}

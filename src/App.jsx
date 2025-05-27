import React, { useState } from 'react';
import VideoConference from './VideoConference';

function App() {
  const [role, setRole] = useState('');

  return (
    <div style={{ padding: '20px' }}>
      <h1>WebRTC One-to-Many Video Conference (Manual Signaling)</h1>
      <select value={role} onChange={e => setRole(e.target.value)}>
        <option value="">Select Role</option>
        <option value="broadcaster">Broadcaster</option>
        <option value="viewer">Viewer</option>
      </select>

      {role && <VideoConference role={role} />}
    </div>
  );
}

export default App;

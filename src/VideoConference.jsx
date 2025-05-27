import React, { useState, useRef } from 'react';

function VideoConference({ role }) {
  const localVideoRef = useRef(null);
  const [localStream, setLocalStream] = useState(null);
  const [connections, setConnections] = useState({});
  const [viewerOffer, setViewerOffer] = useState('');
  const [viewerAnswer, setViewerAnswer] = useState('');
  const remoteVideoRef = useRef(null);
  const viewerPeerConnectionRef = useRef(null);

  const startLocalStream = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideoRef.current.srcObject = stream;
    setLocalStream(stream);
    
  };

  const createOfferForViewer = async (viewerId) => {
    if (!localStream) {
      alert('Start broadcast first!');
      return;
    }

    setConnections(prev => ({
      ...prev,
      [viewerId]: { peerConnection: null, offer: '', answer: '', status: 'Creating offer...' }
    }));

    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    await Promise.race([
      new Promise(resolve => {
        if (peerConnection.iceGatheringState === 'complete') resolve();
        else peerConnection.onicegatheringstatechange = () => {
          if (peerConnection.iceGatheringState === 'complete') resolve();
        };
      }),
      new Promise(resolve => setTimeout(resolve, 5000))
    ]);

    setConnections(prev => ({
      ...prev,
      [viewerId]: {
        peerConnection,
        offer: JSON.stringify(peerConnection.localDescription),
        answer: '',
        status: 'Offer ready — waiting for answer.'
      }
    }));
  };

  const applyAnswerForViewer = async (viewerId) => {
    const conn = connections[viewerId];
    if (!conn || !conn.answer) {
      alert('Missing connection or answer.');
      return;
    }

    setConnections(prev => ({
      ...prev,
      [viewerId]: { ...prev[viewerId], status: 'Connecting...' }
    }));

    try {
      await conn.peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(conn.answer)));
      setConnections(prev => ({
        ...prev,
        [viewerId]: { ...prev[viewerId], status: 'Connected ✅' }
      }));
    } catch (e) {
      setConnections(prev => ({
        ...prev,
        [viewerId]: { ...prev[viewerId], status: 'Failed ❌' }
      }));
      alert('Failed to apply answer: ' + e.message);
    }
  };

  const handleAnswerChange = (viewerId, newAnswer) => {
    setConnections(prev => ({
      ...prev,
      [viewerId]: { ...prev[viewerId], answer: newAnswer }
    }));
  };

  const connectAsViewer = async () => {
    if (!viewerOffer) {
      alert('Paste an offer first.');
      return;
    }

    setViewerAnswer('Generating answer...');
    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    peerConnection.ontrack = event => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    await peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(viewerOffer)));

    const answerDesc = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answerDesc);

    await Promise.race([
      new Promise(resolve => {
        if (peerConnection.iceGatheringState === 'complete') resolve();
        else peerConnection.onicegatheringstatechange = () => {
          if (peerConnection.iceGatheringState === 'complete') resolve();
        };
      }),
      new Promise(resolve => setTimeout(resolve, 5000))
    ]);

    viewerPeerConnectionRef.current = peerConnection;
    setViewerAnswer(JSON.stringify(peerConnection.localDescription));
  };


  const hangUp = (viewerId = null) => {
  if (role === 'broadcaster') {
    if (viewerId) {
      const conn = connections[viewerId];
      if (conn) {
        conn.peerConnection.close();
        setConnections(prev => {
          const updated = { ...prev };
          delete updated[viewerId];
          return updated;
        });
      }
    } else {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      Object.values(connections).forEach(conn => conn.peerConnection.close());
      setConnections({});
    }
  } else if (role === 'viewer') {
    if (viewerPeerConnectionRef.current) {
      viewerPeerConnectionRef.current.close();
      viewerPeerConnectionRef.current = null;
    }
    if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
      remoteVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
      remoteVideoRef.current.srcObject = null;
    }
    setViewerAnswer('');
    setViewerOffer('');
  }
};

  return (
    <div style={{ marginTop: '20px' }}>
      <h2>{role === 'broadcaster' ? 'Broadcaster' : 'Viewer'}</h2>

      {role === 'broadcaster' && (
        <>
          <video ref={localVideoRef} autoPlay muted playsInline width="320" style={{ border: '1px solid #ccc' }} />
          <br />
          <button onClick={startLocalStream} disabled={localStream}>Start Broadcast</button>
          <h3>Manage Viewers</h3>
          <button onClick={() => createOfferForViewer(Date.now().toString())}>
            Add New Viewer
          </button>

          {Object.entries(connections).map(([viewerId, conn]) => (
            <div key={viewerId} style={{ border: '1px solid #ddd', marginTop: '10px', padding: '10px' }}>
              <strong>Viewer ID: {viewerId}</strong>
              <p>Status: {conn.status}</p>
              <h4>Offer (Send this to viewer)</h4>
              <textarea value={conn.offer} readOnly rows="4" cols="60" />
              <h4>Paste Answer from Viewer</h4>
              <textarea
                value={conn.answer}
                onChange={e => handleAnswerChange(viewerId, e.target.value)}
                rows="4"
                cols="60"
              />
              <br />
              <button
                onClick={() => applyAnswerForViewer(viewerId)}
                disabled={!conn.answer || conn.status.startsWith('Connected')}
              >
                Apply Answer
              </button>
              <button onClick={() => hangUp(viewerId)}>Hang Up Viewer</button>

            </div>
          ))}
          <button style={{ marginTop: '20px' }} onClick={() => hangUp()}>Hang Up All</button>

        </>
      )}

      {role === 'viewer' && (
        <>
          <video ref={remoteVideoRef} autoPlay playsInline width="320" style={{ border: '1px solid #ccc' }} />
          <h3>Paste Broadcaster Offer</h3>
          <textarea value={viewerOffer} onChange={e => setViewerOffer(e.target.value)} rows="4" cols="60" />
          <br />
          <button onClick={connectAsViewer}>Generate Answer</button>
          <h3>Your Answer (Copy to Broadcaster)</h3>
          <textarea value={viewerAnswer} readOnly rows="4" cols="60" />
          <button style={{ marginTop: '20px' }} onClick={() => hangUp()}>Hang Up </button>

        </>
      )}
    </div>
    
  );
}

export default VideoConference;

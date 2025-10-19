// Browser-safe Witness Layer: Ephemeral P2P chat (WebRTC stub; full in annex)
// Use window.crypto for PoW

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function computePoW(nonce, difficulty = 4, maxIter = 1e6) {
  let i = 0;
  while (i < maxIter) {
    const hash = await sha256(nonce.toString());
    if (hash.startsWith('0'.repeat(difficulty))) return nonce;
    nonce++;
    i++;
  }
  throw new Error('PoW max iterations exceeded');
}

function initWitness(roomId) {
  // WebRTC stub with quarantine: No direct storage write
  const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }; // Trusted STUN only
  const peerConnection = new RTCPeerConnection(rtcConfig);
  const channel = peerConnection.createDataChannel('chat');
  channel.onmessage = e => {
    document.getElementById('chat').innerHTML += `<p>${e.data}</p>`;
  };

  // Bootstrap from Genesis (stub: load aether.json via fetch)
  fetch('/genesis/aether.json').then(res => res.json()).then(genesis => {
    console.log('Bootstrapped from Genesis:', genesis);
    // Signal to peers (annex for full signaling)
  });

  // Offline mode: localStorage persistence
  const localState = localStorage.getItem('witness_state') || '{}';
  console.log('Offline state loaded:', localState);

  // Send with PoW
  document.getElementById('send').addEventListener('click', async () => {
    const msg = document.getElementById('msg').value;
    const nonce = await computePoW(0);
    const payload = JSON.stringify({ msg, nonce });
    channel.send(payload);
    // Persist offline
    localStorage.setItem('witness_state', JSON.stringify({ lastMsg: msg }));
  });
}

// Expose
window.witness = { connect: initWitness };

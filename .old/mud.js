// Stubs for Phase 2 Evennia MUD integration

export class MudAPI {
  async listRooms() {
    // Future: fetch('/api/mud/rooms').then(res => res.json());
    return [];
  }

  async getRoom(slug) {
    // Future: fetch(`/api/mud/room/${slug}`).then(res => res.json());
    return null;
  }

  async postToBlogFromRoom(roomId, draft) {
    // Future: fetch('/api/mud/post', {method: 'POST', body: JSON.stringify({roomId, draft})});
    return;
  }

  async subscribeToRoomFeed(roomId) {
    // Future: use WebSocket or poll for updates
    return () => {}; // unsubscribe
  }
}

// Example usage (commented):
/*
// In post page or home:
const api = new MudAPI();
api.getRoom('example').then(room => {
  if (room) {
    const embed = document.createElement('div');
    embed.innerHTML = `<h3>Live from MUD Room: ${room.name}</h3><p>${room.description}</p>`;
    document.querySelector('.post').appendChild(embed);
  }
});
*/

// Idle Detector utility for monitoring user/system idle time
export const CONFIG = {
  CHECK_INTERVAL_MS: 60000,
  IDLE_THRESHOLD_MINUTES: 30,
};

export function createInitialRoomData() {
  return [
    { room: 'Conference Room A', occupancy: 0, isIdle: false, idleMinutes: 0, hvacOn: true, lightsOn: true, energyConsumption: 3.5 },
    { room: 'Conference Room B', occupancy: 2, isIdle: false, idleMinutes: 0, hvacOn: true, lightsOn: true, energyConsumption: 3.5 },
    { room: 'Office 101', occupancy: 1, isIdle: false, idleMinutes: 0, hvacOn: true, lightsOn: true, energyConsumption: 3.5 },
    { room: 'Office 102', occupancy: 0, isIdle: false, idleMinutes: 0, hvacOn: true, lightsOn: false, energyConsumption: 3.0 },
    { room: 'Lobby', occupancy: 5, isIdle: false, idleMinutes: 0, hvacOn: true, lightsOn: true, energyConsumption: 3.5 },
    { room: 'Server Room', occupancy: 0, isIdle: false, idleMinutes: 0, hvacOn: true, lightsOn: false, energyConsumption: 8.0 },
  ];
}

export function detectAllIdleRooms(rooms) {
  if (!rooms) return [];
  return rooms.map(room => {
    const newIdleMinutes = room.occupancy === 0 ? room.idleMinutes + 1 : 0;
    const isIdle = newIdleMinutes >= CONFIG.IDLE_THRESHOLD_MINUTES;
    return { ...room, idleMinutes: newIdleMinutes, isIdle };
  });
}

export function getIdleRooms(rooms) {
  if (!rooms) return [];
  return rooms.filter(room => room.isIdle);
}

export function updateRoomOccupancy(rooms, readings) {
  if (!rooms || !readings) return rooms;
  return rooms.map(room => {
    const reading = readings.find(r => r.room === room.room);
    if (reading) {
      return { ...room, ...reading };
    }
    return room;
  });
}

export const idleDetector = {
  startTime: null,
  idleTime: 0,
  maxIdleTime: 15 * 60 * 1000,

  init() {
    this.startTime = Date.now();
    this.setupListeners();
  },

  setupListeners() {
    document.addEventListener('mousemove', () => this.resetIdleTime());
    document.addEventListener('keypress', () => this.resetIdleTime());
    setInterval(() => this.checkIdleTime(), 1000);
  },

  resetIdleTime() {
    this.idleTime = 0;
  },

  checkIdleTime() {
    this.idleTime += 1000;
    if (this.idleTime >= this.maxIdleTime) {
      this.onIdle();
    }
  },

  onIdle() {
    console.log('System idle detected');
  },

  getIdleTime() {
    return this.idleTime;
  },
};

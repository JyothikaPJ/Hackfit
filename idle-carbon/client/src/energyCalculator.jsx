// Energy Calculator utility for computing energy usage and waste
export const energyCalculator = {
  calculateEnergyUsage(metrics) {
    if (!metrics) return 0;
    const { cpuUsage = 0, memoryUsage = 0, diskUsage = 0 } = metrics;
    return (cpuUsage * 0.5 + memoryUsage * 0.3 + diskUsage * 0.2) / 100;
  },

  calculateCarbonFootprint(energyUsage) {
    const carbonEmissionRate = 0.233;
    return energyUsage * carbonEmissionRate;
  },

  calculateWaste(idleTime, energyRate) {
    return (idleTime / 1000 / 3600) * energyRate;
  },

  estimateSavings(wastedEnergy, costPerKwh = 0.12) {
    return wastedEnergy * costPerKwh;
  },

  formatEnergy(joules) {
    if (joules < 1000) return `${joules.toFixed(2)} J`;
    if (joules < 1000000) return `${(joules / 1000).toFixed(2)} kJ`;
    return `${(joules / 1000000).toFixed(2)} MJ`;
  },
};

export function calculateTotalWaste(rooms) {
  if (!rooms || rooms.length === 0) {
    return {
      totalIdleRooms: 0,
      totalEnergyWasted: 0,
      totalCostLost: 0,
      roomBreakdown: [],
    };
  }

  const COST_PER_KWH = 0.12;
  const HVAC_POWER = 3.0;
  const LIGHTS_POWER = 0.5;
  
  let totalEnergyWasted = 0;
  let totalIdleRooms = 0;
  const roomBreakdown = [];

  rooms.forEach(room => {
    if (room.isIdle && room.idleMinutes > 0) {
      totalIdleRooms++;
      
      let wastedPower = 0;
      if (room.hvacOn) wastedPower += HVAC_POWER;
      if (room.lightsOn) wastedPower += LIGHTS_POWER;
      
      const wastedHours = room.idleMinutes / 60;
      const wastedKwh = (wastedPower * wastedHours) / 1000;
      const costLost = wastedKwh * COST_PER_KWH;
      
      totalEnergyWasted += wastedKwh;
      
      roomBreakdown.push({
        room: room.room,
        energyWasted: wastedKwh,
        costLost: costLost,
        idleMinutes: room.idleMinutes,
      });
    }
  });

  return {
    totalIdleRooms,
    totalEnergyWasted: parseFloat(totalEnergyWasted.toFixed(2)),
    totalCostLost: parseFloat((totalEnergyWasted * COST_PER_KWH).toFixed(2)),
    roomBreakdown,
  };
}

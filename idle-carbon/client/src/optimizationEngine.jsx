// Optimization Engine for generating optimization recommendations
let optimizationLog = [];
let optimizationSummary = {
  totalOptimizations: 0,
  totalEnergySaved: 0,
  totalCostSaved: 0,
};

export const optimizationEngine = {
  analyzeResources(resources) {
    const recommendations = [];

    if (!resources) return recommendations;

    if (resources.idleServers > 0) {
      recommendations.push({
        id: 1,
        title: 'Shutdown Idle Servers',
        description: `${resources.idleServers} server(s) are idle and consuming resources`,
        priority: 'high',
        savings: resources.idleServers * 50,
      });
    }

    if (resources.averageCpuUsage > 80) {
      recommendations.push({
        id: 2,
        title: 'Optimize High CPU Usage',
        description: `Average CPU usage is ${resources.averageCpuUsage}%, consider optimization`,
        priority: 'medium',
        savings: (resources.averageCpuUsage - 60) * 10,
      });
    }

    if (resources.unusedMemory > 50) {
      recommendations.push({
        id: 3,
        title: 'Deallocate Unused Memory',
        description: `${resources.unusedMemory}% of allocated memory is unused`,
        priority: 'medium',
        savings: resources.unusedMemory * 5,
      });
    }

    return recommendations;
  },

  calculateOptimizationScore(resources) {
    if (!resources) return 0;
    let score = 100;

    score -= resources.idleServers * 10;
    score -= Math.max(0, resources.averageCpuUsage - 70) * 0.5;
    score -= resources.unusedMemory * 0.3;

    return Math.max(0, Math.min(100, score));
  },

  estimateTotalSavings(recommendations) {
    return recommendations.reduce((total, rec) => total + rec.savings, 0);
  },
};

export function getOptimizationLog() {
  return optimizationLog;
}

export function getOptimizationSummary() {
  return optimizationSummary;
}

export function optimizeRoom(roomId) {
  const energySaved = Math.random() * 2;
  const costSaved = energySaved * 0.12;
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    room: roomId,
    energySaved,
    costSaved,
    idleMinutes: Math.floor(Math.random() * 120) + 30,
    subsystems: [
      { name: 'HVAC', powerKw: 3.0, status: 'disabled' },
      { name: 'Lights', powerKw: 0.5, status: 'disabled' },
    ],
  };
  
  optimizationLog.push(logEntry);
  optimizationSummary.totalOptimizations++;
  optimizationSummary.totalEnergySaved += energySaved;
  optimizationSummary.totalCostSaved += costSaved;
  
  return logEntry;
}

export function getRoomSubsystemStatus(roomName) {
  return {
    room: roomName,
    subsystems: [
      { name: 'HVAC', powerKw: 3.0, status: 'active', consumption: '2.8 kW' },
      { name: 'Lights', powerKw: 0.5, status: 'active', consumption: '0.4 kW' },
      { name: 'Plugs', powerKw: 0.2, status: 'active', consumption: '0.1 kW' },
    ],
    totalConsumption: '3.3 kW',
  };
}

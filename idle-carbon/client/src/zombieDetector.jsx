// Zombie Detector utility for identifying zombie/orphaned resources
let zombieStorage = [];
let zombieFixSummary = {
  totalZombies: 0,
  totalFixed: 0,
  totalSaved: 0,
};

export const zombieDetector = {
  detectZombieResources(resources) {
    const zombies = [];

    if (!resources) return zombies;

    if (resources.orphanedInstances) {
      resources.orphanedInstances.forEach((instance) => {
        if (instance.createdAt && !instance.lastActivity) {
          zombies.push({
            type: 'instance',
            id: instance.id,
            name: instance.name,
            reason: 'No activity detected',
            ageDays: this.getAgeDays(instance.createdAt),
          });
        }
      });
    }

    if (resources.volumes) {
      resources.volumes.forEach((volume) => {
        if (volume.attachments === 0 || volume.attachments === undefined) {
          zombies.push({
            type: 'volume',
            id: volume.id,
            name: volume.name,
            reason: 'Not attached to any instance',
            size: volume.size,
          });
        }
      });
    }

    return zombies;
  },

  getAgeDays(createdDate) {
    const now = new Date();
    const created = new Date(createdDate);
    return Math.floor((now - created) / (1000 * 60 * 60 * 24));
  },

  calculateZombieCost(zombies, costPerHour = 0.05) {
    return zombies.length * costPerHour * 24;
  },
};

export function generateInfrastructureData() {
  return [
    { id: 'vm-001', name: 'WebServer-01', type: 'VM', cpuUsage: 2, idleTime: 180, cost: 45 },
    { id: 'vm-002', name: 'DBServer-01', type: 'VM', cpuUsage: 85, idleTime: 5, cost: 60 },
    { id: 'srv-001', name: 'BackupNode-01', type: 'Server', cpuUsage: 3, idleTime: 240, cost: 120 },
    { id: 'srv-002', name: 'AppServer-01', type: 'Server', cpuUsage: 45, idleTime: 15, cost: 120 },
    { id: 'storage-001', name: 'OrphanedVolume-01', type: 'Volume', size: '500GB', attachments: 0, cost: 25 },
  ];
}

export function detectZombies(resources) {
  if (!resources) return [];
  
  const zombies = [];
  
  resources.forEach(resource => {
    let isZombie = false;
    
    if (resource.type === 'VM' && resource.cpuUsage < 5) {
      isZombie = true;
    } else if (resource.type === 'Server' && resource.idleTime > 120) {
      isZombie = true;
    } else if (resource.type === 'Volume' && resource.attachments === 0) {
      isZombie = true;
    }
    
    if (isZombie) {
      zombies.push({
        ...resource,
        isZombie: true,
        recommendedAction: 'Terminate/Delete',
        potentialSavings: resource.cost,
      });
    }
  });
  
  zombieStorage = zombies;
  zombieFixSummary.totalZombies = zombies.length;
  return zombies;
}

export function getZombies(resources) {
  return detectZombies(resources);
}

export function getZombieFixSummary() {
  return zombieFixSummary;
}

export function fixZombie(zombie) {
  const cost = zombie.cost || 50;
  zombieFixSummary.totalFixed++;
  zombieFixSummary.totalSaved += cost;
  
  return {
    success: true,
    zombie: zombie.name,
    action: 'Terminated',
    costSaved: cost,
    timestamp: new Date().toISOString(),
  };
}

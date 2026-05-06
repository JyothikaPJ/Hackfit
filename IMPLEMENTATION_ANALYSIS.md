# Idle Carbon Client - Implementation Analysis

## Overview
The idle-carbon/client project requires implementations for 5 utility files that are imported across the app. This document details all required exports, function signatures, and usage patterns.

---

## 1. AuthContext.jsx

### Current State (Incomplete)
```javascript
export const AuthContext = createContext();
export const AuthProvider = ({ children }) => { ... }
export const useAuth = () => React.useContext(AuthContext);
```

### Required Exports
✅ **Already Implemented:**
- `AuthContext` - React Context object
- `AuthProvider` - Provider component
- `useAuth` - Hook to access auth context

### Usage Pattern
**Used in:**
- App.jsx: Wraps entire app with `<AuthProvider>`
- App.jsx: `const { user, logout, loading } = useAuth()`
- OptimizationReport.jsx: `const { user } = useAuth()`
- ResourceManager.jsx: `const { user } = useAuth()`
- Various pages via useAuth hook

### Context Value Shape
```javascript
{
  user: {
    name: string,
    role: 'manager' | 'admin' | 'employee',
    departmentName: string,
    id?: string
  },
  token: string | null,
  login: (userData, authToken) => void,
  logout: () => void,
  loading: boolean  // Important: needed for initial auth check
}
```

### Missing Requirement
The current implementation is missing the **`loading` state** which is required by App.jsx:
```javascript
if (loading) return <div className="loading-screen">...</div>;
```

---

## 2. idleDetector.jsx

### Current State (Stub)
```javascript
export const idleDetector = { ... }  // Object with methods
export function detectAllIdleRooms() { return []; }
export function createInitialRoomData() { return {}; }
export function getIdleRooms() { return []; }
export function updateRoomOccupancy() { return {}; }
export const CONFIG = {};
```

### Required Exports

#### `createInitialRoomData()`
**Returns:** Array of room objects
**Used in:** 
- App.jsx: `chatRooms = detectAllIdleRooms(createInitialRoomData())`
- OccupancyHeatmap.jsx: `const initial = createInitialRoomData()`
- AIChatPanel.jsx: `rooms = detectAllIdleRooms(rooms)`

**Expected Shape:**
```javascript
[
  {
    room: string,           // e.g., "Conference Room A"
    occupancy: number,      // 0-20+ people
    isIdle: boolean,        // becomes true if idle > 30 min
    idleMinutes: number,    // minutes since last activity
    hvacOn: boolean,
    lightsOn: boolean,
    energyConsumption: number, // kWh
  },
  ...
]
```

#### `detectAllIdleRooms(rooms)`
**Parameters:** Array of room objects
**Returns:** Array of room objects with `isIdle` flag set
**Logic:** Mark rooms as idle if:
- Occupancy === 0
- idleMinutes >= 30
**Used in:**
- App.jsx: For initializing chatRooms
- OccupancyHeatmap.jsx: Called every 60 seconds via setInterval
- AIChatPanel.jsx: buildSystemData() to classify rooms
- ChatEngine.js: handleIdleRooms, handleFallback

#### `getIdleRooms(rooms)`
**Parameters:** Array of room objects (with isIdle flag set)
**Returns:** Filtered array of only idle rooms
**Used in:**
- ChatEngine.js: handleIdleRooms, handleCostSaved, handleFallback
- AIChatPanel.jsx: To get just idle rooms

#### `updateRoomOccupancy(rooms, readings)`
**Parameters:**
- `rooms`: Current room state array
- `readings`: Live sensor data { room, occupancy, hvacOn, lightsOn }
**Returns:** Updated rooms array with merged occupancy data
**Used in:** OccupancyHeatmap.jsx
```javascript
const readings = generateLiveReadings(prev);
const withResources = prev.map(r => {
  const rd = readings.find(x => x.room === r.room) || {};
  return { ...r, hvacOn: rd.hvacOn ?? r.hvacOn, lightsOn: rd.lightsOn ?? r.lightsOn };
});
const updated = updateRoomOccupancy(withResources, readings);
```

#### `CONFIG`
**Object with:**
- `CHECK_INTERVAL_MS`: number (used: 60000ms for idle detection interval)
**Used in:** OccupancyHeatmap.jsx
```javascript
idleCheckRef.current = setInterval(() => {
  setRooms(prev => detectAllIdleRooms(prev));
}, CONFIG.CHECK_INTERVAL_MS);
```

---

## 3. energyCalculator.jsx

### Current State (Stub)
```javascript
export const energyCalculator = { ... }  // Object with methods
export function calculateTotalWaste() { return 0; }
```

### Required Exports

#### `calculateTotalWaste(rooms)`
**Parameters:** Array of room objects
**Returns:** Object with waste metrics
**Used in:**
- ChatEngine.js: handleEnergySaved, handleCostSaved, handleEnergyWaste, handleFallback
- AIChatPanel.jsx: buildSystemData()

**Expected Return Shape:**
```javascript
{
  totalIdleRooms: number,        // Count of rooms where occupancy=0 & isIdle=true
  totalEnergyWasted: number,     // kWh wasted across all idle rooms
  totalCostLost: number,         // $ cost of wasted energy
  roomBreakdown: [
    {
      room: string,
      energyWasted: number,      // kWh
      costLost: number           // $
    },
    ...
  ]
}
```

**Calculation Logic:**
- Only count rooms with occupancy === 0 AND isIdle === true
- Energy waste per room = (hvacOn ? 3.0 : 0) + (lightsOn ? 0.5 : 0) kWh per hour
- Cost per kWh = $0.12 (found in energyCalculator object)
- Example from OccupancyHeatmap.jsx:
  ```javascript
  const kwh = (room.hvacOn ? 3.0 : 0) + (room.lightsOn ? 0.5 : 0);
  const wastePercent = Math.round((kwh / 3.5) * 100);
  ```

---

## 4. optimizationEngine.jsx

### Current State (Stub)
```javascript
export const optimizationEngine = { ... }  // Object with methods
export function getOptimizationLog() { return []; }
export function getOptimizationSummary() { return {}; }
```

### Required Exports

#### `getOptimizationLog()`
**Returns:** Array of optimization history entries
**Used in:**
- ChatEngine.js: handleWhyOptimized, handleOptLog
- AIChatPanel.jsx: buildSystemData()
- OccupancyHeatmap.jsx: (displayed to user)

**Expected Return Shape:**
```javascript
[
  {
    room: string,              // Room name
    timestamp: string,         // ISO date
    idleMinutes: number,
    subsystems: [
      {
        label: string,         // e.g., "HVAC", "Lights"
        action: string,        // e.g., "turned OFF", "dimmed 50%"
        energySaved: number    // kWh
      },
      ...
    ],
    energySaved: number,       // Total kWh saved from this optimization
    costSaved: number          // $ saved
  },
  ...
]
```

#### `getOptimizationSummary()`
**Returns:** Summary statistics object
**Used in:**
- ChatEngine.js: handleEnergySaved, handleCostSaved, handleFallback
- AIChatPanel.jsx: buildSystemData()
- OccupancyHeatmap.jsx: (displayed in summary)

**Expected Return Shape:**
```javascript
{
  totalOptimizations: number,    // Count of rooms optimized
  totalEnergySaved: number,      // kWh total
  totalCostSaved: number,        // $ total
  zombieResourcesDetected?: number,
  zombieResourcesFixed?: number
}
```

#### `optimizeRoom(roomId)` (implicit from OccupancyHeatmap.jsx)
**Used in:** OccupancyHeatmap.jsx
```javascript
const result = optimizeRoom(room.room);  // Called by roomId
setOptResults(prev => ({ ...prev, [room.room]: result }));
```
**Returns:** Optimization result object
**Side effect:** Should add entry to optimization log

#### `getRoomSubsystemStatus(roomName)`
**Used in:** OccupancyHeatmap.jsx
- Likely used to get subsystem breakdown for optimization

---

## 5. zombieDetector.jsx

### Current State (Stub)
```javascript
export const zombieDetector = { ... }  // Object with methods
```

### Required Exports

#### `generateInfrastructureData()`
**Returns:** Array of infrastructure/resource objects
**Used in:** ZombieMonitor.jsx
```javascript
const [resources, setResources] = useState(() => 
  detectZombies(generateInfrastructureData())
);
```

**Expected Shape:** (from mockResources.js pattern)
```javascript
[
  {
    id: string,
    name: string,
    type: string,              // 'Server', 'VM', 'Backup Server', etc.
    category: string,          // 'server', 'vm', 'backup'
    critical: boolean,
    cpuUsage: number | null,
    idleTime: number,
    energyConsumption: number,
    isZombie: boolean,
    zombieType?: string        // e.g., 'zombie_vm', 'sleeping_server', 'energy_vampire'
  },
  ...
]
```

#### `detectZombies(resources)`
**Parameters:** Array of infrastructure resources
**Returns:** Same array with `isZombie` flags set
**Used in:** ZombieMonitor.jsx
**Logic:** Mark resources as zombies if:
- VM: cpuUsage < 5%
- Server: idleTime > 120 minutes
- Backup: cpuUsage < 8%

#### `getZombies(resources)`
**Parameters:** Array of resource objects (with isZombie flag)
**Returns:** Filtered array of zombie resources only
**Used in:** ZombieMonitor.jsx
```javascript
const zombies = getZombies(resources);
```

#### `fixZombie(zombie)`
**Parameters:** Zombie resource object
**Returns:** Result object with fix summary
**Used in:** ZombieMonitor.jsx
```javascript
const result = fixZombie(zombie);
setFixResults(prev => ({ ...prev, [zombie.id]: result }));
```

**Expected Return Shape:**
```javascript
{
  success: boolean,
  resourceId: string,
  message: string,
  energySaved: number,
  costSaved: number
}
```

#### `getZombieFixSummary()`
**Returns:** Summary of all fixed zombies
**Used in:** ZombieMonitor.jsx (for display)
**Expected Shape:**
```javascript
{
  totalDetected: number,
  totalFixed: number,
  totalEnergySaved: number,
  totalCostSaved: number
}
```

---

## 6. chatEngine.js

### Current State (Partial)
```javascript
export function generateResponse(message, rooms) { ... }
```

### Required Exports

#### `generateResponse(message, rooms)`
**Parameters:**
- `message`: string (user input)
- `rooms`: Array of room objects
**Returns:** string (markdown-formatted AI response)
**Used in:** AIChatPanel.jsx

**Intents Handled (from chatEngine.js):**
1. `why_optimized` - "Why was Room B optimized?"
2. `energy_saved` - "How much energy was saved?"
3. `idle_rooms` - "Which rooms are idle?"
4. `cost_saved` - "How much cost was saved?"
5. `optimization_log` - "Show optimization log"
6. `room_status` - "Tell me about Room A"
7. `energy_waste` - "How much energy is wasted?"
8. `help` - "Help" or "What can you do?"
9. **Fallback** - Unknown queries

**Handler Dependencies:**
- Calls `getIdleRooms()`, `detectAllIdleRooms()` from idleDetector
- Calls `calculateTotalWaste()` from energyCalculator
- Calls `getOptimizationLog()`, `getOptimizationSummary()` from optimizationEngine

---

## 7. api.js (Already Implemented ✅)

**Exports HTTP functions for backend communication:**
- `login(email, password)`
- `getMe()`
- `getEmployeeDashboard()`
- `getAdminDashboard()`
- `getLeaderboard()`
- `getActions(status?)`
- `approveAction(id)`
- `dismissAction(id)`
- `getIdleMetrics(type, teamId)`
- `updateBaseline(teamId, baselineUsage)`
- `getOptimizationData(period)`
- `submitReport({ period, managerComments, aiSummary, reportData })`
- `getAdminReports(filters)`
- `markReportReviewed(reportId)`

---

## Key Data Flows

### 1. Live Occupancy Monitoring Flow
```
OccupancyHeatmap.jsx:
  → createInitialRoomData()           [idleDetector]
  → detectAllIdleRooms(rooms)         [idleDetector]
  → updateRoomOccupancy(rooms, data)  [idleDetector]
  → detectAllIdleRooms(updated)       [idleDetector]
  → getWasteLevel(room)               [local calculation]
  → optimizeRoom(room.room)           [optimizationEngine]
  → getOptimizationLog()              [optimizationEngine]
```

### 2. Chat Engine Flow
```
AIChatPanel.jsx:
  → buildSystemData(rooms)
    → detectAllIdleRooms(rooms)       [idleDetector]
    → getIdleRooms(withStatus)        [idleDetector]
    → calculateTotalWaste(rooms)      [energyCalculator]
    → getOptimizationSummary()        [optimizationEngine]
    → getOptimizationLog()            [optimizationEngine]
  → generateResponse(message, rooms)  [chatEngine]
    → Uses above data to generate markdown response
```

### 3. Resource Optimization Flow (Managers)
```
ResourceManager.jsx:
  → getResources()                    [mockResources.js]
  → getIdleResources(resources)       [mockResources.js]
  → canOptimize(role, resource)       [mockResources.js]
  → optimizeResource(id)              [mockResources.js]
  → createOptimizationRequest()       [mockResources.js]
```

### 4. Zombie Detection Flow (All Users)
```
ZombieMonitor.jsx:
  → generateInfrastructureData()      [zombieDetector]
  → detectZombies(data)               [zombieDetector]
  → getZombies(resources)             [zombieDetector]
  → fixZombie(zombie)                 [zombieDetector]
  → getZombieFixSummary()             [zombieDetector]
```

---

## Implementation Notes

### Room Data Structure
All room objects must follow this shape:
```javascript
{
  room: string,              // Unique identifier/name
  occupancy: number,         // People count
  isIdle: boolean,           // Set by detectAllIdleRooms()
  idleMinutes: number,       // Minutes since last activity
  hvacOn: boolean,
  lightsOn: boolean,
  energyConsumption: number, // kWh
}
```

### Energy Calculations
- **HVAC power:** 3.0 kWh (when room empty)
- **Lights power:** 0.5 kWh (when room empty)
- **Cost per kWh:** $0.12
- **Idle threshold:** 30 minutes of zero occupancy

### Critical State Persistence
- **optimizationLog** - Must persist across session (for report generation)
- **optimizationRequests** - Managed by mockResources.js
- **securityAlerts** - Managed by mockResources.js

### Role-Based Access
From App.jsx routing:
- **Manager role:** `/manager`, `/resources`, `/reports`, `/leaderboard`, `/heatmap`, `/zombies`
- **Admin role:** `/admin`, `/admin/reports`, `/admin/opt-control`, `/leaderboard`, `/heatmap`
- **Employee role:** `/leaderboard`, `/heatmap`

---

## Integration Checklist

- [ ] AuthContext: Add `loading` state to prevent initial render issues
- [ ] idleDetector: Implement room data structure and idle detection logic
- [ ] energyCalculator: Implement waste calculation with room breakdown
- [ ] optimizationEngine: Implement history tracking and summary stats
- [ ] zombieDetector: Implement infrastructure detection and zombie classification
- [ ] chatEngine: Already has handlers, just needs helper functions to work
- [ ] All: Ensure data structures match usage patterns exactly
- [ ] All: Test mock data flows through components

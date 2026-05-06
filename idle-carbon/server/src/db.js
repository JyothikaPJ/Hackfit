// In-memory data store — perfect for a hackathon demo
// Data persists for the lifetime of the server process

const store = {
  departments: [],
  users: [],
  idleMetrics: [],
  optimizationActions: [],
  notifications: [],
  optimizationReports: [],  // manager-submitted optimization reports
};

function getStore() {
  return store;
}

function initDB() {
  // No-op for in-memory store — tables are just arrays
  console.log('  📦 In-memory data store initialized');
}

module.exports = { getStore, initDB };

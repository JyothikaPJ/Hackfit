# Idle Carbon Budget + Idle Infrastructure Detector
## Product Requirements Document — v2.0

| Field | Value |
|-------|-------|
| **Owner** | Jyothika P J |
| **Event** | Enterprise Sustainability Hackathon |
| **Version** | v2.0 |
| **Status** | Final Draft |
| **Date** | March 2026 |

---

## 1. Executive Summary

Modern enterprises waste large amounts of energy due to idle infrastructure — empty meeting rooms running HVAC, unused cloud instances, and machines consuming power without performing useful work. These inefficiencies increase operational costs and contribute to avoidable carbon emissions.

The **Idle Carbon Budget + Idle Infrastructure Detector** is a unified monitoring platform that detects idle enterprise resources, triggers automated or manager-approved optimizations, and tracks resulting energy, cost, and carbon savings. The platform integrates with an existing procurement management system and provides role-based dashboards for employees, managers, and administrators.

A key differentiator is the **fairness model**: departments are ranked by percentage improvement relative to their baseline rather than raw consumption, ensuring that high-compute teams (e.g., Data Science) are compared equitably against low-compute teams (e.g., HR). A gamified leaderboard drives behavioral change across the organization.

---

## 2. Problem Statement

### 2.1 Idle Infrastructure Waste

Infrastructure frequently remains active when not in use, including:

- HVAC systems running in empty meeting rooms
- Idle cloud virtual machines accumulating compute hours
- Lighting and office equipment left on overnight
- Idle GPU clusters between training jobs

### 2.2 Lack of Unified Visibility

Facilities teams manage building infrastructure while IT teams manage cloud infrastructure. These systems rarely communicate, producing fragmented and incomplete insights. There is no single platform where a manager can see both dimensions of waste simultaneously.

### 2.3 Unfair Sustainability Metrics

Comparing raw energy consumption across departments penalizes teams that legitimately perform high-compute workloads. A fair comparison must account for what each department is expected to consume relative to its function.

---

## 3. Objectives

1. Detect idle infrastructure across building and cloud environments.
2. Trigger automated or manager-approved optimization actions.
3. Track and report energy, cost, and carbon savings per department.
4. Rank departments fairly using baseline-normalized efficiency scores.
5. Drive behavioral change through a transparent, gamified leaderboard.
6. Demonstrate enterprise integration via a live procurement platform connection.

---

## 4. Scope

### 4.1 In Scope

- Rule-based idle detection for cloud VMs, HVAC, and lighting systems
- Automated optimization actions (shutdown, HVAC off, lights off)
- Role-based dashboards: Employee, Manager, Leaderboard, Admin
- Fairness-normalized efficiency leaderboard
- Procurement system integration for resource ownership tagging
- Simulated IoT sensor data and cloud metrics for hackathon demo
- JWT-based authentication and role enforcement

### 4.2 Out of Scope

- Machine learning-based predictive idle detection *(v2 enhancement)*
- Real IoT hardware integration (ESP32, Raspberry Pi) — simulated for demo
- Live AWS CloudWatch / Prometheus connections — simulated for demo
- Carbon credit accounting or external sustainability reporting (e.g., GHG Protocol)
- Multi-tenant / multi-organization support
- Mobile application
- Real-time bidirectional MQTT communication — unidirectional simulation only

---

## 5. User Roles and Stories

### 5.1 Employee

Employees can view personal and team sustainability metrics but cannot approve or trigger actions.

**User Stories**

- As an employee, I want to see how much energy my team saved this week so that I understand our collective impact.
- As an employee, I want to see my department's leaderboard rank so that I feel motivated to reduce idle usage.
- As an employee, I want to receive an alert when an idle resource is detected in my team's environment so that I can take manual action if needed.

**Acceptance Criteria**

- Employee dashboard loads within 3 seconds and displays current week's kWh and carbon savings.
- Leaderboard rank is visible on the employee home screen without additional navigation.
- Idle alerts are surfaced as in-app notifications with a timestamp and resource name.

---

### 5.2 Manager

Managers have approval authority over optimization actions and can view team-level analytics.

**User Stories**

- As a manager, I want to see a list of currently idle resources on my team so that I can decide whether to approve shutdown.
- As a manager, I want to approve or dismiss an optimization recommendation so that I maintain control over my team's infrastructure.
- As a manager, I want to see a weekly efficiency report so that I can track improvement trends over time.

**Acceptance Criteria**

- Manager dashboard shows pending optimization actions with resource type, idle duration, and estimated savings.
- Approve / Dismiss actions are available per recommendation and require a single click to execute.
- Approved actions are logged with a timestamp, manager ID, and resulting savings estimate.
- Weekly report is downloadable as CSV.

---

### 5.3 Leaderboard Viewer (All Staff)

The leaderboard is visible to all authenticated users to promote transparency and healthy competition.

**User Stories**

- As any employee, I want to see all department rankings on a single screen so that I understand how my team compares.
- As any employee, I want to see the improvement percentage alongside the rank so that I understand the basis for the ranking.

**Acceptance Criteria**

- Leaderboard displays all departments sorted by improvement percentage descending.
- Each row shows: rank, department name, baseline usage, current usage, improvement %.
- Leaderboard refreshes automatically every 30 seconds.

---

### 5.4 Administrator

Administrators have full visibility across all departments and can configure system settings.

**User Stories**

- As an admin, I want to see company-wide energy savings so that I can report on sustainability progress.
- As an admin, I want to see idle detection accuracy metrics so that I can tune thresholds.
- As an admin, I want to manage department baseline values so that the fairness model stays accurate.

**Acceptance Criteria**

- Admin dashboard aggregates total kWh saved, cost saved ($), and CO2 avoided (kg) across all departments.
- Idle detection log is filterable by resource type, department, and date range.
- Baseline values are editable via the admin UI with changes logged for audit.

---

## 6. Functional Requirements

### 6.1 Idle Detection Engine

The detection engine evaluates incoming metrics against configurable thresholds to classify resources as idle. A resource must meet the condition for the full sustained period before an optimization action is triggered, to prevent false positives from brief pauses in activity.

| Rule | Condition | Sustained Period |
|------|-----------|-----------------|
| Cloud VM Idle | CPU < 10% AND network I/O = 0 | 15 minutes |
| HVAC Idle | Occupancy sensor = 0 AND HVAC = ON | 10 minutes |
| Lighting Idle | Motion sensor = 0 AND lights = ON | 5 minutes |
| Compute Cluster Idle | CPU < 5% AND GPU util. = 0% | 20 minutes |

Idle classifications are written to the `IdleMetrics` table (see Section 10).

### 6.2 Optimization Actions

Once idle classification is confirmed, the system selects an action based on resource type and department policy.

| Resource Type | Default Action | Requires Approval |
|---------------|---------------|-------------------|
| Cloud VM | Shutdown instance | Yes — Manager approval |
| HVAC | Send off-signal to BMS | No — Auto-execute |
| Lighting | Send off-signal | No — Auto-execute |
| Compute Cluster | Suspend cluster | Yes — Manager approval |

All actions — whether auto-executed or manager-approved — are logged with: resource ID, action taken, timestamp, approver (if applicable), and estimated kWh, cost, and CO2 savings.

### 6.3 Efficiency Scoring and Leaderboard

> **Efficiency Score Formula**
> `Improvement % = (Baseline Usage − Current Usage) / Baseline Usage × 100`
> Scores are additionally normalized by team size where applicable. Rankings are recalculated each time new metrics are ingested.

**Example leaderboard output:**

| Rank | Department | Baseline (kWh) | Current (kWh) | Improvement % |
|------|-----------|----------------|---------------|---------------|
| 1 | Data Science | 1,000 | 750 | 25.0% |
| 2 | Procurement | 400 | 328 | 18.0% |
| 3 | HR | 200 | 176 | 12.0% |
| 4 | Facilities / IT | 350 | 315 | 10.0% |

### 6.4 Dashboards

All dashboards must load within 3 seconds. Real-time charts update on a 30-second polling interval.

- **Employee Dashboard:** personal savings, team rank, idle alerts, carbon contribution
- **Manager Dashboard:** pending actions, team idle resource list, efficiency trend, CSV export
- **Leaderboard Dashboard:** full department ranking table, visible to all authenticated users
- **Admin Dashboard:** company-wide aggregates, idle detection log, baseline management

---

## 7. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Performance | Dashboard load time ≤ 3 seconds (P95). Leaderboard refresh ≤ 30 seconds. |
| Security | All endpoints require a valid JWT. Role-based access control enforced server-side. Tokens expire after 8 hours. |
| Data Retention | IdleMetrics records retained for 90 days. Optimization action logs retained for 1 year. |
| Availability | System available for full duration of hackathon demo (target: 99% uptime during event). |
| Auditability | All manager approvals and admin baseline edits logged with user ID and timestamp. |
| Scalability | Architecture must support at least 40 concurrent users without degradation. |
| Browser Support | Chrome 110+, Firefox 110+, Edge 110+. No IE support. |

---

## 8. Data Sources

### 8.1 Simulated Data (Hackathon Demo)

For the hackathon, all infrastructure data is simulated. Real integrations are listed in Section 8.2 as post-hackathon targets.

- IoT sensor data (motion, temperature, occupancy) is generated by a seed script and fed via a simulated MQTT topic.
- Cloud VM metrics (CPU, network) are generated by a cron job producing values within realistic ranges.
- All simulated data is seeded to match the demo dataset described in Section 12.

### 8.2 Target Real Integrations (Post-Hackathon)

| Source | Data Provided | Integration Method |
|--------|--------------|-------------------|
| AWS CloudWatch | EC2 CPU, network I/O, instance state | AWS SDK / REST API polled every 5 min |
| Prometheus Node Exporter | On-prem server CPU, memory | HTTP scrape via cron job |
| IoT Sensors (ESP32 / RPi) | Motion, temperature, occupancy | MQTT broker |
| Employee Calendar API | Room booking status | Google Calendar / Exchange REST API |
| Procurement System | Resource ownership, department tags | Internal REST API (existing) |

---

## 9. API Contract (Summary)

All endpoints are prefixed with `/api/v1`. Authentication is via Bearer token in the `Authorization` header. Responses follow: `{ success: boolean, data: object | array, error?: string }`.

| Endpoint | Method | Auth Role | Description |
|----------|--------|-----------|-------------|
| `/metrics/idle` | GET | Manager, Admin | List idle resources. Filterable by type and teamId. |
| `/actions/approve/:id` | POST | Manager | Approve a pending optimization action. |
| `/actions/dismiss/:id` | POST | Manager | Dismiss a pending optimization action. |
| `/leaderboard` | GET | All | Return department efficiency rankings. |
| `/dashboard/employee` | GET | Employee+ | Return personal and team savings for current user. |
| `/dashboard/admin` | GET | Admin | Return company-wide aggregate metrics. |
| `/baselines/:teamId` | PUT | Admin | Update baseline usage value for a department. |
| `/reports/weekly/:teamId` | GET | Manager, Admin | Weekly efficiency report. CSV via `?format=csv`. |

Full OpenAPI specification to be maintained in `/docs/api.yaml` alongside the codebase.

---

## 10. Database Design

### 10.1 IdleMetrics

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| type | ENUM | `'hvac'` \| `'cloud'` \| `'machine'` \| `'lighting'` |
| resourceId | STRING | External resource identifier |
| teamId | FK → Teams | Owning department |
| usageValue | FLOAT | Current metric reading (kWh or %) |
| baselineUsage | FLOAT | Baseline for this resource type |
| isIdle | BOOLEAN | Whether resource is currently idle |
| carbonSaved | FLOAT | Estimated kg CO2 saved (calculated) |
| costSaved | FLOAT | Estimated $ saved (calculated) |
| detectedAt | TIMESTAMP | Time of idle classification |

### 10.2 OptimizationActions

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| metricId | FK → IdleMetrics | Associated idle detection event |
| status | ENUM | `'pending'` \| `'approved'` \| `'auto-executed'` \| `'dismissed'` |
| actionType | STRING | e.g., `'shutdown'`, `'hvac-off'`, `'lights-off'` |
| approvedBy | FK → Users (nullable) | Null for auto-executed actions |
| executedAt | TIMESTAMP | Null until action is taken |
| estimatedSavings | FLOAT | kWh savings estimate at detection time |
| actualSavings | FLOAT (nullable) | Recorded post-execution if measurable |

### 10.3 Departments

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| name | STRING | Department name |
| baselineUsage | FLOAT | kWh baseline (admin-configurable) |
| teamSize | INTEGER | Used for size-normalized scoring |

---

## 11. Fairness Model

The platform compares departments by efficiency improvement relative to their assigned baseline, not by absolute consumption. This ensures fairness when comparing a GPU-heavy Data Science team against a laptop-only HR team.

> **Scoring Logic**
> 1. Admin sets a baseline kWh value per department (reflecting expected consumption for that team's workload type).
> 2. Each reporting period, current consumption is measured against baseline.
> 3. `Improvement % = (Baseline − Current) / Baseline × 100`
> 4. *(Optional)* Score is further normalized by dividing by team size to account for headcount differences.
> 5. Departments are ranked by improvement % descending.

Baseline values are set by administrators and should be reviewed quarterly. Changes are logged for audit. Teams cannot view or modify their own baseline.

**Anti-gaming controls:** Resource ownership tagging ensures that workloads shifted to other departments are tracked under the originating team. Any untagged resource defaults to Facilities / IT until reassigned.

---

## 12. Demo Dataset

All data is synthetic and seeded for the hackathon demonstration.

| Department | Users | Roles Included |
|-----------|-------|----------------|
| Data Science | 12 | Data Scientists (8), ML Engineers (3), Team Lead (1) |
| Procurement | 10 | Procurement Officers (7), Procurement Manager (2), Admin (1) |
| HR | 8 | HR Generalists (5), HR Manager (2), Recruiter (1) |
| Facilities / IT | 10 | IT Engineers (5), Maintenance Staff (3), Facilities Manager (2) |

**Pre-loaded demo metrics:**

- 12 idle cloud VMs across Data Science and Procurement
- 4 HVAC systems detected idle in meeting rooms
- 8 lighting systems idle overnight
- **Aggregate demo savings: 2,500 kWh | $500 cost reduction | 1,125 kg CO2 avoided**

---

## 13. Demo Flow

1. Procurement officer logs in → sees their team ranked 2nd on the leaderboard at 18% improvement.
2. Data Scientist logs in → sees their team ranked 1st at 25% improvement due to GPU utilization reductions.
3. Manager receives a pending action alert → approves shutdown of an idle compute cluster → dashboard updates with increased savings.
4. Admin views company-wide dashboard → sees 2,500 kWh saved, $500 cost reduction, and 1,125 kg CO2 avoided.
5. Leaderboard refreshes → all attendees can see updated rankings in real time.

---

## 14. Success Metrics

| Metric | Target | Verification Method |
|--------|--------|---------------------|
| Idle detection accuracy | ≥ 80% on seeded dataset | Compare detections against ground-truth labels in seed data |
| Dashboard load time | ≤ 3 seconds (P95) | Browser DevTools network tab during live demo |
| Leaderboard refresh latency | ≤ 30 seconds from data ingestion | Manual timer test during demo |
| Energy savings displayed | ≥ 2,000 kWh in demo dataset | Admin dashboard aggregate at demo time |
| Role access control | 100% — no unauthorized data access | Attempt cross-role API calls and confirm 403 responses |
| Manager approval flow | End-to-end in < 60 seconds | Timed walkthrough during demo |

---

## 15. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| False idle detection on seeded data | Leaderboard rankings appear incorrect | Require sustained idle period; validate detection against ground-truth seed labels before demo. |
| Leaderboard gaming (shifting workloads) | Unfair rankings undermine credibility | Resource ownership tagging ensures workloads are attributed to origin team regardless of where they run. |
| Demo environment instability | Live demo fails | Freeze a stable build 2 hours before demo. Prepare offline screenshots as fallback. |
| Simulated data looks unrealistic | Judges question validity | Tune simulation ranges to match real-world benchmarks (e.g., EC2 t3.micro: 2–15% idle CPU). |
| JWT token expiry during demo | Users logged out mid-demo | Set token TTL to 24 hours for the demo environment only. |

---

## 16. Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Backend Runtime | Node.js 20 + Express | REST API server |
| ORM | Sequelize | Database modeling and migrations |
| Database | PostgreSQL 15 | Primary data store |
| Auth | JWT (jsonwebtoken) + bcrypt | Authentication and password hashing |
| Job Scheduling | node-cron | Periodic metric polling and idle detection runs |
| IoT Simulation | MQTT (mosquitto broker) | Simulated sensor data ingestion |
| Frontend | React 18 | Role-based dashboards |
| Charts | Recharts | Energy and savings visualizations |
| State Management | React Context + useReducer | Client-side state |
| HTTP Client | Axios | Frontend → API communication |
| Testing | Jest + Supertest | API unit and integration tests |
| Dev Tooling | ESLint, Prettier, Nodemon | Code quality and developer experience |

---

## 17. Implementation Timeline

| Phase | Tasks | Deliverables |
|-------|-------|--------------|
| Phase 1: Foundation | DB schema, Sequelize models, JWT auth, seed script | Working auth system, seeded DB with 40 users |
| Phase 2: Detection Engine | Idle detection rules, cron job, MQTT simulation, IdleMetrics writes | Idle detection running against simulated data |
| Phase 3: Optimization Layer | Action generation, manager approval API, auto-execute logic, savings calculation | Full approve/dismiss flow working end-to-end |
| Phase 4: Dashboards | Employee, Manager, Admin, Leaderboard React views | All 4 dashboards functional and role-restricted |
| Phase 5: Demo Polish | Seed demo data, tune simulation, fix edge cases, prepare demo script | Stable demo build, rehearsed demo flow |

---

## 18. Future Enhancements

- Predictive idle detection using time-series ML models (e.g., LSTM on usage patterns) to shut down resources before they become idle.
- Real IoT hardware integration with ESP32 and Raspberry Pi devices publishing to a live MQTT broker.
- Live cloud API connections (AWS CloudWatch, Azure Monitor, GCP Operations Suite).
- Digital twin building visualization showing real-time energy flow across office floors.
- Carbon credit accounting aligned to GHG Protocol Scope 2 reporting.
- AI-powered policy recommendations suggesting optimal thresholds per department based on usage history.

---

## 19. Conclusion

The Idle Carbon Budget + Idle Infrastructure Detector demonstrates that enterprise energy waste can be addressed through intelligent monitoring, automation, and behavioral incentives — without requiring new hardware or major process changes.

The fairness-normalized leaderboard is the key innovation: it makes sustainability metrics actionable and equitable across teams with fundamentally different workloads. By embedding this system into an existing procurement platform, the solution shows a realistic path to enterprise adoption beyond the hackathon context.

This PRD defines a buildable, demonstrable scope with clear acceptance criteria, measurable success metrics, and explicit boundaries — giving the team what it needs to deliver confidently within the event timeline.

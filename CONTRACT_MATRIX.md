# Comprehensive Frontend/Backend API Contract Matrix

## Council Bridge Phase 10 Remediation

| Feature | HTTP Method | Frontend Request | Backend Route | Request Schema | Response Schema | Authentication Requirement | Authorization Policy | Verification Status |
|---------|-------------|------------------|---------------|----------------|-----------------|---------------------------|---------------------|---------------------|
| **Dashboard Features** | | | | | | | | |
| Dashboard (Divisions) | GET | `apiClient.get('/api/divisions')` | `GET /api/divisions` | Pagination + filters | `{ divisions: Division[] }` | Bearer token | Founder, Division Head | ✅ OK |
| Dashboard (Staff) | GET | `apiClient.get('/api/staff')` | `GET /api/staff` | Pagination + divisionId | `{ staff: StaffAgent[] }` | Bearer token | Founder, Division Head, Staff (self) | ✅ OK |
| Dashboard (Approvals) | GET | `apiClient.get('/api/approvals')` | `GET /api/approvals` | Pagination + status | `{ data: ApprovalRequest[] }` | Bearer token | Founder | ✅ OK |
| Dashboard (Executions) | GET | `apiClient.get('/api/executions')` | `GET /api/executions` | Pagination + status/al | `{ executions: ExecutionRequest[] }` | Bearer token | Founder | ✅ OK |
| Dashboard (Activity) | GET | `apiClient.get('/api/activity')` | `GET /api/activity` | Pagination | `{ activity: ActivityItem[] }` | Bearer token | Founder, Division Head, Staff (own) | ✅ OK |
| **Activity Feature** | | | | | | | | |
| Activity | GET | `apiClient.get('/api/activity', { params })` | `GET /api/activity` | Pagination (limit/offset) | `{ activity: ActivityItem[] }` | Bearer token | Founder, Division Head, Staff (own) | ✅ OK |
| **Chat/Messaging Feature** | | | | | | | | |
| Chat (Conversations) | GET | `apiClient.get('/api/messages/conversations')` | `GET /api/messages/conversations` | Pagination + search | `{ conversations: Conversation[] }` | Bearer token | Founder, Division Head, Staff | ✅ OK |
| Chat (Messages) | GET | `apiClient.get('/api/messages/:conversationId')` | `GET /api/messages/:convId` | Pagination + convId | `{ messages: Message[] }` | Bearer token | Founder, Division Head, Staff (participant) | ✅ OK |
| Chat (Send) | POST | `apiClient.post('/api/messages', { recipient_id, content })` | `POST /api/messages` | `{ recipient_id, content }` | `{ message: Message }` | Bearer token | Founder, Division Head, Staff | ✅ OK |
| **Council Feature** | | | | | | | | |
| Council (Seats) | GET | `apiClient.get('/api/council/seats')` | `GET /api/council/seats` | none | `{ seats: CouncilSeat[] }` | Bearer token | Founder, Division Head, Staff | ✅ OK |
| Council (Personas) | GET | `apiClient.get('/api/council/personas')` | `GET /api/council/personas` | owner_type/owner_id/cat | `{ data: Persona[] }` | Bearer token | Founder (all), others (own) | ✅ OK |
| Council (Runtime Assignments) | GET | `apiClient.get('/api/council/runtime-assignments')` | `GET /api/council/runtime-assignments` | none | `{ data: RuntimePersonaAssignment[] }` | Bearer token | Founder, Division Head, Staff | ✅ OK |
| Council (Constitution) | GET | `apiClient.get('/api/council/constitution')` | `GET /api/council/constitution` | none | `{ data: Constitution }` | Bearer token | Founder, Division Head, Staff | ✅ OK |
| Council (Meetings) | GET | `apiClient.get('/api/council/meetings')` | `GET /api/meetings` | Pagination + status | `{ meetings: Meeting[] }` | Bearer token | Founder, Division Head, Staff | ✅ OK |
| **Meetings Feature** | | | | | | | | |
| Meetings (List) | GET | `apiClient.get('/api/meetings')` | `GET /api/meetings` | Pagination + status | `{ meetings: Meeting[] }` | Bearer token | Founder, Division Head, Staff | ✅ OK |
| Meetings (Detail) | GET | `apiClient.get('/api/meetings/:id')` | `GET /api/meetings/:id` | none | `{ meeting: Meeting }` | Bearer token | Founder, Division Head, Staff | ✅ OK |
| Meetings (Phases) | GET | `apiClient.get('/api/meetings/:id/phases')` | `GET /api/meetings/:id/phases` | none | `{ phases: MeetingPhase[] }` | Bearer token | Founder, Division Head, Staff | ✅ OK |
| **Memory Feature** | | | | | | | | |
| Memory (List) | GET | `apiClient.get('/api/memory')` | `GET /api/memory` | Pagination + filters | `{ entries: MemoryEntry[] }` | Bearer token | Founder, Division Head, Staff (own) | ✅ OK |
| Memory (Detail) | GET | `apiClient.get('/api/memory/:id')` | `GET /api/memory/:id` | none | `{ entry: MemoryEntry }` | Bearer token | Owner-only via `checkMemoryAccess` | ✅ OK |
| **Organization Feature** | | | | | | | | |
| Organization (Divisions) | GET | `apiClient.get('/api/divisions')` | `GET /api/divisions` | none | `{ divisions: Division[] }` | Bearer token | Founder, Division Head | ✅ OK |
| Organization (Staff) | GET | `apiClient.get('/api/staff')` | `GET /api/staff` | Pagination + division/status | `{ staff: StaffAgent[] }` | Bearer token | Founder (all), Division Head (division), Staff (self) | ✅ OK |
| Organization (Members) | GET | `apiClient.get('/api/staff/divisions/members')` | `GET /api/staff/divisions/members` | none | `{ members: DivisionMember[] }` | Bearer token | Founder, Division Head | ✅ OK |
| **Tasks Feature** | | | | | | | | |
| Tasks (List) | GET | `apiClient.get('/api/tasks')` | `GET /api/tasks` | Pagination + filters | `{ tasks: Task[] }` | Bearer token | Founder (all), Division Head (division), Staff (assigned) | ✅ OK |
| Tasks (Detail) | GET | `apiClient.get('/api/tasks/:id')` | `GET /api/tasks/:id` | none | `{ task: Task }` | Bearer token | Assignee, Creator, Division Head (division), Founder | ✅ OK |
| Tasks (Create) | POST | `apiClient.post('/api/tasks', taskData)` | `POST /api/tasks` | CreateTaskSchema | `{ task: Task }` | Bearer token | Founder, Division Head | ✅ OK |
| Tasks (Assign) | PUT | `apiClient.put('/api/tasks/:id/assign', assignData)` | `PUT /api/tasks/:id/assign` | AssignTaskSchema | `{ task: updatedTask }` | Bearer token | Founder, Division Head (own division) | ✅ OK |
| Tasks (Status) | PUT | `apiClient.put('/api/tasks/:id/status', statusData)` | `PUT /api/tasks/:id/status` | UpdateTaskStatusSchema | `{ task: updatedTask }` | Bearer token | Assignee, Founder | ✅ OK |
| **Executions Feature** | | | | | | | | |
| Executions (List) | GET | `apiClient.get('/api/executions')` | `GET /api/executions` | Pagination + filters | `{ executions: ExecutionRequest[] }` | Bearer token | Founder | ✅ OK |
| Executions (Detail) | GET | `apiClient.get('/api/executions/:id')` | `GET /api/executions/:id` | none | `{ execution: ExecutionRequest }` | Bearer token | Founder | ✅ OK |
| Executions (History) | GET | `apiClient.get('/api/executions/:id/history')` | `GET /api/executions/:id/history` | none | `{ history: ExecutionHistory[] }` | Bearer token | Founder | ✅ OK |
| Executions (Request) | POST | `apiClient.post('/api/executions/request', reqData)` | `POST /api/executions/request` | RequestExecutionSchema | `{ execution: ExecutionRequest }` | Bearer token | Founder | ✅ OK |
| Executions (Approve) | POST | `apiClient.post('/api/executions/approve', approveData)` | `POST /api/executions/approve` | ApproveExecutionSchema | `{ result: any }` | Bearer token | Founder | ✅ OK |
| Executions (Execute) | POST | `apiClient.post('/api/executions/:id/execute')` | `POST /api/executions/:id/execute` | ExecuteExecutionSchema | `{ result: any }` | Bearer token | Runtime (via MCP) | ✅ OK |
| Executions (Cancel) | POST | `apiClient.post('/api/executions/:id/cancel')` | `POST /api/executions/:id/cancel` | CancelExecutionSchema | `{ result: any }` | Bearer token | Founder | ✅ OK |
| Executions (Autonomy Levels) | GET | `apiClient.get('/api/executions/autonomy-levels')` | `GET /api/executions/autonomy-levels` | none | `{ autonomyLevels: TaskAutonomyLevel[] }` | Bearer token | Founder | ✅ OK |
| **Deliverables Feature** | | | | | | | | |
| Deliverables (List) | GET | `apiClient.get('/api/deliverables')` | `GET /api/deliverables` | Pagination + filters | `{ deliverables: Deliverable[] }` | Bearer token | Founder, Division Head, Staff (own) | ✅ OK |
| Deliverables (Detail) | GET | `apiClient.get('/api/deliverables/:id')` | `GET /api/deliverables/:id` | none | `{ deliverable: Deliverable }` | Bearer token | Task assignee/creator, Founder | ✅ OK |
| Deliverables (Versions) | GET | `apiClient.get('/api/deliverables/:id/versions')` | `GET /api/deliverables/:id/versions` | none | `{ versions: DeliverableVersion[] }` | Bearer token | Task assignee/creator, Founder | ✅ OK |
| Deliverables (Create) | POST | `apiClient.post('/api/deliverables', data)` | `POST /api/deliverables` | CreateDeliverableSchema | `{ deliverable: Deliverable }` | Bearer token | Founder, Division Head | ✅ OK |
| Deliverables (Submit) | PUT | `apiClient.put('/api/deliverables/:id/submit')` | `PUT /api/deliverables/:id/submit` | SubmitDeliverableSchema | `{ deliverable: Deliverable }` | Bearer token | Task assignee | ✅ OK |
| Deliverables (Review) | PUT | `apiClient.put('/api/deliverables/:id/review', data)` | `PUT /api/deliverables/:id/review` | ReviewDeliverableSchema | `{ deliverable: Deliverable }` | Bearer token | Reviewer, Founder | ✅ OK |
| Deliverables (Revision) | PUT | `apiClient.put('/api/deliverables/:id/revision', data)` | `PUT /api/deliverables/:id/revision` | RequestRevisionSchema | `{ deliverable: Deliverable }` | Bearer token | Reviewer, Founder | ✅ OK |
| Deliverables (Assign Reviewer) | PUT | `apiClient.put('/api/deliverables/:id/assign-reviewer', data)` | `PUT /api/deliverables/:id/assign-reviewer` | AssignReviewerSchema | `{ deliverable: Deliverable }` | Bearer token | Founder | ✅ OK |
| **Approvals Feature** | | | | | | | | |
| Approvals (List) | GET | `apiClient.get('/api/approvals')` | `GET /api/approvals` | Pagination + status/reqBy | `{ data: ApprovalRequest[] }` | Bearer token | Founder | ✅ OK |
| **Runtime Control Feature** | | | | | | | | |
| Runtime State | GET | `apiClient.get('/api/runtime')` | `GET /api/runtime` | none | `{ activeRuntime, connectionStatus, sessionId, ... }` | Bearer token | Founder | ✅ OK |
| Runtime Connect | POST | `apiClient.post('/api/runtime/connect', { runtime, session_id, ... })` | `POST /api/runtime/connect` | `{ runtime, session_id, ... }` | `{ success, data: state }` | Bearer token | Founder | ✅ OK |
| Runtime Disconnect | POST | `apiClient.post('/api/runtime/disconnect', { session_id })` | `POST /api/runtime/disconnect` | `{ session_id }` | `{ success, data: state }` | Bearer token | Founder | ✅ OK |
| Runtime Switch | POST | `apiClient.post('/api/runtime/switch', { new_runtime, session_id, ... })` | `POST /api/runtime/switch` | `{ new_runtime, session_id, ... }` | `{ success, data: state }` | Bearer token | Founder | ✅ OK |
| Runtime Heartbeat | POST | `apiClient.post('/api/runtime/heartbeat', { session_id })` | `POST /api/runtime/heartbeat` | `{ session_id }` | `{ success, data: state }` | Bearer token | Session owner (runtime or Founder) | ✅ OK |
| **Profile Feature** | | | | | | | | |
| Profile | GET | `apiClient.get('/api/auth/status')` | `GET /api/auth/status` | none | `{ authenticated, auth_mode, session, stats }` | Bearer token | Any authenticated | ✅ OK |
| **Settings Feature** | | | | | | | | |
| Settings (Appearance) | - | UI (theme switch) | N/A (localStorage) | N/A | stored in localStorage | N/A | N/A | ✅ OK |
| Settings (Notifications) | - | UI (switches) | N/A (localStorage) | N/A | stored in localStorage | N/A | N/A | ✅ OK |
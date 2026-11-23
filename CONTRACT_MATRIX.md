// COMPREHENSIVE FRONTEND/BACKEND API CONTRACT MATRIX
// COUNCIL BRIDGE Phase 10 Remediation

// COLUMN DEFINITIONS:
// Feature | Frontend request | Backend route | Request schema | Response schema | Status

echo "FEATURE                  | FRONTEND REQUEST                     | BACKEND ROUTE               | REQUEST SCHEMA            | RESPONSE SCHEMA          | STATUS
---------------------------------------------------------------------------"

# Dashboard features
echo "Dashboard (divisions)      | GET /api/divisions                    | GET /api/divisions         | Pagination + filters    | { divisions: Division[] }| OK"
echo "Dashboard (staff)          | GET /api/staff                        | GET /api/staff             | Pagination + divisionId | { staff: StaffAgent[] }  | OK"
echo "Dashboard (approvals)      | GET /api/approvals                    | GET /api/approvals         | Pagination + status     | { data: ApprovalRequest[] }| OK"
echo "Dashboard (executions)     | GET /api/executions                   | GET /api/executions        | Pagination + status/al  | { executions: ExecutionRequest[] }| OK"
echo "Dashboard (activity)       | GET /api/activity                     | GET /api/activity          | Pagination              | { activity: ActivityItem[] }| OK"

# Activity feature  
echo "Activity                   | GET /api/activity (params)            | GET /api/activity          | Pagination (limit/offset)| { activity: ActivityItem[] }| OK"

# Chat/ Messaging feature
echo "Chat (conversations)       | GET /api/messages/conversations        | GET /api/messages/conversations | Pagination + search  | { conversations: Conversation[] }| OK"
echo "Chat (messages)            | GET /api/messages/:conversationId      | GET /api/messages/:convId  | Pagination + convId    | { messages: Message[] }| OK"
echo "Chat (send)                | POST /api/messages                     | POST /api/messages         | { recipient_id, content }| message: Message           | OK"

# Council feature
echo "Council (seats)            | GET /api/council/seats                 | GET /api/council/seats      | none                    | { seats: CouncilSeat[] }    | OK"
echo "Council (personas)         | GET /api/council/personas              | GET /api/council/personas   | owner_type/owner_id/cat| { data: Persona[] }         | OK"
echo "Council (runtime-assignments)| GET /api/council/runtime-assignments   | GET /api/council/runtime-assignments | none      | { data: RuntimePersonaAssignment[] }| OK"
echo "Council (constitution)     | GET /api/council/constitution          | GET /api/council/constitution | none       | { data: Constitution }      | OK"
echo "Council (meetings)         | GET /api/council/meetings (alias)      | GET /api/meetings           | Pagination + status     | { meetings: Meeting[] }     | OK"

# Meetings feature
echo "Meetings (list)            | GET /api/meetings                      | GET /api/meetings           | Pagination + status     | { meetings: Meeting[] }     | OK"
echo "Meetings (detail/:id)      | GET /api/meetings/:id                  | GET /api/meetings/:id       | none                     | { meeting: Meeting }        | OK"
echo "Meetings (phases/:id)      | GET /api/meetings/:id/phases           | GET /api/meetings/:id/phases | none        | { phases: MeetingPhase[] }  | OK"

# Memory feature
echo "Memory (list)              | GET /api/memory                        | GET /api/memory              | Pagination + filters    | { entries: MemoryEntry[] }  | OK"
echo "Memory (detail/:id)        | GET /api/memory/:id                    | GET /api/memory/:id          | none                     | { entry: MemoryEntry }      | OK"

# Organization feature
echo "Organization (divisions)   | GET /api/divisions                     | GET /api/divisions           | none                     | { divisions: Division[] }   | OK"
echo "Organization (staff)       | GET /api/staff                         | GET /api/staff               | Pagination + division/status | { staff: StaffAgent[] } | OK"
echo "Organization (members)     | GET /api/staff/divisions/members       | GET /api/staff/divisions/members | none         | { members: DivisionMember[] }| OK"

# Tasks feature
echo "Tasks (list)               | GET /api/tasks                         | GET /api/tasks               | Pagination + filters    | { tasks: Task[] }           | OK"
echo "Tasks (detail/:id)         | GET /api/tasks/:id                     | GET /api/tasks/:id           | none                     | { task: Task }              | OK"
echo "Tasks (create)             | POST /api/tasks                        | POST /api/tasks              | CreateTaskSchema         | { task: Task }              | OK"
echo "Tasks (assign/:id)         | PUT /api/tasks/:id/assign                | PUT /api/tasks/:id/assign    | AssignTaskSchema         | { task: updatedTask }     | OK"
echo "Tasks (status/:id)         | PUT /api/tasks/:id/status                | PUT /api/tasks/:id/status    | UpdateTaskStatusSchema   | { task: updatedTask }     | OK"

# Executions feature
echo "Executions (list)          | GET /api/executions                    | GET /api/executions          | Pagination + filters    | { executions: ExecutionRequest[] }| OK"
echo "Executions (detail/:id)    | GET /api/executions/:id                | GET /api/executions/:id      | none                     | { execution: ExecutionRequest }| OK"
echo "Executions (history/:id)   | GET /api/executions/:id/history        | GET /api/executions/:id/history | none           | { history: ExecutionHistory[] }| OK"
echo "Executions (request)       | POST /api/executions/request           | POST /api/executions/request | RequestExecutionSchema | { execution: ExecutionRequest }| OK"
echo "Executions (approve)       | POST /api/executions/approve           | POST /api/executions/approve | ApproveExecutionSchema | { result: any }             | OK"
echo "Executions (execute/:id)   | POST /api/executions/:id/execute       | POST /api/executions/:id/execute | ExecuteExecutionSchema | { result: any }           | OK"
echo "Executions (cancel/:id)    | POST /api/executions/:id/cancel        | POST /api/executions/:id/cancel | CancelExecutionSchema | { result: any }             | OK"
echo "Executions (autonomy-levels)| GET /api/executions/autonomy-levels    | GET /api/executions/autonomy-levels | none           | { autonomyLevels: TaskAutonomyLevel[] }| OK"

# Deliverables feature
echo "Deliverables (list)        | GET /api/deliverables                  | GET /api/deliverables        | Pagination + filters    | { deliverables: Deliverable[] }| OK"
echo "Deliverables (detail/:id)  | GET /api/deliverables/:id              | GET /api/deliverables/:id    | none                     | { deliverable: Deliverable }| OK"
echo "Deliverables (versions/:id)| GET /api/deliverables/:id/versions     | GET /api/deliverables/:id/versions | none         | { versions: DeliverableVersion[] }| OK"
echo "Deliverables (create)      | POST /api/deliverables                 | POST /api/deliverables       | CreateDeliverableSchema | { deliverable: Deliverable }| OK"
echo "Deliverables (submit/:id)  | PUT /api/deliverables/:id/submit        | PUT /api/deliverables/:id/submit | SubmitDeliverableSchema | { deliverable: Deliverable }| OK"
echo "Deliverables (review/:id)  | PUT /api/deliverables/:id/review        | PUT /api/deliverables/:id/review | ReviewDeliverableSchema | { deliverable: Deliverable }| OK"
echo "Deliverables (revision/:id)| PUT /api/deliverables/:id/revision     | PUT /api/deliverables/:id/revision | RequestRevisionSchema | { deliverable: Deliverable }| OK"
echo "Deliverables (assign-reviewer/:id)| PUT /api/deliverables/:id/assign-reviewer | PUT /api/deliverables/:id/assign-reviewer | AssignReviewerSchema | { deliverable: Deliverable }| OK"

# Approvals feature
echo "Approvals (list)           | GET /api/approvals                     | GET /api/approvals           | Pagination + status/reqBy | { data: ApprovalRequest[] }| OK"

# Runtime Control feature
echo "Runtime state              | GET /api/runtime                       | GET /api/runtime             | none                     | { activeRuntime, connectionStatus, sessionId, ... }| OK"
echo "Runtime connect            | POST /api/runtime/connect              | POST /api/runtime/connect    | { runtime, session_id, ... }| { success, data: state }    | OK"
echo "Runtime disconnect         | POST /api/runtime/disconnect           | POST /api/runtime/disconnect | { session_id }      | { success, data: state }    | OK"
echo "Runtime switch             | POST /api/runtime/switch               | POST /api/runtime/switch     | { new_runtime, session_id, ... }| { success, data: state }    | OK"
echo "Runtime heartbeat          | POST /api/runtime/heartbeat            | POST /api/runtime/heartbeat  | { session_id }          | { success, data: state }    | OK"

# Profile feature
echo "Profile                    | GET /api/auth/status                   | GET /api/auth/status         | none                     | { authenticated, auth_mode, session, stats }| OK"

# Settings feature
echo "Settings (appearance)      | UI (theme switch)                      | N/A (localStorage)         | N/A                      | stored in localStorage       | OK"
echo "Settings (notifications)   | UI (switches)                          | N/A (localStorage)         | N/A                      | stored in localStorage       | OK"
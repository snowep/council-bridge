// API Types - Shared between frontend and backend
// Based on backend types in src/council/types.ts

// Auth types
export interface AuthContext {
  owner_type: 'founder' | 'staff' | 'division' | 'seat';
  owner_id: string;
  runtime: 'claude' | 'hermes';
  session_id: string;
  permissions: string[];
  expires_at: number;
  issued_at: number;
  founder_signed?: boolean;
}

export interface SessionTokenResponse {
  session_token: string;
}

export interface AuthStatusResponse {
  authenticated: boolean;
  auth_mode: string;
  session: AuthContext | null;
  stats: {
    total: number;
    active: number;
    expired: number;
    by_runtime: Record<string, number>;
  };
}

export interface FounderPublicKeyResponse {
  public_key: string;
  key_id: string;
}

// Council types
export interface CouncilSeat {
  seat_id: string;
  name: string;
  status: 'permanent' | 'replaceable' | 'vacant' | 'candidate' | 'approved';
  is_founder: boolean;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Persona {
  persona_id: string;
  seat_id: string;
  name: string;
  description: string;
  traits: string;
  created_at: string;
  updated_at: string;
}

export interface RuntimePersonaAssignment {
  runtime: 'claude' | 'hermes';
  persona_id: string;
}

export interface Constitution {
  constitution_id: string;
  version: string;
  content: string;
  status: 'draft' | 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface FounderApproval {
  approval_id: string;
  constitution_id: string;
  approved: boolean;
  notes: string;
  created_at: string;
}

// Division types
export interface Division {
  division_id: string;
  name: string;
  description: string;
  head_staff_id: string | null;
  budget_limit: number | null;
  permissions: string[];
  strategic_objectives: string[];
  created_at: string;
  updated_at: string;
}

export interface StaffAgent {
  staff_id: string;
  name: string;
  role: string;
  division_id: string;
  runtime_instances: string[];
  permissions: string[];
  status: 'pending' | 'approved' | 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
}

export interface DivisionMember {
  division_id: string;
  staff_id: string;
  joined_at: string;
}

// Memory types
export type MemoryCategory =
  | 'individual_persona'
  | 'council_shared'
  | 'meeting_history'
  | 'decision_resolution'
  | 'idea_proposal'
  | 'research_evidence'
  | 'lesson_learned'
  | 'unresolved_question'
  | 'division_shared'
  | 'division_private'
  | 'staff_private'
  | 'business_context'
  | 'task_history'
  | 'cross_division';

export type MemoryType =
  | 'memory_entry'
  | 'task_created'
  | 'task_updated'
  | 'task_completed'
  | 'deliverable_submitted'
  | 'deliverable_approved'
  | 'deliverable_rejected'
  | 'execution_requested'
  | 'execution_approved'
  | 'execution_completed'
  | 'meeting_phase'
  | 'council_decision'
  | 'staff_appointed';

export interface MemoryEntry {
  memory_id: string;
  owner_type: 'founder' | 'staff' | 'division' | 'seat' | 'council';
  owner_id: string;
  category: MemoryCategory;
  memory_type: MemoryType;
  title: string;
  content: string;
  tags: string[];
  confidence: number;
  created_at: string;
  updated_at: string;
}

export interface MemorySearchParams {
  query?: string;
  category?: MemoryCategory;
  owner_type?: MemoryEntry['owner_type'];
  owner_id?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

// Message types
export interface Message {
  message_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  created_at: string;
  read_at: string | null;
}

export interface Conversation {
  participant_id: string;
  participant_name: string;
  last_message: Message | null;
  unread_count: number;
}

// Meeting types
export interface Meeting {
  meeting_id: string;
  number: number;
  title: string;
  agenda: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface MeetingPhase {
  phase_id: string;
  meeting_id: string;
  phase: 'opening' | 'primary_ideas' | 'brainstorm' | 'challenges' | 'defenses' | 'syntheses' | 'reassessments' | 'evaluations' | 'closing';
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  started_at: string | null;
  completed_at: string | null;
}

// Task types
export type TaskStatus = 'pending' | 'in_progress' | 'review' | 'completed' | 'cancelled' | 'delegated' | 'accepted';

export type TaskAssignedToType = 'division' | 'staff';

export interface Task {
  task_id: string;
  title: string;
  description: string;
  assigned_to_type: TaskAssignedToType;
  assigned_to_id: string;
  created_by_type: 'founder' | 'division_head' | 'staff';
  created_by_id: string;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  updated_at: string;
}

// Deliverable types
export type DeliverableStatus = 'draft' | 'submitted' | 'accepted' | 'rejected' | 'revision_requested';

export type ReviewerType = 'founder' | 'council' | 'division_head';

export interface Deliverable {
  deliverable_id: string;
  task_id: string;
  content: string;
  version: number;
  quality_score: number | null;
  status: DeliverableStatus;
  reviewer_type: ReviewerType | null;
  reviewer_id: string | null;
  approved_at: string | null;
  approved_by_type: ReviewerType | null;
  approved_by_id: string | null;
  founder_signature: string | null;
  founder_signed_at: string | null;
  revision_notes: string | null;
  submitted_by_type: 'staff' | 'founder' | 'division';
  submitted_by_id: string;
  created_at: string;
  updated_at: string;
}

export interface DeliverableVersion {
  version_id: string;
  deliverable_id: string;
  version_num: number;
  content: string;
  quality_score: number | null;
  status: DeliverableStatus;
  submitted_by_type: string;
  submitted_by_id: string;
  revision_notes: string | null;
  created_at: string;
}

// Execution types
export type AutonomyLevel = 1 | 2 | 3;

export type ExecutionStatus =
  | 'proposed'
  | 'permission_check'
  | 'approval_required'
  | 'approved'
  | 'rejected'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';

export interface TaskAutonomyLevel {
  task_type: string;
  autonomy_level: AutonomyLevel;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface ExecutionRequest {
  execution_id: string;
  task_id: string;
  requested_by_type: 'staff' | 'division' | 'founder';
  requested_by_id: string;
  autonomy_level: AutonomyLevel;
  action_description: string;
  action_payload: Record<string, any>;
  status: ExecutionStatus;
  approval_request_id: string | null;
  approval_id: string | null;
  permission_grants: string[];
  error_message: string | null;
  result_payload: Record<string, any> | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalRequest {
  approval_request_id: string;
  execution_id: string;
  requested_by_type: 'staff' | 'division' | 'founder';
  requested_by_id: string;
  action_description: string;
  action_payload: Record<string, any>;
  justification: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  deadline: string | null;
  status: ApprovalStatus;
  approved_by_type: string | null;
  approved_by_id: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExecutionHistory {
  history_id: string;
  execution_id: string;
  task_id: string;
  requested_by_type: 'staff' | 'division' | 'founder';
  requested_by_id: string;
  autonomy_level: AutonomyLevel;
  action_description: string;
  action_payload: Record<string, any>;
  status_before: string;
  status_after: string;
  approval_reference: string | null;
  permission_grants: string[];
  result_payload: Record<string, any> | null;
  error_message: string | null;
  executed_by_type: string | null;
  executed_by_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  recorded_at: string;
}

// Quality threshold types
export interface QualityThreshold {
  threshold_id: string;
  division_id: string | null;
  task_type: string | null;
  min_quality_score: number;
  requires_review: boolean;
  created_at: string;
  updated_at: string;
}

// API Request/Response types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApiError {
  error: string;
  code: string;
  details?: any;
}

// Founder signature request
export interface FounderSignatureRequest {
  founder_signature: string;
  founder_timestamp: string;
  founder_nonce: string;
  founder_key_id: string;
}
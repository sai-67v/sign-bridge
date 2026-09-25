export enum ECommandType {
  COMMAND = "COMMAND",
  OPTION = "OPTION",
  CONTENT = "CONTENT",
}

export interface ICommand {
  type: ECommandType
  text: string
}

export interface ICommandSuggestItem {
  title: string
  desc: string
}

export interface ICommandOptions {
  [key: string]: {
    options: string[]
    desc: string
  }
}

export type CommandFunc = () => {
  execute: (commands: ICommand[]) => Promise<void>
  hasSuggestValue?: (command: ICommand) => string
  suggestOptionValue?: (option: string, value: string) => ICommandSuggestItem[]
  commandOptions: ICommandOptions
}

export interface ICSSVariable {
  name: string
  value: string
}

// ─── Domain models ────────────────────────────────────────────────────────────

export interface ISchool {
  id: string
  name: string
  adminId: string
  address?: string
  city?: string
  country?: string
  logoFileId?: string
  $createdAt?: string
}

export interface IClassroom {
  id: string
  name: string
  schoolId: string
  teacherId: string
  subject?: string
  gradeLevel?: string
  description?: string
  inviteCode: string
  /** Optional Appwrite `folders` row id that roots this class workspace in the library. */
  rootFolderId?: string | null
  /** Optional `folders` row id for the class **Materials** subtree (set when teacher first ensures/uploads). */
  materialsFolderId?: string | null
  $createdAt?: string
  $updatedAt?: string
}

export type MembershipRole = 'student' | 'teacher' | 'co-teacher'
export type MembershipStatus = 'active' | 'invited' | 'removed'

export interface IClassroomMembership {
  id: string
  userId: string
  classroomId: string
  schoolId: string
  role: MembershipRole
  status: MembershipStatus
  joinedAt?: string
}

export interface IFolder {
  id: string
  ownerId: string
  name: string
  color?: string
  parentFolderId?: string
  /** Optional: folder belongs to a class workspace (folder subtree). */
  classId?: string | null
  /** Optional: `class_workspace` = class root; `materials` gates class PDF uploads; other = `general` / `default`. */
  folderKind?: 'general' | 'materials' | 'default' | 'class_workspace' | null
  $createdAt?: string
}

export interface ITag {
  id: string
  ownerId: string
  name: string
  color?: string
}

export type WorksheetStatus = 'draft' | 'distributed'

export interface IWorksheet {
  id: string
  teacherId: string
  classroomId?: string
  title: string
  content: string
  worksheetSections?: string
  status: WorksheetStatus
  $createdAt?: string
  $updatedAt?: string
}

export type SubmissionStatus = 'pending' | 'submitted' | 'reviewed'

export interface IWorksheetDistribution {
  id: string
  worksheetId: string
  teacherId: string
  classroomId: string
  distributedAt?: string
  submissionCount: number
}

export interface IWorksheetSubmission {
  id: string
  distributionId: string
  worksheetId: string
  teacherId: string
  studentId: string
  classroomId: string
  studentAnswers?: string
  status: SubmissionStatus
  submittedAt?: string
  aiAnalysis?: string
}

export type NotificationType = 'worksheet_received' | 'submission_reviewed'

export interface INotification {
  id: string
  recipientId: string
  type: NotificationType
  title: string
  message: string
  metadata?: string
  read: boolean
  createdAt?: string
}

export interface INotificationMetadata {
  worksheetId?: string
  distributionId?: string
  classroomId?: string
  teacherName?: string
  worksheetTitle?: string
}

/** Appwrite `pad_ai_usage_events` — Feature 008 teacher dashboard. */
export type PadAiUsageEventKind = 'ai_completion' | 'ai_blocked' | 'ai_chat'

export interface IPadAiUsageEvent {
  id: string
  schoolId: string
  classroomId: string
  noteId: string
  userId: string
  eventKind: PadAiUsageEventKind
  metadata: string | null
  $createdAt?: string
}

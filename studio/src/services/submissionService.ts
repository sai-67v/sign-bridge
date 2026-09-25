import { ID, Permission, Query, Role } from 'appwrite';
import { APPWRITE_DATABASE_ID } from '../config/appwriteEnv';
import { databases } from '../libs/appwrite';
import type { IWorksheetSubmission, SubmissionStatus } from '../types';

const DB = APPWRITE_DATABASE_ID;
const COL = 'worksheet_submissions';

function docToSubmission(doc: any): IWorksheetSubmission {
  return {
    id: doc.$id,
    distributionId: doc.distributionId,
    worksheetId: doc.worksheetId,
    teacherId: doc.teacherId,
    studentId: doc.studentId,
    classroomId: doc.classroomId,
    studentAnswers: doc.studentAnswers,
    status: doc.status || 'pending',
    submittedAt: doc.submittedAt,
    aiAnalysis: doc.aiAnalysis,
  };
}

export const submissionService = {
  async createSubmission(data: {
    distributionId: string;
    worksheetId: string;
    teacherId: string;
    studentId: string;
    classroomId: string;
  }): Promise<IWorksheetSubmission> {
    // Only set permissions for the caller (teacher). Setting Role.user(studentId)
    // from a teacher's session 401s — Appwrite forbids granting roles you don't own.
    // Student read/update access is covered by table-level read/update("users").
    const doc = await databases.createDocument(DB, COL, ID.unique(), {
      ...data,
      status: 'pending',
    }, [
      Permission.read(Role.user(data.teacherId)),
      Permission.update(Role.user(data.teacherId)),
      Permission.delete(Role.user(data.teacherId)),
      Permission.read(Role.user(data.studentId)),
      Permission.update(Role.user(data.studentId)),
    ]);
    return docToSubmission(doc);
  },

  /** Student's submission row for a given distribution (for deep links / notifications). */
  async getSubmissionForDistributionAndStudent(
    distributionId: string,
    studentId: string
  ): Promise<IWorksheetSubmission | null> {
    const res = await databases.listDocuments(DB, COL, [
      Query.equal('distributionId', distributionId),
      Query.equal('studentId', studentId),
      Query.limit(1),
    ]);
    if (!res.documents.length) return null;
    return docToSubmission(res.documents[0]);
  },

  async getSubmission(id: string): Promise<IWorksheetSubmission> {
    const doc = await databases.getDocument(DB, COL, id);
    return docToSubmission(doc);
  },

  async getMySubmissions(studentId: string): Promise<IWorksheetSubmission[]> {
    const res = await databases.listDocuments(DB, COL, [
      Query.equal('studentId', studentId),
      Query.orderDesc('$createdAt'),
      Query.limit(100),
    ]);
    return res.documents.map(docToSubmission);
  },

  async getSubmissionsForDistribution(distributionId: string): Promise<IWorksheetSubmission[]> {
    const res = await databases.listDocuments(DB, COL, [
      Query.equal('distributionId', distributionId),
      Query.orderAsc('studentId'),
      Query.limit(200),
    ]);
    return res.documents.map(docToSubmission);
  },

  async getSubmissionsForClassroom(classroomId: string): Promise<IWorksheetSubmission[]> {
    const res = await databases.listDocuments(DB, COL, [
      Query.equal('classroomId', classroomId),
      Query.orderDesc('$createdAt'),
      Query.limit(200),
    ]);
    return res.documents.map(docToSubmission);
  },

  async updateAnswers(id: string, answers: Record<string, string>): Promise<IWorksheetSubmission> {
    const doc = await databases.updateDocument(DB, COL, id, {
      studentAnswers: JSON.stringify(answers),
    });
    return docToSubmission(doc);
  },

  async submit(id: string, answers: Record<string, string>): Promise<IWorksheetSubmission> {
    const doc = await databases.updateDocument(DB, COL, id, {
      studentAnswers: JSON.stringify(answers),
      status: 'submitted' as SubmissionStatus,
      submittedAt: new Date().toISOString(),
    });
    return docToSubmission(doc);
  },

  async saveAiAnalysis(id: string, analysis: object): Promise<IWorksheetSubmission> {
    const doc = await databases.updateDocument(DB, COL, id, {
      aiAnalysis: JSON.stringify(analysis),
      status: 'reviewed' as SubmissionStatus,
    });
    return docToSubmission(doc);
  },
};

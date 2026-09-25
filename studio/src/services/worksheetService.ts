import { ID, Permission, Query, Role } from 'appwrite';
import { APPWRITE_DATABASE_ID } from '../config/appwriteEnv';
import { databases } from '../libs/appwrite';
import type { IWorksheet, IWorksheetDistribution } from '../types';
import { classroomService } from './classroomService';
import { notificationService } from './notificationService';
import { submissionService } from './submissionService';

const DB = APPWRITE_DATABASE_ID;
const WS_COL = 'worksheets';
const DIST_COL = 'worksheet_distributions';

function docToWorksheet(doc: any): IWorksheet {
  return {
    id: doc.$id,
    teacherId: doc.teacherId,
    classroomId: doc.classroomId,
    title: doc.title,
    content: doc.content || '',
    worksheetSections: doc.worksheetSections,
    status: doc.status || 'draft',
    $createdAt: doc.$createdAt,
    $updatedAt: doc.$updatedAt,
  };
}

function docToDistribution(doc: any): IWorksheetDistribution {
  return {
    id: doc.$id,
    worksheetId: doc.worksheetId,
    teacherId: doc.teacherId,
    classroomId: doc.classroomId,
    distributedAt: doc.distributedAt,
    submissionCount: doc.submissionCount || 0,
  };
}

export const worksheetService = {
  async createWorksheet(
    teacherId: string,
    data: Omit<IWorksheet, 'id' | 'teacherId' | 'status' | '$createdAt' | '$updatedAt'>
  ): Promise<IWorksheet> {
    const doc = await databases.createDocument(DB, WS_COL, ID.unique(), {
      ...data,
      teacherId,
      status: 'draft',
    }, [
      Permission.read(Role.user(teacherId)),
      Permission.update(Role.user(teacherId)),
      Permission.delete(Role.user(teacherId)),
    ]);
    return docToWorksheet(doc);
  },

  async getWorksheet(id: string): Promise<IWorksheet> {
    const doc = await databases.getDocument(DB, WS_COL, id);
    return docToWorksheet(doc);
  },

  async listMyWorksheets(teacherId: string): Promise<IWorksheet[]> {
    const res = await databases.listDocuments(DB, WS_COL, [
      Query.equal('teacherId', teacherId),
      Query.orderDesc('$createdAt'),
      Query.limit(100),
    ]);
    return res.documents.map(docToWorksheet);
  },

  async updateWorksheet(id: string, data: Partial<Omit<IWorksheet, 'id' | 'teacherId' | '$createdAt' | '$updatedAt'>>): Promise<IWorksheet> {
    const doc = await databases.updateDocument(DB, WS_COL, id, data);
    return docToWorksheet(doc);
  },

  async deleteWorksheet(id: string): Promise<void> {
    await databases.deleteDocument(DB, WS_COL, id);
  },

  /**
   * Distribute a worksheet to an entire classroom.
   * Creates:
   *  1. A distribution record
   *  2. One submission doc per active student (with teacher+student read perms)
   *  3. One notification doc per student
   */
  async distribute(
    worksheetId: string,
    classroomId: string,
    teacherId: string,
    teacherName: string,
  ): Promise<IWorksheetDistribution> {
    const worksheet = await worksheetService.getWorksheet(worksheetId);

    const distribution = await databases.createDocument(DB, DIST_COL, ID.unique(), {
      worksheetId,
      teacherId,
      classroomId,
      distributedAt: new Date().toISOString(),
      submissionCount: 0,
    }, [
      Permission.read(Role.user(teacherId)),
      Permission.update(Role.user(teacherId)),
      Permission.delete(Role.user(teacherId)),
    ]);

    await worksheetService.updateWorksheet(worksheetId, { status: 'distributed' });

    const members = await classroomService.listMembers(classroomId);
    const students = members.filter(m => m.role === 'student' && m.status === 'active');
    const studentReadPerms = students.map((m) => Permission.read(Role.user(m.userId)));

    await Promise.all(
      students.map(async (member) => {
        await submissionService.createSubmission({
          distributionId: distribution.$id,
          worksheetId,
          teacherId,
          studentId: member.userId,
          classroomId,
        });

        await notificationService.createNotification({
          recipientId: member.userId,
          senderId: teacherId,
          type: 'worksheet_received',
          title: `New Worksheet: ${worksheet.title}`,
          message: `${teacherName} sent you a new worksheet to complete.`,
          metadata: JSON.stringify({
            worksheetId,
            distributionId: distribution.$id,
            classroomId,
            teacherName,
            worksheetTitle: worksheet.title,
          }),
        });
      })
    );

    // Let students open the distribution + worksheet in the hub / assignment flow (Appwrite read).
    if (studentReadPerms.length > 0) {
      try {
        await databases.updateDocument(DB, DIST_COL, distribution.$id, {}, [
          Permission.read(Role.user(teacherId)),
          Permission.update(Role.user(teacherId)),
          Permission.delete(Role.user(teacherId)),
          ...studentReadPerms,
        ]);
        await databases.updateDocument(DB, WS_COL, worksheetId, {}, [
          Permission.read(Role.user(teacherId)),
          Permission.update(Role.user(teacherId)),
          Permission.delete(Role.user(teacherId)),
          ...studentReadPerms,
        ]);
      } catch (e) {
        console.warn('distribute: could not add student read on distribution/worksheet', e);
      }
    }

    return docToDistribution(distribution);
  },

  async listDistributions(teacherId: string): Promise<IWorksheetDistribution[]> {
    const res = await databases.listDocuments(DB, DIST_COL, [
      Query.equal('teacherId', teacherId),
      Query.orderDesc('distributedAt'),
      Query.limit(100),
    ]);
    return res.documents.map(docToDistribution);
  },

  async getDistribution(id: string): Promise<IWorksheetDistribution> {
    const doc = await databases.getDocument(DB, DIST_COL, id);
    return docToDistribution(doc);
  },
};

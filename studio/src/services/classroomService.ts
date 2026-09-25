import { ID, Permission, Query, Role } from 'appwrite';
import { APPWRITE_DATABASE_ID } from '../config/appwriteEnv';
import { databases } from '../libs/appwrite';
import type { IClassroom, IClassroomMembership, MembershipRole } from '../types';

const DB = APPWRITE_DATABASE_ID;
const CL_COL = 'classrooms';
const MEM_COL = 'classroom_memberships';

function docToClassroom(doc: any): IClassroom {
  return {
    id: doc.$id,
    name: doc.name,
    schoolId: doc.schoolId,
    teacherId: doc.teacherId,
    subject: doc.subject,
    gradeLevel: doc.gradeLevel,
    description: doc.description,
    inviteCode: doc.inviteCode,
    rootFolderId: doc.rootFolderId ?? null,
    materialsFolderId: doc.materialsFolderId ?? null,
    $createdAt: doc.$createdAt,
    $updatedAt: doc.$updatedAt,
  };
}

function docToMembership(doc: any): IClassroomMembership {
  return {
    id: doc.$id,
    userId: doc.userId,
    classroomId: doc.classroomId,
    schoolId: doc.schoolId,
    role: doc.role,
    status: doc.status || 'active',
    joinedAt: doc.joinedAt,
  };
}

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export const classroomService = {
  async createClassroom(
    teacherId: string,
    data: Omit<IClassroom, 'id' | 'teacherId' | 'inviteCode' | '$createdAt' | '$updatedAt'>
  ): Promise<IClassroom> {
    const inviteCode = generateInviteCode();
    const doc = await databases.createDocument(DB, CL_COL, ID.unique(), {
      ...data,
      teacherId,
      inviteCode,
    }, [
      Permission.read(Role.users()),
      Permission.update(Role.user(teacherId)),
      Permission.delete(Role.user(teacherId)),
    ]);
    let classroom = docToClassroom(doc);
    if (!classroom.rootFolderId) {
      try {
        const { folderService } = await import('./folderService');
        const root = await folderService.createFolder(teacherId, {
          name: `${classroom.name} — class workspace`,
          parentFolderId: undefined,
          classId: classroom.id,
          folderKind: 'class_workspace',
        });
        await classroomService.updateClassroom(classroom.id, { rootFolderId: root.id });
        classroom = await classroomService.getClassroom(classroom.id);
        await folderService.ensureClassMaterialsFolder(teacherId, classroom);
        classroom = await classroomService.getClassroom(classroom.id);
      } catch (e) {
        console.warn('[classroom] auto-provision folders failed', e);
      }
    }
    return classroom;
  },

  async getClassroom(id: string): Promise<IClassroom> {
    const doc = await databases.getDocument(DB, CL_COL, id);
    return docToClassroom(doc);
  },

  async listMyClassrooms(teacherId: string): Promise<IClassroom[]> {
    const res = await databases.listDocuments(DB, CL_COL, [
      Query.equal('teacherId', teacherId),
      Query.limit(100),
    ]);
    return res.documents.map(docToClassroom);
  },

  async listClassroomsBySchool(schoolId: string): Promise<IClassroom[]> {
    const res = await databases.listDocuments(DB, CL_COL, [
      Query.equal('schoolId', schoolId),
      Query.limit(200),
    ]);
    return res.documents.map(docToClassroom);
  },

  /**
   * Classrooms the user can access: those they teach plus those they joined via membership.
   */
  async listAccessibleClassrooms(userId: string): Promise<IClassroom[]> {
    const [owned, memberships] = await Promise.all([
      classroomService.listMyClassrooms(userId),
      classroomService.listMyMemberships(userId),
    ]);
    const byId = new Map<string, IClassroom>();
    for (const c of owned) {
      byId.set(c.id, c);
    }
    for (const m of memberships) {
      if (byId.has(m.classroomId)) continue;
      try {
        const c = await classroomService.getClassroom(m.classroomId);
        byId.set(c.id, c);
      } catch {
        /* membership row may reference deleted classroom */
      }
    }
    return Array.from(byId.values());
  },

  async updateClassroom(
    id: string,
    data: Partial<
      Pick<IClassroom, 'name' | 'subject' | 'gradeLevel' | 'description' | 'rootFolderId' | 'materialsFolderId'>
    >
  ): Promise<IClassroom> {
    const doc = await databases.updateDocument(DB, CL_COL, id, data);
    return docToClassroom(doc);
  },

  async deleteClassroom(id: string): Promise<void> {
    await databases.deleteDocument(DB, CL_COL, id);
  },

  /** Invite-code join is disabled; rosters are admin-provisioned (see `adminAddStudentMembership`). */
  async findByInviteCode(_code: string): Promise<IClassroom | null> {
    return null;
  },

  /** @deprecated Use admin roster or teacher `addMember`. */
  async joinByInviteCode(_userId: string, _code: string): Promise<IClassroomMembership | null> {
    return null;
  },

  /**
   * Admin (or tooling) adds a student membership without an invite code.
   * Same permission shape as legacy self-join: student owns their membership row.
   */
  async adminAddStudentMembership(payload: {
    studentUserId: string;
    classroomId: string;
    schoolId: string;
  }): Promise<IClassroomMembership> {
    const existing = await databases.listDocuments(DB, MEM_COL, [
      Query.equal('userId', payload.studentUserId),
      Query.equal('classroomId', payload.classroomId),
      Query.equal('status', 'active'),
    ]);
    if (existing.documents.length > 0) {
      return docToMembership(existing.documents[0]);
    }
    const doc = await databases.createDocument(DB, MEM_COL, ID.unique(), {
      userId: payload.studentUserId,
      classroomId: payload.classroomId,
      schoolId: payload.schoolId,
      role: 'student',
      status: 'active',
    }, [
      Permission.read(Role.user(payload.studentUserId)),
      Permission.update(Role.user(payload.studentUserId)),
      Permission.delete(Role.user(payload.studentUserId)),
    ]);
    return docToMembership(doc);
  },

  async adminMoveStudentBetweenClassrooms(payload: {
    studentUserId: string;
    fromClassroomId: string;
    toClassroomId: string;
    toSchoolId: string;
  }): Promise<IClassroomMembership> {
    const fromList = await databases.listDocuments(DB, MEM_COL, [
      Query.equal('userId', payload.studentUserId),
      Query.equal('classroomId', payload.fromClassroomId),
      Query.equal('status', 'active'),
    ]);
    for (const row of fromList.documents) {
      await databases.updateDocument(DB, MEM_COL, row.$id, { status: 'removed' });
    }
    return classroomService.adminAddStudentMembership({
      studentUserId: payload.studentUserId,
      classroomId: payload.toClassroomId,
      schoolId: payload.toSchoolId,
    });
  },

  async addMember(
    teacherId: string,
    data: { userId: string; classroomId: string; schoolId: string; role: MembershipRole }
  ): Promise<IClassroomMembership> {
    // Only grant permissions for the caller (teacher). Granting Role.user(data.userId)
    // from a teacher's session would 401 — Appwrite forbids granting roles you don't own.
    // Student read access is covered by table-level read("users").
    const doc = await databases.createDocument(DB, MEM_COL, ID.unique(), {
      ...data,
      status: 'active',
    }, [
      Permission.read(Role.user(teacherId)),
      Permission.update(Role.user(teacherId)),
      Permission.delete(Role.user(teacherId)),
    ]);
    return docToMembership(doc);
  },

  async listMembers(classroomId: string): Promise<IClassroomMembership[]> {
    const res = await databases.listDocuments(DB, MEM_COL, [
      Query.equal('classroomId', classroomId),
      Query.equal('status', 'active'),
      Query.limit(200),
    ]);
    return res.documents.map(docToMembership);
  },

  /**
   * When a pad lives under `folderId`, return the classroom it belongs to.
   * Uses this user's mirrored `class_workspace` root (students) and/or the teacher `rootFolderId` (teacher tree)
   * so folder walks never compare a student's path to another user's folder ids.
   */
  async resolveClassIdForFolder(userId: string, folderId: string | null | undefined): Promise<string | null> {
    if (!folderId) return null;
    const { folderService } = await import('./folderService');
    const classrooms = await classroomService.listAccessibleClassrooms(userId);
    for (const c of classrooms) {
      const roots = new Set<string>();
      const memberRoot = await folderService.findClassWorkspaceRootFolderId(userId, c.id);
      if (memberRoot) roots.add(memberRoot);
      if (c.teacherId === userId && c.rootFolderId) roots.add(c.rootFolderId);
      for (const root of roots) {
        if (await folderService.isFolderDescendantOf(userId, folderId, root)) return c.id;
      }
    }
    return null;
  },

  /**
   * Ensures `rootFolderId` and the Materials subtree exist (same flow as {@link createClassroom}).
   * Caller must be the library owner (`ownerId`), typically the class teacher.
   */
  async ensureClassWorkspaceIfNeeded(ownerId: string, classroom: IClassroom): Promise<IClassroom> {
    let c = classroom;
    if (!c.rootFolderId) {
      const { folderService } = await import('./folderService');
      const root = await folderService.createFolder(ownerId, {
        name: `${c.name} — class workspace`,
        parentFolderId: undefined,
        classId: c.id,
        folderKind: 'class_workspace',
      });
      c = await classroomService.updateClassroom(c.id, { rootFolderId: root.id });
    }
    const { folderService } = await import('./folderService');
    await folderService.ensureClassMaterialsFolder(ownerId, c);
    await folderService.ensureClassWorksheetsFolder(ownerId, c);
    return await classroomService.getClassroom(c.id);
  },

  /**
   * Under the student's own library: `{class name} — class workspace` with **Materials** and **Worksheets**
   * nested inside (same layout as the teacher class tree). Used for imports and personal class-scoped notes.
   */
  async ensureStudentClassWorkspace(studentId: string, classroom: IClassroom): Promise<void> {
    const { folderService } = await import('./folderService');
    let folders = await folderService.listFolders(studentId);
    let root = folders.find(
      (f) =>
        f.classId === classroom.id &&
        f.folderKind === 'class_workspace' &&
        (f.parentFolderId === undefined || f.parentFolderId === null)
    );
    if (!root) {
      await folderService.createFolder(studentId, {
        name: `${classroom.name} — class workspace`,
        parentFolderId: undefined,
        classId: classroom.id,
        folderKind: 'class_workspace',
      });
      folders = await folderService.listFolders(studentId);
      root = folders.find(
        (f) =>
          f.classId === classroom.id &&
          f.folderKind === 'class_workspace' &&
          (f.parentFolderId === undefined || f.parentFolderId === null)
      );
    }
    if (!root) return;
    const classRoot = root;

    const hasMaterials = folders.some(
      (f) => f.parentFolderId === classRoot.id && f.classId === classroom.id && f.folderKind === 'materials'
    );
    if (!hasMaterials) {
      await folderService.createFolder(studentId, {
        name: 'Materials',
        parentFolderId: classRoot.id,
        classId: classroom.id,
        folderKind: 'materials',
      });
      folders = await folderService.listFolders(studentId);
    }

    const hasWorksheets = folders.some(
      (f) =>
        f.parentFolderId === classRoot.id &&
        f.classId === classroom.id &&
        f.name.trim().toLowerCase() === 'worksheets'
    );
    if (!hasWorksheets) {
      await folderService.createFolder(studentId, {
        name: 'Worksheets',
        parentFolderId: classRoot.id,
        classId: classroom.id,
        folderKind: 'general',
      });
    }
  },

  async listMyMemberships(userId: string): Promise<IClassroomMembership[]> {
    const res = await databases.listDocuments(DB, MEM_COL, [
      Query.equal('userId', userId),
      Query.equal('status', 'active'),
      Query.limit(100),
    ]);
    return res.documents.map(docToMembership);
  },

  async removeMember(membershipId: string): Promise<void> {
    await databases.updateDocument(DB, MEM_COL, membershipId, { status: 'removed' });
  },
};

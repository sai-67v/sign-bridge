import { addDoc, collection, deleteDoc, doc, DocumentData, getDocs, limit, query, QueryDocumentSnapshot, startAfter, Timestamp, where } from "../libs/firebase";
import { ref, listAll, getDownloadURL, uploadBytes, deleteObject } from "../libs/firebase";
import { message } from "../components/message";
import { auth, db, storage, storageEnabled } from "../libs/firebase";
import { getCacheArray, setCacheJSON } from "../libs/localCache";
import { getPlanByUid, MAX_STORAGE_SIZE, updatePlanByUid } from "./plans";

type TUploadFileFunc = (filePath: string, file: File | Blob) => Promise<string>
export interface IFile {
  id?: string
  name: string
  path: string // path to file in firebase storage
  url: string
  size: number
  type: string
  createdBy: string
  createdAt: Timestamp
  padId: string
  source: string
}

const COLLECTION_NAME = 'files';

// Check if storage is available
export const isStorageAvailable = () => storageEnabled && storage !== null;

// size: shourld be converted to mb at first
const _calculateStorageSize = async (size: number) => {
  const planData = await getPlanByUid()
  if (!planData) {
    console.log('planData is empty')
    return
  }

  const currentStorageSize = (planData.currentStorageSize || 0) + size
  const roundedSize = currentStorageSize >= 0 ? currentStorageSize : 0

  await updatePlanByUid({
    currentStorageSize: roundedSize
  })

  _maximumStorageWarning(roundedSize)
  console.log('updated current storage size')
}

const _maximumStorageWarning = (size: number) => {
  if (size > MAX_STORAGE_SIZE) {
    message.warning("Your storage size reached to the limit")
  }
}

const _uploadFile: TUploadFileFunc = (filePath, file) => {
  return new Promise((resolve, reject) => {
    if (!storage) {
      message.error("File upload requires Firebase Blaze plan")
      reject('STORAGE_NOT_AVAILABLE')
      return
    }
    const fileRef = ref(storage, filePath);
    uploadBytes(fileRef, file).then(() => {
      _calculateStorageSize(file.size / 1024 / 1024)
      resolve(filePath)
    }).catch((error: any) => {
      console.log('_uploadFile', error)
      reject('ERROR')
    })
  })

};

// Create a reference under which you want to list
const getListRef = () => storage ? ref(storage, "avatars/public") : null;

export const addFileInfo = async (file: IFile) => {
  try {
    await addDoc(collection(db, COLLECTION_NAME), file);
  } catch (error) {
    console.log(error)
  }
}

export const deleteFileInfo = async (id: string) => {
  await deleteDoc(doc(db, COLLECTION_NAME, id))
}

export const getAllPublicAvatars = () => {
  const key = "PUBLIC_AVATAR";
  return new Promise<string[]>((resolve, reject) => {
    // Use local avatars as fallback for demo
    const localAvatars = [
      '/docs/avatars/female-1.png',
      '/docs/avatars/female-2.png',
      '/docs/avatars/female-3.png',
      '/docs/avatars/female-4.png',
      '/docs/avatars/female-5.png',
      '/docs/avatars/female-6.png',
      '/docs/avatars/men-1.png',
      '/docs/avatars/men-2.png',
      '/docs/avatars/men-3.png',
      '/docs/avatars/men-4.png',
      '/docs/avatars/men-5.png',
      '/docs/avatars/men-6.png',
    ];

    const listRef = getListRef();
    if (!listRef) {
      // No Firebase storage, use local avatars
      resolve(localAvatars);
      return;
    }

    const cachedPublicAvatars = getCacheArray(key);
    if (cachedPublicAvatars) {
      resolve(cachedPublicAvatars);
      return;
    }

    // Find all the prefixes and items.
    listAll(listRef)
      .then(async (res: any) => {
        const promise: Promise<string>[] = [];

        res.items.forEach((itemRef: any) => {
          promise.push(getDownloadURL(itemRef));
        });

        const urls = await Promise.all(promise);

        setCacheJSON(key, urls);
        resolve(urls);
      })
      .catch((error: any) => {
        console.warn("Failed to load avatars from Firebase Storage, using local avatars", error);
        // Fallback to local avatars on error
        resolve(localAvatars);
      });
  });
};

export const uploadFileToPad = (filePath: string, file: File | Blob): ReturnType<TUploadFileFunc> => {
  const user = auth?.currentUser
  if (!user || !user.uid) return Promise.resolve('ERROR');

  const { uid } = user;
  const path = `pads/${uid}/${filePath}`;

  return _uploadFile(path, file)
}

export const deleteCoverImageFile = async (file: Partial<IFile>) => {
  const q = query(collection(db, COLLECTION_NAME),
    where("createdBy", "==", file.createdBy),
    where("padId", "==", file.padId),
    where("source", "==", "COVER-IMAGE"))
  const snapshots = await getDocs(q)

  if (snapshots.empty) {
    return 0;
  }

  snapshots.forEach((doc: QueryDocumentSnapshot) => {
    deleteDoc(doc.ref)
    _calculateStorageSize(-(file.size || 0))
  })

  return 1;
}

interface IFileResults {
  lastDoc: QueryDocumentSnapshot<DocumentData> | null,
  data: IFile[]
}

type GetAllFileFunc = (
  fromDoc?: QueryDocumentSnapshot<DocumentData>
) => Promise<IFileResults>

export const getAllFileByUser: GetAllFileFunc = async (fromDoc) => {
  const user = auth?.currentUser
  if (!user || !user.uid) return { lastDoc: null, data: [] };

  let q;
  const dbConn = collection(db, COLLECTION_NAME)
  const cond = where("createdBy", "==", user.uid)
  const maxRecord = limit(20)

  if (!fromDoc) {
    q = query(dbConn, cond, maxRecord
    );
  } else {
    q = query(dbConn, cond, startAfter(fromDoc), maxRecord)
  }

  const snapshot = await getDocs(q)
  if (snapshot.empty) {
    return { lastDoc: null, data: [] }
  }

  const files: IFile[] = []
  const lastDoc = snapshot.docs[snapshot.docs.length - 1]
  snapshot.forEach((doc: QueryDocumentSnapshot) => {
    const data = doc.data() as IFile
    files.push({
      id: doc.id,
      name: data.name,
      path: data.path,
      url: data.url,
      size: data.size,
      type: data.type,
      createdBy: data.createdBy,
      createdAt: data.createdAt,
      padId: data.padId,
      source: data.source
    })
  })

  return {
    lastDoc,
    data: files
  };
}

export const deleteAllImageInOnePad = async (padId: string) => {
  const user = auth?.currentUser
  if (!user || !user.uid) return 0;

  const q = query(collection(db, COLLECTION_NAME),
    where("createdBy", "==", user.uid),
    where("padId", "==", padId))
  const snapshots = await getDocs(q)

  if (snapshots.empty) {
    return 0;
  }

  let totalSize = 0;
  snapshots.forEach((doc: QueryDocumentSnapshot) => {
    const data = doc.data() as IFile
    totalSize += data.size
    deleteFile(data.path).then(() => {
      deleteDoc(doc.ref).catch(() => {
        /* ignore */
      })
    });
  })

  _calculateStorageSize(-totalSize)

  return 1;
}

export const getFileUrl = (filePath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!storage) {
      reject('STORAGE_NOT_AVAILABLE')
      return
    }
    getDownloadURL(ref(storage, filePath)).then((url: any) => {
      resolve(url)
    }).catch((err: any) => {
      console.log('getFileUrl', err)
      reject('Error')
    })
  })
}

export const deleteFile = (filePath: string): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (!storage) {
      resolve(true) // Nothing to delete if storage not available
      return
    }
    const fileRef = ref(storage, filePath)
    deleteObject(fileRef).then(() => {
      resolve(true)
    }).catch((err: any) => {
      if (err.code === 'storage/object-not-found') {
        return resolve(true)
      }
      reject(false)
    })
  })
}


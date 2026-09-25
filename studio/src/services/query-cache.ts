import { doc, onSnapshot, runTransaction } from "../libs/firebase"
import localforage from "localforage"
import { auth, db } from "../libs/firebase"

const DEMO_MODE = process.env.REACT_APP_DEMO_MODE === 'true' || !process.env.REACT_APP_FIREBASE_API_KEY;

// Helper to get current user in demo mode
const getCurrentUser = () => {
  if (DEMO_MODE) {
    const demoUser = localStorage.getItem('demoUser');
    if (demoUser) {
      const user = JSON.parse(demoUser);
      return { uid: user.uid };
    }
    return null;
  }
  return auth?.currentUser || null;
};

// define cache name below ---------------
// define cache name above --------------

export interface IQueryCache {
  [key: string]: number
}

const COLLECTION_NAME = "query-caching"

const cacheDb = localforage.createInstance({
  name: "query-caching",
})

export const setQueryCache = (name: string, data: any) => {
  return cacheDb.setItem(name, data)
}

export const clearQueryCache = (name: string) => {
  return cacheDb.setItem(name, "")
}

export const getQueryCache = (name: string) => {
  return cacheDb.getItem(name)
}

// at the first time, when the app loaded
// it will be registered a watcher
// for listening changes from `cache-query/:userId` document
// everytime there's a change it will do the update process
export const watchQuery = (cb: (data: IQueryCache) => void) => {
  if (DEMO_MODE) {
    // In demo mode, return default values and empty unsubscribe
    cb({});
    return () => { };
  }

  const user = getCurrentUser()

  if (!user) {
    throw new Error("User is null")
  }

  const q = doc(db, COLLECTION_NAME, user.uid)

  const unsub = onSnapshot(q, (qSnapshot: { data: () => any }) => {
    const respData = qSnapshot.data() || {}

    const data: IQueryCache = {
      ...respData,
    }

    cb(data)
  })

  return unsub
}

// update the cache counter on `cache-query` collections
// after update process finished
// it will notify to all devices that
// there's new update available
// after that, app will re-fetch datas and update data to cache
export const updateQueryCounterFor = (
  name: string,
  cb?: (counter: number) => void
) => {
  if (DEMO_MODE) {
    // In demo mode, just call callback with 0
    cb && cb(0);
    return;
  }

  const user = getCurrentUser()
  if (!user) return

  runTransaction(db, async (transaction: { get: (ref: any) => Promise<any>; set: (ref: any, data: any) => void; update: (ref: any, data: any) => void }) => {
    const docRef = doc(db, COLLECTION_NAME, user.uid)
    const queryDoc = await transaction.get(docRef)

    if (!queryDoc.exists()) {
      transaction.set(docRef, { [name]: 1 })
      return
    }

    const dt = queryDoc.data() as IQueryCache
    const n = dt[name]

    // in case, `query-caching/:userId` not undefined
    // but one of fields is undefined
    // must checking isNaN
    let counter = isNaN(n) ? 0 : n
    counter += 1

    transaction.update(docRef, { [name]: counter })

    cb && cb(counter)
  })
}

// update counter for each collections

import { doc, getDoc, setDoc, Timestamp, updateDoc } from "../libs/firebase"
import { auth, db } from "../libs/firebase"
import { getCurrentUser, DEMO_MODE } from "../libs/demo-helpers"

export interface IPlan {
  id?: string
  uid: string
  maxRecord: number
  currentRecord: number
  maxStorageSize: number
  currentStorageSize: number
  expiredTime: Timestamp
}

export const MAX_STORAGE_SIZE = 2000 // GB

export const getPlanByUid = async (): Promise<IPlan | null> => {
  if (DEMO_MODE) {
    // Demo: Return a mock unlimited plan
    const user = getCurrentUser();
    return {
      uid: user?.uid || 'demo',
      maxRecord: 99999,
      currentRecord: 0,
      maxStorageSize: 99999,
      currentStorageSize: 0,
      expiredTime: { seconds: Date.now() / 1000 + 86400 * 365 } as any,
    };
  }

  const uid = auth?.currentUser?.uid

  if (!uid) {
    return null
  }

  try {
    const d = await getDoc(doc(db, "/plans", uid))
    if (d.exists()) {
      const data = d.data() as IPlan | undefined
      if (!data) return null

      return {
        id: d.id,
        uid: data.uid,
        maxRecord: data.maxRecord,
        currentRecord: data.currentRecord,
        expiredTime: data.expiredTime,
        maxStorageSize: data.maxStorageSize,
        currentStorageSize: data.currentStorageSize,
      }
    }

    return null
  } catch (error) {
    console.log(error)
    return null
  }
}

export const decreasePlanRecord = async () => {
  await decreasePlanRecordBy(1)
}

/** Decrement stored plan usage count by `delta` in one read/write (avoids N× Firebase updates). */
export const decreasePlanRecordBy = async (delta: number) => {
  if (delta <= 0) return
  try {
    const planData = await getPlanByUid()
    if (!planData) return

    const next = Math.max(0, planData.currentRecord - delta)
    await updatePlanByUid({ currentRecord: next })
  } catch (error) {
    console.log("decreasePlanRecordBy ERROR", error)
  }
}

export const createFreePlan = async () => {
  if (DEMO_MODE) return 1; // Skip in demo mode

  const uid = auth?.currentUser?.uid

  if (!uid) {
    return null
  }

  try {
    const date = new Date()
    date.setMonth(date.getMonth() + 1)
    const expiredTime = Timestamp.fromDate(date)

    await setDoc(doc(db, `/plans`, uid), {
      uid,
      maxRecord: 20,
      currentRecord: 0,
      maxStorageSize: MAX_STORAGE_SIZE,
      currentStorageSize: 0,
      expiredTime: expiredTime,
    })
    return 1
  } catch (error) {
    console.log(error)
    return null
  }
}

export const getCurrentStorageSize = async () => {
  const planData = await getPlanByUid()
  return planData?.currentStorageSize || 0
}

export const updatePlanByUid = async (planData: Partial<IPlan>) => {
  if (DEMO_MODE) return 1; // Skip in demo mode

  const uid = auth?.currentUser?.uid

  if (!uid) {
    return null
  }

  try {

    const data: {
      [key: string]: any
    } = {}

    if (planData.currentRecord !== undefined) {
      data.currentRecord = planData.currentRecord
    }

    if (planData.currentStorageSize) {
      data.currentStorageSize = planData.currentStorageSize
    }

    if (data.currentStorageSize && data.currentRecord) return

    await updateDoc(doc(db, "/plans", uid), data)

    // await updateDoc(doc(db, "/plans", uid), {
    //   currentRecord: currentRecord >= 0 ? currentRecord : 0,
    //   currentStorageSize: planData.currentStorageSize || 0,
    // })

    return 1
  } catch (error) {
    console.log(error)
    return 0
  }
}

export const hasReachedSizeLimit = async (): Promise<boolean | string> => {
  try {
    const planData = await getPlanByUid()

    if (!planData) {
      return true
    }

    const currentSize = planData.currentStorageSize
    const maxSize = planData.maxStorageSize || MAX_STORAGE_SIZE

    if (currentSize > maxSize) {
      return true
    }

    return false
  } catch (error) {
    return true
  }
}

export const isPlanExceed = async (): Promise<IPlan | string> => {
  try {
    const planData = await getPlanByUid()

    if (!planData) {
      return Promise.reject("PLAN_DOES_NOT_EXIST")
    }

    const currentSize = planData.currentStorageSize
    const maxSize = planData.maxStorageSize || MAX_STORAGE_SIZE

    if (currentSize > maxSize) {
      return Promise.reject("EXCEED_STORAGE_PLAN")
    }

    if (planData.currentRecord >= planData.maxRecord) {
      return Promise.reject("EXCEED_PLAN")
    }

    return planData
  } catch (error) {
    return Promise.reject("CHECKING_PLAN_ERROR")
  }
}

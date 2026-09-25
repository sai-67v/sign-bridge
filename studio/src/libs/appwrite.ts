import { Client, Account, Databases, Storage } from "appwrite"
import {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  isAppwriteConfigured,
} from "../config/appwriteEnv"

const client = new Client()

if (isAppwriteConfigured()) {
  client.setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT_ID)
} else if (import.meta.env?.DEV) {
  console.warn(
    "[Canis Studio] Appwrite not configured. Set VITE_APPWRITE_ENDPOINT, VITE_APPWRITE_PROJECT_ID, and VITE_APPWRITE_DATABASE_ID in .env",
  )
}

const account = new Account(client)
const databases = new Databases(client)
const storage = new Storage(client)

export { client, account, databases, storage, isAppwriteConfigured }

import { algoliasearch } from "algoliasearch"
import { IUserSearch } from "../containers/PadActions/PadShareModal/types"

const appId = process.env.REACT_APP_ALGOLIA_APP_ID || ''
const apiKey = process.env.REACT_APP_ALGOLIA_API_KEY || '' // only use this app on Desktop, if you public it on the browser, this api key is not secure

// Only initialize Algolia client if credentials are provided
const client = appId && apiKey ? algoliasearch(appId, apiKey) : null

type TSearchIndexName = "main" | "email"

// Note: setSettings might fail if Algolia is not configured, which is fine
// This is just configuration for faceted search by user ID

export interface IPadFromSearch {
  title: string
  id: string
}

export interface IUserFromSearch {
  uid: string
  email: string
  fullname: string
  photoURL: string
}

export const searchByUser = (
  term: string,
  uid: string
): Promise<IPadFromSearch[]> => {
  return new Promise((resolve) => {
    if (!client) {
      console.warn("Algolia not configured, search disabled")
      resolve([])
      return
    }
    
    client!
      .search({
        requests: [{
          indexName: "kompad-notes",
          query: term,
          filters: `uid:${uid}`,
        }]
      })
      .then((response: any) => {
        const results: IPadFromSearch[] = []
        const hits = response.results?.[0]?.hits || []
        hits.forEach((hit: any) => {
          const dt = hit as unknown as { title: string; padId: string }
          results.push({
            title: dt.title,
            id: dt.padId,
          })
        })

        resolve(results)
      })
      .catch((err: any) => {
        console.error("error from fulltext search", err)
        resolve([])
      })
  })
}

export const searchEmail = (term: string): Promise<IUserSearch[]> => {
  return new Promise((resolve) => {
    if (!client) {
      console.warn("Algolia not configured, email search disabled")
      resolve([])
      return
    }
    
    client!.search({
      requests: [{
        indexName: "kompad-emails",
        query: term,
      }]
    }).then((response: any) => {
      const results: IUserFromSearch[] = []
      const hits = response.results?.[0]?.hits || []

      hits.forEach((hit: any) => {
        const dt = hit as unknown as IUserFromSearch
        results.push({
          uid: dt.uid,
          email: dt.email,
          fullname: dt.fullname,
          photoURL: dt.photoURL,
        })
      })

      resolve(results)
    }).catch(() => {
      resolve([])
    })
  })
}

export const getIndexName = (name?: string) => {
  switch (name) {
    case "email":
      return "kompad-emails"
    default:
      return "kompad-notes"
  }
}

export const seAddNewEmailObject = (data: any) => {
  return seAddNewObject(data, "email")
}

export const seAddNewObject = (data: any, indexName?: TSearchIndexName) => {
  if (!client) {
    console.warn("Algolia not configured, skipping index operation")
    return Promise.resolve()
  }
  
  const index = getIndexName(indexName)
  //https://www.algolia.com/doc/api-reference/api-methods/save-objects/
  return client!.saveObject({
    indexName: index,
    body: data,
  })
}

export const seUpdateObject = (data: any, indexName?: TSearchIndexName) => {
  if (!client) {
    console.warn("Algolia not configured, skipping index operation")
    return Promise.resolve()
  }
  
  const index = getIndexName(indexName)
  // https://www.algolia.com/doc/api-reference/api-methods/partial-update-objects/
  return client!.partialUpdateObject({
    indexName: index,
    objectID: data.objectID || data.id,
    attributesToUpdate: data,
  })
}

export const seDeleteObject = (id: string, indexName?: TSearchIndexName) => {
  if (!client) {
    console.warn("Algolia not configured, skipping index operation")
    return Promise.resolve()
  }
  
  const index = getIndexName(indexName)
  return client!.deleteObject({
    indexName: index,
    objectID: id,
  })
}

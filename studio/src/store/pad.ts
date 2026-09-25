import { create } from "zustand"
import produce from "immer"
import { IPad } from "../services/pads"
// import { QueryDocumentSnapshot } from "firebase/firestore" // No longer used directly here, but interface uses it?
// services/pads now uses it internally but exports it via IPadQuery maybe?
// Let's check IPadQuery definition. It uses QueryDocumentSnapshot.
// We should import it from services/pads if we moved it, or keep it mocked/stubbed if we removed firebase from package.json.
// Since we are referencing it in interface, we need it. 
// BUT we uninstalled firebase. So this import will Fail.
// We must replace QueryDocumentSnapshot with 'any' or a Mock type.

export interface IPadQuery {
  recently?: boolean
  startAfter?: any // QueryDocumentSnapshot<unknown>
  important?: boolean
  shared?: boolean
}

export interface IPadStore {
  pads: IPad[]
  query: IPadQuery
  clearFilter: () => void
  filterByAll: (query: IPadQuery) => void
  filterByRecently: () => void
  updatePadList: (data: IPad[]) => void
  filterByImportant: () => void
  appendPads: (data: IPad[]) => void
  filterByShared: () => void
}

// configure store
export const usePadListStore = create<IPadStore>((set) => ({
  pads: [],
  query: {
    recently: true,
    important: false,
    shared: false,
  },

  clearFilter: () =>
    set(
      produce<IPadStore>((state) => {
        state.query = {
          recently: false,
          important: false,
        }
      })
    ),

  filterByRecently: () => {
    set(
      produce<IPadStore>((state) => {
        state.query.important = false
        state.query.shared = false
        state.query.recently = !state.query.recently
      })
    )
  },

  filterByAll: (query: IPadQuery) =>
    set(
      produce<IPadStore>((state) => {
        state.query = query
      })
    ),

  updatePadList: (data: IPad[]) =>
    set(
      produce<IPadStore>((state) => {
        state.pads = data
      })
    ),

  appendPads: (data: IPad[]) =>
    set(
      produce<IPadStore>((state) => {
        state.pads = [...state.pads, ...data]
      })
    ),

  filterByImportant: () => {
    set(
      produce<IPadStore>((state) => {
        state.query.recently = false
        state.query.shared = false
        state.query.important = !state.query.important
      })
    )
  },

  filterByShared: () => {
    set(
      produce<IPadStore>((state) => {
        state.query.recently = false
        state.query.important = false
        state.query.shared = !state.query.shared
      })
    )
  },
}));

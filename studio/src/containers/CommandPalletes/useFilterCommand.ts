import { usePadListStore } from "../../store/pad"
import {
  CommandFunc,
  ICommand,
  ICommandOptions,
  ICommandSuggestItem,
} from "../../types"
import { isOptionNMatchedPreset } from "./util"

const commandOptions: ICommandOptions = {
  clear: { options: ["--clear"], desc: "remove all filter conditions" },
  all: { options: ["--all"], desc: "show all documents" },
  recent: { options: ["--recent"], desc: "show recently documents" },
  important: { options: ["--important", "-i"], desc: "toggle a document to important and vice versa" },
}

export const useFilterCommand: CommandFunc = () => {
  const {
    filterByRecently,
    filterByImportant,
    clearFilter,
  } = usePadListStore()

  const extractOptions = (commands: ICommand[]) => {
    const options = {
      clear: false,
      all: false,
      recent: false,
      important: false,
    }

    const len = commands.length

    let i = 0
    while (i < len) {
      const item = commands[i]

      if (isOptionNMatchedPreset(item, commandOptions.clear.options)) {
        options.clear = true
      }

      if (isOptionNMatchedPreset(item, commandOptions.all.options)) {
        options.all = true
      }

      if (isOptionNMatchedPreset(item, commandOptions.recent.options)) {
        options.recent = true
      }

      if (isOptionNMatchedPreset(item, commandOptions.important.options)) {
        options.important = true
      }

      ++i
    }

    return options
  }

  const execute = async (commands: ICommand[]) => {
    const options = extractOptions(commands)

    if (options.clear) {
      clearFilter()
      return
    }

    if (options.all) {
      clearFilter()
    }

    if (options.important) {
      filterByImportant()
    }

    if (options.recent) {
      filterByRecently()
    }
  }

  const hasSuggestValue = (_command: ICommand) => {
    return ""
  }

  const suggestOptionValue = (_option: string, _value: string) => {
    const suggestedOptionValue: ICommandSuggestItem[] = []
    return suggestedOptionValue
  }

  return { execute, commandOptions, hasSuggestValue, suggestOptionValue }
}

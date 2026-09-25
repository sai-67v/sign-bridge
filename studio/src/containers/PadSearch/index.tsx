import { useEffect, useState } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useAuth } from "../../hooks/useAuth"
import { useNavigate } from "react-router-dom"
import { usePadStore } from "../../store"
import useMobileNavigator from "../../components/MobileNavigator/useMobileNavigator"
import { IPadFromSearch, searchByUser } from "../../libs/search"

let timeout = 0

export default function PadSearch() {
  const { user } = useAuth()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [pads, setPads] = useState<IPadFromSearch[]>([])

  const navigate = useNavigate()
  const { setSecondSidebarVisible } = useMobileNavigator()
  const searchModalStatus = usePadStore((state) => state.searchModalStatus)
  const setSearchModalStatus = usePadStore(
    (state) => state.setSearchModalStatus
  )

  useEffect(() => {
    if (user && user.uid) {
      timeout && clearTimeout(timeout)
      timeout = setTimeout(() => {
        searchByUser(query, user.uid).then((result) => {
          setPads(result)
        })
      }, 250) as unknown as number
    }
  }, [query, user])

  useEffect(() => {
    setOpen(searchModalStatus)
  }, [searchModalStatus])

  useEffect(() => {
    setSearchModalStatus(open)
    // eslint-disable-next-line
  }, [open])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) setQuery("")
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        id="pad-search"
        className="modal div-y mx-auto max-w-xl overflow-hidden p-0 gap-0 sm:rounded-lg"
      >
        <Command
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
          shouldFilter={false}
        >
          <CommandInput
            placeholder="Search..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-72">
            {pads.length > 0 ? (
              <CommandGroup className="bg py-2 text-sm">
                {pads.map((pad) => (
                  <CommandItem
                    key={pad.id}
                    value={`${pad.title} ${pad.id}`}
                    onSelect={() => {
                      setOpen(false)
                      navigate(`/app/pad/${pad.id}`)
                      setSecondSidebarVisible()
                    }}
                    className="cursor-pointer px-4 py-2 data-[selected=true]:bg-[color:var(--common-light-bg-color)] data-[selected=true]:text-[color:var(--common-text-color)]"
                  >
                    {pad.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {query !== "" && pads.length === 0 ? (
              <CommandEmpty className="p-4 text-sm text-muted-foreground">
                No pad found.
              </CommandEmpty>
            ) : null}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

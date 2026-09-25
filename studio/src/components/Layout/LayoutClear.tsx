import { Outlet } from "react-router-dom";
import Titlebar from "../Titlebar";
export default function LayoutClear() {
  return (
    <main className="layout-clear flex-1 flex flex-col h-full overflow-auto">
      <Titlebar />
      <Outlet />
    </main>
  );
}

import ScrollBar from "../../components/ScrollBar";
import Category from "../Category";
import ShortcutModal from "../Settings/ShortcutModal";
import UserSection from "./UserSection";
import FolderTree from "./FolderTree";
import TagChips from "./TagChips";

function RootSidebar() {
  return (
    <div className="root-sidebar">
      <div className="flex justify-between items-center px-4 h-[44px]">
        <h2 className="brand-name">canis.studio</h2>
      </div>

      <ScrollBar height="calc(100vh - 61px - 44px)">
        <Category />
        <FolderTree />
        <TagChips />
      </ScrollBar>

      <UserSection />
      <ShortcutModal />
    </div>
  );
}

export default RootSidebar;

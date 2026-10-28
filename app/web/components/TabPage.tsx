import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";

// A main tab (People, Gallery): header on top, nav pinned to the bottom.
export function TabPage({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className={`mx-auto flex w-full max-w-xl flex-1 flex-col px-5 ${className}`}>{children}</main>
      <div className="sticky bottom-0">
        <BottomNav />
      </div>
    </div>
  );
}

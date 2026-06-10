"use client";

import * as React from "react";
import { PanelLeftIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

type SidebarContextProps = {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextProps | null>(null);

export function useSidebar() {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isMobile = useIsMobile();
  const [_open, _setOpen] = React.useState(defaultOpen);
  const open = openProp ?? _open;

  const setOpen = React.useCallback(
    (value: boolean) => {
      if (onOpenChange) onOpenChange(value);
      else _setOpen(value);
    },
    [onOpenChange],
  );

  const toggleSidebar = React.useCallback(
    () => setOpen(!open),
    [open, setOpen],
  );

  const state = open ? "expanded" : "collapsed";

  return (
    <SidebarContext.Provider value={{ state, open, setOpen, isMobile, toggleSidebar }}>
      <div
        data-slot="sidebar-wrapper"
        style={
          {
            "--sidebar-width": "16rem",
            "--sidebar-width-icon": "3rem",
            ...style,
          } as React.CSSProperties
        }
        className={cn("flex min-h-svh w-full", className)}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Sidebar shell
// ---------------------------------------------------------------------------

export function Sidebar({
  collapsible = "icon",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  collapsible?: "icon" | "offcanvas" | "none";
  variant?: "sidebar" | "inset" | "floating";
}) {
  const { state } = useSidebar();

  return (
    <div
      data-slot="sidebar"
      data-state={state}
      data-collapsible={collapsible}
      className={cn(
        "bg-sidebar text-sidebar-foreground hidden md:flex flex-col h-svh",
        "transition-[width] duration-200 ease-linear",
        state === "expanded"
          ? "w-(--sidebar-width)"
          : collapsible === "icon"
            ? "w-(--sidebar-width-icon)"
            : "w-0 overflow-hidden",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar sub-parts
// ---------------------------------------------------------------------------

export function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-header" className={cn("flex flex-col gap-2 p-2", className)} {...props} />;
}

export function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-content" className={cn("flex min-h-0 flex-1 flex-col gap-2 overflow-auto", className)} {...props} />;
}

export function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-footer" className={cn("flex flex-col gap-2 p-2", className)} {...props} />;
}

export function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-group" className={cn("relative flex w-full min-w-0 flex-col p-2", className)} {...props} />;
}

export function SidebarGroupLabel({ className, ...props }: React.ComponentProps<"div">) {
  const { state } = useSidebar();
  return (
    <div
      data-slot="sidebar-group-label"
      className={cn(
        "text-sidebar-foreground/70 flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium transition-[margin,opacity] duration-200",
        state === "collapsed" && "opacity-0 -mt-8",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarGroupContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-group-content" className={cn("w-full text-sm", className)} {...props} />;
}

export function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul data-slot="sidebar-menu" className={cn("flex w-full min-w-0 flex-col gap-1", className)} {...props} />;
}

export function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li data-slot="sidebar-menu-item" className={cn("group/menu-item relative", className)} {...props} />;
}

export function SidebarMenuButton({
  isActive = false,
  tooltip,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & {
  isActive?: boolean;
  tooltip?: string;
}) {
  const { state } = useSidebar();

  return (
    <button
      data-slot="sidebar-menu-button"
      data-active={isActive}
      title={state === "collapsed" ? tooltip : undefined}
      className={cn(
        "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors",
        "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:font-medium",
        "[&>svg]:size-4 [&>svg]:shrink-0 [&>span]:truncate",
        state === "collapsed" && "justify-center [&>span]:hidden",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function SidebarSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-separator" className={cn("bg-sidebar-border mx-2 my-1 h-px", className)} {...props} />;
}

export function SidebarTrigger({ className, onClick, ...props }: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar();
  return (
    <Button
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon"
      className={cn("size-7", className)}
      onClick={(e) => { onClick?.(e); toggleSidebar(); }}
      {...props}
    >
      <PanelLeftIcon />
      <span className="sr-only">Toggle sidebar</span>
    </Button>
  );
}

// ---------------------------------------------------------------------------
// SidebarInset — main content area next to sidebar
// ---------------------------------------------------------------------------

export function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn("bg-background relative flex w-full flex-1 flex-col min-w-0 overflow-hidden", className)}
      {...props}
    />
  );
}

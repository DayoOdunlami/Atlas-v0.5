import { CopilotChat } from "@copilotkit/react-ui";
import { SidebarInput } from "@/components/chat/layout/input";
import { AssistantBubble } from "@/components/chat/layout/assistant-message";
import { UserBubble } from "@/components/chat/layout/user-message";
import { Suggestions } from "@/components/chat/layout/suggestion";
import { cn } from "@/lib/utils";
import { Header } from "@/components/chat/layout/header";
interface ChatProps {
  className: string;
}

export function Chat({ className }: ChatProps) {
  return (
    <div className={cn(className, "p-4 max-w-[500px]")}>
      <div className="h-full min-h-0 rounded-2xl border bg-card shadow-xl overflow-hidden flex flex-col">
        <Header />
        <CopilotChat
          className="flex-1 min-h-0"
          labels={{
            initial:
              "👋 Hi, I'm ATLAS.\n\nI help CPC strategists build evidence-backed investment briefs grounded in the CPC corpus — real projects, live funding calls, policy evidence, and HIVE case studies.\n\nTry one of the prompts below, or ask me anything.",
          }}
          suggestions={[
            {
              title: "Autonomous freight corridors",
              message:
                "What is the strategic case for CPC to commission a programme on autonomous freight corridors in the UK?",
            },
            {
              title: "EV charging infrastructure",
              message:
                "Build an investment brief for a CPC-led EV charging infrastructure programme targeting underserved regions.",
            },
            {
              title: "Active travel",
              message:
                "What evidence does the CPC corpus have on active travel and urban mobility innovation?",
            },
          ]}
          Input={SidebarInput}
          AssistantMessage={AssistantBubble}
          UserMessage={UserBubble}
          RenderSuggestionsList={Suggestions}
        />
      </div>
    </div>
  );
}

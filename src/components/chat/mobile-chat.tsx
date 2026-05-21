"use client";

import { CopilotSidebar } from "@copilotkit/react-ui";
import { SidebarInput } from "@/components/chat/layout/input";
import { AssistantBubble } from "@/components/chat/layout/assistant-message";
import { UserBubble } from "@/components/chat/layout/user-message";
import { Suggestions } from "@/components/chat/layout/suggestion";

export function MobileChat() {
  return (
    <CopilotSidebar
      labels={{
        title: "🧭 ATLAS — CPC Decision Intelligence",
        initial: "👋 Hi, I'm ATLAS. Ask me to build an investment brief, evaluate an opportunity, or search the CPC corpus.",
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
  );
}

// app/chat/[threadId]/page.tsx
import { Assistant } from "../assistant";
import { AssistantLayout, ActivityToolUI, InterruptToolUI } from "@/components/assistant-ui/thread";
import { OAuthHandler } from "@/components/oauth-handler";

export default async function ChatThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const resolvedParams = await params;
  
  return (
    <main className="h-dvh w-full">
      <Assistant threadId={resolvedParams.threadId}>
        <OAuthHandler />
        <ActivityToolUI />
        <InterruptToolUI />
        <AssistantLayout />
      </Assistant>
    </main>
  );
}

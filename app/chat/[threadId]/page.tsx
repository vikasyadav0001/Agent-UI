// app/chat/[threadId]/page.tsx
import { Assistant } from "@/app/assistant";
import { OAuthHandler } from "@/components/oauth-handler";

export default async function ChatThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const resolvedParams = await params;

  return (
    <main className="h-dvh w-full">
      <Assistant />
      <OAuthHandler />
    </main>
  );
}

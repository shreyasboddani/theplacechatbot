import { ChatWidget } from "@/components/chatbot/ChatWidget";
import { parseEmbedPresentation } from "@/lib/widget/presentation";

interface EmbedPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function EmbedPage({ searchParams }: EmbedPageProps) {
  const presentation = parseEmbedPresentation(await searchParams);
  return (
    <main className="embed-page">
      <ChatWidget
        variant="embedded"
        initialOpen={!presentation.launcherVisible}
        launcherVisible={presentation.launcherVisible}
        position={presentation.position}
        theme={presentation.theme}
      />
    </main>
  );
}


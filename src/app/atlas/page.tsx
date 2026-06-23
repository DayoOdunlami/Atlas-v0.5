import { AtlasEntryScreen } from "@/components/atlas/entry/atlas-entry-screen";
import { entryFranklin, entryNewsreader } from "@/components/atlas/entry/entry-fonts";

export const metadata = {
  title: "Atlas · What do you understand?",
  description: "Atlas v5 entry — canvas at rest",
};

export default function AtlasLandingPage() {
  return (
    <div className={`${entryNewsreader.variable} ${entryFranklin.variable}`}>
      <AtlasEntryScreen />
    </div>
  );
}

/** Canonical J1T1 orient query — matches agents/atlas_v5/j1t1_corpus.py */
export const J1T1_QUERY =
  "State of play on rail decarbonisation in our corpus";

export type AtlasEntryPrompt = {
  id: string;
  label: string;
  query: string;
  hint: string;
  mode: "Orient" | "Connect" | "Diagnose" | "Act";
};

export const ATLAS_ENTRY_PROMPTS: AtlasEntryPrompt[] = [
  {
    id: "showcase",
    label: "Show me what you can do",
    query: "Show me what you can do",
    hint: "Showcase · rail · aviation · flex",
    mode: "Orient",
  },
  {
    id: "j1t1",
    label: "State of play",
    query: J1T1_QUERY,
    hint: "Orient · IncommensurableMagnitudes · live corpus",
    mode: "Orient",
  },
  {
    id: "network",
    label: "Map the network",
    query: "Map the hydrogen rail supply chain as a network",
    hint: "Connect · NetworkMap · mode bridges",
    mode: "Connect",
  },
  {
    id: "ecosystem",
    label: "Ecosystem bridges",
    query: "Show the cross-modal ecosystem and who collaborates on rail decarb",
    hint: "Connect · force-graph or typed inventory",
    mode: "Connect",
  },
  {
    id: "gaps",
    label: "Evidence gaps",
    query: "What evidence gaps exist in rail decarbonisation funding data?",
    hint: "Diagnose · blindspot + TRIG ingestion gate",
    mode: "Diagnose",
  },
  {
    id: "opportunity",
    label: "Biggest opportunity",
    query: "Where is the biggest CPC opportunity in rail decarbonisation?",
    hint: "Act · OpportunityList when routed substantive",
    mode: "Act",
  },
];

export const ATLAS_SHOWCASE_SCENES = ATLAS_ENTRY_PROMPTS;

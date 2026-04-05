export type WritingPrompt = {
  id: string;
  topic: string;
  text: string;
};

export type WritingPromptsResponse = {
  featuredPrompt: WritingPrompt;
  prompts: WritingPrompt[];
  source: "default" | "personalized";
  generatedAt: string | null;
};

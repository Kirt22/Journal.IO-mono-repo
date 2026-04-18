import { request } from "../utils/apiClient";

type WritingPrompt = {
  id: string;
  topic: string;
  text: string;
};

type WritingPromptsResponse = {
  featuredPrompt: WritingPrompt;
  prompts: WritingPrompt[];
  source: "default" | "personalized";
  generatedAt: string | null;
};

const getWritingPrompts = async () => {
  const response = await request<WritingPromptsResponse>("/prompts/writing", {
    method: "GET",
  });

  return response.data;
};

export { getWritingPrompts };
export type { WritingPrompt, WritingPromptsResponse };

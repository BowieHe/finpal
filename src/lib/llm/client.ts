import { ChatOpenAI } from '@langchain/openai';

const apiKey = process.env.OPENAI_API_KEY;
const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

if (!apiKey) {
  throw new Error('OPENAI_API_KEY is not set in environment variables');
}

export const llm = new ChatOpenAI({
  openAIApiKey: apiKey,
  configuration: {
    baseURL,
  },
  temperature: 0.7,
  model,
});

// file: src/services/llmService.ts
// Сервис выполнения запросов к бесплатным и локальным LLM

import dotenv from 'dotenv'; // dotenv
import { GoogleGenAI } from '@google/genai'; // GoogleGenAI

dotenv.config();

export type LlmProvider = 'groq' | 'gemini' | 'local';

export interface LlmConfigResponse {
  groqConfigured: boolean;
  geminiConfigured: boolean;
  localUrl: string;
  defaultProvider: LlmProvider;
}

export function getLlmConfig(): LlmConfigResponse {
  const hasGroq = Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim());
  const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());
  const localUrl = process.env.LOCAL_LLM_URL || 'http://localhost:11434/v1';
  let defaultProvider: LlmProvider = 'local';
  if (hasGroq) {
    defaultProvider = 'groq';
  } else if (hasGemini) {
    defaultProvider = 'gemini';
  }
  return {
    groqConfigured: hasGroq,
    geminiConfigured: hasGemini,
    localUrl,
    defaultProvider,
  };
}

async function callGroq(prompt: string, model?: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY не задан в переменных окружения.');
  }
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: model || 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API Error (${response.status}): ${errorText}`);
  }
  const data = (await response.json()) as any;
  return data.choices?.[0]?.message?.content || '';
}

async function callGemini(prompt: string, model?: string): Promise<string> {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY не задан в переменных окружения.');
  }
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: model || 'gemini-3.8-flash',
    contents: prompt,
    config: { temperature: 0.1 },
  });
  return response.text || '';
}

async function callLocal(prompt: string, customUrl?: string, model?: string): Promise<string> {
  const baseUrl = customUrl || process.env.LOCAL_LLM_URL || 'http://localhost:11434/v1';
  const cleanUrl = baseUrl.replace(/\/+$/, '');
  const targetUrl = cleanUrl.endsWith('/chat/completions')
    ? cleanUrl
    : `${cleanUrl}/chat/completions`;
  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || 'llama3.2',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Local LLM Error (${response.status}): ${errorText}`);
  }
  const data = (await response.json()) as any;
  return data.choices?.[0]?.message?.content || '';
}

export async function queryLlm(
  prompt: string,
  provider: LlmProvider,
  customUrl?: string,
  model?: string
): Promise<string> {
  if (provider === 'groq') {
    return await callGroq(prompt, model);
  }
  if (provider === 'gemini') {
    return await callGemini(prompt, model);
  }
  return await callLocal(prompt, customUrl, model);
}

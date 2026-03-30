import { z } from 'zod';

// Settings Schema
export const SettingsSchema = z.object({
  id: z.number().default(1),
  api_url: z.string().nullable(),
  model_name: z.string().nullable(),
  light_model_name: z.string().nullable().optional(),
  api_key: z.string().nullable(),
  dashscope_api_key: z.string().nullable(),
  updated_at: z.date().or(z.string()).transform(val => new Date(val)),
});

export type Settings = z.infer<typeof SettingsSchema>;

// FundBasic Schema
export const FundBasicSchema = z.object({
  code: z.string().max(10),
  name: z.string().max(100),
  category: z.string().nullable(),
  manager: z.string().nullable(),
  company: z.string().nullable(),
  established_date: z.date().nullable().or(z.string()).transform(val => val ? new Date(val) : null),
  updated_at: z.date().nullable().or(z.string()).transform(val => val ? new Date(val) : null),
});

export type FundBasic = z.infer<typeof FundBasicSchema>;

// FundNav Schema
export const FundNavSchema = z.object({
  id: z.number(),
  fund_code: z.string().max(10),
  nav_date: z.date().or(z.string()).transform(val => new Date(val)),
  unit_nav: z.number().or(z.string()).transform(Number),
  accum_nav: z.number().or(z.string()).transform(Number),
  daily_return: z.number().nullable().or(z.string()).transform(val => val ? Number(val) : null),
  created_at: z.date().nullable().or(z.string()).transform(val => val ? new Date(val) : null),
});

export type FundNav = z.infer<typeof FundNavSchema>;

// UserHolding Schema
export const UserHoldingSchema = z.object({
  id: z.string(),
  fund_code: z.string(),
  fund_name: z.string(),
  shares: z.number().or(z.string()).transform(Number),
  cost_price: z.number().or(z.string()).transform(Number),
  buy_date: z.date().or(z.string()).transform(val => new Date(val)),
  created_at: z.date().or(z.string()).transform(val => new Date(val)),
  updated_at: z.date().or(z.string()).transform(val => new Date(val)),
});

export type UserHolding = z.infer<typeof UserHoldingSchema>;

// HoldingTransaction Schema
export const HoldingTransactionSchema = z.object({
  id: z.string(),
  holding_id: z.string(),
  type: z.enum(['buy', 'sell']),
  date: z.date().or(z.string()).transform(val => new Date(val)),
  shares: z.number().or(z.string()).transform(Number),
  price: z.number().or(z.string()).transform(Number),
  amount: z.number().or(z.string()).transform(Number),
  created_at: z.date().or(z.string()).transform(val => new Date(val)),
});

export type HoldingTransaction = z.infer<typeof HoldingTransactionSchema>;

// KarmaLog Schema
export const KarmaLogSchema = z.object({
  id: z.string(),
  source: z.string(), // 'screenshot' | 'chat' | 'analysis'
  type: z.string(),   // 'behavior' | 'emotion' | 'interest'
  content: z.string(),
  interpretation: z.any(), // Json
  created_at: z.date().or(z.string()).transform(val => new Date(val)),
});

export type KarmaLog = z.infer<typeof KarmaLogSchema>;

// UserProfile Schema
export const UserProfileSchema = z.object({
  id: z.string(),
  version: z.number().default(1),
  persona: z.string(),
  styles: z.any(), // Json
  biases: z.array(z.string()),
  evolutionary_log: z.string(),
  summary: z.string(),
  updated_at: z.date().or(z.string()).transform(val => new Date(val)),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

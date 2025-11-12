import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://utwhoufvuqkcbczszuog.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0d2hvdWZ2dXFrY2JjenN6dW9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMDI2MDIsImV4cCI6MjA3NDc3ODYwMn0.3CL11eCCfXw5hAxt5MF-ToJmZowqZvq06LF5Cz4EhO8'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface Product {
  id: string;
  industry: string;
  brandName: string;
  chemicalName: string;
  application: string;
  targetCountries: string[];
  created_at?: string;
  updated_at?: string;
}

export interface WebhookData {
  id: string;
  industry: string;
  brandName: string;
  chemicalName: string;
  application: string;
  targetCountries: string[];
  source?: string;
  processed_at?: string;
  created_at?: string;
}

export interface Founder {
  id: string;
  'Founder Name': string | null;
  'Company Name': string | null;
  'Position': string | null;
  'Founder Email': string | null;
  'Founder Linkedin': string | null;
  'Founder Address': string | null;
  "Company's Industry": string | null;
  'Company Website': string | null;
  'Company Linkedin': string | null;
  'Company Blogpost'?: string | null;
  'Company Angellist'?: string | null;
  'Company Phone'?: string | null;
  'Verification': boolean | null;
  '1st Follow-Up Sent (5 days)': string | null;
  '2nd Follow-Up Sent (10 days)': string | null;
  'Mail Status'?: string | null;
  'Mail Replys'?: string | null;
  'Mail Priority'?: string | null;
  'Priority based on Reply'?: string | null;
  'Thread ID'?: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppVariables = {
  agent: {
    id: string;
    business_id: string;
    name: string;
    email: string;
    role: 'admin' | 'agent' | 'viewer';
  };
};

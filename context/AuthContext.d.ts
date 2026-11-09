import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

export function ChapitasAuthProvider(props: { children: ReactNode }): JSX.Element;

export function useAuth(): {
  session: Session | null;
  isAdmin: boolean;
  authLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshAdminStatus: (session?: Session | null) => Promise<void>;
};

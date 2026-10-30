import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publishableKey) {
    throw new Error("Supabase URL and publishable key must be configured.");
  }

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  await supabase.auth.getClaims();

  const protectedRoute = request.nextUrl.pathname.match(
    /^\/w\/([^/]+)(?:\/p\/([^/]+))?\/?$/,
  );
  if (request.nextUrl.pathname === "/login") {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (!error && user) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  if (protectedRoute) {
    const unavailable = () => {
      const denied = NextResponse.rewrite(
        new URL("/resource-unavailable", request.url),
      );
      for (const cookie of response.cookies.getAll()) {
        denied.cookies.set(cookie);
      }
      return denied;
    };

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return unavailable();

    const [, workspaceId, projectId] = protectedRoute;
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("workspace_id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (membershipError || !membership) return unavailable();

    if (projectId) {
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("id", projectId)
        .maybeSingle();
      if (projectError || !project) return unavailable();
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

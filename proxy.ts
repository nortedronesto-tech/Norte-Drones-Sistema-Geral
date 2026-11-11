import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Renova a sessão do Supabase e protege as áreas internas:
//   /gestao, /admin, /api/admin e /api/gestao exigem login; o site público (/) é aberto.
// (No Next 16, "middleware" passou a se chamar "proxy".)
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims;

  const isApi = pathname.startsWith("/api/admin") || pathname.startsWith("/api/gestao");
  const isLogin = pathname === "/login";

  if (!signedIn && isApi) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!signedIn && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  // Só manda embora da tela de login quem tem sessão VÁLIDA no servidor. Um cookie vencido ou revogado ainda passa
  // na checagem local (getClaims), mas o layout o trata como deslogado: sem esta conferência, /login e /gestao
  // ficam mandando um para o outro ("mais de 20 redirecionamentos").
  if (signedIn && isLogin && (await supabase.auth.getUser()).data.user) {
    const url = request.nextUrl.clone();
    url.pathname = "/gestao";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // O site público não passa pelo proxy: só login e as áreas internas.
  matcher: ["/login", "/gestao/:path*", "/admin/:path*", "/api/admin/:path*", "/api/gestao/:path*"],
};

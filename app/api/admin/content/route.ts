import { NextRequest, NextResponse } from "next/server";
import { getSiteContent, saveSiteContent, SiteContent } from "@/lib/content-store";
import { requirePartner } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requirePartner();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const content = await getSiteContent();
  return NextResponse.json(content);
}

export async function PUT(request: NextRequest) {
  const guard = await requirePartner();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let body: SiteContent;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !body.contacts) {
    return NextResponse.json({ error: "Formato inválido." }, { status: 400 });
  }

  const c = body.contacts;
  const sanitized: SiteContent = {
    contacts: {
      whatsappNumber: String(c.whatsappNumber ?? "").replace(/[^\d]/g, ""),
      whatsappMessage: String(c.whatsappMessage ?? "").slice(0, 300),
      phone: String(c.phone ?? "").slice(0, 40),
      email: String(c.email ?? "").slice(0, 120),
      instagramHandle: String(c.instagramHandle ?? "").slice(0, 60),
      instagramUrl: String(c.instagramUrl ?? "").slice(0, 200),
      address: String(c.address ?? "").slice(0, 200),
      areaServed: String(c.areaServed ?? "").slice(0, 200),
    },
  };

  try {
    await saveSiteContent(sanitized, guard.supabase);
  } catch (err) {
    return NextResponse.json(
      { error: "Não foi possível salvar. " + (err as Error).message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, content: sanitized });
}

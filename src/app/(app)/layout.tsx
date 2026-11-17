import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer, ROLE_LABEL } from "@/lib/consult";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../login/actions";
import { Logo } from "@/components/Logo";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  let badge = 0;
  if (viewer.role) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("consult_unread_count");
    badge = typeof data === "number" ? data : 0;
  }

  return (
    <>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo />
            <span>
              <b className="block text-[17px]">התייעצות מומחים</b>
              <small className="text-[12.5px] text-muted">
                {viewer.fullName}
                {viewer.role && ` · ${ROLE_LABEL[viewer.role]}`}
                {viewer.branchName && ` · ${viewer.branchName}`}
              </small>
            </span>
          </Link>
          <nav className="flex flex-wrap items-center gap-1" aria-label="תפריט ראשי">
            {viewer.role && (
              <Link href="/" className="nav-link">
                {viewer.role === "ops" ? "פניות לסינון" : viewer.role === "specialist" ? "תיבת פניות" : viewer.role === "overview" ? "כל הפניות" : "הפניות שלנו"}
                {badge > 0 && (
                  <span className="badge" aria-label={`${badge} פניות עם עדכון`}>
                    {badge}
                  </span>
                )}
              </Link>
            )}
            {viewer.role === "clinic" && (
              <Link href="/requests/new" className="nav-link">
                פנייה חדשה
              </Link>
            )}
            <form action={logout}>
              <button type="submit" className="nav-link">
                יציאה
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 pt-5 pb-14">
        {viewer.role ? (
          children
        ) : (
          <div className="card mx-auto mt-10 max-w-lg p-8 text-center">
            <h1 className="text-xl font-bold">אין לך גישה למודול ההתייעצות</h1>
            <p className="mt-2 text-muted">
              המודול פתוח למנהלי מרפאות, לסמנכ״ל התפעול ולרופאים המומחים. אם את/ה צריך/ה גישה, פנה/י למנהל המערכת.
            </p>
          </div>
        )}
      </main>
    </>
  );
}

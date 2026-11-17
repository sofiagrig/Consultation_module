import { createClient } from "@/lib/supabase/server";
import { logout } from "./login/actions";
import { displayUsername } from "@/lib/auth";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto w-full max-w-[1120px] px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">התייעצות מומחים</h1>
          <p className="mt-1 text-sm text-muted">מחוברת בתור {displayUsername(user?.email)}</p>
        </div>
        <form action={logout}>
          <button type="submit" className="btn-secondary">
            יציאה
          </button>
        </form>
      </div>
      <div className="card mt-6 p-8 text-center text-muted">
        המסכים של המודול ייבנו כאן: פניות המרפאה, סינון סמנכ״ל התפעול, תיבת הרופא ומסך ההנהלה.
      </div>
    </main>
  );
}

import { redirect } from "next/navigation";
import { getViewer } from "@/lib/consult";
import { createClient } from "@/lib/supabase/server";
import { NewRequestForm } from "./NewRequestForm";

export default async function NewRequestPage() {
  const viewer = await getViewer();
  if (viewer?.role !== "clinic") redirect("/");

  const supabase = await createClient();
  const { data } = await supabase.from("specialties").select("id, name, code").order("sort_order");

  return <NewRequestForm specialties={(data ?? []) as { id: string; name: string; code: string }[]} />;
}

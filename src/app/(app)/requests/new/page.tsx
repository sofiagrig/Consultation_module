import { redirect } from "next/navigation";
import { consultSpecialties, getViewer } from "@/lib/consult";
import { NewRequestForm } from "./NewRequestForm";

export default async function NewRequestPage() {
  const viewer = await getViewer();
  if (viewer?.role !== "clinic") redirect("/");

  return <NewRequestForm specialties={await consultSpecialties()} />;
}

import { redirect } from "next/navigation";

/** Legacy URL — primary shell is now at `/`. */
export default function LangGraphRedirectPage() {
  redirect("/");
}

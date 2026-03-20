import { redirect } from "next/navigation";

// The new-application form is now a sheet on the applications list page.
export default function NewApplicationPage() {
    redirect("/applications?new=1");
}

import { redirect } from "next/navigation";

// The edit form is now a sheet on the application detail page.
export default async function EditApplicationPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    redirect(`/applications/${id}?edit=1`);
}

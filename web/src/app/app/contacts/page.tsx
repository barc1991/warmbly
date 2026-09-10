import ContactsTable from "@/components/app/contacts/ContactsTable";
import AdvisorSummaryBar from "@/components/app/advisor/AdvisorSummaryBar";
import { NoAccess } from "@/components/layout/NoAccess";
import { usePermission } from "@/hooks/usePermission";

export default function ContactsPage() {
    const canView = usePermission("VIEW_CONTACTS");
    if (!canView) return <NoAccess feature="contacts" permissionLabel="צפייה באנשי קשר" />;
    return (
        <>
            {/* List-hygiene findings live where the list does. */}
            <AdvisorSummaryBar surface="contacts" noun="list" nounPlural="lists" className="mx-5 mt-3" />
            <ContactsTable />
        </>
    );
}

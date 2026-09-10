// Settings → Data. Move this workspace to or from another Warmbly instance.
//
// Backed by:
//   GET    /organization/current/transfer/groups
//   POST   /organization/current/export
//   GET    /organization/current/export
//   GET    /organization/current/export/:id/download
//   DELETE /organization/current/export/:id
//   POST   /organization/current/import/preflight
//   POST   /organization/current/import
//   GET    /organization/current/import
//
// Owner-only, matching the danger zone: an export with credentials is the most
// sensitive file this product produces, and an import rewrites the workspace.

import React from "react";
import toast from "react-hot-toast";
import { DownloadIcon, UploadIcon } from "lucide-react";
import useFeatureAccess from "@/hooks/useFeatureAccess";
import { useOrgExports, useOrgImports, useOrgTransferGroups } from "@/lib/api/hooks/app/orgtransfer/useOrgTransfer";
import { Section, SectionShell } from "../_components/SectionShell";
import ExportPanel from "./ExportPanel";
import ImportPanel from "./ImportPanel";
import TransferHistory from "./TransferHistory";

export default function DataSettingsPage() {
    const access = useFeatureAccess();
    const groups = useOrgTransferGroups();
    const exports = useOrgExports();
    const imports = useOrgImports();

    if (!access.isOwner) {
        return (
            <SectionShell
                title="נתונים"
                description="העבר את סביבת העבודה הזו אל או משרת Warmbly אחר."
            >
                <Section eyebrow="גישה מוגבלת">
                    <p className="text-[12.5px] text-slate-500 leading-relaxed">
                        רק בעל סביבת העבודה רשאי לייצא או לייבא נתוני סביבת עבודה. קובץ
                        ייצוא מכיל כל איש קשר, הודעה ופרטי התחברות לתיבות דואר
                        בסביבת העבודה, ולכן חל עליו אותו רף אבטחה מחמיר כמו מחיקתה.
                    </p>
                </Section>
            </SectionShell>
        );
    }

    return (
        <SectionShell
            title="נתונים"
            description="העבר את סביבת העבודה הזו אל או משרת Warmbly אחר."
        >
            <Section
                eyebrow="ייצוא"
                description="כתוב את כל סביבת העבודה לקובץ ארכיון יחיד שתוכל לייבא במופע (Instance) אחר."
                actions={
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
                        <DownloadIcon className="w-3 h-3" />
                        {groups.data ? `נשמר למשך ${groups.data.retention_days} ימים` : ""}
                    </span>
                }
            >
                <ExportPanel
                    groups={groups.data?.groups ?? []}
                    minPassphrase={groups.data?.min_passphrase ?? 12}
                    loading={groups.isLoading}
                    onStarted={() => toast.success("הייצוא החל. הוא ימשיך לרוץ גם אם תעזוב עמוד זה.")}
                />
            </Section>

            <Section
                eyebrow="ארכיונים"
                description="קבצי ייצוא מסביבת עבודה זו. כל אחד מהם הוא עותק מלא, ולכן יש להם תוקף מוגבל."
            >
                <TransferHistory
                    exports={exports.data ?? []}
                    imports={imports.data ?? []}
                    loading={exports.isLoading || imports.isLoading}
                />
            </Section>

            <Section
                eyebrow="ייבוא"
                description="החל קובץ ארכיון שיוצא ממופע אחר על סביבת עבודה זו."
                actions={
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
                        <UploadIcon className="w-3 h-3" />
                        שום דבר לא ייכתב עד שתאשר
                    </span>
                }
            >
                <ImportPanel
                    groups={groups.data?.groups ?? []}
                    onStarted={() => toast.success("הייבוא החל. הוא ימשיך לרוץ גם אם תעזוב עמוד זה.")}
                />
            </Section>
        </SectionShell>
    );
}

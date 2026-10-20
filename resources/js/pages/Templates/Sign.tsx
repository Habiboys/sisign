import SigningWorkspace, {
    type WorkspaceSignature,
} from '@/components/signing/SigningWorkspace';
import AppLayout from '@/layouts/app-layout';
import { Head, router } from '@inertiajs/react';

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
}

interface Review {
    id: string;
    status: 'pending' | 'approved' | 'rejected';
    komentar?: string;
    disetujuiBy?: {
        id: string;
        name: string;
    };
    created_at: string;
}

interface Signer {
    id: string;
    user: User;
    is_signed: boolean;
    sign_order: number | null;
}

interface Signature {
    id: string;
    type: 'physical' | 'digital';
    user: User;
    signedAt: string;
    page_number?: number;
}

interface Template {
    id: string;
    title: string;
    description?: string;
    files: string;
    signed_template_path?: string;
    review: Review;
    created_at: string;
    updatedAt: string;
    signers: Signer[];
    signatures: Signature[];
}

interface Props {
    template: Template;
    user: User;
    canSign: boolean;
    hasEncryptionKeys: boolean;
}

export default function TemplateSign({
    template,
    user,
    canSign,
    hasEncryptionKeys,
}: Props) {
    // Backend flashes a success/error message on redirect, which is shown
    // automatically by the app layout. Don't show a second toast here.
    const isTemplateSigned = !!template.signed_template_path;

    const handleSave = (
        signatureData: string,
        passphrase?: string,
        signedPdfBase64?: string,
    ) => {
        router.post(
            `/templates/${template.id}/sign`,
            {
                signatureData: signatureData,
                passphrase: passphrase || null,
                signedPdfBase64: signedPdfBase64 || null,
                position: {
                    x: 0,
                    y: 0,
                    width: 150,
                    height: 75,
                    page: 1,
                },
            },
            {
                onError: (errors) => {
                    console.error('Signature errors:', errors);
                },
            },
        );
    };

    const handleDeleteSignature = () => {
        router.delete(`/templates/${template.id}/remove-signature`);
    };

    const signedCount = template.signers.filter((s) => s.is_signed).length;

    const signatures: WorkspaceSignature[] = (template.signatures || []).map(
        (s) => ({
            id: s.id,
            type: s.type,
            user: s.user,
            page: s.page_number || 1,
            signedAt: s.signedAt,
        }),
    );

    return (
        <AppLayout>
            <Head title={`Tanda Tangan Template - ${template.title}`} />

            <SigningWorkspace
                mode="template"
                entityId={template.id}
                title="Tanda Tangan Template"
                subtitle={`Tandatangani template sertifikat: ${template.title}`}
                statusLabel={
                    signedCount === template.signers.length &&
                    template.signers.length > 0
                        ? 'Sudah Lengkap Ditandatangani'
                        : isTemplateSigned
                          ? 'Partially Signed'
                          : 'Belum Ditandatangani'
                }
                statusBadge={isTemplateSigned ? 'signed' : 'unsigned'}
                pdfUrl={`/templates/${template.id}/preview`}
                canEdit={canSign}
                canSign={canSign}
                currentUserId={user.id}
                hasEncryptionKeys={hasEncryptionKeys}
                signers={template.signers}
                signatures={signatures}
                onSave={handleSave}
                onDeleteSignature={handleDeleteSignature}
                deleteConfirmText="Tanda tangan fisik dan digital Anda akan dihapus sekaligus dari template ini. Template perlu ditandatangani ulang sebelum bisa digunakan untuk membuat sertifikat."
                infoFields={[
                    { label: 'Title', value: template.title },
                    {
                        label: 'Status',
                        value: isTemplateSigned
                            ? 'Partially Signed'
                            : 'Belum Ditandatangani',
                    },
                    ...(template.description
                        ? [
                              {
                                  label: 'Description',
                                  value: template.description,
                              },
                          ]
                        : []),
                ]}
            />
        </AppLayout>
    );
}
import SigningWorkspace, {
    type WorkspaceSigner,
    type WorkspaceSignature,
} from '@/components/signing/SigningWorkspace';
import { useToast } from '@/hooks/use-toast';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, router } from '@inertiajs/react';

interface User {
    id: string;
    name: string;
    email: string;
}

interface Document {
    id: string;
    title: string;
    files: string;
    userId: string;
    to: string;
    user: User;
    signers: WorkspaceSigner[];
    signed_file?: string;
}

interface SignaturePosition extends WorkspaceSignature {
    user: User;
}

interface SignDocumentProps {
    document: Document;
    existingSignatures: SignaturePosition[];
    canSign: boolean;
    hasEncryptionKeys: boolean;
    user: User;
}

export default function SignDocument({
    document,
    existingSignatures,
    canSign,
    hasEncryptionKeys,
    user,
}: SignDocumentProps) {
    // Success messages are flashed by the backend and shown automatically by
    // the app layout. Errors from these two endpoints come back as a
    // validation error bag (not flash), so they're shown manually here.
    const { error } = useToast();

    const handleSave = (
        signatureData: string,
        passphrase?: string,
        signedPdfBase64?: string,
    ) => {
        router.post(
            `/documents/${document.id}/sign/combined`,
            {
                signatureData,
                position: {
                    x: 0,
                    y: 0,
                    height: 75,
                    page: 1,
                },
                pin: passphrase || null,
                signedPdfBase64: signedPdfBase64 || null,
            },
            {
                onError: (errors) => {
                    console.error('Signature errors:', errors);
                    const errorMessage =
                        errors.error ||
                        Object.values(errors)[0] ||
                        'Terjadi kesalahan yang tidak diketahui';
                    error('Gagal menambahkan tanda tangan: ' + errorMessage);
                },
            },
        );
    };

    const handleDeleteSignature = () => {
        router.delete(`/documents/${document.id}/signature`, {
            onError: (errors) => {
                error(
                    'Gagal menghapus tanda tangan: ' +
                    (Object.values(errors)[0] ||
                        'Terjadi kesalahan yang tidak diketahui'),
                );
            },
        });
    };

    const signedCount = document.signers.filter((s) => s.is_signed).length;

    const signatures: WorkspaceSignature[] = existingSignatures.map((s) => ({
        id: s.id,
        type: s.type,
        user: s.user,
        page: s.page,
        signedAt: s.signedAt,
    }));

    return (
        <AppSidebarLayout>
            <Head title={`Sign Document: ${document.title}`} />

            <SigningWorkspace
                mode="document"
                entityId={document.id}
                title="Sign Document"
                subtitle={document.title}
                statusLabel={
                    signedCount === document.signers.length
                        ? 'Sudah Lengkap Ditandatangani'
                        : signedCount > 0
                          ? 'Sebagian Ditandatangani'
                          : 'Belum Ditandatangani'
                }
                statusBadge={
                    signedCount === document.signers.length
                        ? 'signed'
                        : 'unsigned'
                }
                                    pdfUrl={
                                        document.signed_file
                                            ? `/documents/${document.id}/signed-pdf/preview`
                                            : `/documents/${document.id}/pdf`
                                    }
                                    canEdit={canSign}
                canSign={canSign}
                currentUserId={user.id}
                hasEncryptionKeys={hasEncryptionKeys}
                signers={document.signers}
                signatures={signatures}
                showQrToggle
                onSave={handleSave}
                onDeleteSignature={handleDeleteSignature}
                infoFields={[
                    { label: 'Title', value: document.title },
                    { label: 'Created by', value: document.user.name },
                ]}
            />
        </AppSidebarLayout>
    );
}
import PDFCanvasViewer from '@/components/PDFCanvasViewer';
import AlertModal from '@/components/ui/alert-modal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ConfirmModal from '@/components/ui/confirm-modal';
import { useModal } from '@/hooks/use-modal';
import { useToast } from '@/hooks/use-toast';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Head, router } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';

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
    signers: any[];
    signed_file?: string;
}

interface SignaturePosition {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    page: number;
    type: 'physical' | 'digital';
    user: User;
    signedAt: string;
    signatureData?: string;
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
    const [currentPage, setCurrentPage] = useState(1);
    const [signatures, setSignatures] =
        useState<SignaturePosition[]>(existingSignatures);

    const { success, error } = useToast();
    const deleteModal = useModal();
    const alertModal = useModal();
    const [alertData, setAlertData] = useState({
        title: '',
        description: '',
        type: 'info' as const,
    });
    const [deleteSignatureId, setDeleteSignatureId] = useState<string>('');

    const handleSignatureComplete = (
        signatureData: string,
        passphrase?: string,
        signedPdfBase64?: string,
    ) => {
        if (!canSign) {
            setAlertData({
                title: 'Akses Ditolak',
                description:
                    'Anda tidak memiliki izin untuk menandatangani dokumen ini.',
                type: 'info',
            });
            alertModal.open();
            return;
        }

        if (!hasEncryptionKeys) {
            setAlertData({
                title: 'Kunci Enkripsi Diperlukan',
                description:
                    'Anda perlu membuat kunci enkripsi terlebih dahulu.',
                type: 'info',
            });
            alertModal.open();
            return;
        }

        // Create combined signature (physical + digital)
        createCombinedSignature(
            signatureData,
            { x: 0, y: 0, page: 1 },
            passphrase,
            signedPdfBase64,
        );
    };

    const createCombinedSignature = (
        signatureData: string,
        position: { x: number; y: number; page: number },
        passphrase?: string,
        signedPdfBase64?: string,
    ) => {
        console.log('Sending signature data:', {
            dataLength: signatureData.length,
            dataPreview: signatureData.substring(0, 100),
            position,
            hasPassphrase: !!passphrase,
        });

        // Use Inertia router to make the request
        router.post(
            `/documents/${document.id}/sign/combined`,
            {
                signatureData,
                position: {
                    x: Math.round(position.x),
                    y: Math.round(position.y),
                    width: 150,
                    height: 75,
                    page: Math.round(position.page),
                },
                passphrase: passphrase || null, // Use provided passphrase or null
                signedPdfBase64: signedPdfBase64 || null, // Send signed PDF data
            },
            {
                onSuccess: () => {
                    success('Tanda tangan berhasil ditambahkan!');

                    // Add only physical signature to local state immediately (digital signature is for backend only)
                    const physicalSignature: SignaturePosition = {
                        id: Date.now().toString() + '_physical',
                        x: Math.round(position.x),
                        y: Math.round(position.y),
                        width: 150,
                        height: 75,
                        page: Math.round(position.page),
                        type: 'physical' as const,
                        user: document.user,
                        signedAt: new Date().toISOString(),
                    };

                    setSignatures((prev) => [...prev, physicalSignature]);

                    // Reload to get the actual signatures from server
                    setTimeout(() => {
                        router.reload();
                    }, 1000);
                },
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

    const handleSignaturePositionChange = (
        signatureId: string,
        position: {
            x: number;
            y: number;
            width: number;
            height: number;
            page: number;
        },
    ) => {
        // Update signature position via Inertia
        const roundedPosition = {
            x: Math.round(position.x),
            y: Math.round(position.y),
            width: Math.round(position.width),
            height: Math.round(position.height),
            page: Math.round(position.page),
        };

        router.patch(`/signatures/${signatureId}/position`, roundedPosition, {
            onSuccess: () => {
                setSignatures((prev) =>
                    prev.map((sig) =>
                        sig.id === signatureId
                            ? { ...sig, ...roundedPosition }
                            : sig,
                    ),
                );
                success('Posisi tanda tangan berhasil diperbarui');
            },
            onError: (errors) => {
                console.error('Position update errors:', errors);
                error(
                    'Gagal memperbarui posisi tanda tangan: ' +
                    (Object.values(errors)[0] ||
                        'Terjadi kesalahan yang tidak diketahui'),
                );
            },
        });
    };

    const generateSignedPDF = () => {
        window.open(`/documents/${document.id}/signed-pdf`, '_blank');
    };

    const handleDeleteSignature = (signatureId: string) => {
        setDeleteSignatureId(signatureId);
        deleteModal.open();
    };

    const confirmDeleteSignature = () => {
        router.delete(`/signatures/${deleteSignatureId}`, {
            onSuccess: () => {
                setSignatures((prev) =>
                    prev.filter((sig) => sig.id !== deleteSignatureId),
                );
                success('Tanda tangan berhasil dihapus');
                setDeleteSignatureId('');
            },
            onError: (errors) => {
                error(
                    'Gagal menghapus tanda tangan: ' +
                    (Object.values(errors)[0] ||
                        'Terjadi kesalahan yang tidak diketahui'),
                );
            },
        });
    };

    return (
        <AppSidebarLayout>
            <Head title={`Sign Document: ${document.title}`} />

            <div className="flex h-full flex-1 flex-col gap-2 overflow-x-auto rounded-xl p-2 sm:gap-4 sm:p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 sm:text-3xl">
                            Sign Document
                        </h1>
                        <p className="text-sm break-words text-gray-600 sm:text-base">
                            {document.title}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:gap-4 lg:grid-cols-4">
                    {/* PDF Viewer */}
                    <div className="lg:col-span-3">
                        <Card>
                            <CardHeader className="pb-2 sm:pb-6">
                                <CardTitle className="text-sm sm:text-base">
                                    Document Preview
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-2 sm:p-6">
                                <PDFCanvasViewer
                                    pdfUrl={
                                        document.signed_file
                                            ? `/documents/${document.id}/signed-pdf/preview`
                                            : `/documents/${document.id}/pdf`
                                    }
                                    onSave={handleSignatureComplete}
                                    canEdit={canSign}
                                    documentId={document.id}
                                    generateQRCode={
                                        (document.signers?.filter((s) => s.is_signed).length || 0) + 1 ===
                                        (document.signers?.length || 0)
                                    }
                                />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-2 sm:space-y-4">
                        {/* Document Info */}
                        <Card>
                            <CardHeader className="pb-2 sm:pb-6">
                                <CardTitle className="text-sm sm:text-base">
                                    Document Info
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 p-2 sm:space-y-3 sm:p-6">
                                <div>
                                    <label className="text-xs font-medium text-gray-600 sm:text-sm">
                                        Title
                                    </label>
                                    <p className="text-xs break-words sm:text-sm">
                                        {document.title}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-600 sm:text-sm">
                                        Created by
                                    </label>
                                    <p className="text-xs sm:text-sm">
                                        {document.user.name}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-600 sm:text-sm">
                                        Total Signatures
                                    </label>
                                    <p className="text-xs sm:text-sm">
                                        {signatures.filter(s => s.type === 'physical').length}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Signatures List */}
                        <Card>
                            <CardHeader className="pb-2 sm:pb-6">
                                <CardTitle className="text-sm sm:text-base">
                                    Signatures
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-2 sm:p-6">
                                {signatures.length === 0 ? (
                                    <p className="text-xs text-gray-500 sm:text-sm">
                                        No signatures yet
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {signatures.filter(s => s.type === 'physical').map((signature) => (
                                            <div
                                                key={signature.id}
                                                className="rounded-lg border p-2 sm:p-3"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-xs font-medium sm:text-sm">
                                                            {signature.user
                                                                ?.name ||
                                                                'Unknown User'}
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            {signature.type ===
                                                                'physical'
                                                                ? '✍️ Physical'
                                                                : '🔐 Digital'}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <span className="text-xs text-gray-400">
                                                            Page{' '}
                                                            {signature.page}
                                                        </span>
                                                        {canSign &&
                                                            signature.user?.id ===
                                                            user.id && (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() =>
                                                                        handleDeleteSignature(
                                                                            signature.id,
                                                                        )
                                                                    }
                                                                    className="h-6 w-6 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            )}
                                                    </div>
                                                </div>
                                                <p className="mt-1 text-xs text-gray-400">
                                                    {new Date(
                                                        signature.signedAt,
                                                    ).toLocaleString()}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Actions */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Actions</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {!hasEncryptionKeys && (
                                    <Button
                                        onClick={() =>
                                        (window.location.href =
                                            '/encryption')
                                        }
                                        className="w-full"
                                        variant="secondary"
                                    >
                                        Setup Digital Keys
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Modals */}
            <AlertModal
                open={alertModal.isOpen}
                onClose={alertModal.close}
                title={alertData.title}
                description={alertData.description}
                type={alertData.type}
            />

            <ConfirmModal
                open={deleteModal.isOpen}
                onClose={deleteModal.close}
                onConfirm={confirmDeleteSignature}
                title="Hapus Tanda Tangan"
                description="Apakah Anda yakin ingin menghapus tanda tangan ini? Tindakan ini tidak dapat dibatalkan."
                confirmText="Hapus"
                cancelText="Batal"
                variant="destructive"
            />
        </AppSidebarLayout>
    );
}

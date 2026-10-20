import PDFCanvasViewer from '@/components/PDFCanvasViewer';
import AlertModal from '@/components/ui/alert-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import ConfirmModal from '@/components/ui/confirm-modal';
import { useModal } from '@/hooks/use-modal';
import { ChevronDown, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

export interface WorkspaceSigner {
    id: string;
    user: { id: string; name: string };
    is_signed: boolean;
    sign_order: number | null;
}

export interface WorkspaceSignature {
    id: string;
    type: 'physical' | 'digital';
    user: { id: string; name: string };
    page: number;
    signedAt: string;
}

export interface SigningWorkspaceProps {
    mode: 'document' | 'template';
    title: string;
    subtitle: string;
    statusLabel: string;
    statusBadge: 'signed' | 'unsigned';
    pdfUrl: string;
    entityId: string;
    canEdit: boolean;
    canSign: boolean;
    currentUserId: string;
    hasEncryptionKeys?: boolean;
    signers: WorkspaceSigner[];
    signatures: WorkspaceSignature[];
    showQrToggle?: boolean;
    onSave: (
        signatureData: string,
        passphrase?: string,
        signedPdfBase64?: string,
    ) => void;
    onDeleteSignature: () => void;
    deleteConfirmText?: string;
    infoFields?: { label: string; value: string }[];
}

export default function SigningWorkspace({
    mode,
    title,
    subtitle,
    statusLabel,
    statusBadge,
    pdfUrl,
    entityId,
    canEdit,
    canSign,
    currentUserId,
    hasEncryptionKeys = true,
    signers,
    signatures,
    showQrToggle = false,
    onSave,
    onDeleteSignature,
    deleteConfirmText = 'Tanda tangan fisik dan digital Anda akan dihapus sekaligus. Tindakan ini tidak dapat dibatalkan.',
    infoFields = [],
}: SigningWorkspaceProps) {
    const [showQRCode, setShowQRCode] = useState(true);

    const deleteModal = useModal();
    const alertModal = useModal();
    const [alertData, setAlertData] = useState({
        title: '',
        description: '',
        type: 'info' as const,
    });

    const isCompleted = useMemo(
        () =>
            signers.length > 0 &&
            signers.every((signer) => signer.is_signed),
        [signers],
    );

    // Group signatures per signer so physical + digital collapse into one row.
    const signaturesBySigner = useMemo(() => {
        const grouped: Record<
            string,
            {
                user: { id: string; name: string };
                types: Set<string>;
                latestSignedAt: string;
                page: number;
            }
        > = {};

        for (const signature of signatures) {
            const key = signature.user.id;
            if (!grouped[key]) {
                grouped[key] = {
                    user: signature.user,
                    types: new Set(),
                    latestSignedAt: signature.signedAt,
                    page: signature.page,
                };
            }
            grouped[key].types.add(signature.type);
            if (
                new Date(signature.signedAt) >
                new Date(grouped[key].latestSignedAt)
            ) {
                grouped[key].latestSignedAt = signature.signedAt;
            }
        }

        return Object.values(grouped);
    }, [signatures]);

    const handleSignatureComplete = (
        signatureData: string,
        passphrase?: string,
        signedPdfBase64?: string,
    ) => {
        if (!canSign) {
            setAlertData({
                title: 'Akses Ditolak',
                description:
                    'Anda tidak memiliki izin untuk menandatangani ' +
                    (mode === 'document' ? 'dokumen' : 'template') +
                    ' ini.',
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

        onSave(signatureData, passphrase, signedPdfBase64);
    };

    const generateQRCode =
        showQrToggle &&
        signers.filter((s) => s.is_signed).length + 1 === signers.length;

    return (
        <div className="flex h-full flex-1 flex-col gap-2 rounded-xl p-2 sm:gap-4 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 sm:text-3xl">
                        {title}
                    </h1>
                    <p className="text-sm break-words text-gray-600 sm:text-base">
                        {subtitle}
                    </p>
                </div>
                <Badge
                    className={
                        statusBadge === 'signed'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                    }
                >
                    {statusLabel}
                </Badge>
            </div>

            {/* Compact info bar on top, expandable. Keeps the PDF preview full width. */}
            <Card>
                <Collapsible>
                    <CollapsibleTrigger className="w-full">
                        <CardHeader className="flex w-full flex-row items-center justify-between py-3">
                            <CardTitle className="flex items-center text-sm sm:text-base">
                                Informasi & Penandatangan
                            </CardTitle>
                            <ChevronDown className="h-4 w-4 text-gray-400 data-[state=open]:rotate-180" />
                        </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <CardContent className="grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
                            {infoFields.map((field) => (
                                <div key={field.label}>
                                    <label className="text-xs font-medium text-gray-500 uppercase">
                                        {field.label}
                                    </label>
                                    <p className="mt-1 text-sm break-words text-gray-800">
                                        {field.value}
                                    </p>
                                </div>
                            ))}

                            <div>
                                <label className="text-xs font-medium text-gray-500 uppercase">
                                    Daftar Penandatangan
                                </label>
                                <div className="mt-1 space-y-1">
                                    {signers.length === 0 ? (
                                        <p className="text-xs text-gray-500">
                                            Belum ada penandatangan yang
                                            ditentukan.
                                        </p>
                                    ) : (
                                        signers
                                            .filter((signer) => signer.user)
                                            .map((signer) => {
                                                const signerSignatures =
                                                    signaturesBySigner.find(
                                                        (s) =>
                                                            s.user.id ===
                                                            signer.user.id,
                                                    );

                                                return (
                                                    <div
                                                        key={signer.id}
                                                        className="flex items-center justify-between gap-2 text-sm"
                                                    >
                                                        <span className="text-gray-800">
                                                            {signer.user.name}
                                                        </span>
                                                        <div className="flex items-center gap-1">
                                                            <Badge
                                                                variant={
                                                                    signer.is_signed
                                                                        ? 'default'
                                                                        : 'outline'
                                                                }
                                                                className={
                                                                    signer.is_signed
                                                                        ? 'bg-green-100 text-green-800'
                                                                        : 'text-gray-500'
                                                                }
                                                            >
                                                                {signer.is_signed
                                                                    ? 'Sudah TTD'
                                                                    : 'Belum TTD'}
                                                            </Badge>
                                                            {canSign &&
                                                                signer.user.id ===
                                                                    currentUserId &&
                                                                signer.is_signed &&
                                                                !isCompleted && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={
                                                                            deleteModal.open
                                                                        }
                                                                        className="h-6 w-6 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                                                                        title="Hapus tanda tangan (fisik + digital)"
                                                                    >
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </Button>
                                                                )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                    )}
                                </div>
                            </div>

                            {showQrToggle && (
                                <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase">
                                        Opsi Tanda Tangan
                                    </label>
                                    <div className="mt-1 flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="showQRCode"
                                            checked={showQRCode}
                                            onChange={(e) =>
                                                setShowQRCode(e.target.checked)
                                            }
                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <label
                                            htmlFor="showQRCode"
                                            className="text-xs font-medium text-gray-700 sm:text-sm"
                                        >
                                            Tampilkan QR Code Verifikasi
                                        </label>
                                    </div>
                                    <p className="mt-1 text-[10px] text-gray-500 sm:text-xs">
                                        Otomatis di pojok kanan bawah halaman
                                        terakhir saat semua pihak TTD.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </CollapsibleContent>
                </Collapsible>
            </Card>

            {/* PDF Viewer - full width */}
            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-sm sm:text-base">
                        {mode === 'document'
                            ? 'Document Preview'
                            : 'Template Preview'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-2 sm:p-6">
                    <PDFCanvasViewer
                        pdfUrl={pdfUrl}
                        onSave={handleSignatureComplete}
                        canEdit={canEdit}
                        documentId={entityId}
                        isTemplate={mode === 'template'}
                        generateQRCode={generateQRCode}
                    />
                </CardContent>
            </Card>

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
                onConfirm={onDeleteSignature}
                title="Hapus Tanda Tangan"
                description={deleteConfirmText}
                confirmText="Hapus"
                cancelText="Batal"
                variant="destructive"
            />
        </div>
    );
}

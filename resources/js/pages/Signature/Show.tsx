import PDFSignatureViewer from '@/components/PDFSignatureViewer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
}

export default function SignDocument({
    document,
    existingSignatures,
    canSign,
    hasEncryptionKeys,
}: SignDocumentProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const [signatures, setSignatures] =
        useState<SignaturePosition[]>(existingSignatures);

    const handleSignatureComplete = (
        signatureData: string,
        position: { x: number; y: number; page: number },
        passphrase?: string,
    ) => {
        if (!canSign) {
            alert('You are not authorized to sign this document');
            return;
        }

        if (!hasEncryptionKeys) {
            alert('You need to generate encryption keys first');
            window.location.href = '/encryption';
            return;
        }

        // Create combined signature (physical + digital)
        createCombinedSignature(signatureData, position, passphrase);
    };

    const createCombinedSignature = (
        signatureData: string,
        position: { x: number; y: number; page: number },
        passphrase?: string,
    ) => {
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
            },
            {
                onSuccess: () => {
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
                        'Unknown error';
                    alert('Failed to add signature: ' + errorMessage);
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
                alert('Signature position updated');
            },
            onError: (errors) => {
                console.error('Position update errors:', errors);
                alert(
                    'Failed to update signature position: ' +
                        (Object.values(errors)[0] || 'Unknown error'),
                );
            },
        });
    };

    const generateSignedPDF = () => {
        window.open(`/documents/${document.id}/signed-pdf`, '_blank');
    };

    const handleDeleteSignature = (signatureId: string) => {
        if (confirm('Apakah Anda yakin ingin menghapus tanda tangan ini?')) {
            router.delete(`/signatures/${signatureId}`, {
                onSuccess: () => {
                    setSignatures((prev) =>
                        prev.filter((sig) => sig.id !== signatureId),
                    );
                    alert('Tanda tangan berhasil dihapus');
                },
                onError: (errors) => {
                    alert(
                        'Gagal menghapus tanda tangan: ' +
                            (Object.values(errors)[0] || 'Unknown error'),
                    );
                },
            });
        }
    };

    return (
        <AppSidebarLayout>
            <Head title={`Sign Document: ${document.title}`} />

            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            Sign Document
                        </h1>
                        <p className="text-gray-600">{document.title}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                    {/* PDF Viewer */}
                    <div className="lg:col-span-3">
                        <Card>
                            <CardHeader>
                                <CardTitle>Document Preview</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <PDFSignatureViewer
                                    pdfUrl={`/documents/${document.id}/pdf`}
                                    signatures={signatures}
                                    onSignaturePositionChange={
                                        handleSignaturePositionChange
                                    }
                                    onSignatureComplete={
                                        handleSignatureComplete
                                    }
                                    canEdit={canSign}
                                    currentPage={currentPage}
                                    onPageChange={setCurrentPage}
                                />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-4">
                        {/* Document Info */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Document Info</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div>
                                    <label className="text-sm font-medium text-gray-600">
                                        Title
                                    </label>
                                    <p className="text-sm">{document.title}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-600">
                                        Created by
                                    </label>
                                    <p className="text-sm">
                                        {document.user.name}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-600">
                                        Total Signatures
                                    </label>
                                    <p className="text-sm">
                                        {signatures.length}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Signatures List */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Signatures</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {signatures.length === 0 ? (
                                    <p className="text-sm text-gray-500">
                                        No signatures yet
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {signatures.map((signature) => (
                                            <div
                                                key={signature.id}
                                                className="rounded-lg border p-3"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-sm font-medium">
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
                                                        {canSign && (
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
                                {signatures.length > 0 && (
                                    <>
                                        <Button
                                            onClick={() =>
                                                window.open(
                                                    `/documents/${document.id}/signed-pdf/preview`,
                                                    '_blank',
                                                )
                                            }
                                            className="w-full"
                                            variant="default"
                                        >
                                            Preview Signed PDF
                                        </Button>
                                        <Button
                                            onClick={generateSignedPDF}
                                            className="w-full"
                                            variant="outline"
                                        >
                                            Download Signed PDF
                                        </Button>
                                    </>
                                )}

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
        </AppSidebarLayout>
    );
}

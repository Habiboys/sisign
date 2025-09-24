import React, { useState } from 'react';
import { Head, useForm, router } from '@inertiajs/react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import SignatureCanvas from '@/Components/SignatureCanvas';
import PDFSignatureViewer from '@/Components/PDFSignatureViewer';

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
    hasEncryptionKeys 
}: SignDocumentProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const [signatures, setSignatures] = useState<SignaturePosition[]>(existingSignatures);

    const handleSignatureComplete = (signatureData: string, position: { x: number; y: number; page: number }, passphrase?: string) => {
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

    const createCombinedSignature = (signatureData: string, position: { x: number; y: number; page: number }, passphrase?: string) => {
        // Use Inertia router to make the request
        router.post(`/documents/${document.id}/sign/combined`, {
            signatureData,
            position: {
                x: Math.round(position.x),
                y: Math.round(position.y),
                width: 150,
                height: 75,
                page: Math.round(position.page)
            },
            passphrase: passphrase || null // Use provided passphrase or null
        }, {
            onSuccess: () => {
                // Will redirect back automatically
            },
            onError: (errors) => {
                console.error('Signature errors:', errors);
                const errorMessage = errors.error || Object.values(errors)[0] || 'Unknown error';
                alert('Failed to add signature: ' + errorMessage);
            }
        });
    };

    const handleSignaturePositionChange = (signatureId: string, position: { x: number; y: number; width: number; height: number; page: number }) => {
        // Update signature position via Inertia
        const roundedPosition = {
            x: Math.round(position.x),
            y: Math.round(position.y),
            width: Math.round(position.width),
            height: Math.round(position.height),
            page: Math.round(position.page)
        };
        
        router.patch(`/signatures/${signatureId}/position`, roundedPosition, {
            onSuccess: () => {
                setSignatures(prev => prev.map(sig => 
                    sig.id === signatureId 
                        ? { ...sig, ...roundedPosition }
                        : sig
                ));
                alert('Signature position updated');
            },
            onError: (errors) => {
                console.error('Position update errors:', errors);
                alert('Failed to update signature position: ' + (Object.values(errors)[0] || 'Unknown error'));
            }
        });
    };



    const generateSignedPDF = () => {
        window.open(`/documents/${document.id}/signed-pdf`, '_blank');
    };

    return (
        <AppShell>
            <Head title={`Sign Document: ${document.title}`} />
            
            <div className="max-w-7xl mx-auto p-6">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Sign Document</h1>
                    <p className="text-gray-600 mt-2">{document.title}</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
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
                                    onSignaturePositionChange={handleSignaturePositionChange}
                                    onSignatureComplete={handleSignatureComplete}
                                    canEdit={canSign}
                                    currentPage={currentPage}
                                    onPageChange={setCurrentPage}
                                />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Document Info */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Document Info</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div>
                                    <label className="text-sm font-medium text-gray-600">Title</label>
                                    <p className="text-sm">{document.title}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-600">Created by</label>
                                    <p className="text-sm">{document.user.name}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-600">Total Signatures</label>
                                    <p className="text-sm">{signatures.length}</p>
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
                                    <p className="text-sm text-gray-500">No signatures yet</p>
                                ) : (
                                    <div className="space-y-3">
                                        {signatures.map((signature) => (
                                            <div key={signature.id} className="p-3 border rounded-lg">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-medium text-sm">{signature.user?.name || 'Unknown User'}</p>
                                                        <p className="text-xs text-gray-500">
                                                            {signature.type === 'physical' ? '✍️ Physical' : '🔐 Digital'}
                                                        </p>
                                                    </div>
                                                    <span className="text-xs text-gray-400">
                                                        Page {signature.page}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    {new Date(signature.signedAt).toLocaleString()}
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
                                            onClick={() => window.open(`/documents/${document.id}/signed-pdf/preview`, '_blank')}
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
                                        onClick={() => window.location.href = '/encryption'}
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


        </AppShell>
    );
}
import PDFCanvasViewer from '@/components/PDFCanvasViewer';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
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

interface Template {
    id: string;
    title: string;
    description?: string;
    files: string;
    signed_template_path?: string;
    review: Review;
    created_at: string;
    updatedAt: string;
}

interface Props {
    template: Template;
    user: User;
}

export default function TemplateSign({ template, user }: Props) {
    const { success, error } = useToast();
    const isTemplateSigned = !!template.signed_template_path;

    const handleSignatureComplete = (
        signatureData: string,
        passphrase?: string,
        signedPdfBase64?: string,
    ) => {
        if (user.role !== 'pimpinan') {
            error('Hanya pimpinan yang dapat menandatangani template');
            return;
        }

        console.log('Template signature complete:', {
            hasSignatureData: !!signatureData,
            hasPassphrase: !!passphrase,
            hasSignedPdf: !!signedPdfBase64,
        });

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
                onSuccess: (page) => {
                    // Redirect akan ditangani otomatis oleh Inertia
                    // Toast akan muncul di halaman tujuan
                },
                onError: (errors) => {
                    console.error('Signature errors:', errors);
                    const errorMessage =
                        errors.error ||
                        Object.values(errors)[0] ||
                        'Terjadi kesalahan yang tidak diketahui';
                    error('Gagal menandatangani template: ' + errorMessage);
                },
            },
        );
    };

    const downloadSignedTemplate = () => {
        if (template.signed_template_path) {
            window.open(`/templates/${template.id}/download-signed`, '_blank');
        }
    };

    return (
        <AppLayout>
            <Head title={`Tanda Tangan Template - ${template.title}`} />
            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            Tanda Tangan Template
                        </h1>
                        <p className="text-gray-600">
                            Tandatangani template sertifikat: {template.title}
                        </p>
                    </div>
                    <div className="flex items-center space-x-2">
                        {isTemplateSigned ? (
                            <Badge className="bg-blue-100 text-blue-800">
                                ℹ️ Partially Signed
                            </Badge>
                        ) : (
                            <Badge className="bg-yellow-100 text-yellow-800">
                                Belum Ditandatangani
                            </Badge>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                    {/* PDF Viewer */}
                    <div className="lg:col-span-3">
                        <Card>
                            <CardHeader className="pb-2 sm:pb-6">
                                <CardTitle className="text-sm sm:text-base">
                                    Template Preview
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-2 sm:p-6">
                                <PDFCanvasViewer
                                    pdfUrl={`/templates/${template.id}/preview`}
                                    onSave={handleSignatureComplete}
                                    canEdit={
                                        user.role === 'pimpinan'
                                    }
                                    documentId={template.id}
                                    isTemplate={true}
                                />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-4">
                        {/* Template Info */}
                        <Card>
                            <CardHeader className="pb-2 sm:pb-6">
                                <CardTitle className="text-sm sm:text-base">
                                    Template Info
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 p-2 sm:space-y-3 sm:p-6">
                                <div>
                                    <label className="text-xs font-medium text-gray-600 sm:text-sm">
                                        Title
                                    </label>
                                    <p className="text-xs break-words sm:text-sm">
                                        {template.title}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-600 sm:text-sm">
                                        Status
                                    </label>
                                    <p className="text-xs sm:text-sm">
                                        {isTemplateSigned
                                            ? 'Partially Signed'
                                            : 'Belum Ditandatangani'}
                                    </p>
                                </div>
                                {template.description && (
                                    <div>
                                        <label className="text-xs font-medium text-gray-600 sm:text-sm">
                                            Description
                                        </label>
                                        <p className="text-xs break-words sm:text-sm">
                                            {template.description}
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Instructions */}
                        <Card className="border-yellow-200 bg-yellow-50">
                            <CardHeader className="pb-2 sm:pb-6">
                                <CardTitle className="text-sm sm:text-base text-yellow-800">
                                    Instruksi
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-2 sm:p-6">
                                <ul className="space-y-1 text-xs text-yellow-700">
                                    <li>• Langsung gambar tanda tangan di PDF</li>
                                    <li>• Gunakan tools di bawah untuk menggambar</li>
                                    <li>• Upload stempel/gambar untuk menambah stempel resmi</li>
                                    <li>• Klik tombol "Stempel" lalu klik di PDF untuk menempatkan stempel</li>
                                    <li>• Perbesar/perkecil stempel dengan scroll mouse atau slider</li>
                                    <li>• <span className="font-medium text-red-600">PIN wajib diisi</span> untuk keamanan digital signature</li>
                                    <li>• PDF yang dihasilkan akan memiliki: <span className="font-medium text-green-600">Tanda tangan fisik (gambar) + QR Code verifikasi digital</span></li>
                                    <li>• TTD dan stempel akan langsung digambar di PDF dengan koordinat yang tepat</li>
                                </ul>
                            </CardContent>
                        </Card>


                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

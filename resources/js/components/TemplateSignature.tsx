import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { router } from '@inertiajs/react';
import { Download, Save, Trash2 } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

interface TemplateSignatureProps {
    template: {
        id: string;
        title: string;
        files: string;
        signed_template_path?: string;
    };
    user: {
        id: string;
        name: string;
        role: string;
    };
    onSignatureComplete?: () => void;
}

export default function TemplateSignature({
    template,
    user,
    onSignatureComplete,
}: TemplateSignatureProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isSigning, setIsSigning] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);
    const { success, error } = useToast();

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.lineTo(x, y);
        ctx.stroke();
        setHasSignature(true);
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasSignature(false);
    };

    const saveSignature = async () => {
        if (!hasSignature) {
            error('Silakan buat tanda tangan terlebih dahulu');
            return;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;

        setIsSigning(true);

        try {
            const signatureData = canvas.toDataURL('image/png');

            router.post(
                `/templates/${template.id}/sign`,
                {
                    signatureData: signatureData,
                },
                {
                    onSuccess: (page) => {
                        success('Template berhasil ditandatangani!');
                        clearSignature();
                        if (onSignatureComplete) {
                            onSignatureComplete();
                        }
                        // Reload halaman untuk menunjukkan status terbaru
                        router.reload();
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
        } catch (err) {
            error('Gagal menyimpan tanda tangan');
            console.error(err);
        } finally {
            setIsSigning(false);
        }
    };

    const downloadTemplate = () => {
        window.open(`/templates/${template.id}/preview`, '_blank');
    };

    const downloadSignedTemplate = () => {
        if (template.signed_template_path) {
            window.open(`/templates/${template.id}/download-signed`, '_blank');
        }
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas style
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }, []);

    const isTemplateSigned = !!template.signed_template_path;

    return (
        <div className="space-y-6">
            {/* Template Info */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>Template: {template.title}</span>
                        <div className="flex items-center space-x-2">
                            {isTemplateSigned ? (
                                <Badge className="bg-green-100 text-green-800">
                                    Sudah Ditandatangani
                                </Badge>
                            ) : (
                                <Badge className="bg-yellow-100 text-yellow-800">
                                    Belum Ditandatangani
                                </Badge>
                            )}
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex space-x-2">
                        <Button
                            variant="outline"
                            onClick={downloadTemplate}
                            className="flex-1"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Download Template Original
                        </Button>

                        {isTemplateSigned && (
                            <Button
                                variant="outline"
                                onClick={downloadSignedTemplate}
                                className="flex-1"
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Download Template Bertanda Tangan
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Signature Canvas */}
            {user.role === 'pimpinan' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Tanda Tangan Template</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-sm text-gray-600">
                            Gambar tanda tangan Anda di area bawah ini:
                        </div>

                        <div className="rounded-lg border-2 border-dashed border-gray-300 p-4">
                            <canvas
                                ref={canvasRef}
                                width={400}
                                height={200}
                                className="w-full cursor-crosshair rounded border border-gray-300 bg-white"
                                style={{ maxWidth: '100%', height: 'auto' }}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                            />
                        </div>

                        <div className="flex space-x-2">
                            <Button
                                variant="outline"
                                onClick={clearSignature}
                                disabled={!hasSignature}
                                className="flex-1"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Hapus
                            </Button>

                            <Button
                                onClick={saveSignature}
                                disabled={!hasSignature || isSigning}
                                className="flex-1 bg-green-600 hover:bg-green-700"
                            >
                                <Save className="mr-2 h-4 w-4" />
                                {isSigning
                                    ? 'Menyimpan...'
                                    : 'Simpan Tanda Tangan'}
                            </Button>
                        </div>

                        {isTemplateSigned && (
                            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
                                <p className="text-sm text-green-800">
                                    ✅ Template ini sudah ditandatangani dan
                                    siap digunakan untuk membuat sertifikat.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {user.role !== 'pimpinan' && (
                <Card>
                    <CardContent className="p-6 text-center">
                        <p className="text-gray-600">
                            Hanya pimpinan yang dapat menandatangani template
                            sertifikat.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

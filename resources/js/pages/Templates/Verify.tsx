import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head } from '@inertiajs/react';
import {
    Calendar,
    CheckCircle,
    Clock,
    FileCheck,
    User,
    XCircle,
} from 'lucide-react';

interface TemplateInfo {
    id: string;
    title: string;
    description?: string;
    created_at: string;
    review_status: 'pending' | 'approved' | 'rejected';
    is_signed: boolean;
    signed_at?: number;
    signers: Array<{
        name: string;
        role: string;
        is_signed: boolean;
        order: number;
    }>;
}

interface ReviewInfo {
    status: 'pending' | 'approved' | 'rejected';
    approved_by?: string;
    comments?: string;
    reviewed_at: string;
}

interface Props {
    success: boolean;
    template?: TemplateInfo;
    review?: ReviewInfo;
    verification_time: string;
    message: string;
}

export default function TemplateVerification({
    success,
    template,
    review,
    verification_time,
    message,
}: Props) {
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved':
                return (
                    <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Disetujui
                    </Badge>
                );
            case 'rejected':
                return (
                    <Badge className="bg-red-100 text-red-800">
                        <XCircle className="mr-1 h-3 w-3" />
                        Ditolak
                    </Badge>
                );
            default:
                return (
                    <Badge className="bg-yellow-100 text-yellow-800">
                        <Clock className="mr-1 h-3 w-3" />
                        Menunggu Review
                    </Badge>
                );
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 py-12">
            <Head title="Verifikasi Template Sertifikat" />

            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-gray-900">
                        Verifikasi Template Sertifikat
                    </h1>
                    <p className="mt-2 text-gray-600">
                        Sistem Tanda Tangan Digital SiSign
                    </p>
                </div>

                <div className="mt-8">
                    {success && template ? (
                        <div className="space-y-6">
                            {/* Status Verifikasi */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center text-green-600">
                                        <CheckCircle className="mr-2 h-6 w-6" />
                                        Verifikasi Berhasil
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-gray-600">
                                        Template telah berhasil diverifikasi
                                        pada{' '}
                                        <span className="font-medium">
                                            {new Date(
                                                verification_time,
                                            ).toLocaleString('id-ID')}
                                        </span>
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Informasi Template */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center">
                                        <FileCheck className="mr-2 h-5 w-5" />
                                        Informasi Template
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div>
                                            <h4 className="font-medium text-gray-900">
                                                ID Template
                                            </h4>
                                            <p className="font-mono text-sm text-gray-600">
                                                {template.id}
                                            </p>
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-gray-900">
                                                Status Review
                                            </h4>
                                            {getStatusBadge(
                                                template.review_status,
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-gray-900">
                                                Judul Template
                                            </h4>
                                            <p className="text-gray-600">
                                                {template.title}
                                            </p>
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-gray-900">
                                                Status Tanda Tangan
                                            </h4>
                                            {template.is_signed ? (
                                                <Badge className="bg-blue-100 text-blue-800">
                                                    <CheckCircle className="mr-1 h-3 w-3" />
                                                    Sudah Ditandatangani
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-gray-100 text-gray-800">
                                                    <XCircle className="mr-1 h-3 w-3" />
                                                    Belum Ditandatangani
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    {template.description && (
                                        <div>
                                            <h4 className="font-medium text-gray-900">
                                                Deskripsi
                                            </h4>
                                            <p className="text-gray-600">
                                                {template.description}
                                            </p>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div>
                                            <h4 className="font-medium text-gray-900">
                                                Tanggal Dibuat
                                            </h4>
                                            <p className="text-gray-600">
                                                {new Date(
                                                    template.created_at,
                                                ).toLocaleString('id-ID')}
                                            </p>
                                        </div>
                                        {template.is_signed &&
                                            template.signed_at && (
                                                <div>
                                                    <h4 className="font-medium text-gray-900">
                                                        Tanggal Ditandatangani
                                                    </h4>
                                                    <p className="text-gray-600">
                                                        {new Date(
                                                            template.signed_at *
                                                            1000,
                                                        ).toLocaleString(
                                                            'id-ID',
                                                        )}
                                                    </p>
                                                </div>
                                            )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Daftar Penanda Tangan */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center">
                                        <User className="mr-2 h-5 w-5" />
                                        Daftar Penanda Tangan
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {template.signers.map((signer, index) => (
                                            <div
                                                key={index}
                                                className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-3"
                                            >
                                                <div className="flex items-center space-x-3">
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold text-sm">
                                                        {signer.order}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900">
                                                            {signer.name}
                                                        </p>
                                                        <p className="text-xs text-gray-500 capitalize">
                                                            {signer.role}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div>
                                                    {signer.is_signed ? (
                                                        <Badge className="bg-green-100 text-green-800">
                                                            <CheckCircle className="mr-1 h-3 w-3" />
                                                            Sudah TTD
                                                        </Badge>
                                                    ) : (
                                                        <Badge className="bg-gray-100 text-gray-800">
                                                            <Clock className="mr-1 h-3 w-3" />
                                                            Belum TTD
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Informasi Review */}
                            {review && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center">
                                            <Calendar className="mr-2 h-5 w-5" />
                                            Informasi Review
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                            <div>
                                                <h4 className="font-medium text-gray-900">
                                                    Status
                                                </h4>
                                                {getStatusBadge(review.status)}
                                            </div>
                                            {review.approved_by && (
                                                <div>
                                                    <h4 className="font-medium text-gray-900">
                                                        Disetujui Oleh
                                                    </h4>
                                                    <div className="flex items-center">
                                                        <User className="mr-1 h-4 w-4 text-gray-500" />
                                                        <span className="text-gray-600">
                                                            {review.approved_by}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {review.comments && (
                                            <div>
                                                <h4 className="font-medium text-gray-900">
                                                    Komentar
                                                </h4>
                                                <p className="text-gray-600">
                                                    {review.comments}
                                                </p>
                                            </div>
                                        )}

                                        <div>
                                            <h4 className="font-medium text-gray-900">
                                                Tanggal Review
                                            </h4>
                                            <p className="text-gray-600">
                                                {new Date(
                                                    review.reviewed_at,
                                                ).toLocaleString('id-ID')}
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Security Notice */}
                            <Card className="border-green-200 bg-green-50">
                                <CardContent className="pt-6">
                                    <div className="flex items-start">
                                        <CheckCircle className="mt-0.5 mr-3 h-5 w-5 flex-shrink-0 text-green-600" />
                                        <div>
                                            <h4 className="font-medium text-green-800">
                                                Template Terverifikasi
                                            </h4>
                                            <p className="mt-1 text-sm text-green-700">
                                                Template ini telah melalui
                                                proses verifikasi dan
                                                autentikasi digital.
                                                {template.is_signed &&
                                                    ' Template sudah ditandatangani dan siap digunakan untuk generate sertifikat.'}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    ) : (
                        /* Error State */
                        <Card className="border-red-200 bg-red-50">
                            <CardHeader>
                                <CardTitle className="flex items-center text-red-600">
                                    <XCircle className="mr-2 h-6 w-6" />
                                    Verifikasi Gagal
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-red-700">{message}</p>
                                <p className="mt-2 text-sm text-red-600">
                                    Template tidak dapat diverifikasi. Pastikan
                                    link QR code yang Anda scan adalah valid.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-8 text-center text-sm text-gray-500">
                    <p>
                        © {new Date().getFullYear()} SiSign - Digital
                        Certificate Management System
                    </p>
                    <p>
                        Sistem ini menggunakan teknologi kriptografi untuk
                        menjamin keaslian dokumen
                    </p>
                </div>
            </div>
        </div >
    );
}

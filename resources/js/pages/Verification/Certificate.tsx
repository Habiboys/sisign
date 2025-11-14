import { Head } from '@inertiajs/react';
import {
    Award,
    Calendar,
    CheckCircle,
    FileText,
    Mail,
    Shield,
    User,
    XCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Recipient {
    name: string;
    email: string;
    issued_at: string | null;
}

interface Certificate {
    certificate_id: string;
    certificate_number: string;
    template_title: string;
    issued_at: string;
    recipients: Recipient[];
    verification_status: string;
    verified_at: string;
    verification_hash: string;
}

interface VerificationProps {
    certificate: Certificate | null;
    success: boolean;
    message?: string;
}

export default function VerificationCertificate({
    certificate,
    success,
    message,
}: VerificationProps) {
    const isVerified = success && certificate !== null;

    return (
        <div className="min-h-screen bg-gray-50">
            <Head title={`Verifikasi Sertifikat - ${certificate?.certificate_number || 'Tidak Ditemukan'}`} />

            <div className="mx-auto max-w-4xl px-4 py-8">
                {/* Header */}
                <div className="mb-8 text-center">
                    <div className="mb-4 flex justify-center">
                        {isVerified ? (
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                                <CheckCircle className="h-8 w-8 text-green-600" />
                            </div>
                        ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                                <XCircle className="h-8 w-8 text-red-600" />
                            </div>
                        )}
                    </div>

                    <h1 className="mb-2 text-3xl font-bold text-gray-900">
                        {isVerified
                            ? 'Sertifikat Terverifikasi'
                            : 'Sertifikat Tidak Ditemukan'}
                    </h1>

                    <p className="text-lg text-gray-600">
                        {isVerified
                            ? 'Sertifikat ini valid dan dapat dipercaya'
                            : message || 'Sertifikat tidak ditemukan atau tidak valid'}
                    </p>
                </div>

                {certificate && (
                    <>
                        {/* Certificate Info Card */}
                        <Card className="mb-6">
                            <CardHeader>
                                <CardTitle className="flex items-center">
                                    <Award className="mr-3 h-6 w-6 text-blue-600" />
                                    Informasi Sertifikat
                                </CardTitle>
                                <CardDescription>
                                    Detail informasi sertifikat yang diverifikasi
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">
                                            Nomor Sertifikat
                                        </label>
                                        <p className="text-lg font-semibold text-gray-900">
                                            {certificate.certificate_number}
                                        </p>
                                    </div>

                                    <div>
                                        <label className="text-sm font-medium text-gray-500">
                                            Template
                                        </label>
                                        <p className="text-lg font-semibold text-gray-900">
                                            {certificate.template_title}
                                        </p>
                                    </div>

                                    <div>
                                        <label className="text-sm font-medium text-gray-500">
                                            Tanggal Diterbitkan
                                        </label>
                                        <p className="text-lg font-semibold text-gray-900">
                                            {certificate.issued_at}
                                        </p>
                                    </div>

                                    <div>
                                        <label className="text-sm font-medium text-gray-500">
                                            Status Verifikasi
                                        </label>
                                        <p className="text-lg font-semibold text-green-600">
                                            ✓ Valid
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Recipients Card */}
                        {certificate.recipients && certificate.recipients.length > 0 && (
                            <Card className="mb-6">
                                <CardHeader>
                                    <CardTitle className="flex items-center">
                                        <User className="mr-3 h-6 w-6 text-green-600" />
                                        Penerima Sertifikat
                                    </CardTitle>
                                    <CardDescription>
                                        Daftar penerima sertifikat ini
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {certificate.recipients.map((recipient, index) => (
                                            <div
                                                key={index}
                                                className="rounded-lg border border-gray-200 p-4"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-semibold text-gray-900">
                                                            {recipient.name}
                                                        </p>
                                                        <p className="flex items-center text-sm text-gray-500">
                                                            <Mail className="mr-2 h-4 w-4" />
                                                            {recipient.email}
                                                        </p>
                                                    </div>
                                                    {recipient.issued_at && (
                                                        <div className="text-right">
                                                            <p className="text-sm text-gray-500">
                                                                {recipient.issued_at}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Verification Info */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center">
                                    <Shield className="mr-3 h-6 w-6 text-gray-600" />
                                    Informasi Verifikasi
                                </CardTitle>
                                <CardDescription>
                                    Detail verifikasi sertifikat
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">
                                            Status Verifikasi
                                        </label>
                                        <p className="text-lg font-semibold text-green-600">
                                            ✓ Terverifikasi
                                        </p>
                                    </div>

                                    <div>
                                        <label className="text-sm font-medium text-gray-500">
                                            Waktu Verifikasi
                                        </label>
                                        <p className="text-lg font-semibold text-gray-900">
                                            {certificate.verified_at}
                                        </p>
                                    </div>

                                    <div>
                                        <label className="text-sm font-medium text-gray-500">
                                            Hash Verifikasi
                                        </label>
                                        <p className="font-mono text-xs text-gray-600 break-all">
                                            {certificate.verification_hash}
                                        </p>
                                    </div>

                                    <div>
                                        <label className="text-sm font-medium text-gray-500">
                                            ID Sertifikat
                                        </label>
                                        <p className="font-mono text-xs text-gray-600 break-all">
                                            {certificate.certificate_id}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}

                {/* Footer */}
                <div className="mt-8 text-center">
                    <p className="text-sm text-gray-500">
                        Sertifikat ini diverifikasi menggunakan sistem verifikasi digital yang aman
                    </p>
                </div>
            </div>
        </div>
    );
}


import { Head } from '@inertiajs/react';
import {
    Calendar,
    CheckCircle,
    FileText,
    Shield,
    User,
    XCircle,
} from 'lucide-react';

interface User {
    id: string;
    name: string;
    email: string;
}

interface Signature {
    id: string;
    type: 'physical' | 'digital';
    user_name: string;
    signed_at: string;
    position: {
        x: number;
        y: number;
        width: number;
        height: number;
        page: number;
    };
}

interface Signer {
    user_id: string;
    name: string;
    is_signed: boolean;
    sign_order: number;
}

interface Document {
    id: string;
    title: string;
    number: string;
    created_at: string;
    status: string;
}

interface VerificationProps {
    document: Document;
    signatures: Signature[];
    signers: Signer[];
    verification_status: 'signed' | 'unsigned';
    verified_at: string;
    success: boolean;
    message?: string;
}

export default function VerificationShow({
    document,
    signatures,
    signers,
    verification_status,
    verified_at,
    success,
    message,
}: VerificationProps) {
    const isVerified = verification_status === 'signed' && success;

    return (
        <div className="min-h-screen bg-gray-50">
            <Head title={`Verifikasi Dokumen - ${document.title}`} />

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
                            ? 'Dokumen Terverifikasi'
                            : 'Dokumen Tidak Terverifikasi'}
                    </h1>

                    <p className="text-lg text-gray-600">
                        {isVerified
                            ? 'Dokumen ini telah ditandatangani secara resmi dan dapat dipercaya'
                            : 'Dokumen ini belum ditandatangani atau tidak valid'}
                    </p>
                </div>

                {/* Document Info Card */}
                <div className="mb-6 rounded-lg bg-white p-6 shadow-md">
                    <div className="mb-4 flex items-center">
                        <FileText className="mr-3 h-6 w-6 text-blue-600" />
                        <h2 className="text-xl font-semibold text-gray-900">
                            Informasi Dokumen
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <label className="text-sm font-medium text-gray-500">
                                Judul Dokumen
                            </label>
                            <p className="text-lg text-gray-900">
                                {document.title}
                            </p>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-500">
                                Nomor Dokumen
                            </label>
                            <p className="text-lg text-gray-900">
                                {document.number}
                            </p>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-500">
                                Tanggal Dibuat
                            </label>
                            <p className="text-lg text-gray-900">
                                {new Date(
                                    document.created_at,
                                ).toLocaleDateString('id-ID', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </p>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-500">
                                Status
                            </label>
                            <span
                                className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${document.status === 'approved'
                                    ? 'bg-green-100 text-green-800'
                                    : document.status === 'rejected'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                    }`}
                            >
                                {document.status === 'approved'
                                    ? 'Disetujui'
                                    : document.status === 'rejected'
                                        ? 'Ditolak'
                                        : 'Menunggu'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Signers Status Card */}
                <div className="mb-6 rounded-lg bg-white p-6 shadow-md">
                    <div className="mb-4 flex items-center">
                        <User className="mr-3 h-6 w-6 text-purple-600" />
                        <h2 className="text-xl font-semibold text-gray-900">
                            Status Penandatangan
                        </h2>
                    </div>

                    <div className="space-y-4">
                        {signers && signers.length > 0 ? (
                            signers.map((signer) => (
                                <div
                                    key={signer.user_id}
                                    className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
                                >
                                    <div className="flex items-center">
                                        <div
                                            className={`mr-3 flex h-8 w-8 items-center justify-center rounded-full ${signer.is_signed
                                                ? 'bg-green-100 text-green-600'
                                                : 'bg-gray-100 text-gray-500'
                                                }`}
                                        >
                                            <User className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">
                                                {signer.name}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                Penandatangan Ke-{signer.sign_order}
                                            </p>
                                        </div>
                                    </div>
                                    <div>
                                        {signer.is_signed ? (
                                            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                                                <CheckCircle className="mr-1 h-3 w-3" />
                                                Sudah TTD
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                                                <XCircle className="mr-1 h-3 w-3" />
                                                Belum TTD
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500">
                                Tidak ada data penandatangan.
                            </p>
                        )}
                    </div>
                </div>

                {/* Signatures Card */}
                {signatures.length > 0 && (
                    <div className="mb-6 rounded-lg bg-white p-6 shadow-md">
                        <div className="mb-4 flex items-center">
                            <Shield className="mr-3 h-6 w-6 text-green-600" />
                            <h2 className="text-xl font-semibold text-gray-900">
                                Tanda Tangan
                            </h2>
                        </div>

                        <div className="space-y-4">
                            {signatures.map((signature, index) => (
                                <div
                                    key={signature.id}
                                    className="rounded-lg border border-gray-200 p-4"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center">
                                            <div
                                                className={`mr-3 h-3 w-3 rounded-full ${signature.type ===
                                                    'physical'
                                                    ? 'bg-blue-500'
                                                    : 'bg-green-500'
                                                    }`}
                                            ></div>
                                            <div>
                                                <p className="font-medium text-gray-900">
                                                    {signature.user_name}
                                                </p>
                                                <p className="text-sm text-gray-500">
                                                    {signature.type ===
                                                        'physical'
                                                        ? 'Tanda Tangan Fisik'
                                                        : 'Tanda Tangan Digital'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <p className="text-sm text-gray-500">
                                                {new Date(
                                                    signature.signed_at,
                                                ).toLocaleDateString('id-ID', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                Halaman{' '}
                                                {signature.position.page}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Verification Info */}
                <div className="rounded-lg bg-white p-6 shadow-md">
                    <div className="mb-4 flex items-center">
                        <Calendar className="mr-3 h-6 w-6 text-gray-600" />
                        <h2 className="text-xl font-semibold text-gray-900">
                            Informasi Verifikasi
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <label className="text-sm font-medium text-gray-500">
                                Status Verifikasi
                            </label>
                            <p
                                className={`text-lg font-medium ${isVerified
                                    ? 'text-green-600'
                                    : 'text-red-600'
                                    }`}
                            >
                                {isVerified
                                    ? '✓ Terverifikasi'
                                    : '✗ Tidak Terverifikasi'}
                            </p>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-500">
                                Waktu Verifikasi
                            </label>
                            <p className="text-lg text-gray-900">
                                {new Date(verified_at).toLocaleDateString(
                                    'id-ID',
                                    {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit',
                                    },
                                )}
                            </p>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-500">
                                Jumlah Tanda Tangan
                            </label>
                            <p className="text-lg text-gray-900">
                                {signatures.length}
                            </p>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-500">
                                ID Dokumen
                            </label>
                            <p className="font-mono text-sm text-gray-600">
                                {document.id}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-8 text-center">
                    <p className="text-sm text-gray-500">
                        Dokumen ini diverifikasi menggunakan sistem tanda tangan
                        digital yang aman
                    </p>
                </div>
            </div>
        </div>
    );
}

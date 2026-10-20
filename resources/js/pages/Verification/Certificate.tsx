import { Head } from '@inertiajs/react';

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
    verification_status: 'valid' | 'tampered' | 'file_missing' | 'unknown';
    verified_at: string;
    content_hash: string | null;
}

interface VerificationProps {
    certificate: Certificate | null;
    success: boolean;
    message?: string;
}

function Field({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
    return (
        <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
            <p className={`text-sm ${color ?? 'text-gray-900'}`}>{value}</p>
        </div>
    );
}

export default function VerificationCertificate({
    certificate,
    success,
    message,
}: VerificationProps) {
    const isTampered = certificate?.verification_status === 'tampered';
    const isVerified = success && certificate !== null && !isTampered;

    const statusLabel = isTampered
        ? 'Sertifikat telah diubah'
        : isVerified
          ? 'Sertifikat terverifikasi'
          : 'Sertifikat tidak ditemukan';

    const statusColor = isTampered ? 'text-red-600' : isVerified ? 'text-green-600' : 'text-gray-500';

    return (
        <div className="min-h-screen bg-white">
            <Head title={`Verifikasi Sertifikat - ${certificate?.certificate_number || 'Tidak Ditemukan'}`} />

            <div className="mx-auto max-w-2xl px-6 py-10">
                {/* Header */}
                <div className="mb-6">
                    <p className={`text-sm font-medium ${statusColor}`}>{statusLabel}</p>
                    <h1 className="mt-0.5 text-xl font-semibold text-gray-900">
                        {certificate?.certificate_number ?? 'Sertifikat tidak ditemukan'}
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        {message ??
                            (isVerified
                                ? 'Sertifikat ini valid dan dapat dipercaya.'
                                : 'Sertifikat tidak ditemukan atau tidak valid.')}
                    </p>
                    {isTampered && (
                        <p className="mt-3 border-l-2 border-red-500 pl-3 text-xs text-gray-600">
                            File PDF sertifikat di server tidak cocok dengan hash saat
                            diterbitkan — isi sertifikat kemungkinan telah dimodifikasi.
                        </p>
                    )}
                </div>

                {certificate && (
                    <>
                        {/* Info gabungan: sertifikat + verifikasi */}
                        <div className="grid grid-cols-3 gap-x-4 gap-y-4 border-t border-gray-200 py-5">
                            <Field label="Template" value={certificate.template_title} />
                            <Field label="Diterbitkan" value={certificate.issued_at} />
                            <Field
                                label="Status Verifikasi"
                                value={
                                    certificate.verification_status === 'valid'
                                        ? 'Valid'
                                        : certificate.verification_status === 'tampered'
                                          ? 'Telah diubah'
                                          : certificate.verification_status === 'file_missing'
                                            ? 'File tidak ditemukan'
                                            : 'Tidak diketahui'
                                }
                                color={
                                    certificate.verification_status === 'valid'
                                        ? 'text-green-600'
                                        : certificate.verification_status === 'tampered'
                                          ? 'text-red-600'
                                          : 'text-yellow-600'
                                }
                            />

                            <Field label="Waktu Verifikasi" value={certificate.verified_at} />
                            <Field
                                label="ID Sertifikat"
                                value={<span className="font-mono text-xs">{certificate.certificate_id}</span>}
                            />
                            {certificate.content_hash && (
                                <div className="col-span-3">
                                    <p className="text-[11px] uppercase tracking-wide text-gray-400">
                                        Hash Integritas (SHA-256)
                                    </p>
                                    <p className="break-all font-mono text-xs text-gray-600">
                                        {certificate.content_hash}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Recipients - baris kompak */}
                        {certificate.recipients && certificate.recipients.length > 0 && (
                            <div className="border-t border-gray-200 py-5">
                                <p className="mb-2 text-[11px] uppercase tracking-wide text-gray-400">
                                    Penerima
                                </p>
                                <div className="space-y-1.5">
                                    {certificate.recipients.map((recipient, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center justify-between text-sm"
                                        >
                                            <span className="text-gray-900">
                                                {recipient.name}
                                                <span className="ml-1.5 text-xs text-gray-400">
                                                    {recipient.email}
                                                </span>
                                            </span>
                                            {recipient.issued_at && (
                                                <span className="text-xs text-gray-400">
                                                    {recipient.issued_at}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                <p className="border-t border-gray-200 pt-4 text-center text-xs text-gray-400">
                    Diverifikasi menggunakan sistem verifikasi digital SISIGN.
                </p>
            </div>
        </div>
    );
}
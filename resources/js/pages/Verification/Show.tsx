import { Head } from '@inertiajs/react';

interface Signature {
    id: string;
    type: 'physical' | 'digital';
    user_name: string;
    signed_at: string;
    position: { x: number; y: number; width: number; height: number; page: number };
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
    verification_status: 'signed' | 'unsigned' | 'tampered';
    integrity_status?: 'valid' | 'tampered' | 'file_missing' | 'unknown';
    verified_at: string;
    success: boolean;
    message?: string;
}

function formatDate(value: string, withTime = true) {
    return new Date(value).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    });
}

function Field({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
    return (
        <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
            <p className={`text-sm ${color ?? 'text-gray-900'}`}>{value}</p>
        </div>
    );
}

export default function VerificationShow({
    document,
    signatures,
    signers,
    verification_status,
    integrity_status,
    verified_at,
    success,
    message,
}: VerificationProps) {
    const isTampered = verification_status === 'tampered';
    const isVerified = verification_status === 'signed' && success;

    const statusLabel = isTampered
        ? 'Dokumen telah diubah'
        : isVerified
          ? 'Dokumen terverifikasi'
          : 'Dokumen tidak terverifikasi';

    const statusColor = isTampered ? 'text-red-600' : isVerified ? 'text-green-600' : 'text-gray-500';

    return (
        <div className="min-h-screen bg-white">
            <Head title={`Verifikasi Dokumen - ${document.title}`} />

            <div className="mx-auto max-w-2xl px-6 py-10">
                {/* Header */}
                <div className="mb-6">
                    <p className={`text-sm font-medium ${statusColor}`}>{statusLabel}</p>
                    <h1 className="mt-0.5 text-xl font-semibold text-gray-900">{document.title}</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        {message ??
                            (isVerified
                                ? 'Dokumen ini telah ditandatangani secara resmi dan dapat dipercaya.'
                                : 'Dokumen ini belum ditandatangani atau tidak valid.')}
                    </p>
                    {isTampered && (
                        <p className="mt-3 border-l-2 border-red-500 pl-3 text-xs text-gray-600">
                            File PDF di server tidak cocok dengan hash saat penandatanganan —
                            isi dokumen kemungkinan telah dimodifikasi.
                        </p>
                    )}
                </div>

                {/* Info gabungan: dokumen + verifikasi, 3 kolom */}
                <div className="grid grid-cols-3 gap-x-4 gap-y-4 border-t border-gray-200 py-5">
                    <Field label="Nomor Dokumen" value={document.number} />
                    <Field
                        label="Status"
                        value={
                            document.status === 'approved'
                                ? 'Disetujui'
                                : document.status === 'rejected'
                                  ? 'Ditolak'
                                  : 'Menunggu'
                        }
                    />
                    <Field label="Dibuat" value={formatDate(document.created_at, false)} />

                    <Field
                        label="Verifikasi"
                        value={isVerified ? 'Terverifikasi' : 'Tidak terverifikasi'}
                        color={isVerified ? 'text-green-600' : 'text-red-600'}
                    />
                    <Field label="Jml. Tanda Tangan" value={signatures.length} />
                    <Field label="Waktu Verifikasi" value={formatDate(verified_at)} />

                    {integrity_status && integrity_status !== 'unknown' && (
                        <Field
                            label="Integritas File"
                            value={
                                integrity_status === 'valid'
                                    ? 'Hash cocok'
                                    : integrity_status === 'tampered'
                                      ? 'File diubah'
                                      : 'File tidak ditemukan'
                            }
                            color={integrity_status === 'valid' ? 'text-green-600' : 'text-red-600'}
                        />
                    )}
                    <Field label="ID Dokumen" value={<span className="font-mono text-xs">{document.id}</span>} />
                </div>

                {/* Signers - baris kompak, bukan kartu */}
                <div className="border-t border-gray-200 py-5">
                    <p className="mb-2 text-[11px] uppercase tracking-wide text-gray-400">
                        Penandatangan
                    </p>
                    {signers && signers.length > 0 ? (
                        <div className="space-y-1.5">
                            {signers.map((signer) => (
                                <div
                                    key={signer.user_id}
                                    className="flex items-center justify-between text-sm"
                                >
                                    <span className="text-gray-900">
                                        {signer.sign_order}. {signer.name}
                                    </span>
                                    <span
                                        className={
                                            signer.is_signed ? 'text-green-600' : 'text-gray-400'
                                        }
                                    >
                                        {signer.is_signed ? 'Sudah TTD' : 'Belum TTD'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400">Tidak ada data penandatangan.</p>
                    )}
                </div>

                {/* Signatures - baris kompak */}
                {signatures.length > 0 && (
                    <div className="border-t border-gray-200 py-5">
                        <p className="mb-2 text-[11px] uppercase tracking-wide text-gray-400">
                            Riwayat Tanda Tangan
                        </p>
                        <div className="space-y-1.5">
                            {signatures.map((signature) => (
                                <div
                                    key={signature.id}
                                    className="flex items-center justify-between text-sm"
                                >
                                    <span className="text-gray-900">
                                        {signature.user_name}
                                        <span className="ml-1.5 text-xs text-gray-400">
                                            ({signature.type === 'physical' ? 'fisik' : 'digital'}, hal. {signature.position.page})
                                        </span>
                                    </span>
                                    <span className="text-xs text-gray-400">
                                        {formatDate(signature.signed_at)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <p className="border-t border-gray-200 pt-4 text-center text-xs text-gray-400">
                    Diverifikasi menggunakan sistem tanda tangan digital SISIGN.
                </p>
            </div>
        </div>
    );
}
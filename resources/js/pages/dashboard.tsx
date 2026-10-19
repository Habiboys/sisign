import AppLayout from '@/layouts/app-layout';
import { index as certificatesIndex } from '@/routes/certificates';
import { create as bulkCreate } from '@/routes/certificates/bulk';
import { index as templatesIndex } from '@/routes/templates';
import { Head, Link } from '@inertiajs/react';
import { Award, FileCheck, Mail, Plus } from 'lucide-react';

interface DashboardProps {
    user: { name: string; role: string };
    stats: { total_templates: number; total_certificates: number };
}

export default function Dashboard({ user, stats }: DashboardProps) {
    const canManageCertificates = user.role !== 'pengaju';

    return (
        <AppLayout>
            <Head title="DTI Sertifikat" />
            <div className="flex flex-1 flex-col gap-6 rounded-xl p-6">
                <div>
                    <h1 className="text-2xl font-bold">DTI Sertifikat</h1>
                    <p className="text-muted-foreground">
                        Selamat datang, {user.name}. Cetak dan kirim sertifikat
                        massal dalam satu tempat.
                    </p>
                </div>
                {canManageCertificates ? (
                    <>
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="rounded-xl border bg-card p-6 text-card-foreground">
                                <FileCheck className="mb-3 size-6" />
                                <p>Template Sertifikat</p>
                                <p className="text-3xl font-bold">
                                    {stats.total_templates}
                                </p>
                            </div>
                            <div className="rounded-xl border bg-card p-6 text-card-foreground">
                                <Award className="mb-3 size-6" />
                                <p>Total Sertifikat</p>
                                <p className="text-3xl font-bold">
                                    {stats.total_certificates}
                                </p>
                            </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-3">
                            <Link
                                href={templatesIndex()}
                                className="rounded-xl border p-6 hover:bg-accent"
                            >
                                <FileCheck className="mb-3 size-6" />
                                <h2 className="font-semibold">
                                    Template Sertifikat
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    Siapkan desain dan posisi data sertifikat.
                                </p>
                            </Link>
                            <Link
                                href={bulkCreate()}
                                className="rounded-xl border p-6 hover:bg-accent"
                            >
                                <Plus className="mb-3 size-6" />
                                <h2 className="font-semibold">
                                    Cetak Sertifikat Massal
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    Buat sertifikat dari data Excel.
                                </p>
                            </Link>
                            <Link
                                href={certificatesIndex()}
                                className="rounded-xl border p-6 hover:bg-accent"
                            >
                                <Mail className="mb-3 size-6" />
                                <h2 className="font-semibold">
                                    Sertifikat dan Kirim Massal
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    Unduh sertifikat dan kirim ke email
                                    penerima.
                                </p>
                            </Link>
                        </div>
                    </>
                ) : (
                    <p className="rounded-xl border p-6 text-muted-foreground">
                        Hubungi administrator untuk mendapatkan akses
                        pengelolaan sertifikat.
                    </p>
                )}
            </div>
        </AppLayout>
    );
}

import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { routes } from '@/utils/routes';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Download, Mail } from 'lucide-react';

interface CertificateRecipient {
    id: string;
    issuedAt: string;
    user: {
        id: string;
        name: string;
        email: string;
    };
}

interface Sertifikat {
    id: string;
    nomor_sertif: string;
    email?: string;
    created_at: string;
    file_path?: string;
    templateSertif: {
        id: string;
        title: string;
    } | null;
    certificateRecipients: CertificateRecipient[] | null;
}

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
}

interface Props {
    sertifikat: Sertifikat;
    user: User;
}

export default function CertificatesShow({ sertifikat, user }: Props) {
    // Debug logging
    console.log('CertificatesShow - sertifikat data:', sertifikat);
    console.log('CertificatesShow - file_path:', sertifikat.file_path);
    console.log('CertificatesShow - templateSertif:', sertifikat.templateSertif);
    console.log('CertificatesShow - created_at:', sertifikat.created_at);
    console.log('CertificatesShow - email:', sertifikat.email);

    return (
        <AppLayout>
            <Head title={`Sertifikat ${sertifikat.nomor_sertif || 'Detail'}`} />
            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <Link href={routes.certificates.index()}>
                            <Button variant="outline" size="sm">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Kembali
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">
                                Sertifikat {sertifikat.nomor_sertif}
                            </h1>
                            <p className="text-gray-600">
                                Detail sertifikat
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Informasi Sertifikat</CardTitle>
                            <CardDescription>
                                Detail informasi sertifikat
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-500">
                                        Nomor Sertifikat
                                    </label>
                                    <p className="text-lg font-semibold">
                                        {sertifikat.nomor_sertif}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-500">
                                        Template
                                    </label>
                                    <p className="text-lg font-semibold">
                                        {sertifikat.templateSertif?.title || 'Template tidak ditemukan'}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-500">
                                        Tanggal Dibuat
                                    </label>
                                    <p className="text-lg font-semibold">
                                        {sertifikat.created_at ? new Date(sertifikat.created_at).toLocaleDateString('id-ID') : 'Tanggal tidak tersedia'}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-500">
                                        Email Penerima
                                    </label>
                                    <p className="text-lg font-semibold">
                                        {sertifikat.email ? (
                                            <span className="flex items-center">
                                                <Mail className="mr-2 h-4 w-4 text-gray-500" />
                                                {sertifikat.email}
                                            </span>
                                        ) : (
                                            <span className="text-gray-400">-</span>
                                        )}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-500">
                                        File Sertifikat
                                    </label>
                                    <div className="text-lg font-semibold">
                                        {sertifikat.file_path ? (
                                            <div className="flex space-x-2">
                                                <Button variant="outline" size="sm" asChild>
                                                    <a href={routes.certificates.view(sertifikat.id)} target="_blank" rel="noopener noreferrer">
                                                        <Download className="mr-2 h-4 w-4" />
                                                        Preview PDF
                                                    </a>
                                                </Button>
                                                <Button variant="outline" size="sm" asChild>
                                                    <a href={routes.certificates.download(sertifikat.id)}>
                                                        <Download className="mr-2 h-4 w-4" />
                                                        Download PDF
                                                    </a>
                                                </Button>
                                            </div>
                                        ) : (
                                            <span className="text-gray-500">File belum tersedia</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {sertifikat.file_path && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Preview Sertifikat</CardTitle>
                                <CardDescription>
                                    Preview PDF sertifikat hasil bulk generation
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="w-full border rounded-lg overflow-hidden" style={{ height: '800px' }}>
                                    <iframe
                                        src={routes.certificates.view(sertifikat.id)}
                                        className="w-full h-full"
                                        title="Preview Sertifikat PDF"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {sertifikat.certificateRecipients && sertifikat.certificateRecipients.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Daftar Penerima</CardTitle>
                                <CardDescription>
                                    Penerima sertifikat ini
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {sertifikat.certificateRecipients.map((recipient) => (
                                        <div key={recipient.id} className="flex items-center justify-between p-4 border rounded-lg">
                                            <div>
                                                <p className="font-semibold">{recipient.user.name}</p>
                                                <p className="text-sm text-gray-500">{recipient.user.email}</p>
                                                <p className="text-xs text-gray-400">
                                                    Diterbitkan: {new Date(recipient.issuedAt).toLocaleDateString('id-ID')}
                                                </p>
                                            </div>
                                            <div className="flex space-x-2">
                                                <Button variant="outline" size="sm">
                                                    <Mail className="mr-2 h-4 w-4" />
                                                    Kirim Email
                                                </Button>
                                                <Button variant="outline" size="sm">
                                                    <Download className="mr-2 h-4 w-4" />
                                                    Download
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

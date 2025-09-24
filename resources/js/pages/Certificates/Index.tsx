import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { routes } from '@/utils/routes';
import { Head, Link, router } from '@inertiajs/react';
import { Award, Eye, Plus, Trash2, Users } from 'lucide-react';
import { useState } from 'react';

interface User {
    id: string;
    name: string;
    email: string;
}

interface CertificateRecipient {
    id: string;
    issuedAt: string;
    user: User;
}

interface Sertifikat {
    id: string;
    nomor_sertif: string;
    created_at: string;
    templateSertif: {
        id: string;
        title: string;
    };
    certificateRecipients: CertificateRecipient[];
}

interface Props {
    sertifikats: {
        data: Sertifikat[];
        links: any[];
        meta: any;
    };
    user: User;
}

export default function CertificatesIndex({ sertifikats, user }: Props) {
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleDelete = (id: string) => {
        router.delete(routes.certificates.destroy(id), {
            onStart: () => setDeletingId(id),
            onFinish: () => setDeletingId(null),
        });
    };

    return (
        <AppLayout>
            <Head title="Sertifikat" />
            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            Sertifikat
                        </h1>
                        <p className="text-gray-600">
                            Kelola sertifikat yang telah dibuat
                        </p>
                    </div>
                    <div className="flex space-x-2">
                        <Link href={routes.certificates.create()}>
                            <Button className="bg-green-600 hover:bg-green-700">
                                <Plus className="mr-2 h-4 w-4" />
                                Buat Sertifikat
                            </Button>
                        </Link>
                        <Link href={routes.certificates.bulk.create()}>
                            <Button variant="outline">
                                <Award className="mr-2 h-4 w-4" />
                                Bulk Generate
                            </Button>
                        </Link>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <Award className="mr-2 h-5 w-5" />
                            Daftar Sertifikat
                        </CardTitle>
                        <CardDescription>
                            Sertifikat yang telah dibuat dalam sistem
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nomor Sertifikat</TableHead>
                                    <TableHead>Template</TableHead>
                                    <TableHead>Penerima</TableHead>
                                    <TableHead>Tanggal Dibuat</TableHead>
                                    <TableHead>Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sertifikats.data.map((sertifikat) => (
                                    <TableRow key={sertifikat.id}>
                                        <TableCell className="font-medium">
                                            {sertifikat.nomor_sertif}
                                        </TableCell>
                                        <TableCell>
                                            {sertifikat.templateSertif.title}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center">
                                                <Users className="mr-2 h-4 w-4" />
                                                <span>
                                                    {
                                                        sertifikat
                                                            .certificateRecipients
                                                            .length
                                                    }{' '}
                                                    penerima
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {new Date(
                                                sertifikat.created_at,
                                            ).toLocaleDateString('id-ID')}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex space-x-2">
                                                <Link
                                                    href={routes.certificates.show(
                                                        sertifikat.id,
                                                    )}
                                                >
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                </Link>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="text-red-600 hover:text-red-700"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>
                                                                Hapus Sertifikat
                                                            </AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Apakah Anda
                                                                yakin ingin
                                                                menghapus
                                                                sertifikat "
                                                                {
                                                                    sertifikat.nomor_sertif
                                                                }
                                                                "? Tindakan ini
                                                                tidak dapat
                                                                dibatalkan.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>
                                                                Batal
                                                            </AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={() =>
                                                                    handleDelete(
                                                                        sertifikat.id,
                                                                    )
                                                                }
                                                                className="bg-red-600 hover:bg-red-700"
                                                                disabled={
                                                                    deletingId ===
                                                                    sertifikat.id
                                                                }
                                                            >
                                                                {deletingId ===
                                                                sertifikat.id
                                                                    ? 'Menghapus...'
                                                                    : 'Hapus'}
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        {sertifikats.data.length === 0 && (
                            <div className="py-8 text-center text-gray-500">
                                Belum ada sertifikat
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}

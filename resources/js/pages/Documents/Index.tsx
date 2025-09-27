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
import { Badge } from '@/components/ui/badge';
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
import {
    CheckCircle,
    Clock,
    Eye,
    FileText,
    Plus,
    Trash2,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';

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
    disetujui?: string;
}

interface Signature {
    id: string;
    type: 'physical' | 'digital';
    signedAt: string;
    user: User;
}

interface Document {
    id: string;
    title: string;
    files: string;
    signed_file?: string;
    number: string;
    created_at: string;
    user: User;
    toUser: User;
    review: Review;
    signatures: Signature[];
}

interface Props {
    documents: {
        data: Document[];
        links: any[];
        meta: any;
    };
    user: User;
}

export default function DocumentsIndex({ documents, user }: Props) {
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Helper function to check if document is truly signed
    const isDocumentSigned = (document: Document) => {
        // Double check: must have signed_file AND signatures
        return (
            document.signed_file &&
            document.signatures &&
            document.signatures.length > 0
        );
    };

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
                        Menunggu
                    </Badge>
                );
        }
    };

    const handleDelete = (id: string) => {
        router.delete(routes.documents.destroy(id), {
            onStart: () => setDeletingId(id),
            onFinish: () => setDeletingId(null),
        });
    };

    return (
        <AppLayout>
            <Head title="Dokumen" />
            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            Dokumen
                        </h1>
                        <p className="text-gray-600">
                            Kelola dokumen dan pengajuan
                        </p>
                    </div>
                    {/* Pimpinan hanya bisa menandatangani, tidak bisa mengajukan dokumen */}
                    {user.role !== 'pimpinan' && (
                        <Link href={routes.documents.create()}>
                            <Button className="bg-green-600 hover:bg-green-700">
                                <Plus className="mr-2 h-4 w-4" />
                                Ajukan Dokumen
                            </Button>
                        </Link>
                    )}
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <FileText className="mr-2 h-5 w-5" />
                            Daftar Dokumen
                        </CardTitle>
                        <CardDescription>
                            {user.role === 'admin' &&
                                'Semua dokumen dalam sistem'}
                            {user.role === 'pimpinan' &&
                                'Dokumen yang ditujukan untuk Anda'}
                            {user.role === 'pengaju' &&
                                'Dokumen yang Anda ajukan'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>No. Dokumen</TableHead>
                                    <TableHead>Judul</TableHead>
                                    <TableHead>Pengaju</TableHead>
                                    <TableHead>Ditujukan</TableHead>
                                    <TableHead>Status Review</TableHead>
                                    <TableHead>Status TTD</TableHead>
                                    <TableHead>Tanggal</TableHead>
                                    <TableHead>Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {documents.data.map((document) => (
                                    <TableRow key={document.id}>
                                        <TableCell className="font-medium">
                                            {document.number}
                                        </TableCell>
                                        <TableCell>{document.title}</TableCell>
                                        <TableCell>
                                            {document.user.name}
                                        </TableCell>
                                        <TableCell>
                                            {document.toUser?.name ?? '-'}
                                        </TableCell>
                                        <TableCell>
                                            {getStatusBadge(
                                                document.review.status,
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    isDocumentSigned(document)
                                                        ? 'default'
                                                        : 'secondary'
                                                }
                                                className={
                                                    isDocumentSigned(document)
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-gray-100 text-gray-800'
                                                }
                                            >
                                                {isDocumentSigned(document)
                                                    ? 'Sudah TTD'
                                                    : 'Belum TTD'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {new Date(
                                                document.created_at,
                                            ).toLocaleDateString('id-ID')}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex space-x-2">
                                                <Link
                                                    href={routes.documents.show(
                                                        document.id,
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
                                                                Hapus Dokumen
                                                            </AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Apakah Anda
                                                                yakin ingin
                                                                menghapus
                                                                dokumen "
                                                                {document.title}
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
                                                                        document.id,
                                                                    )
                                                                }
                                                                className="bg-red-600 hover:bg-red-700"
                                                                disabled={
                                                                    deletingId ===
                                                                    document.id
                                                                }
                                                            >
                                                                {deletingId ===
                                                                document.id
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

                        {documents.data.length === 0 && (
                            <div className="py-8 text-center text-gray-500">
                                Belum ada dokumen
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}

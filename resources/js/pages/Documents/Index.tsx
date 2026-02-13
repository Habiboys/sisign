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
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
    Search,
    Trash2,
    X,
    XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';

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
    signers: {
        id: string;
        user_id: string;
        is_signed: boolean;
        sign_order: number;
    }[];
}

interface Props {
    documents: {
        data: Document[];
        links: any[];
        meta: any;
    };
    user: User;
    search?: string;
    review_status?: string;
    signed_status?: string;
}

export default function DocumentsIndex({ documents, user, search = '', review_status = 'all', signed_status = 'all' }: Props) {
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>(search);
    const [reviewStatus, setReviewStatus] = useState<string>(review_status);
    const [signedStatus, setSignedStatus] = useState<string>(signed_status);
    const [perPage, setPerPage] = useState<string>(String(documents.meta?.per_page || 10));

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery !== search) {
                router.get(
                    routes.documents.index(),
                    {
                        search: searchQuery || undefined,
                        per_page: perPage,
                        review_status: reviewStatus,
                        signed_status: signedStatus,
                    },
                    {
                        preserveState: true,
                        preserveScroll: true,
                        only: ['documents', 'search', 'review_status', 'signed_status']
                    }
                );
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Helper function to check if document is truly signed
    // Helper function to check if document has a signed file (at least one signature)
    const hasSignedFile = (document: Document) => {
        return (
            document.signed_file &&
            document.signatures &&
            document.signatures.length > 0
        );
    };

    // Helper function to check if document is fully signed by all required signers
    const isFullySigned = (document: Document) => {
        if (!document.signers || document.signers.length === 0) return false;
        return document.signers.every((signer) => signer.is_signed);
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
                        {/* Search and Filters */}
                        <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between items-end md:items-center">
                            <div className="flex flex-col md:flex-row gap-2 md:items-center w-full md:w-auto">
                                {/* Per Page */}
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-500 whitespace-nowrap">Show</span>
                                    <Select
                                        value={perPage}
                                        onValueChange={(value) => {
                                            setPerPage(value);
                                            router.get(
                                                routes.documents.index(),
                                                {
                                                    per_page: value,
                                                    search: searchQuery || undefined,
                                                    review_status: reviewStatus,
                                                    signed_status: signedStatus,
                                                },
                                                {
                                                    preserveState: true,
                                                    preserveScroll: false,
                                                }
                                            );
                                        }}
                                    >
                                        <SelectTrigger className="w-[70px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="10">10</SelectItem>
                                            <SelectItem value="25">25</SelectItem>
                                            <SelectItem value="50">50</SelectItem>
                                            <SelectItem value="all">All</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Review Status Filter */}
                                <Select
                                    value={reviewStatus}
                                    onValueChange={(value) => {
                                        setReviewStatus(value);
                                        router.get(
                                            routes.documents.index(),
                                            {
                                                review_status: value,
                                                signed_status: signedStatus,
                                                per_page: perPage,
                                                search: searchQuery || undefined,
                                            },
                                            {
                                                preserveState: true,
                                                preserveScroll: true,
                                            }
                                        );
                                    }}
                                >
                                    <SelectTrigger className="w-full md:w-[150px]">
                                        <SelectValue placeholder="Status Review" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua Review</SelectItem>
                                        <SelectItem value="pending">Menunggu</SelectItem>
                                        <SelectItem value="approved">Disetujui</SelectItem>
                                        <SelectItem value="rejected">Ditolak</SelectItem>
                                    </SelectContent>
                                </Select>

                                {/* Signed Status Filter */}
                                <Select
                                    value={signedStatus}
                                    onValueChange={(value) => {
                                        setSignedStatus(value);
                                        router.get(
                                            routes.documents.index(),
                                            {
                                                review_status: reviewStatus,
                                                signed_status: value,
                                                per_page: perPage,
                                                search: searchQuery || undefined,
                                            },
                                            {
                                                preserveState: true,
                                                preserveScroll: true,
                                            }
                                        );
                                    }}
                                >
                                    <SelectTrigger className="w-full md:w-[150px]">
                                        <SelectValue placeholder="Status TTD" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua TTD</SelectItem>
                                        <SelectItem value="signed">Sudah TTD</SelectItem>
                                        <SelectItem value="partial">Sebagian TTD</SelectItem>
                                        <SelectItem value="unsigned">Belum TTD</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Search */}
                            <div className="relative w-full md:w-72">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                <Input
                                    placeholder="Cari dokumen..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 pr-10"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>

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
                                                    isFullySigned(document)
                                                        ? 'default'
                                                        : hasSignedFile(document)
                                                            ? 'secondary'
                                                            : 'outline'
                                                }
                                                className={
                                                    isFullySigned(document)
                                                        ? 'bg-green-100 text-green-800'
                                                        : hasSignedFile(document)
                                                            ? 'bg-yellow-100 text-yellow-800'
                                                            : 'bg-gray-100 text-gray-800'
                                                }
                                            >
                                                {isFullySigned(document)
                                                    ? 'Sudah TTD'
                                                    : hasSignedFile(document)
                                                        ? 'Sebagian TTD'
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
                    {/* Pagination */}
                    <div className="p-4 pt-0">
                        <Pagination links={documents.links} meta={documents.meta} />
                    </div>
                </Card>
            </div>
        </AppLayout>
    );
}

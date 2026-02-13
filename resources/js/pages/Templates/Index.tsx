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
    FileCheck,
    Plus,
    Search,
    Trash2,
    X,
    XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface Review {
    id: string;
    status: 'pending' | 'approved' | 'rejected';
    komentar?: string;
    disetujui?: string;
}

interface Template {
    id: string;
    title: string;
    description?: string;
    files: string;
    signed_template_path?: string;
    created_at: string;
    review: Review;
}

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
}

interface Props {
    templates: {
        data: Template[];
        links: any[];
        meta: any;
    };
    user: User;
    search?: string;
    review_status?: string;
    signed_status?: string;
}

export default function TemplatesIndex({ templates, user, search = '', review_status = 'all', signed_status = 'all' }: Props) {
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>(search);
    const [reviewStatus, setReviewStatus] = useState<string>(review_status);
    const [signedStatus, setSignedStatus] = useState<string>(signed_status);
    const [perPage, setPerPage] = useState<string>(String(templates.meta?.per_page || 10));

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery !== search) {
                router.get(
                    routes.templates.index(),
                    {
                        search: searchQuery || undefined,
                        per_page: perPage,
                        review_status: reviewStatus,
                        signed_status: signedStatus,
                    },
                    {
                        preserveState: true,
                        preserveScroll: true,
                        only: ['templates', 'search', 'review_status', 'signed_status']
                    }
                );
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchQuery]);

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
        router.delete(routes.templates.destroy(id), {
            onStart: () => setDeletingId(id),
            onFinish: () => setDeletingId(null),
        });
    };

    return (
        <AppLayout>
            <Head title="Template Sertifikat" />
            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            Template Sertifikat
                        </h1>
                        <p className="text-gray-600">
                            Kelola template sertifikat
                        </p>
                    </div>
                    {/* Pengaju dan pimpinan tidak bisa membuat template */}
                    {user.role === 'admin' && (
                        <Link href={routes.templates.create()}>
                            <Button className="bg-green-600 hover:bg-green-700">
                                <Plus className="mr-2 h-4 w-4" />
                                Buat Template
                            </Button>
                        </Link>
                    )}
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <FileCheck className="mr-2 h-5 w-5" />
                            Daftar Template
                        </CardTitle>
                        <CardDescription>
                            Template sertifikat yang tersedia dalam sistem
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
                                                routes.templates.index(),
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
                                            routes.templates.index(),
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
                                            routes.templates.index(),
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
                                    placeholder="Cari template..."
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
                                    <TableHead>Judul Template</TableHead>
                                    <TableHead>Deskripsi</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Status Tanda Tangan</TableHead>
                                    <TableHead>Tanggal Dibuat</TableHead>
                                    <TableHead>Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {templates.data.map((template) => (
                                    <TableRow key={template.id}>
                                        <TableCell className="font-medium">
                                            {template.title}
                                        </TableCell>
                                        <TableCell>
                                            {template.description || '-'}
                                        </TableCell>
                                        <TableCell>
                                            {getStatusBadge(
                                                template.review.status,
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {template.signed_template_path ? (
                                                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                                    ✓ Sudah Ditandatangani
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                                                    ✗ Belum Ditandatangani
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {new Date(
                                                template.created_at,
                                            ).toLocaleDateString('id-ID')}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex space-x-2">
                                                <Link
                                                    href={routes.templates.show(
                                                        template.id,
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
                                                                Hapus Template
                                                            </AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Apakah Anda
                                                                yakin ingin
                                                                menghapus
                                                                template "
                                                                {template.title}
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
                                                                        template.id,
                                                                    )
                                                                }
                                                                className="bg-red-600 hover:bg-red-700"
                                                                disabled={
                                                                    deletingId ===
                                                                    template.id
                                                                }
                                                            >
                                                                {deletingId ===
                                                                    template.id
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

                        {templates.data.length === 0 && (
                            <div className="py-8 text-center text-gray-500">
                                Belum ada template
                            </div>
                        )}
                    </CardContent>
                    {/* Pagination */}
                    <div className="p-4 pt-0">
                        <Pagination links={templates.links} meta={templates.meta} />
                    </div>
                </Card>
            </div>
        </AppLayout>
    );
}

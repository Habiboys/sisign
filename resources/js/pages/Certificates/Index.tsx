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
import { Checkbox } from '@/components/ui/checkbox';
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
import { useToast } from '@/hooks/use-toast';
import AppLayout from '@/layouts/app-layout';
import { routes } from '@/utils/routes';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Award, CheckCircle2, Clock, Eye, Mail, Search, Trash2, X, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
}

interface CertificateRecipient {
    id: string;
    issuedAt: string;
    user: User;
}

interface Sertifikat {
    id: string;
    nomor_sertif: string;
    email?: string;
    created_at: string;
    file_path?: string;
    email_sent_at?: string | null;
    email_sent_status?: 'pending' | 'sent' | 'failed';
    email_sent_error?: string | null;
    templateSertif: {
        id: string;
        title: string;
    } | null;
    certificateRecipients: CertificateRecipient[] | null;
}

interface Props {
    sertifikats: {
        data: Sertifikat[];
        links: any[];
        meta: any;
    };
    user: User;
    search?: string;
}

export default function CertificatesIndex({ sertifikats, user, search = '' }: Props) {
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [selectAllMode, setSelectAllMode] = useState<boolean>(false); // Select all across pages
    const [sendingEmails, setSendingEmails] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>(search);
    const [perPage, setPerPage] = useState<string>(String(sertifikats.meta?.per_page || 15));
    const [emailStatus, setEmailStatus] = useState<string>('all');
    const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
    const [mathNum1, setMathNum1] = useState(0);
    const [mathNum2, setMathNum2] = useState(0);
    const [mathAnswer, setMathAnswer] = useState('');
    const { success, error } = useToast();
    const { flash } = usePage().props as any;

    // Handle flash messages dari backend
    useEffect(() => {
        if (flash?.success) {
            success(flash.success);
        }
        if (flash?.error) {
            error(flash.error);
        }
    }, [flash, success, error]);

    // Debounced search - wait 500ms after user stops typing
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery !== search) {
                router.get(
                    routes.certificates.index(),
                    { search: searchQuery || undefined },
                    {
                        preserveState: true,
                        preserveScroll: true,
                        only: ['sertifikats', 'search']
                    }
                );
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Get unique templates for filter
    const templates = Array.from(
        new Map(
            sertifikats.data
                .filter(s => s.templateSertif)
                .map(s => [s.templateSertif!.id, s.templateSertif!])
        ).values()
    );

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            // Select all on current page only
            const filteredIds = selectedTemplateId && selectedTemplateId !== 'all'
                ? sertifikats.data
                    .filter(s => s.templateSertif?.id === selectedTemplateId)
                    .map(s => s.id)
                : sertifikats.data.map(s => s.id);
            setSelectedIds(new Set(filteredIds));
            setSelectAllMode(false); // Reset select all mode
        } else {
            setSelectedIds(new Set());
            setSelectAllMode(false); // Reset select all mode
        }
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        const newSelected = new Set(selectedIds);
        if (checked) {
            newSelected.add(id);
        } else {
            newSelected.delete(id);
        }
        setSelectedIds(newSelected);
    };

    const handleSendEmails = () => {
        if (!selectAllMode && selectedIds.size === 0) {
            error('Pilih minimal 1 sertifikat untuk dikirim');
            return;
        }

        setSendingEmails(true);

        const payload = selectAllMode
            ? {
                // Select all mode: send filter params
                select_all: true,
                template_id: selectedTemplateId && selectedTemplateId !== 'all' ? selectedTemplateId : undefined,
                search: searchQuery || undefined
            }
            : {
                // Normal mode: send specific IDs
                sertifikat_ids: Array.from(selectedIds),
            };

        router.post(routes.certificates.sendEmails(), payload, {
            onSuccess: () => {
                setSelectedIds(new Set());
                setSelectAllMode(false);
                setSendingEmails(false);
            },
            onError: () => {
                setSendingEmails(false);
            },
        });
    };

    const handleDelete = (id: string, nomorSertif: string) => {
        router.delete(routes.certificates.destroy(id), {
            onStart: () => setDeletingId(id),
            onFinish: () => setDeletingId(null),
            onSuccess: () => {
                success(`Sertifikat ${nomorSertif} berhasil dihapus`);
                // Remove from selection if selected
                if (selectedIds.has(id)) {
                    const newSelected = new Set(selectedIds);
                    newSelected.delete(id);
                    setSelectedIds(newSelected);
                }
            },
            onError: (errors) => {
                const errorMessage = errors?.message || 'Gagal menghapus sertifikat';
                error(errorMessage);
            },
        });
    };

    const getEmailStatusIcon = (status?: string) => {
        switch (status) {
            case 'sent':
                return <CheckCircle2 className="h-4 w-4 text-green-600" />;
            case 'failed':
                return <XCircle className="h-4 w-4 text-red-600" />;
            case 'pending':
                return <Clock className="h-4 w-4 text-yellow-600" />;
            default:
                return null;
        }
    };

    const getEmailStatusText = (status?: string) => {
        switch (status) {
            case 'sent':
                return 'Terkirim';
            case 'failed':
                return 'Gagal';
            case 'pending':
                return 'Pending';
            default:
                return 'Belum dikirim';
        }
    };

    const filteredSertifikats = selectedTemplateId && selectedTemplateId !== 'all'
        ? sertifikats.data.filter(s => s.templateSertif?.id === selectedTemplateId)
        : sertifikats.data;

    const allSelected = filteredSertifikats.length > 0 &&
        filteredSertifikats.every(s => selectedIds.has(s.id));
    const someSelected = filteredSertifikats.some(s => selectedIds.has(s.id));

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
                    {/* Hanya admin yang bisa membuat sertifikat */}
                    {user.role === 'admin' && (
                        <div className="flex space-x-2">
                            <Link href={routes.certificates.bulk.create()}>
                                <Button className="bg-green-600 hover:bg-green-700">
                                    <Award className="mr-2 h-4 w-4" />
                                    Bulk Generate Sertifikat
                                </Button>
                            </Link>
                        </div>
                    )}
                </div>

                {/*  Filters & Actions Card - Consolidated */}
                {user.role === 'admin' && (
                    <Card>
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg">Filters & Actions</CardTitle>
                            <CardDescription>Search, filter, and manage certificates</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Row 1: Search, Email Status, Template Filter */}
                            <div className="flex gap-3 flex-wrap">
                                {/* Search Input */}
                                <div className="relative flex-1 min-w-[250px]">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                    <Input
                                        type="text"
                                        placeholder="Cari nomor, email, atau template..."
                                        value={searchQuery}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                                        className="pl-10 pr-10"
                                    />
                                    {searchQuery && (
                                        <button
                                            onClick={() => setSearchQuery('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                            type="button"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>

                                {/* Email Status Filter */}
                                <Select
                                    value={emailStatus}
                                    onValueChange={(value) => {
                                        setEmailStatus(value);
                                        router.get(
                                            routes.certificates.index(),
                                            {
                                                email_status: value === 'all' ? undefined : value,
                                                template_id: selectedTemplateId && selectedTemplateId !== 'all' ? selectedTemplateId : undefined,
                                                search: searchQuery || undefined,
                                                per_page: perPage || undefined,
                                            },
                                            {
                                                preserveState: true,
                                                preserveScroll: true,
                                            }
                                        );
                                    }}
                                >
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua Status</SelectItem>
                                        <SelectItem value="sent">Terkirim</SelectItem>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="failed">Gagal</SelectItem>
                                        <SelectItem value="unsent">Belum Dikirim</SelectItem>
                                    </SelectContent>
                                </Select>

                                {/* Template Filter */}
                                {templates.length > 0 && (
                                    <Select
                                        value={selectedTemplateId}
                                        onValueChange={(value) => {
                                            setSelectedTemplateId(value);
                                            setSelectedIds(new Set()); // Reset selection when filter changes
                                            router.get(
                                                routes.certificates.index(),
                                                {
                                                    template_id: value && value !== 'all' ? value : undefined,
                                                    email_status: emailStatus === 'all' ? undefined : emailStatus,
                                                    search: searchQuery || undefined,
                                                    per_page: perPage || undefined,
                                                },
                                                {
                                                    preserveState: true,
                                                    preserveScroll: true,
                                                }
                                            );
                                        }}
                                    >
                                        <SelectTrigger className="w-[200px]">
                                            <SelectValue placeholder="Semua Template" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Semua Template</SelectItem>
                                            {templates.map((template) => (
                                                <SelectItem key={template.id} value={template.id}>
                                                    {template.title}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>

                            {/* Row 2: Select All, Selected Count, Action Buttons */}
                            <div className="flex items-center gap-4 flex-wrap">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="select-all"
                                        checked={allSelected}
                                        onCheckedChange={handleSelectAll}
                                    />
                                    <label
                                        htmlFor="select-all"
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    >
                                        Pilih Semua
                                    </label>
                                </div>

                                <span className="text-sm text-gray-600">
                                    {selectedIds.size} dipilih
                                </span>

                                <div className="ml-auto flex items-center gap-2">
                                    <Button
                                        onClick={handleSendEmails}
                                        disabled={selectedIds.size === 0 || sendingEmails}
                                        className="bg-blue-600 hover:bg-blue-700"
                                        size="sm"
                                    >
                                        <Mail className="mr-2 h-4 w-4" />
                                        {sendingEmails ? 'Memproses...' : `Kirim Email (${selectedIds.size})`}
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            // Generate random numbers for math challenge
                                            const num1 = Math.floor(Math.random() * 10) + 1;
                                            const num2 = Math.floor(Math.random() * 10) + 1;
                                            setMathNum1(num1);
                                            setMathNum2(num2);
                                            setMathAnswer('');
                                            setShowBulkDeleteModal(true);
                                        }}
                                        disabled={selectedIds.size === 0}
                                        variant="outline"
                                        size="sm"
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300"
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Hapus ({selectedIds.size})
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Select All Banner - appears when all items on page are selected */}
                {!selectAllMode && selectedIds.size > 0 && selectedIds.size === sertifikats.data.length && sertifikats.meta && sertifikats.meta.total > sertifikats.data.length && (
                    <Card className="bg-blue-50 border-blue-200">
                        <CardContent className="py-3">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-blue-900">
                                    All <strong>{sertifikats.data.length}</strong> certificates on this page are selected.
                                </p>
                                <Button
                                    variant="link"
                                    size="sm"
                                    onClick={() => setSelectAllMode(true)}
                                    className="text-blue-700 hover:text-blue-900 font-semibold"
                                >
                                    Select all {sertifikats.meta?.total || 0} certificates{selectedTemplateId || searchQuery ? ' matching filter' : ''}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Select All Mode Active Banner */}
                {selectAllMode && (
                    <Card className="bg-blue-100 border-blue-300">
                        <CardContent className="py-3">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-blue-900 font-medium">
                                    All <strong>{sertifikats.meta?.total || 0}</strong> certificates{selectedTemplateId || searchQuery ? ' matching filter' : ''} are selected.
                                </p>
                                <Button
                                    variant="link"
                                    size="sm"
                                    onClick={() => {
                                        setSelectAllMode(false);
                                        setSelectedIds(new Set());
                                    }}
                                    className="text-blue-700 hover:text-blue-900 font-semibold"
                                >
                                    Clear selection
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Bulk Delete Confirmation Modal with Math Challenge */}
                <AlertDialog open={showBulkDeleteModal} onOpenChange={setShowBulkDeleteModal}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Konfirmasi Hapus {selectAllMode ? sertifikats.meta?.total || 0 : selectedIds.size} Sertifikat</AlertDialogTitle>
                            <AlertDialogDescription>
                                Apakah Anda yakin ingin menghapus {selectAllMode ? `semua ${sertifikats.meta?.total || 0}` : selectedIds.size} sertifikat yang dipilih?
                                Tindakan ini tidak dapat dibatalkan.
                                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                                    <p className="text-sm font-medium text-yellow-900 mb-2">
                                        Untuk melanjutkan, jawab pertanyaan berikut:
                                    </p>
                                    <p className="text-lg font-bold text-yellow-900 mb-2">
                                        Berapa {mathNum1} + {mathNum2} = ?
                                    </p>
                                    <Input
                                        type="number"
                                        placeholder="Masukkan jawaban"
                                        value={mathAnswer}
                                        onChange={(e) => setMathAnswer(e.target.value)}
                                        className="max-w-[200px]"
                                    />
                                </div>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => {
                                setShowBulkDeleteModal(false);
                                setMathAnswer('');
                            }}>Batal</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => {
                                    // Verify math answer
                                    const correctAnswer = mathNum1 + mathNum2;
                                    if (parseInt(mathAnswer) !== correctAnswer) {
                                        error(`Jawaban salah! ${mathNum1} + ${mathNum2} = ${correctAnswer}`);
                                        return;
                                    }

                                    // Proceed with deletion
                                    const payload = selectAllMode
                                        ? {
                                            select_all: true,
                                            template_id: selectedTemplateId && selectedTemplateId !== 'all' ? selectedTemplateId : undefined,
                                            search: searchQuery || undefined
                                        }
                                        : {
                                            ids: Array.from(selectedIds)
                                        };

                                    router.post('/certificates/bulk-delete', payload, {
                                        onSuccess: () => {
                                            setSelectedIds(new Set());
                                            setSelectAllMode(false);
                                            setShowBulkDeleteModal(false);
                                            setMathAnswer('');
                                            success(selectAllMode ? 'Semua sertifikat berhasil dihapus' : `${selectedIds.size} sertifikat berhasil dihapus`);
                                        },
                                        onError: () => {
                                            error('Gagal menghapus sertifikat');
                                            setShowBulkDeleteModal(false);
                                            setMathAnswer('');
                                        },
                                    });
                                }}
                                className="bg-red-600 hover:bg-red-700"
                                disabled={!mathAnswer}
                            >
                                Hapus Sertifikat
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

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
                                    {user.role === 'admin' && (
                                        <TableHead className="w-[50px]">
                                            <Checkbox
                                                checked={allSelected}
                                                onCheckedChange={handleSelectAll}
                                            />
                                        </TableHead>
                                    )}
                                    <TableHead>Nomor Sertifikat</TableHead>
                                    <TableHead>Template</TableHead>
                                    <TableHead>Penerima</TableHead>
                                    <TableHead>Status Email</TableHead>
                                    <TableHead>Tanggal Dibuat</TableHead>
                                    <TableHead>Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredSertifikats.map((sertifikat) => (
                                    <TableRow key={sertifikat.id}>
                                        {user.role === 'admin' && (
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedIds.has(sertifikat.id)}
                                                    onCheckedChange={(checked) =>
                                                        handleSelectOne(sertifikat.id, checked as boolean)
                                                    }
                                                />
                                            </TableCell>
                                        )}
                                        <TableCell className="font-medium">
                                            {sertifikat.nomor_sertif}
                                        </TableCell>
                                        <TableCell>
                                            {sertifikat.templateSertif?.title || 'Template tidak ditemukan'}
                                        </TableCell>
                                        <TableCell>
                                            {sertifikat.email ? (
                                                <div className="flex items-center">
                                                    <Mail className="mr-2 h-4 w-4 text-gray-500" />
                                                    <span className="text-sm">{sertifikat.email}</span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 text-sm">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {getEmailStatusIcon(sertifikat.email_sent_status)}
                                                <span className="text-sm">
                                                    {getEmailStatusText(sertifikat.email_sent_status)}
                                                </span>
                                                {sertifikat.email_sent_at && (
                                                    <span className="text-xs text-gray-500">
                                                        ({new Date(sertifikat.email_sent_at).toLocaleDateString('id-ID')})
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {sertifikat.created_at ? new Date(sertifikat.created_at).toLocaleDateString('id-ID') : 'Tanggal tidak tersedia'}
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
                                                {user.role === 'admin' && (
                                                    <>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="text-blue-600 hover:text-blue-700"
                                                            onClick={() => {
                                                                router.post(routes.certificates.sendEmails(), {
                                                                    sertifikat_ids: [sertifikat.id]
                                                                });
                                                            }}
                                                            disabled={sendingEmails}
                                                        >
                                                            <Mail className="h-4 w-4" />
                                                        </Button>
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
                                                                                sertifikat.nomor_sertif,
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
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        {filteredSertifikats.length === 0 && (
                            <div className="py-8 text-center text-gray-500">
                                {selectedTemplateId
                                    ? 'Tidak ada sertifikat untuk template ini'
                                    : 'Belum ada sertifikat'}
                            </div>
                        )}

                        {/* Pagination with Per-Page Selector */}
                        {sertifikats.links && sertifikats.links.length > 3 && (
                            <div className="mt-4 flex items-center justify-between gap-4">
                                {/* Per Page Selector */}
                                <div className="flex items-center gap-2">
                                    <label htmlFor="per-page" className="text-sm text-muted-foreground">
                                        Per page:
                                    </label>
                                    <Select
                                        value={perPage}
                                        onValueChange={(value) => {
                                            setPerPage(value);
                                            router.get(
                                                routes.certificates.index(),
                                                {
                                                    per_page: value,
                                                    template_id: selectedTemplateId && selectedTemplateId !== 'all' ? selectedTemplateId : undefined,
                                                    search: searchQuery || undefined,
                                                },
                                                {
                                                    preserveState: true,
                                                    preserveScroll: false,
                                                }
                                            );
                                        }}
                                    >
                                        <SelectTrigger className="w-[100px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="10">10</SelectItem>
                                            <SelectItem value="15">15</SelectItem>
                                            <SelectItem value="20">20</SelectItem>
                                            <SelectItem value="all">All</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Pagination */}
                                <Pagination links={sertifikats.links} meta={sertifikats.meta} />
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}

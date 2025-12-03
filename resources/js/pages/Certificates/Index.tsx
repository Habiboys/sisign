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
import { Checkbox } from '@/components/ui/checkbox';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { routes } from '@/utils/routes';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Award, Eye, Mail, Trash2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

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
}

export default function CertificatesIndex({ sertifikats, user }: Props) {
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [sendingEmails, setSendingEmails] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
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
            // Filter by template if selected
            const filteredIds = selectedTemplateId
                ? sertifikats.data
                      .filter(s => s.templateSertif?.id === selectedTemplateId)
                      .map(s => s.id)
                : sertifikats.data.map(s => s.id);
            setSelectedIds(new Set(filteredIds));
        } else {
            setSelectedIds(new Set());
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
        if (selectedIds.size === 0) {
            error('Pilih minimal 1 sertifikat untuk dikirim');
            return;
        }

        setSendingEmails(true);
        router.post(
            routes.certificates.sendEmails(),
            {
                sertifikat_ids: Array.from(selectedIds),
                template_id: selectedTemplateId || null,
            },
            {
                onSuccess: () => {
                    setSelectedIds(new Set());
                    setSendingEmails(false);
                },
                onError: () => {
                    setSendingEmails(false);
                },
            }
        );
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

    const filteredSertifikats = selectedTemplateId
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

                {/* Email Actions Card */}
                {user.role === 'admin' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <Mail className="mr-2 h-5 w-5" />
                                Kirim Email Sertifikat
                            </CardTitle>
                            <CardDescription>
                                Pilih sertifikat yang akan dikirim via email
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-4">
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
                                    {templates.length > 0 && (
                                        <div className="flex items-center gap-2">
                                            <label className="text-sm font-medium">Filter Template:</label>
                                            <Select
                                                value={selectedTemplateId || undefined}
                                                onValueChange={(value) => {
                                                    setSelectedTemplateId(value || '');
                                                    setSelectedIds(new Set()); // Reset selection when filter changes
                                                }}
                                            >
                                                <SelectTrigger className="w-[200px]">
                                                    <SelectValue placeholder="Semua Template" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {templates.map((template) => (
                                                        <SelectItem key={template.id} value={template.id}>
                                                            {template.title}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                    <div className="ml-auto flex items-center gap-2">
                                        <span className="text-sm text-gray-600">
                                            {selectedIds.size} dipilih
                                        </span>
                                        <Button
                                            onClick={handleSendEmails}
                                            disabled={selectedIds.size === 0 || sendingEmails}
                                            className="bg-blue-600 hover:bg-blue-700"
                                        >
                                            <Mail className="mr-2 h-4 w-4" />
                                            {sendingEmails ? 'Mengirim...' : `Kirim Email (${selectedIds.size})`}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

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
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}

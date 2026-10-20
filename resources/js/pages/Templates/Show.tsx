import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import ConfirmModal from '@/components/ui/confirm-modal';
import { useModal } from '@/hooks/use-modal';
import AppLayout from '@/layouts/app-layout';
import { Head, router } from '@inertiajs/react';
import { Calendar, ChevronDown, Eye, FileCheck, Plus, Trash2, User } from 'lucide-react';
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
    disetujuiBy?: {
        id: string;
        name: string;
    };
    created_at: string;
}

interface Template {
    id: string;
    title: string;
    description?: string;
    files: string;
    signed_template_path?: string;
    review: Review;
    created_at: string;
    updatedAt: string;
    signers?: {
        id: string;
        user: User;
        is_signed: boolean;
        sign_order: number;
    }[];
}

interface Props {
    template: Template;
    user: User;
    isCompleted: boolean;
}

export default function TemplatesShow({ template, user, isCompleted }: Props) {
    const [isRemoving, setIsRemoving] = useState(false);
    const [infoOpen, setInfoOpen] = useState(false);
    const confirmModal = useModal();

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved':
                return (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        Disetujui
                    </Badge>
                );
            case 'rejected':
                return (
                    <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                        Ditolak
                    </Badge>
                );
            case 'pending':
                return (
                    <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                        Menunggu Review
                    </Badge>
                );
            default:
                return (
                    <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                        {status}
                    </Badge>
                );
        }
    };

    const canSign =
        user.role === 'pimpinan' &&
        template.review.status === 'approved' &&
        template.signers?.some(
            (signer) => signer.user.id === user.id && !signer.is_signed
        );

    const canRemoveSignature =
        user.role === 'pimpinan' &&
        !!template.signers?.some(
            (signer) => signer.user.id === user.id && signer.is_signed,
        ) &&
        !isCompleted;

    const handleRemoveSignature = () => {
        confirmModal.open();
    };

    const confirmRemoveSignature = () => {
        setIsRemoving(true);
        router.delete(`/templates/${template.id}/remove-signature`, {
            onSuccess: () => {
                setIsRemoving(false);
                confirmModal.close();
            },
            onError: () => {
                setIsRemoving(false);
            },
            onFinish: () => {
                setIsRemoving(false);
            },
        });
    };

    return (
        <AppLayout>
            <Head title={`Template - ${template.title}`} />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4 sm:gap-6 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                            {template.title}
                        </h1>
                        <p className="text-sm text-gray-600 sm:text-base">
                            Detail template sertifikat
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {getStatusBadge(template.review.status)}
                        {template.signed_template_path && (
                            <Badge className="bg-blue-100 text-blue-800">
                                ✓ Sudah Ditandatangani (Fisik + Digital)
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Compact info bar on top, expandable */}
                <Card>
                    <Collapsible open={infoOpen} onOpenChange={setInfoOpen}>
                        <CollapsibleTrigger className="w-full">
                            <CardHeader className="flex w-full flex-row items-center justify-between py-3">
                                <CardTitle className="flex items-center text-sm sm:text-base">
                                    <Calendar className="mr-2 h-4 w-4" />
                                    Informasi & Status
                                </CardTitle>
                                <ChevronDown
                                    className={`h-4 w-4 transition-transform ${
                                        infoOpen ? 'rotate-180' : ''
                                    }`}
                                />
                            </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <CardContent className="grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
                                <div>
                                    <h4 className="text-xs font-medium text-gray-500 uppercase">
                                        Judul Template
                                    </h4>
                                    <p className="mt-1 text-sm break-words text-gray-800">
                                        {template.title}
                                    </p>
                                </div>
                                {template.description && (
                                    <div>
                                        <h4 className="text-xs font-medium text-gray-500 uppercase">
                                            Deskripsi
                                        </h4>
                                        <p className="mt-1 text-sm break-words text-gray-800">
                                            {template.description}
                                        </p>
                                    </div>
                                )}
                                <div>
                                    <h4 className="text-xs font-medium text-gray-500 uppercase">
                                        File Template
                                    </h4>
                                    <p className="mt-1 text-sm break-words text-gray-800">
                                        {template.files}
                                    </p>
                                </div>
                                <div>
                                    <h4 className="text-xs font-medium text-gray-500 uppercase">
                                        Tanggal Dibuat
                                    </h4>
                                    <p className="mt-1 text-sm text-gray-800">
                                        {new Date(
                                            template.created_at,
                                        ).toLocaleDateString('id-ID')}
                                    </p>
                                </div>
                                <div>
                                    <h4 className="text-xs font-medium text-gray-500 uppercase">
                                        Terakhir Diupdate
                                    </h4>
                                    <p className="mt-1 text-sm text-gray-800">
                                        {new Date(
                                            template.updatedAt,
                                        ).toLocaleDateString('id-ID')}
                                    </p>
                                </div>
                                <div>
                                    <h4 className="text-xs font-medium text-gray-500 uppercase">
                                        Status Review
                                    </h4>
                                    <div className="mt-1">
                                        {getStatusBadge(template.review.status)}
                                    </div>
                                </div>
                                {template.review.disetujuiBy && (
                                    <div>
                                        <h4 className="text-xs font-medium text-gray-500 uppercase">
                                            Disetujui Oleh
                                        </h4>
                                        <p className="mt-1 flex items-center text-sm text-gray-800">
                                            <User className="mr-1 h-3 w-3 text-gray-500" />
                                            {template.review.disetujuiBy.name}
                                        </p>
                                    </div>
                                )}
                                <div>
                                    <h4 className="text-xs font-medium text-gray-500 uppercase">
                                        Status Penanda Tangan
                                    </h4>
                                    <div className="mt-1 space-y-1">
                                        {template.signers?.map((signer) => (
                                            <div
                                                key={signer.id}
                                                className="flex items-center justify-between gap-2 text-sm"
                                            >
                                                <span className="flex items-center text-gray-800">
                                                    <User className="mr-1 h-3 w-3 text-gray-500" />
                                                    {signer.user.name}
                                                </span>
                                                <Badge
                                                    variant={
                                                        signer.is_signed
                                                            ? 'default'
                                                            : 'outline'
                                                    }
                                                    className={
                                                        signer.is_signed
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'text-gray-500'
                                                    }
                                                >
                                                    {signer.is_signed
                                                        ? 'Sudah TTD'
                                                        : 'Belum TTD'}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </CollapsibleContent>
                    </Collapsible>
                </Card>

                {/* Actions, inline row for quick access */}
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            window.open(
                                `/templates/${template.id}/preview`,
                                '_blank',
                            )
                        }
                    >
                        <Eye className="mr-1 h-4 w-4" />
                        Lihat File Template
                    </Button>

                    {template.signed_template_path && (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    window.open(
                                        `/templates/${template.id}/download-signed`,
                                        '_blank',
                                    )
                                }
                            >
                                <Eye className="mr-1 h-4 w-4" />
                                Lihat Bertanda Tangan
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="bg-blue-600 text-white hover:bg-blue-700"
                                onClick={() =>
                                    router.visit(
                                        `/templates/${template.id}/map-variables`,
                                    )
                                }
                            >
                                <Plus className="mr-1 h-4 w-4" />
                                Mapping Variabel untuk Bulk
                            </Button>
                        </>
                    )}

                    {canSign && (
                        <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() =>
                                router.visit(
                                    `/templates/${template.id}/sign`,
                                )
                            }
                        >
                            <Plus className="mr-1 h-4 w-4" />
                            Tanda Tangan Template
                        </Button>
                    )}

                    {canRemoveSignature && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRemoveSignature}
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            disabled={isRemoving}
                        >
                            <Trash2 className="mr-1 h-4 w-4" />
                            {isRemoving
                                ? 'Menghapus...'
                                : 'Hapus Tanda Tangan'}
                        </Button>
                    )}
                </div>

                {/* Template Preview - full width */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="flex items-center text-sm sm:text-base">
                            <FileCheck className="mr-2 h-4 w-4" />
                            {template.signed_template_path
                                ? 'Template Bertanda Tangan'
                                : 'Preview Template'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div
                            className="rounded-lg border border-gray-300"
                            style={{ height: '600px' }}
                        >
                            <iframe
                                src={
                                    template.signed_template_path
                                        ? `/storage/${template.signed_template_path}`
                                        : `/templates/${template.id}/preview`
                                }
                                className="h-full w-full rounded-lg"
                                title="Template Preview"
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <ConfirmModal
                open={confirmModal.isOpen}
                onClose={confirmModal.close}
                onConfirm={confirmRemoveSignature}
                title="Hapus Tanda Tangan Template"
                description="Tanda tangan fisik dan digital Anda akan dihapus sekaligus dari template ini. Template perlu ditandatangani ulang sebelum bisa digunakan untuk membuat sertifikat."
                confirmText="Hapus"
                cancelText="Batal"
                variant="destructive"
            />
        </AppLayout>
    );
}

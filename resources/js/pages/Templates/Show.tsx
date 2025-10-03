import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ConfirmModal from '@/components/ui/confirm-modal';
import { useModal } from '@/hooks/use-modal';
import AppLayout from '@/layouts/app-layout';
import { Head, router } from '@inertiajs/react';
import { Calendar, Eye, FileCheck, Plus, Trash2, User } from 'lucide-react';
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
}

interface Props {
    template: Template;
    user: User;
}

export default function TemplatesShow({ template, user }: Props) {
    const [isRemoving, setIsRemoving] = useState(false);
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
        !template.signed_template_path;

    const canRemoveSignature =
        user.role === 'pimpinan' && template.signed_template_path;

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
            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            {template.title}
                        </h1>
                        <p className="text-gray-600">
                            Detail template sertifikat
                        </p>
                    </div>
                    <div className="flex items-center space-x-2">
                        {getStatusBadge(template.review.status)}
                        {template.signed_template_path && (
                            <Badge className="bg-blue-100 text-blue-800">
                                ✓ Sudah Ditandatangani (Fisik + Digital)
                            </Badge>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {/* Template Preview */}
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center">
                                    <FileCheck className="mr-2 h-5 w-5" />
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

                    {/* Template Details */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Informasi Template</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <h4 className="font-medium text-gray-900">
                                        Judul Template
                                    </h4>
                                    <p className="text-gray-600">
                                        {template.title}
                                    </p>
                                </div>

                                {template.description && (
                                    <div>
                                        <h4 className="font-medium text-gray-900">
                                            Deskripsi
                                        </h4>
                                        <p className="text-gray-600">
                                            {template.description}
                                        </p>
                                    </div>
                                )}

                                <div>
                                    <h4 className="font-medium text-gray-900">
                                        File Template
                                    </h4>
                                    <p className="text-gray-600">
                                        {template.files}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <h4 className="font-medium text-gray-900">
                                            Tanggal Dibuat
                                        </h4>
                                        <p className="text-gray-600">
                                            {new Date(
                                                template.created_at,
                                            ).toLocaleDateString('id-ID')}
                                        </p>
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-gray-900">
                                            Terakhir Diupdate
                                        </h4>
                                        <p className="text-gray-600">
                                            {new Date(
                                                template.updatedAt,
                                            ).toLocaleDateString('id-ID')}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        {/* Actions */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Aksi</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() =>
                                        window.open(
                                            `/templates/${template.id}/preview`,
                                            '_blank',
                                        )
                                    }
                                >
                                    <Eye className="mr-2 h-4 w-4" />
                                    Lihat File Template
                                </Button>

                                {template.signed_template_path && (
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        onClick={() =>
                                            window.open(
                                                `/templates/${template.id}/download-signed`,
                                                '_blank',
                                            )
                                        }
                                    >
                                        <Eye className="mr-2 h-4 w-4" />
                                        Lihat Template Bertanda Tangan
                                    </Button>
                                )}

                                {canSign && (
                                    <Button
                                        className="w-full bg-green-600 hover:bg-green-700"
                                        onClick={() =>
                                            router.visit(
                                                `/templates/${template.id}/sign`,
                                            )
                                        }
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Tanda Tangan Template
                                    </Button>
                                )}

                                {canRemoveSignature && (
                                    <Button
                                        variant="outline"
                                        onClick={handleRemoveSignature}
                                        className="w-full text-red-600 hover:bg-red-50 hover:text-red-700"
                                        disabled={isRemoving}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        {isRemoving
                                            ? 'Menghapus...'
                                            : 'Hapus Tanda Tangan'}
                                    </Button>
                                )}
                            </CardContent>
                        </Card>

                        {/* Review Status */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center">
                                    <Calendar className="mr-2 h-5 w-5" />
                                    Status Review
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <h4 className="font-medium text-gray-900">
                                        Status
                                    </h4>
                                    {getStatusBadge(template.review.status)}
                                </div>

                                {template.review.komentar && (
                                    <div>
                                        <h4 className="font-medium text-gray-900">
                                            Komentar
                                        </h4>
                                        <p className="text-gray-600">
                                            {template.review.komentar}
                                        </p>
                                    </div>
                                )}

                                {template.review.disetujuiBy && (
                                    <div>
                                        <h4 className="font-medium text-gray-900">
                                            Disetujui Oleh
                                        </h4>
                                        <div className="flex items-center">
                                            <User className="mr-2 h-4 w-4 text-gray-500" />
                                            <span className="text-gray-600">
                                                {
                                                    template.review.disetujuiBy
                                                        .name
                                                }
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <h4 className="font-medium text-gray-900">
                                        Tanggal Review
                                    </h4>
                                    <p className="text-gray-600">
                                        {new Date(
                                            template.review.created_at,
                                        ).toLocaleDateString('id-ID')}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            <ConfirmModal
                open={confirmModal.isOpen}
                onClose={confirmModal.close}
                onConfirm={confirmRemoveSignature}
                title="Hapus Tanda Tangan Template"
                description="Apakah Anda yakin ingin menghapus tanda tangan dari template ini? Template perlu ditandatangani ulang sebelum bisa digunakan untuk membuat sertifikat."
                confirmText="Hapus"
                cancelText="Batal"
                variant="destructive"
            />
        </AppLayout>
    );
}

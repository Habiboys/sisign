import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import ConfirmModal from '@/components/ui/confirm-modal';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useModal } from '@/hooks/use-modal';
import { useToast } from '@/hooks/use-toast';
import AppLayout from '@/layouts/app-layout';
import { routes } from '@/utils/routes';
import { Head, router, useForm } from '@inertiajs/react';
import {
    Calendar,
    CheckCircle,
    Clock,
    Download,
    FileText,
    MessageSquare,
    Plus,
    Trash2,
    User,
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
    created_at: string;
}

interface Signature {
    id: string;
    type: 'physical' | 'digital';
    signedAt: string;
    signatureFile?: string;
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
    to_user: User;
    review: Review;
    signatures: Signature[];
    signers: {
        id: string;
        user: User;
        is_signed: boolean;
        sign_order: number;
    }[];
}

interface Props {
    document: Document;
    user: User;
}

export default function DocumentsShow({ document, user }: Props) {
    const [showReviewForm, setShowReviewForm] = useState(false);
    const { success, error } = useToast();
    const deleteModal = useModal();
    const [deleteSignatureId, setDeleteSignatureId] = useState<string>('');

    // Helper function to check if document has a signed file (at least one signature)
    const hasSignedFile = () => {
        return (
            document.signed_file &&
            document.signatures &&
            document.signatures.length > 0
        );
    };

    // Helper function to check if document is fully signed by all required signers
    const isFullySigned = () => {
        if (!document.signers || document.signers.length === 0) return false;
        return document.signers.every((signer) => signer.is_signed);
    };

    // Debug log
    console.log('Document data:', {
        id: document.id,
        signed_file: document.signed_file,
        signatures_count: document.signatures?.length || 0,
        is_truly_signed: hasSignedFile(),
        is_fully_signed: isFullySigned(),
        iframe_src: hasSignedFile()
            ? `/storage/${document.signed_file}`
            : `/documents/${document.id}/pdf`,
    });

    const {
        data: reviewData,
        setData: setReviewData,
        post: postReview,
        processing: reviewProcessing,
        errors: reviewErrors,
    } = useForm({
        status: 'approved' as 'approved' | 'rejected',
        komentar: '',
    });

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

    const handleReview = (e: React.FormEvent) => {
        e.preventDefault();
        postReview(routes.documents.review(document.id), {
            onSuccess: () => {
                setShowReviewForm(false);
                setReviewData('status', 'approved');
                setReviewData('komentar', '');
            },
        });
    };

    const canReview =
        (user.role === 'admin' || user.role === 'pimpinan') &&
        document.review.status === 'pending';
    const canSign =
        user.role === 'pimpinan' &&
        document.review.status === 'approved' &&
        document.signers?.some(
            (signer) => signer.user.id === user.id && !signer.is_signed
        );

    const handleDeleteSignature = (signatureId: string) => {
        setDeleteSignatureId(signatureId);
        deleteModal.open();
    };
    //aa
    const confirmDeleteSignature = () => {
        router.delete(`/signatures/${deleteSignatureId}`, {
            onSuccess: (page: any) => {
                // Check if there's a success message from backend
                if (page.props.flash?.success) {
                    success(page.props.flash.success);
                } else {
                    success('Tanda tangan berhasil dihapus');
                }
                setDeleteSignatureId('');
            },
            onError: (errors) => {
                error(
                    'Gagal menghapus tanda tangan: ' +
                    (Object.values(errors)[0] ||
                        'Terjadi kesalahan yang tidak diketahui'),
                );
            },
        });
    };

    return (
        <AppLayout>
            <Head title={`Dokumen - ${document.title}`} />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            {document.title}
                        </h1>
                        <p className="text-gray-600">No. {document.number}</p>
                    </div>
                    <div className="flex space-x-2">
                        {canReview && (
                            <Button
                                onClick={() =>
                                    setShowReviewForm(!showReviewForm)
                                }
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                Review Dokumen
                            </Button>
                        )}
                        {canSign && (
                            <Button
                                onClick={() =>
                                    router.visit(
                                        `/documents/${document.id}/sign`,
                                    )
                                }
                                className="bg-green-600 hover:bg-green-700"
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Tanda Tangan
                            </Button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div className="space-y-4 lg:col-span-2">
                        {/* PDF Viewer */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center">
                                    <FileText className="mr-2 h-5 w-5" />
                                    Preview Dokumen
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div
                                    className="rounded-lg border border-gray-300"
                                    style={{ height: '600px' }}
                                >
                                    <iframe
                                        src={
                                            hasSignedFile()
                                                ? `/documents/${document.id}/signed-pdf/preview`
                                                : `/documents/${document.id}/pdf`
                                        }
                                        className="h-full w-full rounded-lg"
                                        title="Document Preview"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center">
                                    <FileText className="mr-2 h-5 w-5" />
                                    Detail Dokumen
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-sm font-medium text-gray-500">
                                            Judul
                                        </Label>
                                        <p className="text-lg">
                                            {document.title}
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium text-gray-500">
                                            Nomor
                                        </Label>
                                        <p className="text-lg">
                                            {document.number}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-sm font-medium text-gray-500">
                                            Pengaju
                                        </Label>
                                        <p className="flex items-center">
                                            <User className="mr-2 h-4 w-4" />
                                            {document.user.name}
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium text-gray-500">
                                            Ditujukan (Signers)
                                        </Label>
                                        <div className="space-y-1">
                                            {document.signers?.map((signer) => (
                                                <div key={signer.id} className="flex items-center justify-between text-sm">
                                                    <div className="flex items-center">
                                                        <User className="mr-2 h-4 w-4" />
                                                        {signer.user.name}
                                                    </div>
                                                    <Badge variant={signer.is_signed ? "default" : "outline"} className={signer.is_signed ? "bg-green-100 text-green-800" : "text-gray-500"}>
                                                        {signer.is_signed ? "Sudah TTD" : "Belum TTD"}
                                                    </Badge>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <Label className="text-sm font-medium text-gray-500">
                                        Tanggal Dibuat
                                    </Label>
                                    <p className="flex items-center">
                                        <Calendar className="mr-2 h-4 w-4" />
                                        {new Date(
                                            document.created_at,
                                        ).toLocaleDateString('id-ID', {
                                            weekday: 'long',
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                        })}
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-gray-600">
                                            Status TTD:
                                        </span>
                                        <Badge
                                            variant={
                                                isFullySigned()
                                                    ? 'default'
                                                    : hasSignedFile()
                                                        ? 'secondary'
                                                        : 'outline'
                                            }
                                            className={
                                                isFullySigned()
                                                    ? 'bg-green-100 text-green-800'
                                                    : hasSignedFile()
                                                        ? 'bg-yellow-100 text-yellow-800'
                                                        : 'bg-gray-100 text-gray-800'
                                            }
                                        >
                                            {isFullySigned()
                                                ? 'Sudah Ditandatangani'
                                                : hasSignedFile()
                                                    ? 'Sebagian Ditandatangani'
                                                    : 'Belum Ditandatangani'}
                                        </Badge>
                                    </div>

                                    {(document.signatures?.length || 0) > 0 && (
                                        <div className="text-sm text-gray-600">
                                            <p>
                                                Ditandatangani oleh:{' '}
                                                <span className="font-medium">
                                                    {
                                                        document.signatures[0]
                                                            .user.name
                                                    }
                                                </span>
                                            </p>
                                            <p>
                                                Tanggal:{' '}
                                                <span className="font-medium">
                                                    {new Date(
                                                        document.signatures[0].signedAt,
                                                    ).toLocaleDateString(
                                                        'id-ID',
                                                    )}
                                                </span>
                                            </p>
                                        </div>
                                    )}

                                    <Button
                                        onClick={() =>
                                            window.open(
                                                hasSignedFile()
                                                    ? `/documents/${document.id}/signed-pdf`
                                                    : `/storage/documents/${document.files}`,
                                                '_blank',
                                            )
                                        }
                                        className="w-full bg-blue-600 hover:bg-blue-700"
                                    >
                                        <Download className="mr-2 h-4 w-4" />
                                        {hasSignedFile()
                                            ? 'Download Dokumen (Signed)'
                                            : 'Download Dokumen'}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {showReviewForm && canReview && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Review Dokumen</CardTitle>
                                    <CardDescription>
                                        Berikan review untuk dokumen ini
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <form
                                        onSubmit={handleReview}
                                        className="space-y-4"
                                    >
                                        <div className="space-y-2">
                                            <Label htmlFor="status">
                                                Status
                                            </Label>
                                            <Select
                                                value={reviewData.status}
                                                onValueChange={(
                                                    value:
                                                        | 'approved'
                                                        | 'rejected',
                                                ) =>
                                                    setReviewData(
                                                        'status',
                                                        value,
                                                    )
                                                }
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="approved">
                                                        Setujui
                                                    </SelectItem>
                                                    <SelectItem value="rejected">
                                                        Tolak
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {reviewErrors.status && (
                                                <p className="text-sm text-red-500">
                                                    {reviewErrors.status}
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="komentar">
                                                Komentar
                                            </Label>
                                            <Textarea
                                                id="komentar"
                                                value={reviewData.komentar}
                                                onChange={(
                                                    e: React.ChangeEvent<HTMLTextAreaElement>,
                                                ) =>
                                                    setReviewData(
                                                        'komentar',
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="Berikan komentar (opsional)"
                                                rows={3}
                                            />
                                            {reviewErrors.komentar && (
                                                <p className="text-sm text-red-500">
                                                    {reviewErrors.komentar}
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex justify-end space-x-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() =>
                                                    setShowReviewForm(false)
                                                }
                                            >
                                                Batal
                                            </Button>
                                            <Button
                                                type="submit"
                                                className={
                                                    reviewData.status ===
                                                        'approved'
                                                        ? 'bg-green-600 hover:bg-green-700'
                                                        : 'bg-red-600 hover:bg-red-700'
                                                }
                                                disabled={reviewProcessing}
                                            >
                                                {reviewProcessing
                                                    ? 'Menyimpan...'
                                                    : reviewData.status ===
                                                        'approved'
                                                        ? 'Setujui'
                                                        : 'Tolak'}
                                            </Button>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
                        )}

                        {(document.signatures?.length || 0) > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Tanda Tangan</CardTitle>
                                    <CardDescription>
                                        Daftar tanda tangan pada dokumen ini
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {document.signatures.map((signature) => (
                                            <div
                                                key={signature.id}
                                                className="flex items-center justify-between rounded-lg border p-4"
                                            >
                                                <div className="flex items-center space-x-4">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                                                        <User className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium">
                                                            {
                                                                signature
                                                                    .user
                                                                    .name
                                                            }
                                                        </p>
                                                        <p className="text-sm text-gray-500">
                                                            {signature.type ===
                                                                'digital'
                                                                ? 'Tanda Tangan Digital'
                                                                : 'Tanda Tangan Fisik'}
                                                        </p>
                                                        <p className="text-xs text-gray-400">
                                                            {new Date(
                                                                signature.signedAt,
                                                            ).toLocaleDateString(
                                                                'id-ID',
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <Badge
                                                        variant={
                                                            signature.type ===
                                                                'digital'
                                                                ? 'default'
                                                                : 'secondary'
                                                        }
                                                    >
                                                        {signature.type ===
                                                            'digital'
                                                            ? 'Digital'
                                                            : 'Fisik'}
                                                    </Badge>
                                                    {user.role ===
                                                        'pimpinan' &&
                                                        signature.user.id ===
                                                        user.id && (
                                                            <div className="flex space-x-2">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() =>
                                                                        handleDeleteSignature(
                                                                            signature.id,
                                                                        )
                                                                    }
                                                                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                                                    title="Hapus TTD"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Status Review</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">
                                            Status:
                                        </span>
                                        {getStatusBadge(document.review.status)}
                                    </div>

                                    {document.review.komentar && (
                                        <div>
                                            <Label className="flex items-center text-sm font-medium text-gray-500">
                                                <MessageSquare className="mr-2 h-4 w-4" />
                                                Komentar:
                                            </Label>
                                            <p className="mt-1 rounded-lg bg-gray-50 p-3 text-sm">
                                                {document.review.komentar}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Modals */}
            <ConfirmModal
                open={deleteModal.isOpen}
                onClose={deleteModal.close}
                onConfirm={confirmDeleteSignature}
                title="Hapus Tanda Tangan"
                description="Apakah Anda yakin ingin menghapus tanda tangan ini? Tindakan ini tidak dapat dibatalkan."
                confirmText="Hapus"
                cancelText="Batal"
                variant="destructive"
            />
        </AppLayout >
    );
}

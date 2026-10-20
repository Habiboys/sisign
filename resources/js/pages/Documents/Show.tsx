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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
    ChevronDown,
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
    const [infoOpen, setInfoOpen] = useState(true);
    const { error } = useToast();
    const deleteModal = useModal();

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

    const handleDeleteSignature = () => {
        deleteModal.open();
    };

    const confirmDeleteSignature = () => {
        // Backend flashes a success message, shown automatically by the app
        // layout - don't show a second toast here.
        router.delete(`/documents/${document.id}/signature`, {
            onError: (errors) => {
                error(
                    'Gagal menghapus tanda tangan: ' +
                    (Object.values(errors)[0] ||
                        'Terjadi kesalahan yang tidak diketahui'),
                );
            },
        });
    };

    // Group signatures per signer so physical + digital rows collapse into one entry.
    const signaturesBySigner = (document.signatures || []).reduce(
        (acc: Record<string, { user: User; types: Set<string>; latestSignedAt: string }>, signature) => {
            const key = signature.user.id;
            if (!acc[key]) {
                acc[key] = { user: signature.user, types: new Set(), latestSignedAt: signature.signedAt };
            }
            acc[key].types.add(signature.type);
            if (new Date(signature.signedAt) > new Date(acc[key].latestSignedAt)) {
                acc[key].latestSignedAt = signature.signedAt;
            }

            return acc;
        },
        {},
    );

    return (
        <AppLayout>
            <Head title={`Dokumen - ${document.title}`} />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                            {document.title}
                        </h1>
                        <p className="text-sm text-gray-600 sm:text-base">
                            No. {document.number}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
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
                                    <Label className="text-xs font-medium text-gray-500 uppercase">
                                        Judul
                                    </Label>
                                    <p className="mt-1 text-sm text-gray-800">
                                        {document.title}
                                    </p>
                                </div>
                                <div>
                                    <Label className="text-xs font-medium text-gray-500 uppercase">
                                        Nomor
                                    </Label>
                                    <p className="mt-1 text-sm text-gray-800">
                                        {document.number}
                                    </p>
                                </div>
                                <div>
                                    <Label className="text-xs font-medium text-gray-500 uppercase">
                                        Pengaju
                                    </Label>
                                    <p className="mt-1 flex items-center text-sm text-gray-800">
                                        <User className="mr-1 h-3 w-3 text-gray-500" />
                                        {document.user.name}
                                    </p>
                                </div>
                                <div>
                                    <Label className="text-xs font-medium text-gray-500 uppercase">
                                        Tanggal Dibuat
                                    </Label>
                                    <p className="mt-1 text-sm text-gray-800">
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
                                <div>
                                    <Label className="text-xs font-medium text-gray-500 uppercase">
                                        Status Review
                                    </Label>
                                    <div className="mt-1">
                                        {getStatusBadge(document.review.status)}
                                    </div>
                                    {document.review.komentar && (
                                        <p className="mt-1 flex items-start text-sm text-gray-600">
                                            <MessageSquare className="mr-1 mt-0.5 h-3 w-3 shrink-0 text-gray-400" />
                                            {document.review.komentar}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <Label className="text-xs font-medium text-gray-500 uppercase">
                                        Ditujukan (Signers)
                                    </Label>
                                    <div className="mt-1 space-y-1">
                                        {document.signers?.map((signer) => (
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
                                <div>
                                    <Label className="text-xs font-medium text-gray-500 uppercase">
                                        Status TTD
                                    </Label>
                                    <div className="mt-1">
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
                                </div>
                                <div>
                                    <Label className="text-xs font-medium text-gray-500 uppercase">
                                        Unduh
                                    </Label>
                                    <Button
                                        onClick={() =>
                                            window.open(
                                                hasSignedFile()
                                                    ? `/documents/${document.id}/signed-pdf`
                                                    : `/storage/documents/${document.files}`,
                                                '_blank',
                                            )
                                        }
                                        size="sm"
                                        className="mt-1 bg-blue-600 hover:bg-blue-700"
                                    >
                                        <Download className="mr-1 h-3 w-3" />
                                        {hasSignedFile()
                                            ? 'Download (Signed)'
                                            : 'Download'}
                                    </Button>
                                </div>
                            </CardContent>
                        </CollapsibleContent>
                    </Collapsible>
                </Card>

                {/* PDF Viewer - full width */}
                <div className="space-y-4">
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
                                        {Object.values(signaturesBySigner).map(({ user: signer, types, latestSignedAt }) => (
                                            <div
                                                key={signer.id}
                                                className="flex items-center justify-between rounded-lg border p-4"
                                            >
                                                <div className="flex items-center space-x-4">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                                                        <User className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium">
                                                            {signer.name}
                                                        </p>
                                                        <p className="text-sm text-gray-500">
                                                            Sudah Tanda Tangan
                                                        </p>
                                                        <p className="text-xs text-gray-400">
                                                            {new Date(
                                                                latestSignedAt,
                                                            ).toLocaleDateString(
                                                                'id-ID',
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    {Array.from(types).map((type) => (
                                                        <Badge
                                                            key={type}
                                                            variant={
                                                                type === 'digital'
                                                                    ? 'default'
                                                                    : 'secondary'
                                                            }
                                                        >
                                                            {type === 'digital'
                                                                ? 'Digital'
                                                                : 'Fisik'}
                                                        </Badge>
                                                    ))}
                                                    {user.role === 'pimpinan' &&
                                                        signer.id === user.id &&
                                                        !isFullySigned() && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={handleDeleteSignature}
                                                                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                                                title="Hapus Tanda Tangan (fisik + digital)"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
            </div>

            {/* Modals */}
            <ConfirmModal
                open={deleteModal.isOpen}
                onClose={deleteModal.close}
                onConfirm={confirmDeleteSignature}
                title="Hapus Tanda Tangan"
                description="Tanda tangan fisik dan digital Anda akan dihapus sekaligus dari dokumen ini. Tindakan ini tidak dapat dibatalkan."
                confirmText="Hapus"
                cancelText="Batal"
                variant="destructive"
            />
        </AppLayout >
    );
}

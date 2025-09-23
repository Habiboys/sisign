import SignatureCanvas from '@/components/SignatureCanvas';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { Head, useForm } from '@inertiajs/react';
import { FileText, PenTool } from 'lucide-react';
import { useState } from 'react';

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
}

interface Document {
    id: string;
    title: string;
    number: string;
    files: string;
}

interface Template {
    id: string;
    title: string;
    description?: string;
    files: string;
}

interface Props {
    document?: Document;
    template?: Template;
    type: 'document' | 'template';
    user: User;
}

export default function SignaturesCreate({
    document,
    template,
    type,
    user,
}: Props) {
    const [signatureData, setSignatureData] = useState<string | null>(null);

    const { data, setData, post, processing, errors } = useForm({
        type: 'digital' as 'physical' | 'digital',
        signature_type: type,
        signature_data: signatureData,
        signature_hash: '',
        document_id: document?.id || '',
        template_id: template?.id || '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setData('signature_data', signatureData);
        post('/signatures');
    };

    const handleSignatureChange = (data: string | null) => {
        setSignatureData(data);
        setData('signature_data', data);
    };

    const targetItem = type === 'document' ? document : template;
    const title = type === 'document' ? document?.title : template?.title;

    return (
        <AppLayout>
            <Head title={`Tanda Tangan - ${title}`} />
            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        Tanda Tangan{' '}
                        {type === 'document' ? 'Dokumen' : 'Template'}
                    </h1>
                    <p className="text-gray-600">
                        {type === 'document' ? 'Dokumen' : 'Template'}: {title}{' '}
                        {type === 'document' &&
                            document?.number &&
                            `(No. ${document.number})`}
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <PenTool className="mr-2 h-5 w-5" />
                                Form Tanda Tangan
                            </CardTitle>
                            <CardDescription>
                                Pilih jenis tanda tangan dan lengkapi form
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="type">
                                        Jenis Tanda Tangan
                                    </Label>
                                    <Select
                                        value={data.type}
                                        onValueChange={(
                                            value: 'physical' | 'digital',
                                        ) => setData('type', value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="physical">
                                                Tanda Tangan Fisik
                                            </SelectItem>
                                            <SelectItem value="digital">
                                                Tanda Tangan Digital
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {errors.type && (
                                        <p className="text-sm text-red-500">
                                            {errors.type}
                                        </p>
                                    )}
                                </div>

                                {data.type === 'digital' && (
                                    <div className="space-y-4">
                                        <SignatureCanvas
                                            onSignatureChange={
                                                handleSignatureChange
                                            }
                                            initialSignature={signatureData}
                                        />
                                        {errors.signature_data && (
                                            <p className="text-sm text-red-500">
                                                {errors.signature_data}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {data.type === 'physical' && (
                                    <div className="rounded-lg bg-blue-50 p-4">
                                        <h4 className="mb-2 font-medium text-blue-800">
                                            Tanda Tangan Fisik
                                        </h4>
                                        <p className="text-sm text-blue-700">
                                            Untuk tanda tangan fisik, pastikan
                                            Anda telah menandatangani dokumen
                                            secara manual dan mengkonfirmasi
                                            bahwa tanda tangan telah dilakukan.
                                        </p>
                                    </div>
                                )}

                                <div className="flex justify-end space-x-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => window.history.back()}
                                    >
                                        Batal
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="bg-green-600 hover:bg-green-700"
                                        disabled={processing}
                                    >
                                        {processing
                                            ? 'Menyimpan...'
                                            : 'Simpan Tanda Tangan'}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <FileText className="mr-2 h-5 w-5" />
                                Informasi Dokumen
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label className="text-sm font-medium text-gray-500">
                                    Judul Dokumen
                                </Label>
                                <p className="text-lg">{document.title}</p>
                            </div>

                            <div>
                                <Label className="text-sm font-medium text-gray-500">
                                    Nomor Dokumen
                                </Label>
                                <p className="text-lg">{document.number}</p>
                            </div>

                            <div>
                                <Button
                                    onClick={() =>
                                        window.open(
                                            `/storage/documents/${document.files}`,
                                            '_blank',
                                        )
                                    }
                                    variant="outline"
                                    className="w-full"
                                >
                                    <FileText className="mr-2 h-4 w-4" />
                                    Lihat Dokumen
                                </Button>
                            </div>

                            <div className="rounded-lg bg-yellow-50 p-4">
                                <h4 className="mb-2 font-medium text-yellow-800">
                                    Panduan Tanda Tangan:
                                </h4>
                                <ul className="space-y-1 text-sm text-yellow-700">
                                    <li>
                                        • <strong>Fisik:</strong> Tandatangani
                                        dokumen secara manual
                                    </li>
                                    <li>
                                        • <strong>Digital:</strong> Upload file
                                        tanda tangan dan hash
                                    </li>
                                    <li>
                                        • Pastikan dokumen sudah disetujui
                                        sebelum ditandatangani
                                    </li>
                                    <li>
                                        • Tanda tangan tidak dapat diubah
                                        setelah disimpan
                                    </li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}

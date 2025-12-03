import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { routes } from '@/utils/routes';
import { Head, useForm } from '@inertiajs/react';
import { FileCheck, Plus, Upload } from 'lucide-react';

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
}

interface Props {
    user: User;
    users: User[];
}

export default function TemplatesCreate({ user, users }: Props) {
    const { data, setData, post, processing, errors } = useForm({
        title: '',
        description: '',
        file: null as File | null,
        signers: [''], // Initialize with one empty signer
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(routes.templates.store());
    };

    return (
        <AppLayout>
            <Head title="Buat Template Sertifikat" />
            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        Buat Template Sertifikat
                    </h1>
                    <p className="text-gray-600">
                        Buat template baru untuk sertifikat
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <FileCheck className="mr-2 h-5 w-5" />
                            Form Template Sertifikat
                        </CardTitle>
                        <CardDescription>
                            Isi form di bawah ini untuk membuat template
                            sertifikat
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="title">Judul Template</Label>
                                <Input
                                    id="title"
                                    value={data.title}
                                    onChange={(e) =>
                                        setData('title', e.target.value)
                                    }
                                    placeholder="Masukkan judul template"
                                    className={
                                        errors.title ? 'border-red-500' : ''
                                    }
                                />
                                {errors.title && (
                                    <p className="text-sm text-red-500">
                                        {errors.title}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Deskripsi</Label>
                                <Textarea
                                    id="description"
                                    value={data.description}
                                    onChange={(e) =>
                                        setData('description', e.target.value)
                                    }
                                    placeholder="Masukkan deskripsi template (opsional)"
                                    rows={3}
                                    className={
                                        errors.description
                                            ? 'border-red-500'
                                            : ''
                                    }
                                />
                                {errors.description && (
                                    <p className="text-sm text-red-500">
                                        {errors.description}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-4">
                                <Label>Penanda Tangan (Pimpinan)</Label>
                                {Array.isArray(data.signers) && data.signers.map((signerId, index) => (
                                    <div key={index} className="flex gap-2">
                                        <div className="flex-1">
                                            <Select
                                                value={signerId}
                                                onValueChange={(value) => {
                                                    const newSigners = [...(data.signers as string[])];
                                                    newSigners[index] = value;
                                                    setData('signers', newSigners);
                                                }}
                                            >
                                                <SelectTrigger className={errors.signers ? 'border-red-500' : ''}>
                                                    <SelectValue placeholder={`Pilih Pimpinan ke-${index + 1}`} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {users.map((user) => (
                                                        <SelectItem key={user.id} value={user.id}>
                                                            {user.name} ({user.email})
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {index > 0 && (
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                onClick={() => {
                                                    const newSigners = (data.signers as string[]).filter((_, i) => i !== index);
                                                    setData('signers', newSigners);
                                                }}
                                            >
                                                Hapus
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        const currentSigners = Array.isArray(data.signers) ? data.signers : [];
                                        setData('signers', [...currentSigners, '']);
                                    }}
                                    className="w-full"
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Tambah Penanda Tangan
                                </Button>
                                {errors.signers && (
                                    <p className="text-sm text-red-500">{errors.signers}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="file">File Template</Label>
                                <div className="flex w-full items-center justify-center">
                                    <label
                                        htmlFor="file"
                                        className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100"
                                    >
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            <Upload className="mb-4 h-8 w-8 text-gray-500" />
                                            <p className="mb-2 text-sm text-gray-500">
                                                <span className="font-semibold">
                                                    Klik untuk upload
                                                </span>{' '}
                                                atau drag and drop
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                PDF, DOC, DOCX (MAX. 10MB)
                                            </p>
                                        </div>
                                        <input
                                            id="file"
                                            type="file"
                                            className="hidden"
                                            accept=".pdf,.doc,.docx"
                                            onChange={(e) =>
                                                setData(
                                                    'file',
                                                    e.target.files?.[0] || null,
                                                )
                                            }
                                        />
                                    </label>
                                </div>
                                {data.file && (
                                    <p className="text-sm text-green-600">
                                        File terpilih: {data.file.name}
                                    </p>
                                )}
                                {errors.file && (
                                    <p className="text-sm text-red-500">
                                        {errors.file}
                                    </p>
                                )}
                            </div>

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
                                        ? 'Membuat...'
                                        : 'Buat Template'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}

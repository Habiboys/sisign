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
import AppLayout from '@/layouts/app-layout';
import { routes } from '@/utils/routes';
import { Head, useForm } from '@inertiajs/react';
import { FileText, Upload } from 'lucide-react';

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
}

interface Props {
    users: User[];
    user: User;
}

export default function DocumentsCreate({ users, user }: Props) {
    const { data, setData, post, processing, errors } = useForm({
        title: '',
        file: null as File | null,
        to: '',
        number: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(routes.documents.store());
    };

    return (
        <AppLayout>
            <Head title="Ajukan Dokumen" />
            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        Ajukan Dokumen
                    </h1>
                    <p className="text-gray-600">Buat pengajuan dokumen baru</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <FileText className="mr-2 h-5 w-5" />
                            Form Pengajuan Dokumen
                        </CardTitle>
                        <CardDescription>
                            Isi form di bawah ini untuk mengajukan dokumen
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="title">Judul Dokumen</Label>
                                    <Input
                                        id="title"
                                        value={data.title}
                                        onChange={(e) =>
                                            setData('title', e.target.value)
                                        }
                                        placeholder="Masukkan judul dokumen"
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
                                    <Label htmlFor="number">
                                        Nomor Dokumen
                                    </Label>
                                    <Input
                                        id="number"
                                        value={data.number}
                                        onChange={(e) =>
                                            setData('number', e.target.value)
                                        }
                                        placeholder="Masukkan nomor dokumen"
                                        className={
                                            errors.number
                                                ? 'border-red-500'
                                                : ''
                                        }
                                    />
                                    {errors.number && (
                                        <p className="text-sm text-red-500">
                                            {errors.number}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="to">Ditujukan Kepada</Label>
                                <Select
                                    value={data.to}
                                    onValueChange={(value) =>
                                        setData('to', value)
                                    }
                                >
                                    <SelectTrigger
                                        className={
                                            errors.to ? 'border-red-500' : ''
                                        }
                                    >
                                        <SelectValue placeholder="Pilih penerima dokumen" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {users.map((user) => (
                                            <SelectItem
                                                key={user.id}
                                                value={user.id}
                                            >
                                                {user.name} ({user.email})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.to && (
                                    <p className="text-sm text-red-500">
                                        {errors.to}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="file">File Dokumen</Label>
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
                                        ? 'Mengajukan...'
                                        : 'Ajukan Dokumen'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}

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
import { Award } from 'lucide-react';

interface Template {
    id: string;
    title: string;
    description?: string;
}

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
}

interface Props {
    templates: Template[];
    user: User;
}

export default function CertificatesCreate({ templates, user }: Props) {
    const { data, setData, post, processing, errors } = useForm({
        templateSertifId: '',
        nomor_sertif: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(routes.certificates.store());
    };

    return (
        <AppLayout>
            <Head title="Buat Sertifikat" />
            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        Buat Sertifikat
                    </h1>
                    <p className="text-gray-600">
                        Buat sertifikat individual baru
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <Award className="mr-2 h-5 w-5" />
                            Form Sertifikat
                        </CardTitle>
                        <CardDescription>
                            Isi form di bawah ini untuk membuat sertifikat
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="templateSertifId">
                                    Template Sertifikat
                                </Label>
                                <Select
                                    value={data.templateSertifId}
                                    onValueChange={(value) =>
                                        setData('templateSertifId', value)
                                    }
                                >
                                    <SelectTrigger
                                        className={
                                            errors.templateSertifId
                                                ? 'border-red-500'
                                                : ''
                                        }
                                    >
                                        <SelectValue placeholder="Pilih template sertifikat" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {templates.length === 0 ? (
                                            <div className="p-4 text-center text-gray-500">
                                                <p>
                                                    Tidak ada template yang
                                                    tersedia.
                                                </p>
                                                <p className="text-sm">
                                                    Template harus disetujui dan
                                                    ditandatangani pimpinan
                                                    terlebih dahulu.
                                                </p>
                                            </div>
                                        ) : (
                                            templates.map((template) => (
                                                <SelectItem
                                                    key={template.id}
                                                    value={template.id}
                                                >
                                                    {template.title}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                                {errors.templateSertifId && (
                                    <p className="text-sm text-red-500">
                                        {errors.templateSertifId}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="nomor_sertif">
                                    Nomor Sertifikat
                                </Label>
                                <Input
                                    id="nomor_sertif"
                                    value={data.nomor_sertif}
                                    onChange={(e) =>
                                        setData('nomor_sertif', e.target.value)
                                    }
                                    placeholder="Masukkan nomor sertifikat"
                                    className={
                                        errors.nomor_sertif
                                            ? 'border-red-500'
                                            : ''
                                    }
                                />
                                {errors.nomor_sertif && (
                                    <p className="text-sm text-red-500">
                                        {errors.nomor_sertif}
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
                                        : 'Buat Sertifikat'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}

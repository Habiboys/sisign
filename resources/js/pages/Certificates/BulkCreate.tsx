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
import { routes } from '@/utils/routes';
import { Head, useForm } from '@inertiajs/react';
import { Award, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

export default function CertificatesBulkCreate({ templates, user }: Props) {
    console.log('BulkCreate component loaded', { templates, user });
    const { success, error, info } = useToast();

    const { data, setData, post, processing, errors } = useForm({
        templateSertifId: '',
        excel_file: null as File | null,
        passphrase: '',
    });

    console.log('Form state:', { data, errors, processing });
    console.log('Available templates:', templates);
    console.log('Templates count:', templates.length);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Form submit attempted', data);
        
        // Validasi form sebelum submit
        if (!data.templateSertifId) {
            console.error('Template tidak dipilih');
            error('Silakan pilih template sertifikat terlebih dahulu');
            return;
        }
        
        if (!data.excel_file) {
            console.error('File Excel tidak dipilih');
            error('Silakan pilih file Excel terlebih dahulu');
            return;
        }
        
        if (!data.passphrase) {
            console.error('Passphrase tidak diisi');
            error('Silakan masukkan passphrase untuk tanda tangan digital');
            return;
        }
        
        console.log('Form validation passed, submitting...');
        info('Sedang memproses sertifikat...');
        
        // Inertia post with file upload
        post(routes.certificates.generateFromExcel(), {
            forceFormData: true,
            onStart: () => {
                console.log('Form submission started');
            },
            onSuccess: (page) => {
                console.log('Form submission successful', page);
                success('Sertifikat berhasil digenerate!');
            },
            onError: (errors) => {
                console.error('Form submission errors', errors);
                const errorMessage = Object.values(errors).flat().join(', ');
                error('Terjadi kesalahan: ' + errorMessage);
            },
            onFinish: () => {
                console.log('Form submission finished');
            }
        });
    };


    return (
        <AppLayout>
            <Head title="Bulk Generate Sertifikat" />
            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        Bulk Generate Sertifikat
                    </h1>
                    <p className="text-gray-600">
                        Generate sertifikat dalam jumlah besar dari file Excel
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <Award className="mr-2 h-5 w-5" />
                                Form Bulk Generation
                            </CardTitle>
                            <CardDescription>
                                Upload file Excel (.xlsx/.xls) untuk generate
                                sertifikat secara bulk
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
                                                        Template harus disetujui
                                                        dan ditandatangani
                                                        pimpinan terlebih
                                                        dahulu.
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
                                    <Label htmlFor="excel_file">
                                        File Excel (.xlsx/.xls)
                                    </Label>
                                    <div className="flex w-full items-center justify-center">
                                        <label
                                            htmlFor="excel_file"
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
                                                    XLSX, XLS (MAX. 10MB)
                                                </p>
                                            </div>
                                            <input
                                                id="excel_file"
                                                type="file"
                                                className="hidden"
                                                accept=".xlsx,.xls"
                                                onChange={(e) =>
                                                    setData(
                                                        'excel_file',
                                                        e.target.files?.[0] ||
                                                            null,
                                                    )
                                                }
                                            />
                                        </label>
                                    </div>
                                    {data.excel_file && (
                                        <p className="text-sm text-green-600">
                                            File terpilih:{' '}
                                            {data.excel_file.name}
                                        </p>
                                    )}
                                    {errors.excel_file && (
                                        <p className="text-sm text-red-500">
                                            {errors.excel_file}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="passphrase">
                                        Passphrase untuk Tanda Tangan Digital
                                    </Label>
                                    <input
                                        id="passphrase"
                                        type="password"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={data.passphrase}
                                        onChange={(e) =>
                                            setData('passphrase', e.target.value)
                                        }
                                        placeholder="Masukkan passphrase untuk tanda tangan digital"
                                    />
                                    {errors.passphrase && (
                                        <p className="text-sm text-red-500">
                                            {errors.passphrase}
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
                                            ? 'Generating...'
                                            : 'Generate Sertifikat'}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <FileSpreadsheet className="mr-2 h-5 w-5" />
                                Template Excel
                            </CardTitle>
                            <CardDescription>
                                Download template Excel untuk bulk generation
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="rounded-lg bg-gray-50 p-4">
                                <h4 className="mb-2 font-medium">
                                    Format Excel yang diperlukan:
                                </h4>
                                <div className="space-y-1 text-sm text-gray-600">
                                    <p>
                                        <strong>Kolom A:</strong> Nomor
                                        Sertifikat
                                    </p>
                                    <p>
                                        <strong>Kolom B:</strong> Email Penerima
                                    </p>
                                    <p>
                                        <strong>Kolom C:</strong> Tanggal Terbit
                                        (YYYY-MM-DD)
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-lg bg-blue-50 p-4">
                                <h4 className="mb-2 font-medium text-blue-800">
                                    Contoh Data:
                                </h4>
                                <div className="space-y-1 text-sm text-blue-700">
                                    <p>
                                        SERT-001 | user@example.com | 2025-01-01
                                    </p>
                                    <p>
                                        SERT-002 | admin@example.com |
                                        2025-01-02
                                    </p>
                                    <p>
                                        SERT-003 | pimpinan@example.com |
                                        2025-01-03
                                    </p>
                                </div>
                            </div>

                            {data.templateSertifId ? (
                                <Button
                                    onClick={() => {
                                        window.open(
                                            `/templates/${data.templateSertifId}/download-excel-template`,
                                            '_blank',
                                        );
                                    }}
                                    variant="outline"
                                    className="w-full"
                                >
                                    <Download className="mr-2 h-4 w-4" />
                                    Download Template Excel
                                </Button>
                            ) : (
                                <div className="rounded-lg bg-gray-100 p-4 text-center text-gray-500">
                                    Pilih template terlebih dahulu untuk download template Excel
                                </div>
                            )}

                            <div className="rounded-lg bg-yellow-50 p-4">
                                <h4 className="mb-2 font-medium text-yellow-800">
                                    Catatan Penting:
                                </h4>
                                <ul className="space-y-1 text-sm text-yellow-700">
                                    <li>
                                        • Email penerima harus sudah terdaftar
                                        di sistem
                                    </li>
                                    <li>• Nomor sertifikat harus unik</li>
                                    <li>• Format tanggal: YYYY-MM-DD</li>
                                    <li>
                                        • Baris pertama akan diabaikan (header)
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

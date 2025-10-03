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

    const { data, setData, post, processing, errors } = useForm({
        templateSertifId: '',
        excel_file: null as File | null,
    });

    console.log('Form state:', { data, errors, processing });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Form submit attempted', data);
        
        // Inertia post with file upload
        post(routes.certificates.generateFromExcel(), {
            forceFormData: true,
            onStart: () => {
                console.log('Form submission started');
            },
            onSuccess: (page) => {
                console.log('Form submission successful', page);
            },
            onError: (errors) => {
                console.log('Form submission errors', errors);
            },
            onFinish: () => {
                console.log('Form submission finished');
            }
        });
    };

    const downloadTemplate = () => {
        const csvContent =
            'Nomor Sertifikat,Email Penerima,Tanggal Terbit\nSERT-001,user@example.com,2025-01-01\nSERT-002,admin@example.com,2025-01-02';
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'template_sertifikat.csv';
        a.click();
        window.URL.revokeObjectURL(url);
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

                                {/* Download Template Button */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Template Excel</Label>
                                        {data.templateSertifId && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    window.open(
                                                        `/templates/${data.templateSertifId}/download-excel-template`,
                                                        '_blank',
                                                    );
                                                }}
                                                className="text-blue-600 hover:text-blue-700"
                                            >
                                                <Download className="mr-2 h-4 w-4" />
                                                Download Template
                                            </Button>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Pilih template terlebih dahulu untuk
                                        download template Excel
                                    </p>
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

                            <Button
                                onClick={downloadTemplate}
                                variant="outline"
                                className="w-full"
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Download Template Excel
                            </Button>

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

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
import { Badge } from '@/components/ui/badge';
import AppLayout from '@/layouts/app-layout';
import { routes } from '@/utils/routes';
import { Head, useForm, router } from '@inertiajs/react';
import { Award, Download, FileSpreadsheet, Upload, AlertCircle, CheckCircle2, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VariablePosition {
    name: string;
    x: number;
    y: number;
    fontSize?: number;
    alignment?: 'L' | 'C' | 'R';
}

interface Template {
    id: string;
    title: string;
    description?: string;
    signed_template_path?: string;
    variable_positions?: VariablePosition[];
    has_variables_mapped: boolean;
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
    const { success, error, info } = useToast();

    const { data, setData, post, processing, errors } = useForm({
        templateSertifId: '',
        excel_file: null as File | null,
        passphrase: '',
    });

    const selectedTemplate = templates.find(t => t.id === data.templateSertifId);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validasi form sebelum submit
        if (!data.templateSertifId) {
            error('Silakan pilih template sertifikat terlebih dahulu');
            return;
        }

        const template = templates.find(t => t.id === data.templateSertifId);
        if (template && !template.has_variables_mapped) {
            error('Template belum di-mapping variabelnya. Silakan mapping variabel terlebih dahulu.');
            return;
        }
        
        if (!data.excel_file) {
            error('Silakan pilih file Excel terlebih dahulu');
            return;
        }
        
        if (!data.passphrase) {
            error('Silakan masukkan passphrase untuk tanda tangan digital');
            return;
        }
        
        info('Sedang memproses sertifikat...');
        
        // Inertia post with file upload
        post(routes.certificates.generateFromExcel(), {
            forceFormData: true,
            onSuccess: () => {
                success('Sertifikat berhasil digenerate!');
            },
            onError: (errors) => {
                const errorMessage = Object.values(errors).flat().join(', ');
                error('Terjadi kesalahan: ' + errorMessage);
            },
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
                                                        <div className="flex items-center justify-between w-full">
                                                            <span>{template.title}</span>
                                                            {template.has_variables_mapped ? (
                                                                <Badge className="ml-2 bg-green-100 text-green-800 text-xs">
                                                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                                                    Variabel sudah di-mapping
                                                                </Badge>
                                                            ) : (
                                                                <Badge className="ml-2 bg-yellow-100 text-yellow-800 text-xs">
                                                                    <AlertCircle className="h-3 w-3 mr-1" />
                                                                    Belum di-mapping
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                    {selectedTemplate && !selectedTemplate.has_variables_mapped && (
                                        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 mt-2">
                                            <div className="flex items-start">
                                                <AlertCircle className="h-5 w-5 text-yellow-600 mr-2 mt-0.5" />
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-yellow-800">
                                                        Template belum di-mapping variabel
                                                    </p>
                                                    <p className="text-xs text-yellow-700 mt-1">
                                                        Silakan mapping variabel terlebih dahulu sebelum melakukan bulk generate.
                                                    </p>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="mt-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border-yellow-300"
                                                        onClick={() => {
                                                            router.visit(`/templates/${selectedTemplate.id}/map-variables`);
                                                        }}
                                                    >
                                                        <Settings className="h-4 w-4 mr-2" />
                                                        Mapping Variabel
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
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
                            {selectedTemplate && selectedTemplate.has_variables_mapped ? (
                                <>
                                    <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                                        <div className="flex items-center mb-2">
                                            <CheckCircle2 className="h-5 w-5 text-green-600 mr-2" />
                                            <h4 className="font-medium text-green-800">
                                                Variabel Template
                                            </h4>
                                        </div>
                                        <div className="space-y-1 text-sm text-green-700">
                                            {selectedTemplate.variable_positions?.map((variable, index) => (
                                                <div key={index} className="flex items-center">
                                                    <span className="font-medium">Kolom {String.fromCharCode(65 + index)}:</span>
                                                    <span className="ml-2 capitalize">
                                                        {variable.name.replace(/_/g, ' ')}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="rounded-lg bg-blue-50 p-4">
                                        <h4 className="mb-2 font-medium text-blue-800">
                                            Format Excel:
                                        </h4>
                                        <div className="space-y-1 text-sm text-blue-700">
                                            <p className="font-semibold">Baris pertama: Header (akan diabaikan)</p>
                                            <p>Baris berikutnya: Data sesuai urutan variabel di atas</p>
                                        </div>
                                    </div>

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
                                </>
                            ) : selectedTemplate && !selectedTemplate.has_variables_mapped ? (
                                <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
                                    <div className="flex items-start">
                                        <AlertCircle className="h-5 w-5 text-yellow-600 mr-2 mt-0.5" />
                                        <div>
                                            <h4 className="font-medium text-yellow-800 mb-2">
                                                Template belum di-mapping variabel
                                            </h4>
                                            <p className="text-sm text-yellow-700 mb-3">
                                                Silakan mapping variabel terlebih dahulu untuk mengetahui format Excel yang diperlukan.
                                            </p>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border-yellow-300"
                                                onClick={() => {
                                                    router.visit(`/templates/${selectedTemplate.id}/map-variables`);
                                                }}
                                            >
                                                <Settings className="h-4 w-4 mr-2" />
                                                Mapping Variabel
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-lg bg-gray-100 p-4 text-center text-gray-500">
                                    <p>Pilih template terlebih dahulu untuk melihat format Excel</p>
                                </div>
                            )}

                            <div className="rounded-lg bg-gray-50 p-4">
                                <h4 className="mb-2 font-medium">
                                    Catatan Penting:
                                </h4>
                                <ul className="space-y-1 text-sm text-gray-600">
                                    <li>• Nomor sertifikat harus unik</li>
                                    <li>• Format tanggal: YYYY-MM-DD (jika ada kolom tanggal)</li>
                                    <li>• Baris pertama akan diabaikan (header)</li>
                                    <li>• Urutan kolom harus sesuai dengan variabel yang sudah di-mapping</li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}

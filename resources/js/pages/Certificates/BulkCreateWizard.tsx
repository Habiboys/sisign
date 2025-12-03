import { Badge } from '@/components/ui/badge';
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
import { useToast } from '@/hooks/use-toast';
import AppLayout from '@/layouts/app-layout';
import { routes } from '@/utils/routes';
import { Head, router, useForm } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowLeft,
    ArrowRight,
    Award,
    CheckCircle2,
    Download,
    FileSpreadsheet,
    MapPin,
    Upload
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface VariablePosition {
    name: string;
    x: number;
    y: number;
    fontSize?: number;
    fontFamily?: string;
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

type Step = 'select' | 'mapping' | 'upload';

export default function CertificatesBulkCreateWizard({ templates, user }: Props) {
    const { success, error, info } = useToast();
    const [currentStep, setCurrentStep] = useState<Step>('select');
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [variables, setVariables] = useState<VariablePosition[]>([]);
    const [isMappingMode, setIsMappingMode] = useState(false);
    const [newVariableName, setNewVariableName] = useState('');
    const [selectedVariable, setSelectedVariable] = useState<number | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [pdfUrl, setPdfUrl] = useState<string>('');
    const pdfCanvasRef = useRef<HTMLCanvasElement>(null);

    const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

    const { data, setData, post, processing, errors, transform } = useForm({
        templateSertifId: '',
        excel_file: null as File | null,
        passphrase: '',
        variable_positions: [] as VariablePosition[],
    });

    // Load PDF when template is selected
    useEffect(() => {
        if (selectedTemplate?.signed_template_path && selectedTemplate?.id) {
            // Use route to serve PDF instead of direct storage access
            const url = `/templates/${selectedTemplate.id}/signed-pdf`;
            setPdfUrl(url);
            // Load variable positions dari template (jika sudah ada di DB)
            if (selectedTemplate.variable_positions && selectedTemplate.variable_positions.length > 0) {
                setVariables(selectedTemplate.variable_positions);
            } else {
                // Reset variables jika template belum punya mapping
                setVariables([]);
            }
        }
    }, [selectedTemplate]);

    const loadPDF = useCallback(async () => {
        if (!pdfUrl || !pdfCanvasRef.current) return;

        try {
            const pdfjsLib = await import('pdfjs-dist');
            pdfjsLib.GlobalWorkerOptions.workerSrc =
                'https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js';

            const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
            setTotalPages(pdf.numPages);

            const pageData = await pdf.getPage(currentPage);
            const viewport = pageData.getViewport({ scale: 1.5 });

            const canvas = pdfCanvasRef.current;
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            const renderContext = {
                canvasContext: ctx,
                viewport: viewport,
            };

            await pageData.render(renderContext).promise;

            // Draw variable markers
            variables.forEach((variable, index) => {
                ctx.fillStyle = index === selectedVariable ? '#3b82f6' : '#ef4444';
                ctx.beginPath();
                ctx.arc(variable.x, variable.y, 8, 0, 2 * Math.PI);
                ctx.fill();
                ctx.fillStyle = '#000';
                ctx.font = '12px Arial';
                ctx.fillText(variable.name, variable.x + 12, variable.y + 4);
            });
        } catch (err) {
            console.error('Error loading PDF:', err);
            error('Gagal memuat PDF template');
        }
    }, [pdfUrl, currentPage, variables, selectedVariable, error]);

    useEffect(() => {
        if (currentStep === 'mapping' && pdfUrl) {
            loadPDF();
        }
    }, [currentStep, pdfUrl, loadPDF]);

    const handleTemplateSelect = (templateId: string) => {
        setSelectedTemplateId(templateId);
        setData('templateSertifId', templateId);
        const template = templates.find(t => t.id === templateId);
        if (template?.has_variables_mapped) {
            setCurrentStep('upload');
        } else {
            setCurrentStep('mapping');
        }
    };

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isMappingMode || !newVariableName.trim()) {
            if (selectedVariable !== null) {
                // Update selected variable position
                const canvas = pdfCanvasRef.current;
                if (!canvas) return;

                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;

                const x = (e.clientX - rect.left) * scaleX;
                const y = (e.clientY - rect.top) * scaleY;

                const updated = [...variables];
                updated[selectedVariable] = {
                    ...updated[selectedVariable],
                    x: x,
                    y: y,
                };
                setVariables(updated);
                setSelectedVariable(null);
            }
            return;
        }

        const canvas = pdfCanvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        const newVariable: VariablePosition = {
            name: newVariableName.trim(),
            x: x,
            y: y,
            fontSize: 12,
            fontFamily: 'Arial',
            alignment: 'C',
        };
        setVariables([...variables, newVariable]);
        setNewVariableName('');
        setIsMappingMode(false);
    };

    const handleSaveMapping = () => {
        if (variables.length === 0) {
            error('Minimal harus ada 1 variabel');
            return;
        }

        transform((data) => ({
            ...data,
            variable_positions: variables,
        }));

        post(`/templates/${selectedTemplateId}/save-variable-positions`, {
            preserveScroll: true,
            onSuccess: () => {
                success('Posisi variabel berhasil disimpan');

                // Reload page untuk mendapatkan data template terbaru dari server
                router.reload({
                    only: ['templates'],
                    preserveState: false,
                    preserveScroll: false,
                });

                // Auto download template Excel setelah save (dengan delay untuk memastikan DB ter-update)
                // Delay lebih lama untuk memastikan reload selesai
                setTimeout(() => {
                    window.open(
                        `/templates/${selectedTemplateId}/download-excel-template`,
                        '_blank',
                    );
                }, 1500);
                setCurrentStep('upload');
            },
            onError: () => {
                error('Gagal menyimpan posisi variabel');
            },
        });
    };

    const handleUpdateVariable = (index: number, field: keyof VariablePosition, value: any) => {
        const updated = [...variables];
        updated[index] = {
            ...updated[index],
            [field]: value,
        };
        setVariables(updated);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!data.excel_file) {
            error('Silakan pilih file Excel terlebih dahulu');
            return;
        }

        if (!data.passphrase) {
            error('Silakan masukkan passphrase untuk tanda tangan digital');
            return;
        }

        info('Sedang memproses sertifikat...');

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

                {/* Step Indicator */}
                <div className="flex items-center justify-center space-x-4 mb-6">
                    <div className={`flex items-center ${currentStep === 'select' ? 'text-blue-600' : 'text-gray-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'select' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                            1
                        </div>
                        <span className="ml-2 font-medium">Pilih Template</span>
                    </div>
                    <ArrowRight className="text-gray-400" />
                    <div className={`flex items-center ${currentStep === 'mapping' ? 'text-blue-600' : currentStep === 'upload' && selectedTemplate?.has_variables_mapped ? 'text-green-600' : 'text-gray-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'mapping' ? 'bg-blue-600 text-white' : selectedTemplate?.has_variables_mapped ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>
                            {selectedTemplate?.has_variables_mapped ? <CheckCircle2 className="h-5 w-5" /> : '2'}
                        </div>
                        <span className="ml-2 font-medium">Mapping Variabel</span>
                    </div>
                    <ArrowRight className="text-gray-400" />
                    <div className={`flex items-center ${currentStep === 'upload' ? 'text-blue-600' : 'text-gray-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'upload' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                            3
                        </div>
                        <span className="ml-2 font-medium">Upload & Generate</span>
                    </div>
                </div>

                {/* Step 1: Select Template */}
                {currentStep === 'select' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <Award className="mr-2 h-5 w-5" />
                                Pilih Template Sertifikat
                            </CardTitle>
                            <CardDescription>
                                Pilih template yang sudah ditandatangani untuk bulk generation
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <Label>Template Sertifikat</Label>
                                <Select
                                    value={selectedTemplateId}
                                    onValueChange={handleTemplateSelect}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih template sertifikat" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {templates.length === 0 ? (
                                            <div className="p-4 text-center text-gray-500">
                                                <p>Tidak ada template yang tersedia.</p>
                                                <p className="text-sm">
                                                    Template harus disetujui dan ditandatangani pimpinan terlebih dahulu.
                                                </p>
                                            </div>
                                        ) : (
                                            templates.map((template) => (
                                                <SelectItem key={template.id} value={template.id}>
                                                    <div className="flex items-center justify-between w-full">
                                                        <span>{template.title}</span>
                                                        {template.has_variables_mapped ? (
                                                            <Badge className="ml-2 bg-green-100 text-green-800 text-xs">
                                                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                                                Siap
                                                            </Badge>
                                                        ) : (
                                                            <Badge className="ml-2 bg-yellow-100 text-yellow-800 text-xs">
                                                                <AlertCircle className="h-3 w-3 mr-1" />
                                                                Perlu Mapping
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Step 2: Mapping Variables */}
                {currentStep === 'mapping' && selectedTemplate && (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <CardTitle className="flex items-center">
                                    <MapPin className="mr-2 h-5 w-5" />
                                    Mapping Variabel
                                </CardTitle>
                                <CardDescription>
                                    Klik pada PDF untuk menambahkan atau mengubah posisi variabel
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                                disabled={currentPage === 1}
                                            >
                                                Sebelumnya
                                            </Button>
                                            <span className="flex items-center px-4">
                                                Halaman {currentPage} / {totalPages}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                                disabled={currentPage === totalPages}
                                            >
                                                Selanjutnya
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="relative border border-gray-300 rounded-lg overflow-auto bg-gray-50">
                                        <canvas
                                            ref={pdfCanvasRef}
                                            onClick={handleCanvasClick}
                                            className="cursor-crosshair"
                                            style={{ maxWidth: '100%', height: 'auto' }}
                                        />
                                    </div>
                                    <p className="text-sm text-gray-500">
                                        {isMappingMode
                                            ? `Klik pada PDF untuk menambahkan variabel "${newVariableName}"`
                                            : selectedVariable !== null
                                                ? `Klik pada PDF untuk memindahkan variabel "${variables[selectedVariable]?.name}"`
                                                : 'Masukkan nama variabel dan klik "Tambah", lalu klik pada PDF. Atau klik variabel yang sudah ada untuk memindahkannya.'}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Daftar Variabel</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Nama Variabel Baru</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                value={newVariableName}
                                                onChange={(e) => setNewVariableName(e.target.value)}
                                                placeholder="Contoh: nama_lengkap"
                                                onKeyPress={(e) => {
                                                    if (e.key === 'Enter' && newVariableName.trim()) {
                                                        setIsMappingMode(true);
                                                    }
                                                }}
                                            />
                                            <Button
                                                onClick={() => {
                                                    if (newVariableName.trim()) {
                                                        setIsMappingMode(true);
                                                    }
                                                }}
                                                size="sm"
                                                variant="outline"
                                            >
                                                Tambah
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="space-y-2 max-h-96 overflow-y-auto">
                                        {variables.map((variable, index) => (
                                            <div
                                                key={index}
                                                className={`p-3 border rounded ${selectedVariable === index ? 'border-blue-500 bg-blue-50' : ''
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-medium text-sm">{variable.name}</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            setVariables(variables.filter((_, i) => i !== index));
                                                            if (selectedVariable === index) {
                                                                setSelectedVariable(null);
                                                            }
                                                        }}
                                                    >
                                                        ×
                                                    </Button>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                                                        <div>X: {Math.round(variable.x)}</div>
                                                        <div>Y: {Math.round(variable.y)}</div>
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs">Ukuran Font</Label>
                                                        <Input
                                                            type="number"
                                                            min="8"
                                                            max="72"
                                                            value={variable.fontSize || 12}
                                                            onChange={(e) =>
                                                                handleUpdateVariable(
                                                                    index,
                                                                    'fontSize',
                                                                    parseInt(e.target.value) || 12
                                                                )
                                                            }
                                                            className="h-8 text-xs"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs">Jenis Font</Label>
                                                        <Select
                                                            value={variable.fontFamily || 'Arial'}
                                                            onValueChange={(value) =>
                                                                handleUpdateVariable(index, 'fontFamily', value)
                                                            }
                                                        >
                                                            <SelectTrigger className="h-8 text-xs">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="Arial">Arial</SelectItem>
                                                                <SelectItem value="Times">Times</SelectItem>
                                                                <SelectItem value="Courier">Courier</SelectItem>
                                                                <SelectItem value="Helvetica">Helvetica</SelectItem>
                                                                <SelectItem value="Times-Roman">Times Roman</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs">Alignment</Label>
                                                        <Select
                                                            value={variable.alignment || 'C'}
                                                            onValueChange={(value: 'L' | 'C' | 'R') =>
                                                                handleUpdateVariable(index, 'alignment', value)
                                                            }
                                                        >
                                                            <SelectTrigger className="h-8 text-xs">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="L">Kiri</SelectItem>
                                                                <SelectItem value="C">Tengah</SelectItem>
                                                                <SelectItem value="R">Kanan</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full"
                                                        onClick={() => setSelectedVariable(selectedVariable === index ? null : index)}
                                                    >
                                                        {selectedVariable === index ? 'Batal Pilih' : 'Pilih untuk Pindahkan'}
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                        {variables.length === 0 && (
                                            <p className="text-sm text-gray-500 text-center py-4">
                                                Belum ada variabel. Tambahkan variabel baru di atas.
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        {variables.length > 0 && (
                                            <Button
                                                onClick={() => {
                                                    window.open(
                                                        `/templates/${selectedTemplateId}/download-excel-template`,
                                                        '_blank',
                                                    );
                                                }}
                                                variant="outline"
                                                className="w-full"
                                            >
                                                <Download className="mr-2 h-4 w-4" />
                                                Download Template Excel
                                            </Button>
                                        )}
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                onClick={() => setCurrentStep('select')}
                                                className="flex-1"
                                            >
                                                <ArrowLeft className="h-4 w-4 mr-2" />
                                                Kembali
                                            </Button>
                                            <Button
                                                onClick={handleSaveMapping}
                                                disabled={variables.length === 0 || processing}
                                                className="flex-1 bg-green-600 hover:bg-green-700"
                                            >
                                                Simpan & Lanjut
                                                <ArrowRight className="h-4 w-4 ml-2" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                {/* Step 3: Upload Excel */}
                {currentStep === 'upload' && selectedTemplate && (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center">
                                    <Upload className="mr-2 h-5 w-5" />
                                    Upload File Excel
                                </CardTitle>
                                <CardDescription>
                                    Upload file Excel sesuai dengan format template
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="space-y-2">
                                        <Label>File Excel (.xlsx/.xls)</Label>
                                        <div className="flex w-full items-center justify-center">
                                            <label
                                                htmlFor="excel_file"
                                                className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100"
                                            >
                                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                    <Upload className="mb-4 h-8 w-8 text-gray-500" />
                                                    <p className="mb-2 text-sm text-gray-500">
                                                        <span className="font-semibold">Klik untuk upload</span> atau drag and drop
                                                    </p>
                                                    <p className="text-xs text-gray-500">XLSX, XLS (MAX. 10MB)</p>
                                                </div>
                                                <input
                                                    id="excel_file"
                                                    type="file"
                                                    className="hidden"
                                                    accept=".xlsx,.xls"
                                                    onChange={(e) => setData('excel_file', e.target.files?.[0] || null)}
                                                />
                                            </label>
                                        </div>
                                        {data.excel_file && (
                                            <p className="text-sm text-green-600">
                                                File terpilih: {data.excel_file.name}
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Passphrase untuk Tanda Tangan Digital</Label>
                                        <Input
                                            type="password"
                                            value={data.passphrase}
                                            onChange={(e) => setData('passphrase', e.target.value)}
                                            placeholder="Masukkan passphrase"
                                        />
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setCurrentStep(selectedTemplate.has_variables_mapped ? 'select' : 'mapping')}
                                            className="flex-1"
                                        >
                                            <ArrowLeft className="h-4 w-4 mr-2" />
                                            Kembali
                                        </Button>
                                        <Button
                                            type="submit"
                                            className="flex-1 bg-green-600 hover:bg-green-700"
                                            disabled={processing}
                                        >
                                            {processing ? 'Generating...' : 'Generate Sertifikat'}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center">
                                    <FileSpreadsheet className="mr-2 h-5 w-5" />
                                    Format Excel
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {selectedTemplate.has_variables_mapped && selectedTemplate.variable_positions && (
                                    <>
                                        <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                                            <div className="flex items-center mb-2">
                                                <CheckCircle2 className="h-5 w-5 text-green-600 mr-2" />
                                                <h4 className="font-medium text-green-800">Variabel Template</h4>
                                            </div>
                                            <div className="space-y-1 text-sm text-green-700">
                                                {selectedTemplate.variable_positions.map((variable, index) => (
                                                    <div key={index} className="flex items-center">
                                                        <span className="font-medium">Kolom {String.fromCharCode(65 + index)}:</span>
                                                        <span className="ml-2 capitalize">{variable.name.replace(/_/g, ' ')}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <Button
                                            onClick={() => {
                                                window.open(
                                                    `/templates/${selectedTemplateId}/download-excel-template`,
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
                                )}

                                <div className="rounded-lg bg-gray-50 p-4">
                                    <h4 className="mb-2 font-medium">Catatan Penting:</h4>
                                    <ul className="space-y-1 text-sm text-gray-600">
                                        <li>• Nomor sertifikat harus unik</li>
                                        <li>• Format tanggal: YYYY-MM-DD</li>
                                        <li>• Baris pertama akan diabaikan (header)</li>
                                        <li>• Urutan kolom harus sesuai variabel</li>
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}


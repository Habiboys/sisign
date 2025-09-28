import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import {
    Calendar,
    Code,
    Copy,
    Download,
    FileText,
    Hash,
    User,
} from 'lucide-react';

interface Props {
    user: any;
}

export default function TemplateVariablesGuide({ user }: Props) {
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const variables = [
        {
            icon: <User className="h-5 w-5" />,
            category: 'Data Penerima',
            color: 'bg-blue-50 border-blue-200',
            items: [
                {
                    variable: '{{nama_penerima}}',
                    description: 'Nama lengkap penerima',
                    example: 'John Doe',
                },
                {
                    variable: '{{email_penerima}}',
                    description: 'Email penerima',
                    example: 'john@example.com',
                },
                {
                    variable: '{{nama_lengkap}}',
                    description: 'Nama lengkap dari Excel',
                    example: 'Dr. John Doe, S.Kom',
                },
                {
                    variable: '{{jabatan}}',
                    description: 'Jabatan dari Excel',
                    example: 'Manager IT',
                },
                {
                    variable: '{{departemen}}',
                    description: 'Departemen dari Excel',
                    example: 'Information Technology',
                },
            ],
        },
        {
            icon: <Hash className="h-5 w-5" />,
            category: 'Data Sertifikat',
            color: 'bg-green-50 border-green-200',
            items: [
                {
                    variable: '{{nomor_sertifikat}}',
                    description: 'Nomor unik sertifikat',
                    example: 'SERT-2025-001',
                },
                {
                    variable: '{{tanggal_terbit}}',
                    description: 'Tanggal terbit',
                    example: '28 September 2025',
                },
                {
                    variable: '{{tanggal_terbit_short}}',
                    description: 'Tanggal format pendek',
                    example: '28/09/2025',
                },
                {
                    variable: '{{tanggal_custom}}',
                    description: 'Tanggal dari Excel',
                    example: '15 Agustus 2025',
                },
            ],
        },
        {
            icon: <FileText className="h-5 w-5" />,
            category: 'Data Template',
            color: 'bg-purple-50 border-purple-200',
            items: [
                {
                    variable: '{{judul_template}}',
                    description: 'Judul template',
                    example: 'Sertifikat Pelatihan',
                },
                {
                    variable: '{{deskripsi_template}}',
                    description: 'Deskripsi template',
                    example: 'Pelatihan 3 hari',
                },
            ],
        },
        {
            icon: <Calendar className="h-5 w-5" />,
            category: 'Data Sistem',
            color: 'bg-orange-50 border-orange-200',
            items: [
                {
                    variable: '{{tanggal_generate}}',
                    description: 'Tanggal generate',
                    example: '28 September 2025',
                },
                {
                    variable: '{{tahun_sekarang}}',
                    description: 'Tahun saat ini',
                    example: '2025',
                },
                {
                    variable: '{{bulan_sekarang}}',
                    description: 'Bulan saat ini',
                    example: 'September',
                },
            ],
        },
    ];

    const formattingExamples = [
        {
            title: 'Format Tanggal',
            examples: [
                { code: '{{tanggal_terbit|d/m/Y}}', result: '28/09/2025' },
                {
                    code: '{{tanggal_terbit|d F Y}}',
                    result: '28 September 2025',
                },
                {
                    code: '{{tanggal_terbit|l, j F Y}}',
                    result: 'Sabtu, 28 September 2025',
                },
            ],
        },
        {
            title: 'Format Teks',
            examples: [
                { code: '{{nama_penerima|upper}}', result: 'JOHN DOE' },
                { code: '{{nama_penerima|lower}}', result: 'john doe' },
                { code: '{{nama_penerima|title}}', result: 'John Doe' },
            ],
        },
    ];

    const templateExample = `SERTIFIKAT
{{judul_template}}

Diberikan kepada:
{{nama_penerima}}
{{jabatan}} - {{departemen}}

Nomor Sertifikat: {{nomor_sertifikat}}
Tanggal Terbit: {{tanggal_terbit|d F Y}}

Atas prestasi dan dedikasi yang luar biasa.

Jakarta, {{tanggal_terbit|d F Y}}

_________________________
Direktur`;

    return (
        <AuthenticatedLayout user={user}>
            <Head title="Panduan Template Sertifikat" />

            <div className="py-12">
                <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
                    <div className="mb-8">
                        <h1 className="mb-4 text-3xl font-bold text-gray-900">
                            📋 Panduan Template Sertifikat
                        </h1>
                        <p className="text-lg text-gray-600">
                            Variable yang tersedia dan cara penggunaannya dalam
                            template sertifikat.
                        </p>
                    </div>

                    <div className="mb-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
                        {variables.map((category, index) => (
                            <Card key={index} className={`${category.color}`}>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        {category.icon}
                                        {category.category}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {category.items.map(
                                            (item, itemIndex) => (
                                                <div
                                                    key={itemIndex}
                                                    className="flex items-center justify-between rounded-lg border bg-white p-3"
                                                >
                                                    <div className="flex-1">
                                                        <div className="mb-1 flex items-center gap-2">
                                                            <Badge
                                                                variant="outline"
                                                                className="font-mono text-xs"
                                                            >
                                                                {item.variable}
                                                            </Badge>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() =>
                                                                    copyToClipboard(
                                                                        item.variable,
                                                                    )
                                                                }
                                                                className="h-6 w-6 p-0"
                                                            >
                                                                <Copy className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                        <p className="text-sm text-gray-600">
                                                            {item.description}
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            Contoh:{' '}
                                                            {item.example}
                                                        </p>
                                                    </div>
                                                </div>
                                            ),
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <div className="mb-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
                        {formattingExamples.map((section, index) => (
                            <Card key={index}>
                                <CardHeader>
                                    <CardTitle>{section.title}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {section.examples.map(
                                            (example, exIndex) => (
                                                <div
                                                    key={exIndex}
                                                    className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                                                >
                                                    <div className="flex-1">
                                                        <code className="rounded bg-blue-100 px-2 py-1 text-sm">
                                                            {example.code}
                                                        </code>
                                                        <div className="mt-1 text-sm text-gray-600">
                                                            → {example.result}
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            copyToClipboard(
                                                                example.code,
                                                            )
                                                        }
                                                        className="h-6 w-6 p-0"
                                                    >
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ),
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <Card className="mb-8">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Code className="h-5 w-5" />
                                Contoh Template Lengkap
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                <div>
                                    <h4 className="mb-2 font-semibold">
                                        Template Code:
                                    </h4>
                                    <div className="rounded-lg bg-gray-900 p-4 font-mono text-sm whitespace-pre-wrap text-green-400">
                                        {templateExample}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="mb-2 font-semibold">
                                        Hasil Output:
                                    </h4>
                                    <div className="rounded-lg bg-blue-50 p-4 text-sm whitespace-pre-wrap">
                                        SERTIFIKAT Sertifikat Pelatihan Digital
                                        Marketing Diberikan kepada: John Doe
                                        Manager IT - Information Technology
                                        Nomor Sertifikat: SERT-2025-001 Tanggal
                                        Terbit: 28 September 2025 Atas prestasi
                                        dan dedikasi yang luar biasa. Jakarta,
                                        28 September 2025
                                        _________________________ Direktur
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        <Card className="border-yellow-200 bg-yellow-50">
                            <CardHeader>
                                <CardTitle className="text-yellow-800">
                                    💡 Tips Penting
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2 text-sm text-yellow-700">
                                    <li>
                                        • Gunakan variable yang sesuai dengan
                                        data
                                    </li>
                                    <li>• Test template dengan data sample</li>
                                    <li>• Sisakan space untuk signature</li>
                                    <li>• Gunakan formatting yang konsisten</li>
                                </ul>
                            </CardContent>
                        </Card>

                        <Card className="border-green-200 bg-green-50">
                            <CardHeader>
                                <CardTitle className="text-green-800">
                                    ✅ Best Practices
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2 text-sm text-green-700">
                                    <li>
                                        • Font minimal 10pt untuk readability
                                    </li>
                                    <li>
                                        • Kontras yang baik teks vs background
                                    </li>
                                    <li>• Layout yang professional</li>
                                    <li>• Margin yang cukup di semua sisi</li>
                                </ul>
                            </CardContent>
                        </Card>

                        <Card className="border-blue-200 bg-blue-50">
                            <CardHeader>
                                <CardTitle className="text-blue-800">
                                    📥 Download Template
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="mb-3 text-sm text-blue-700">
                                    Download template HTML sebagai referensi
                                    untuk membuat template sertifikat.
                                </p>
                                <Button
                                    onClick={() =>
                                        window.open(
                                            '/template-guide/download-example',
                                            '_blank',
                                        )
                                    }
                                    className="w-full bg-blue-600 hover:bg-blue-700"
                                >
                                    <Download className="mr-2 h-4 w-4" />
                                    Download Template
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}


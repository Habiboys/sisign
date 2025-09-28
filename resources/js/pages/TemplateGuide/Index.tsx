import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import {
    CheckCircle,
    Code,
    Copy,
    Download,
    FileText,
    Palette,
} from 'lucide-react';

interface Variable {
    variable: string;
    description: string;
    source: string;
    example: string;
}

interface Variables {
    basic: Record<string, Variable>;
    excel: Record<string, Variable>;
    template: Record<string, Variable>;
    system: Record<string, Variable>;
}

interface Formatting {
    date: Record<string, string>;
    text: Record<string, string>;
    number: Record<string, string>;
}

interface Example {
    title: string;
    content: string;
    result: string;
}

interface Examples {
    basic_template: Example;
    excel_template: Example;
    professional_template: Example;
}

interface BestPractices {
    design: string[];
    variables: string[];
    layout: string[];
}

interface Props {
    variables: Variables;
    formatting: Formatting;
    examples: Examples;
    best_practices: BestPractices;
    user: any;
}

export default function TemplateGuideIndex({
    variables,
    formatting,
    examples,
    best_practices,
    user,
}: Props) {
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const downloadExampleTemplate = () => {
        window.open('/template-guide/download-example', '_blank');
    };

    return (
        <AuthenticatedLayout user={user}>
            <Head title="Panduan Template Sertifikat" />

            <div className="py-12">
                <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
                    <div className="overflow-hidden bg-white shadow-sm sm:rounded-lg">
                        <div className="p-6">
                            <div className="mb-8">
                                <h1 className="mb-4 text-3xl font-bold text-gray-900">
                                    📋 Panduan Template Sertifikat
                                </h1>
                                <p className="text-lg text-gray-600">
                                    Pelajari cara membuat template sertifikat
                                    yang professional dengan variable yang
                                    tersedia.
                                </p>
                            </div>

                            <Tabs defaultValue="variables" className="w-full">
                                <TabsList className="grid w-full grid-cols-4">
                                    <TabsTrigger value="variables">
                                        Variables
                                    </TabsTrigger>
                                    <TabsTrigger value="formatting">
                                        Formatting
                                    </TabsTrigger>
                                    <TabsTrigger value="examples">
                                        Contoh
                                    </TabsTrigger>
                                    <TabsTrigger value="practices">
                                        Best Practices
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent
                                    value="variables"
                                    className="space-y-6"
                                >
                                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                        {Object.entries(variables).map(
                                            ([category, vars]) => (
                                                <Card key={category}>
                                                    <CardHeader>
                                                        <CardTitle className="flex items-center gap-2">
                                                            {category ===
                                                                'basic' && (
                                                                <FileText className="h-5 w-5" />
                                                            )}
                                                            {category ===
                                                                'excel' && (
                                                                <Code className="h-5 w-5" />
                                                            )}
                                                            {category ===
                                                                'template' && (
                                                                <Palette className="h-5 w-5" />
                                                            )}
                                                            {category ===
                                                                'system' && (
                                                                <CheckCircle className="h-5 w-5" />
                                                            )}
                                                            {category
                                                                .charAt(0)
                                                                .toUpperCase() +
                                                                category.slice(
                                                                    1,
                                                                )}{' '}
                                                            Variables
                                                        </CardTitle>
                                                        <CardDescription>
                                                            {category ===
                                                                'basic' &&
                                                                'Variable dasar dari database user'}
                                                            {category ===
                                                                'excel' &&
                                                                'Variable dari data Excel yang diupload'}
                                                            {category ===
                                                                'template' &&
                                                                'Variable dari template sertifikat'}
                                                            {category ===
                                                                'system' &&
                                                                'Variable sistem dan tanggal'}
                                                        </CardDescription>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="space-y-4">
                                                            {Object.entries(
                                                                vars,
                                                            ).map(
                                                                ([
                                                                    key,
                                                                    variable,
                                                                ]) => (
                                                                    <div
                                                                        key={
                                                                            key
                                                                        }
                                                                        className="rounded-lg border p-4"
                                                                    >
                                                                        <div className="mb-2 flex items-center justify-between">
                                                                            <Badge
                                                                                variant="secondary"
                                                                                className="font-mono"
                                                                            >
                                                                                {
                                                                                    variable.variable
                                                                                }
                                                                            </Badge>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() =>
                                                                                    copyToClipboard(
                                                                                        variable.variable,
                                                                                    )
                                                                                }
                                                                            >
                                                                                <Copy className="h-4 w-4" />
                                                                            </Button>
                                                                        </div>
                                                                        <p className="mb-1 text-sm text-gray-600">
                                                                            {
                                                                                variable.description
                                                                            }
                                                                        </p>
                                                                        <p className="mb-2 text-xs text-gray-500">
                                                                            Source:{' '}
                                                                            {
                                                                                variable.source
                                                                            }
                                                                        </p>
                                                                        <div className="rounded bg-gray-50 p-2 font-mono text-sm">
                                                                            {
                                                                                variable.example
                                                                            }
                                                                        </div>
                                                                    </div>
                                                                ),
                                                            )}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ),
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent
                                    value="formatting"
                                    className="space-y-6"
                                >
                                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                                        {Object.entries(formatting).map(
                                            ([type, formats]) => (
                                                <Card key={type}>
                                                    <CardHeader>
                                                        <CardTitle className="capitalize">
                                                            {type} Formatting
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="space-y-3">
                                                            {Object.entries(
                                                                formats,
                                                            ).map(
                                                                ([
                                                                    format,
                                                                    result,
                                                                ]) => (
                                                                    <div
                                                                        key={
                                                                            format
                                                                        }
                                                                        className="rounded border p-3"
                                                                    >
                                                                        <div className="mb-1 flex items-center justify-between">
                                                                            <code className="rounded bg-blue-50 px-2 py-1 text-sm">
                                                                                {
                                                                                    format
                                                                                }
                                                                            </code>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() =>
                                                                                    copyToClipboard(
                                                                                        format,
                                                                                    )
                                                                                }
                                                                            >
                                                                                <Copy className="h-3 w-3" />
                                                                            </Button>
                                                                        </div>
                                                                        <div className="text-sm text-gray-600">
                                                                            →{' '}
                                                                            {
                                                                                result
                                                                            }
                                                                        </div>
                                                                    </div>
                                                                ),
                                                            )}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ),
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent
                                    value="examples"
                                    className="space-y-6"
                                >
                                    <div className="space-y-6">
                                        {Object.entries(examples).map(
                                            ([key, example]) => (
                                                <Card key={key}>
                                                    <CardHeader>
                                                        <CardTitle>
                                                            {example.title}
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                                            <div>
                                                                <h4 className="mb-2 font-semibold">
                                                                    Template
                                                                    Code:
                                                                </h4>
                                                                <div className="rounded-lg bg-gray-900 p-4 font-mono text-sm whitespace-pre-wrap text-green-400">
                                                                    {
                                                                        example.content
                                                                    }
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <h4 className="mb-2 font-semibold">
                                                                    Hasil
                                                                    Output:
                                                                </h4>
                                                                <div className="rounded-lg bg-blue-50 p-4 text-sm whitespace-pre-wrap">
                                                                    {
                                                                        example.result
                                                                    }
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ),
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent
                                    value="practices"
                                    className="space-y-6"
                                >
                                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                                        {Object.entries(best_practices).map(
                                            ([category, practices]) => (
                                                <Card key={category}>
                                                    <CardHeader>
                                                        <CardTitle className="capitalize">
                                                            {category}{' '}
                                                            Guidelines
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <ul className="space-y-2">
                                                            {practices.map(
                                                                (
                                                                    practice,
                                                                    index,
                                                                ) => (
                                                                    <li
                                                                        key={
                                                                            index
                                                                        }
                                                                        className="flex items-start gap-2"
                                                                    >
                                                                        <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                                                                        <span className="text-sm">
                                                                            {
                                                                                practice
                                                                            }
                                                                        </span>
                                                                    </li>
                                                                ),
                                                            )}
                                                        </ul>
                                                    </CardContent>
                                                </Card>
                                            ),
                                        )}
                                    </div>
                                </TabsContent>
                            </Tabs>

                            <div className="mt-8 rounded-lg bg-blue-50 p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-semibold text-blue-900">
                                            📥 Download Template Contoh
                                        </h3>
                                        <p className="text-blue-700">
                                            Download file HTML template sebagai
                                            referensi untuk membuat template
                                            sertifikat.
                                        </p>
                                    </div>
                                    <Button
                                        onClick={downloadExampleTemplate}
                                        className="bg-blue-600 hover:bg-blue-700"
                                    >
                                        <Download className="mr-2 h-4 w-4" />
                                        Download Template
                                    </Button>
                                </div>
                            </div>

                            <div className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                                <h4 className="mb-2 font-semibold text-yellow-800">
                                    💡 Tips Penting:
                                </h4>
                                <ul className="space-y-1 text-sm text-yellow-700">
                                    <li>
                                        • Gunakan variable yang sesuai dengan
                                        data yang tersedia
                                    </li>
                                    <li>
                                        • Test template dengan data sample
                                        sebelum deploy
                                    </li>
                                    <li>
                                        • Pastikan signature area tidak tertutup
                                        variable
                                    </li>
                                    <li>
                                        • Gunakan formatting yang konsisten
                                        untuk tanggal dan nama
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}


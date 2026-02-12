import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import AppLayout from '@/layouts/app-layout';
import { Head, router } from '@inertiajs/react';
import { AlertCircle, CheckCircle, Loader2, Mail, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Props {
    batchId: string;
}

interface BatchStatus {
    id: string;
    progress: number;
    finished: boolean;
    cancelled: boolean;
    failedJobs: number;
    processedJobs: number;
    totalJobs: number;
}

export default function EmailProgress({ batchId }: Props) {
    const [status, setStatus] = useState<BatchStatus | null>(null);
    const [polling, setPolling] = useState(true);

    useEffect(() => {
        if (!polling) return;

        const poll = setInterval(() => {
            fetch(`/certificates/email-batch-status/${batchId}`)
                .then((res) => res.json())
                .then((data) => {
                    setStatus(data);
                    if (data.finished || data.cancelled) {
                        setPolling(false);
                    }
                })
                .catch((err) => {
                    console.error('Failed to poll email batch status', err);
                    setPolling(false);
                });
        }, 2000);

        return () => clearInterval(poll);
    }, [batchId, polling]);

    const successCount = status ? Math.max(0, status.processedJobs - status.failedJobs) : 0;
    const hasErrors = status && status.failedJobs > 0;
    const allSuccess = status?.finished && !hasErrors;

    return (
        <AppLayout>
            <Head title="Mengirim Email..." />
            <div className="flex h-full flex-1 flex-col items-center justify-center p-6">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="text-center flex items-center justify-center gap-2">
                            <Mail className="h-5 w-5" />
                            {status?.finished ? 'Selesai!' : 'Mengirim Email...'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm text-gray-500">
                                <span>Progress</span>
                                <span>{status?.progress || 0}%</span>
                            </div>
                            <Progress value={status?.progress || 0} className="h-2" />
                        </div>

                        {status && (
                            <div className="space-y-2">
                                <div className="text-center text-sm text-gray-600 mb-3">
                                    {status.processedJobs} / {status.totalJobs} email diproses
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-center">
                                    <div className="rounded-lg bg-green-50 p-3">
                                        <div className="flex items-center justify-center gap-2 text-green-600">
                                            <CheckCircle className="h-5 w-5" />
                                            <span className="font-bold">{successCount}</span>
                                        </div>
                                        <p className="text-xs text-green-700 mt-1">Terkirim</p>
                                    </div>
                                    <div className="rounded-lg bg-red-50 p-3">
                                        <div className="flex items-center justify-center gap-2 text-red-600">
                                            <XCircle className="h-5 w-5" />
                                            <span className="font-bold">{status.failedJobs}</span>
                                        </div>
                                        <p className="text-xs text-red-700 mt-1">Gagal</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Success Alert */}
                        {allSuccess && (
                            <Alert className="border-green-200 bg-green-50">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <AlertTitle className="text-green-900">Berhasil!</AlertTitle>
                                <AlertDescription className="text-green-800">
                                    Semua {status.totalJobs} email berhasil dikirim.
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Error Alert */}
                        {status?.finished && hasErrors && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Perhatian</AlertTitle>
                                <AlertDescription>
                                    {successCount} email berhasil dikirim, {status.failedJobs} email gagal.
                                    {status.failedJobs > 0 && (
                                        <span className="block mt-1 text-sm">
                                            Periksa log untuk detail error.
                                        </span>
                                    )}
                                </AlertDescription>
                            </Alert>
                        )}

                        {status?.finished && (
                            <Button
                                className="w-full"
                                onClick={() => router.visit('/certificates')}
                            >
                                Kembali ke Daftar Sertifikat
                            </Button>
                        )}

                        {!status?.finished && (
                            <div className="flex justify-center">
                                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}


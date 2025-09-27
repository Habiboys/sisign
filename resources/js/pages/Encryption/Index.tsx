import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { Head, useForm } from '@inertiajs/react';
import React, { useState } from 'react';

interface KeyInfo {
    created_at: string;
    key_size: number;
    key_type: string;
    algorithm: string;
    public_key_fingerprint: string;
}

interface EncryptionIndexProps {
    hasKeys: boolean;
    keyInfo?: KeyInfo;
    publicKey?: string;
}

export default function EncryptionIndex({
    hasKeys,
    keyInfo,
    publicKey,
}: EncryptionIndexProps) {
    const [showGenerateForm, setShowGenerateForm] = useState(false);
    const [showTestForm, setShowTestForm] = useState(false);
    const [testResults, setTestResults] = useState<any>(null);

    const generateForm = useForm({
        passphrase: '',
        confirm_passphrase: '',
    });

    const testForm = useForm({
        test_data: 'Hello, this is a test message for encryption!',
        passphrase: '',
    });

    const deleteForm = useForm({
        confirmation: '',
    });

    const handleGenerateKeys = (e: React.FormEvent) => {
        e.preventDefault();

        generateForm.post('/encryption/generate-keys', {
            onSuccess: (page: any) => {
                if (page.props?.success) {
                    alert(page.props.success);
                } else {
                    alert('Encryption keys generated successfully!');
                }
                setShowGenerateForm(false);
                window.location.reload();
            },
            onError: (errors: any) => {
                console.error('Key generation error:', errors);
                let errorMessage = 'Failed to generate keys';

                if (errors.error) {
                    errorMessage = errors.error;
                } else if (errors.message) {
                    errorMessage = errors.message;
                } else if (typeof errors === 'string') {
                    errorMessage = errors;
                }

                alert(errorMessage);
            },
        });
    };

    const handleTestEncryption = (e: React.FormEvent) => {
        e.preventDefault();

        testForm.post('/encryption/test', {
            onSuccess: (response: any) => {
                setTestResults(response.props?.test_results);
            },
            onError: (errors: any) => {
                alert(errors.message || 'Test failed');
            },
        });
    };

    const handleDeleteKeys = (e: React.FormEvent) => {
        e.preventDefault();

        if (deleteForm.data.confirmation !== 'DELETE') {
            alert('Please type DELETE to confirm');
            return;
        }

        deleteForm.delete('/encryption/delete-keys', {
            onSuccess: () => {
                alert('Encryption keys deleted successfully');
                window.location.reload();
            },
            onError: (errors: any) => {
                alert(errors.message || 'Failed to delete keys');
            },
        });
    };

    const downloadPublicKey = () => {
        window.open('/encryption/download-public-key', '_blank');
    };

    return (
        <AppLayout>
            <Head title="Encryption Keys Management" />
            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            Manajemen Kunci Enkripsi
                        </h1>
                        <p className="text-gray-600">
                            Kelola kunci kriptografi untuk tanda tangan digital
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {/* Current Keys Status */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Status Kunci Saat Ini</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {hasKeys ? (
                                <div className="space-y-4">
                                    <div className="flex items-center">
                                        <div className="mr-3 h-3 w-3 rounded-full bg-green-500"></div>
                                        <span className="font-medium text-green-600">
                                            Kunci Telah Dibuat
                                        </span>
                                    </div>

                                    {keyInfo && (
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">
                                                    Tipe Kunci:
                                                </span>
                                                <span className="font-medium">
                                                    {keyInfo.key_type}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">
                                                    Ukuran Kunci:
                                                </span>
                                                <span className="font-medium">
                                                    {keyInfo.key_size} bits
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">
                                                    Algoritma:
                                                </span>
                                                <span className="font-medium">
                                                    {keyInfo.algorithm}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">
                                                    Dibuat:
                                                </span>
                                                <span className="font-medium">
                                                    {new Date(
                                                        keyInfo.created_at,
                                                    ).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">
                                                    Fingerprint:
                                                </span>
                                                <span className="font-mono text-xs">
                                                    {
                                                        keyInfo.public_key_fingerprint
                                                    }
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex space-x-2 pt-4">
                                        <Button
                                            onClick={downloadPublicKey}
                                            variant="outline"
                                            size="sm"
                                        >
                                            Unduh Kunci Publik
                                        </Button>
                                        <Button
                                            onClick={() =>
                                                setShowTestForm(true)
                                            }
                                            variant="outline"
                                            size="sm"
                                        >
                                            Test Enkripsi
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center">
                                        <div className="mr-3 h-3 w-3 rounded-full bg-red-500"></div>
                                        <span className="font-medium text-red-600">
                                            Belum Ada Kunci
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600">
                                        Anda perlu membuat kunci enkripsi untuk
                                        menggunakan tanda tangan digital.
                                    </p>
                                    <Button
                                        onClick={() =>
                                            setShowGenerateForm(true)
                                        }
                                        className="w-full"
                                    >
                                        Buat Kunci Baru
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Key Management Actions */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Manajemen Kunci</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                                <h4 className="mb-2 font-medium text-blue-800">
                                    Tentang Tanda Tangan Digital
                                </h4>
                                <ul className="space-y-1 text-sm text-blue-700">
                                    <li>• Menggunakan enkripsi RSA 2048-bit</li>
                                    <li>• Algoritma hashing SHA-256</li>
                                    <li>• Aman secara kriptografi</li>
                                    <li>
                                        • Tahan manipulasi dan tidak dapat
                                        disangkal
                                    </li>
                                    <li>
                                        • Mengikat secara hukum di banyak
                                        yurisdiksi
                                    </li>
                                </ul>
                            </div>

                            {hasKeys && (
                                <div className="space-y-3">
                                    <Button
                                        onClick={() =>
                                            setShowGenerateForm(true)
                                        }
                                        variant="outline"
                                        className="w-full"
                                    >
                                        Buat Ulang Kunci
                                    </Button>

                                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                                        <h4 className="mb-2 font-medium text-yellow-800">
                                            ⚠️ Area Berbahaya
                                        </h4>
                                        <p className="mb-3 text-sm text-yellow-700">
                                            Menghapus kunci akan membuat semua
                                            tanda tangan digital yang ada
                                            menjadi tidak valid.
                                        </p>
                                        <Button
                                            onClick={() =>
                                                deleteForm.setData(
                                                    'confirmation',
                                                    'DELETE',
                                                )
                                            }
                                            variant="destructive"
                                            size="sm"
                                            className="w-full"
                                        >
                                            Hapus Kunci
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Generate Keys Form */}
                {showGenerateForm && (
                    <Card className="mt-4">
                        <CardHeader>
                            <CardTitle>Buat Kunci Enkripsi Baru</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form
                                onSubmit={handleGenerateKeys}
                                className="space-y-4"
                            >
                                <div>
                                    <label className="mb-2 block text-sm font-medium">
                                        Kata Sandi (Opsional)
                                    </label>
                                    <input
                                        type="password"
                                        value={generateForm.data.passphrase}
                                        onChange={(e) =>
                                            generateForm.setData(
                                                'passphrase',
                                                e.target.value,
                                            )
                                        }
                                        className="w-full rounded-md border px-3 py-2"
                                        placeholder="Masukkan kata sandi untuk mengenkripsi kunci privat Anda"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        Biarkan kosong untuk kunci privat tidak
                                        terenkripsi (tidak disarankan)
                                    </p>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium">
                                        Konfirmasi Kata Sandi
                                    </label>
                                    <input
                                        type="password"
                                        value={
                                            generateForm.data.confirm_passphrase
                                        }
                                        onChange={(e) =>
                                            generateForm.setData(
                                                'confirm_passphrase',
                                                e.target.value,
                                            )
                                        }
                                        className="w-full rounded-md border px-3 py-2"
                                        placeholder="Konfirmasi kata sandi Anda"
                                    />
                                </div>

                                <div className="flex justify-end space-x-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() =>
                                            setShowGenerateForm(false)
                                        }
                                    >
                                        Batal
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={generateForm.processing}
                                    >
                                        {generateForm.processing
                                            ? 'Membuat...'
                                            : 'Buat Kunci'}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {/* Test Encryption Form */}
                {showTestForm && (
                    <Card className="mt-4">
                        <CardHeader>
                            <CardTitle>
                                Test Enkripsi & Penandatanganan
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form
                                onSubmit={handleTestEncryption}
                                className="space-y-4"
                            >
                                <div>
                                    <label className="mb-2 block text-sm font-medium">
                                        Pesan Test
                                    </label>
                                    <textarea
                                        value={testForm.data.test_data}
                                        onChange={(e) =>
                                            testForm.setData(
                                                'test_data',
                                                e.target.value,
                                            )
                                        }
                                        className="w-full rounded-md border px-3 py-2"
                                        rows={3}
                                        placeholder="Masukkan pesan untuk test enkripsi"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium">
                                        Kata Sandi (jika diset)
                                    </label>
                                    <input
                                        type="password"
                                        value={testForm.data.passphrase}
                                        onChange={(e) =>
                                            testForm.setData(
                                                'passphrase',
                                                e.target.value,
                                            )
                                        }
                                        className="w-full rounded-md border px-3 py-2"
                                        placeholder="Masukkan kata sandi kunci privat Anda"
                                    />
                                </div>

                                <div className="flex justify-end space-x-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setShowTestForm(false)}
                                    >
                                        Batal
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={testForm.processing}
                                    >
                                        {testForm.processing
                                            ? 'Menguji...'
                                            : 'Jalankan Test'}
                                    </Button>
                                </div>
                            </form>

                            {testResults && (
                                <div className="mt-6 rounded-lg bg-gray-50 p-4">
                                    <h4 className="mb-3 font-medium">
                                        Hasil Test
                                    </h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span>Test Enkripsi:</span>
                                            <span
                                                className={
                                                    testResults.encryption_success
                                                        ? 'text-green-600'
                                                        : 'text-red-600'
                                                }
                                            >
                                                {testResults.encryption_success
                                                    ? '✓ Berhasil'
                                                    : '✗ Gagal'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Test Tanda Tangan:</span>
                                            <span
                                                className={
                                                    testResults.signature_valid
                                                        ? 'text-green-600'
                                                        : 'text-red-600'
                                                }
                                            >
                                                {testResults.signature_valid
                                                    ? '✓ Valid'
                                                    : '✗ Tidak Valid'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Keseluruhan:</span>
                                            <span
                                                className={
                                                    testResults.all_tests_passed
                                                        ? 'font-medium text-green-600'
                                                        : 'font-medium text-red-600'
                                                }
                                            >
                                                {testResults.all_tests_passed
                                                    ? '✓ Semua Test Berhasil'
                                                    : '✗ Beberapa Test Gagal'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </AppLayout>
    );
}
